from homeassistant.components.sensor import SensorEntity, SensorStateClass, SensorDeviceClass
from homeassistant.helpers.dispatcher import async_dispatcher_connect

DOMAIN = "gbnpa_router"
SIGNAL_UPDATE = f"{DOMAIN}_data_update"

GLOBAL_NAME_MAP = {
    "wan_up": "WAN总上传",
    "wan_down": "WAN总下载",
    "lan_high_up": "LAN总上行",
    "lan_high_down": "LAN总下行",
    "lan_off_up": "高精流量↑上行",
    "lan_off_down": "高精流量↓下行"
}

async def async_setup_entry(hass, config_entry, async_add_entities):
    """动态生成实体与设备"""
    known_macs = set()
    global_added = False

    async def async_discover_new_entities():
        nonlocal global_added
        data = hass.data[DOMAIN]
        new_entities = []
        
        # 1. 注册全局大盘设备
        if not global_added and data.get("time_str"):
            global_added = True
            # 加入探针时间
            new_entities.append(
                GbnpaGlobalSensor(hass, "time_str", "探针最后握手", "mdi:clock-check-outline", is_traffic=False)
            )
            # 动态遍历注入所有大盘流量实体
            for key, value in data.get("global", {}).items():
                cn_name = GLOBAL_NAME_MAP.get(key, key.upper())
                icon = "mdi:upload-network" if "up" in key else "mdi:download-network"
                new_entities.append(
                    GbnpaGlobalSensor(hass, key, cn_name, icon, is_traffic=True)
                )
            
        # 2. 动态发现新加入的内网节点 MAC
        for mac, info in data.get("devices", {}).items():
            if not mac:
                continue
            if mac not in known_macs:
                known_macs.add(mac)
                device_name = info.get("name", mac) # 继承前端洗净的中文名
                
                # 自动聚合为一个设备
                new_entities.extend([
                    GbnpaDeviceSensor(hass, mac, "up", device_name, is_traffic=True),
                    GbnpaDeviceSensor(hass, mac, "down", device_name, is_traffic=True),
                    GbnpaDeviceSensor(hass, mac, "status", device_name, is_traffic=False)
                ])
                
        # 3. 批量推入 HA
        if new_entities:
            async_add_entities(new_entities)

    # 监听 Webhook，并保存注销句柄
    hass.data[DOMAIN]["unsub_dispatcher"] = async_dispatcher_connect(
        hass, SIGNAL_UPDATE, async_discover_new_entities
    )


class GbnpaGlobalSensor(SensorEntity):
    """大盘数据实体（归属于网关设备）"""
    def __init__(self, hass, dict_key, name, icon, is_traffic):
        self.hass = hass
        self._key = dict_key
        self._is_traffic = is_traffic
        
        # 核心1：实体本
        self._attr_unique_id = f"gbnpa_global_{dict_key}"
        # 加上专属前缀
        self.entity_id = f"sensor.gbnpa_global_{dict_key}"
        self._attr_name = f"[哥哥科技大盘] {name}"
        self._attr_icon = icon
        
        if is_traffic:
            self._attr_native_unit_of_measurement = "bit"
            self._attr_state_class = SensorStateClass.TOTAL_INCREASING
            self._attr_device_class = SensorDeviceClass.DATA_SIZE

    @property
    def device_info(self):
        """核心2：将实体绑定到统一的『网关设备』卡片下"""
        return {
            "identifiers": {(DOMAIN, "gateway")},
            "name": "[哥哥科技] GBNPA 核心网关",
            "manufacturer": "哥哥科技",
            "model": "态势感知中枢",
        }

    @property
    def native_value(self):
        # 探针时间原样返回
        if self._key == "time_str":
            return self.hass.data[DOMAIN].get("time_str")
            
        # 清洗防御机制 (DRY 原则)
        raw_val = self.hass.data[DOMAIN]["global"].get(self._key)
        if self._is_traffic:
            if raw_val is None:
                return None  # 遇到空值直接返回 None 冻结，绝不返 0
            try:
                return int(float(raw_val))
            except (ValueError, TypeError):
                return None  # 遇到乱码同样冻结
        return raw_val if raw_val is not None else 0

    async def async_added_to_hass(self):
        self.async_on_remove(
            async_dispatcher_connect(self.hass, SIGNAL_UPDATE, self.async_write_ha_state)
        )


