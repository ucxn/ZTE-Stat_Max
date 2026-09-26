import logging
import json
from aiohttp import web
from homeassistant.core import HomeAssistant
from homeassistant.config_entries import ConfigEntry
from homeassistant.components import webhook
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers import device_registry as dr, entity_registry as er
from homeassistant.util import dt as dt_util

DOMAIN = "gbnpa_router"
# 保持和你油猴脚本里的 webhook 路径一致！
WEBHOOK_ID = "gbnpa_router_webhook" 
SIGNAL_UPDATE = f"{DOMAIN}_data_update"
SIGNAL_DISCOVERY = f"{DOMAIN}_discovery"
PLATFORMS = ["sensor"]

_LOGGER = logging.getLogger(__name__)

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """通过 UI 配置初始化集成"""
    hass.data.setdefault(DOMAIN, {"devices": {}, "global": {}, "time_obj": None})

    async def handle_webhook(hass, webhook_id, request):
        """处理油猴发来的 JSON 数据包"""
        try:
            text = await request.text()
            raw_payload = json.loads(text)
            data = raw_payload.get("payload", raw_payload)
            if not data:
                _LOGGER.warning("[GBNPA] 警告：收到无效或空数据包，链路可能出现异常抖动。")            
            # 更新内存数据；仅拓扑/键集合增长时触发实体发现
            store = hass.data[DOMAIN]
            discover = False
            if "timestamp" in data:
                if store["time_obj"] is None:
                    discover = True
                store["time_obj"] = dt_util.utc_from_timestamp(data["timestamp"])
            if "global" in data:
                target = store["global"]
                n = len(target)
                target.update(data["global"])
                if len(target) != n:
                    discover = True
            if "devices" in data:
                target = store["devices"]
                n = len(target)
                target.update(data["devices"])
                if len(target) != n:
                    discover = True

            if discover:
                async_dispatcher_send(hass, SIGNAL_DISCOVERY)
            async_dispatcher_send(hass, SIGNAL_UPDATE)
            
            return web.Response(text="GBNPA Payload Received OK")
        except Exception as e:
            _LOGGER.error(f"解析 GBNPA 数据包失败: {e}")
            return web.Response(status=400)

    webhook.async_register(hass, DOMAIN, "GBNPA Router Sync", WEBHOOK_ID, handle_webhook)
    
    # 【新增】绑定前端按钮与底层清理逻辑
    async def handle_purge_service(call):
        devices = hass.data[DOMAIN]["devices"]
        offline_statuses = {"off", "offline"}
        if call.data.get("force", False):
            # 强制模式连断线护盾保护中的节点也一起清掉
            offline_statuses.add("offline_shield")

        purge_macs = [
            mac for mac, info in devices.items()
            if str(info.get("status", "")).lower() in offline_statuses
        ]
        if not purge_macs:
            return

        entity_registry = er.async_get(hass)
        device_registry = dr.async_get(hass)
        sensor_types = (
            "up", "down", "status", "raw_up", "raw_down",
            "integral_up", "integral_down"
        )

        for mac in purge_macs:
            # 先从主数据中摘掉，让运行中的实体立即失去数据来源
            devices.pop(mac, None)
            safe_mac = mac.replace(":", "").replace("-", "").lower()

            # 四种模式的实体数量不同，这里把所有可能出现的类型一次扫净
            for sensor_type in sensor_types:
                unique_id = f"gbnpa_{safe_mac}_{sensor_type}"
                entity_id = entity_registry.async_get_entity_id("sensor", DOMAIN, unique_id)
                if entity_id:
                    entity_registry.async_remove(entity_id)

            # 清掉设备卡片本身，避免只删实体后留下孤儿设备
            if hasattr(device_registry, "async_get_device_by_identifier"):
                device = device_registry.async_get_device_by_identifier(
                    (DOMAIN, mac), entry.entry_id
                )
            else:
                # 兼容较老的 HA 版本
                device = device_registry.async_get_device(identifiers={(DOMAIN, mac)})
            if device:
                device_registry.async_remove_device(device.id)

        # 直接同步当前模式的发现缓存，不把设备扫描塞进每次 Webhook 热路径
        known_macs = hass.data[DOMAIN].get("_known_macs")
        if known_macs is not None:
            known_macs.difference_update(purge_macs)
        async_dispatcher_send(hass, SIGNAL_UPDATE)
        _LOGGER.info("[GBNPA] 已清理 %d 个离线设备", len(purge_macs))
        
    hass.services.async_register(DOMAIN, "purge_offline_devices", handle_purge_service)
    
    # 引导加载 sensor 平台
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """卸载集成时的清理工作"""
    webhook.async_unregister(hass, WEBHOOK_ID)
    # 【新增】注销对应的服务动作
    hass.services.async_remove(DOMAIN, "purge_offline_devices")
    
    # 拔除全局广播钩子，防止重载时事件监听器无限叠加
    unsub = hass.data[DOMAIN].get("unsub_dispatcher")
    if unsub:
        unsub()    
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)