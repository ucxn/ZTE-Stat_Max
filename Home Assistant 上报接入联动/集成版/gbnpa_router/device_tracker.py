"""
GBNPA 设备位置平台（可选，初始表单里勾选“设备位置”才会加载）

做两件事：
1. 为每台设备建一个 device_tracker（在家/离家），属性里带接入路由、信号强度、所在房间；
2. 按脚本上报的 via_mac 把设备挂到对应的“接入路由”设备下面（网关 → 接入路由 → 终端）。

流量实体怎么摆由 sensor 模式 1-4 决定，这里完全不碰，两条轴互不影响。
"""
from homeassistant.components.device_tracker import ScannerEntity
from homeassistant.core import callback
from homeassistant.helpers import area_registry as ar, device_registry as dr
from homeassistant.helpers.dispatcher import async_dispatcher_connect

DOMAIN = "gbnpa_router"
SIGNAL_UPDATE = f"{DOMAIN}_data_update"
SIGNAL_DISCOVERY = f"{DOMAIN}_discovery"

GATEWAY_ID = (DOMAIN, "gateway")
# 与 sensor 里 offline / offline_shield 的判断一致，再加上脚本快照里的中文“下线”
OFFLINE_STATUSES = {"off", "offline", "offline_shield", "下线"}


async def async_setup_entry(hass, config_entry, async_add_entities):
    store = hass.data[DOMAIN]
    dev_reg = dr.async_get(hass)
    state = store.setdefault("_tracker", {"known": set(), "via": {}, "rooms": {}})
    known, applied = state["known"], state["via"]

    def ensure_gateway():
        return dev_reg.async_get_or_create(
            config_entry_id=config_entry.entry_id,
            identifiers={GATEWAY_ID},
            name="[哥哥科技] GBNPA 核心网关",
            manufacturer="哥哥科技",
            model="态势感知中枢",
        )

    def ensure_device(mac, info):
        # 给设备补上 MAC 连接：ScannerEntity 只能按 MAC 连接找到设备卡片，找不到会默认禁用
        return dev_reg.async_get_or_create(
            config_entry_id=config_entry.entry_id,
            identifiers={(DOMAIN, mac)},
            connections={(dr.CONNECTION_NETWORK_MAC, dr.format_mac(mac))},
            name=info.get("name") or mac,
            model=info.get("ip") or "家庭网络设备",
        )

    def apply_parent(mac, info):
        """via_mac 或路由名变了才动设备注册表；字段缺失（大包未到）或离线时原地不动。"""
        key = (info.get("via_mac"), info.get("via"))
        if key[0] is None or applied.get(mac) == key or str(info.get("status", "")).lower() in OFFLINE_STATUSES:
            return
        dev = dev_reg.async_get_device_by_identifier((DOMAIN, mac), config_entry.entry_id)
        if dev is None:
            return
        gateway = ensure_gateway()
        if key[0]:
            # 制造商借来装路由名：设备列表按制造商分组，就是“一台路由一组”，路由自己靠 [AP] 前缀排在组首
            name = key[1] or key[0]
            parent = dev_reg.async_get_or_create(
                config_entry_id=config_entry.entry_id,
                identifiers={(DOMAIN, f"router_{key[0]}")},
                name=f"[AP] {name}",
                manufacturer=name,
                model="接入路由",
                via_device_id=gateway.id,
            )
        else:
            parent = gateway  # via_mac 为空串：挂在主路由 / 网关下
        if dev.via_device_id != parent.id or dev.manufacturer != parent.manufacturer:
            dev_reg.async_update_device(dev.id, via_device_id=parent.id, manufacturer=parent.manufacturer)
        applied[mac] = key

    @callback
    def discover():
        new_entities = []
        for mac, info in store.get("devices", {}).items():
            if not mac or mac in known:
                continue
            known.add(mac)
            ensure_device(mac, info)
            apply_parent(mac, info)
            new_entities.append(GbnpaTracker(hass, mac))
        if new_entities:
            async_add_entities(new_entities)

    @callback
    def on_update():
        for mac, info in store.get("devices", {}).items():
            if mac in known:
                apply_parent(mac, info)

    config_entry.async_on_unload(async_dispatcher_connect(hass, SIGNAL_DISCOVERY, discover))
    config_entry.async_on_unload(async_dispatcher_connect(hass, SIGNAL_UPDATE, on_update))

    @callback
    def on_registry(event):
        # 房间只在用户手动改区域时才会变，把查询挪到这一下点击上，推送的热路径只剩一次字典取值
        if "area_id" in event.data.get("changes", ()):
            state["rooms"].clear()

    config_entry.async_on_unload(hass.bus.async_listen(dr.EVENT_DEVICE_REGISTRY_UPDATED, on_registry))
    # 重载时直接吃现存内存数据
    known.clear()
    applied.clear()
    state["rooms"].clear()
    discover()


class GbnpaTracker(ScannerEntity):
    """单设备在线状态（在家/离家）"""

    def __init__(self, hass, mac):
        self.hass = hass
        self._mac = mac
        safe_mac = mac.replace(":", "").replace("-", "").lower()
        self.entity_id = f"device_tracker.gbnpa_device_{safe_mac}"
        self._attr_mac_address = dr.format_mac(mac)
        self._attr_unique_id = f"gbnpa_{safe_mac}_tracker"

    @property
    def _data(self):
        return self.hass.data[DOMAIN]["devices"].get(self._mac, {})

    @property
    def unique_id(self):
        # ScannerEntity 默认拿 MAC 当 unique_id；这里改成和 sensor 同一套命名，清理服务才找得到
        return self._attr_unique_id

    @property
    def name(self):
        return self._data.get("name") or self._mac

    @property
    def ip_address(self):
        return self._data.get("ip") or None

    hostname = name

    @property
    def is_connected(self) -> bool:
        status = str(self._data.get("status", "")).lower()
        return bool(status) and status not in OFFLINE_STATUSES

    @property
    def extra_state_attributes(self):
        info = self._data
        attrs = {}
        via_mac = info.get("via_mac")
        if via_mac is not None:
            attrs["via_mac"] = via_mac
            if info.get("via"):
                attrs["via"] = info["via"]
            attrs["room"] = self._room(via_mac)
        if info.get("rssi") is not None:
            attrs["rssi"] = info["rssi"]
        return attrs

    def _room(self, via_mac):
        """所在房间 = 接入路由设备被用户分到的区域；via_mac 为空串（挂主路由）时看网关设备的区域。"""
        rooms = self.hass.data[DOMAIN]["_tracker"]["rooms"]
        if via_mac in rooms:
            return rooms[via_mac]
        dev_reg = dr.async_get(self.hass)
        ident = (DOMAIN, f"router_{via_mac}") if via_mac else GATEWAY_ID
        dev = dev_reg.async_get_device_by_identifier(ident, self.platform.config_entry.entry_id)
        area = dev and dev.area_id and ar.async_get(self.hass).async_get_area(dev.area_id)
        rooms[via_mac] = name = area.name if area else None
        return name

    async def async_added_to_hass(self):
        self.async_on_remove(
            async_dispatcher_connect(self.hass, SIGNAL_UPDATE, self.async_write_ha_state)
        )