class GbnpaDeviceSensor(SensorEntity):
    """单设备数据实体（归属于各自的节点设备）"""
    def __init__(self, hass, mac, sensor_type, device_name, is_traffic):
        self.hass = hass
        self._mac = mac
        self._type = sensor_type
        self._device_name = device_name
        self._is_traffic = is_traffic
        
        # MAC清洗，确保命名符合 HA 规范
        safe_mac = mac.replace(":", "").replace("-", "").lower()
        self.entity_id = f"sensor.gbnpa_device_{safe_mac}_{sensor_type}"
        self._attr_unique_id = f"gbnpa_{safe_mac}_{sensor_type}"
        
        # 名称处理
        self._attr_has_entity_name = True
        type_cn = {"up": "上传", "down": "下载", "status": "状态"}.get(sensor_type, sensor_type)
        self._attr_name = type_cn
        
        # 精华：流量数据加上 b 和 device_class
        if is_traffic:
            self._attr_native_unit_of_measurement = "bit"
            self._attr_state_class = SensorStateClass.TOTAL_INCREASING
            self._attr_device_class = SensorDeviceClass.DATA_SIZE

    @property
    def device_info(self):
        device_data = self.hass.data[DOMAIN]["devices"].get(self._mac, {})
        ip_addr = device_data.get("ip")
        model_display = ip_addr if ip_addr else "家庭网络设备"
        """核心2：将实体绑定到以 MAC 为唯一标识的『设备卡片』下"""
        return {
            "identifiers": {(DOMAIN, self._mac)},
            "name": self._device_name,
            "manufacturer": "哥哥科技 GBNPA",
            "model": model_display,
        }

    @property
    def icon(self):
        """原版精华：动态图标渲染引擎"""
        if self._is_traffic:
            return "mdi:upload" if self._type == "up" else "mdi:download"
        
        # 状态图标联动
        raw_status = self.hass.data[DOMAIN]["devices"].get(self._mac, {}).get("status", "unknown")
        return "mdi:shield-check" if raw_status == "offline_shield" else "mdi:lan-connect"

    @property
    def native_value(self):
        device_data = self.hass.data[DOMAIN]["devices"].get(self._mac, {})
        raw_val = device_data.get(self._type)

        # 1. 流量数据走强转防御，阻断归零陷阱
        if self._is_traffic:
            if raw_val is None:
                return None  # 断线或网页关闭时返回 None，让 HA 状态机挂起
            try:
                return int(float(raw_val))
            except (ValueError, TypeError):
                return None
                
        # 2. 状态数据走中文翻译引擎
        if self._type == "status":
            raw_status = raw_val if raw_val else "unknown"
            if raw_status == "offline_shield":
                return "断线护盾生效中"
            return f"在线 ({raw_status})"
            
        return raw_val
    @property
    def extra_state_attributes(self):
        """核心重构：将次要高精数据作为附加属性收纳（副册美学）"""
        device_data = self.hass.data[DOMAIN]["devices"].get(self._mac, {})
        attrs = {}
        
        # 1. 将原生流量分别挂载到对应主力流量实体的属性中
        if self._type == "up":
            raw_up = device_data.get("raw_up")
            if raw_up is not None:
                attrs["raw_up_bit"] = raw_up
        elif self._type == "down":
            raw_down = device_data.get("raw_down")
            if raw_down is not None:
                attrs["raw_down_bit"] = raw_down
                
        # 2. 状态实体里顺手塞入 IP 等静态元数据，实现极致收纳
        elif self._type == "status":
            ip_addr = device_data.get("ip")
            if ip_addr:
                attrs["ip_address"] = ip_addr
                
        return attrs if attrs else None
    
    async def async_added_to_hass(self):
        self.async_on_remove(
            async_dispatcher_connect(self.hass, SIGNAL_UPDATE, self.async_write_ha_state)
        )