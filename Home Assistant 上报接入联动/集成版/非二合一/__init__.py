import logging
import json
from aiohttp import web
from homeassistant.core import HomeAssistant
from homeassistant.config_entries import ConfigEntry
from homeassistant.components import webhook
from homeassistant.helpers.dispatcher import async_dispatcher_send

DOMAIN = "gbnpa_router"
# 保持和你油猴脚本里的 webhook 路径一致！
WEBHOOK_ID = "gbnpa_router_webhook" 
SIGNAL_UPDATE = f"{DOMAIN}_data_update"
PLATFORMS = ["sensor"]

_LOGGER = logging.getLogger(__name__)

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """通过 UI 配置初始化集成"""
    hass.data.setdefault(DOMAIN, {"devices": {}, "global": {}, "time_str": None})

    async def handle_webhook(hass, webhook_id, request):
        """处理油猴发来的 JSON 数据包"""
        try:
            text = await request.text()
            raw_payload = json.loads(text)
            data = raw_payload.get("payload", raw_payload)
            
            # 更新内存数据
            hass.data[DOMAIN]["time_str"] = data.get("time_str")
            if "global" in data:
                hass.data[DOMAIN]["global"].update(data["global"])
            if "devices" in data:
                hass.data[DOMAIN]["devices"].update(data["devices"])
                
            # 广播通知实体主数据已刷新
            async_dispatcher_send(hass, SIGNAL_UPDATE)
            
            return web.Response(text="GBNPA Payload Received OK")
        except Exception as e:
            _LOGGER.error(f"解析 GBNPA 数据包失败: {e}")
            return web.Response(status=400)

    webhook.async_register(hass, DOMAIN, "GBNPA Router Sync", WEBHOOK_ID, handle_webhook)
    
    # 引导加载 sensor 平台
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """卸载集成时的清理工作"""
    webhook.async_unregister(hass, WEBHOOK_ID)
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)