# GBNPA Autonomous Network - Webhook Payload Parser
# Author: 哥哥科技
# Version: V3.0


# 0. 核心载荷提取与防御性预检
payload = data.get("payload", {})
if not payload:
    logger.warning("[GBNPA] 警告：收到无效或空数据包，链路可能出现异常抖动。")

global_name_map = {
    "wan_up": "WAN总上传",
    "wan_down": "WAN总下载",
    "lan_high_up": "LAN总上行",
    "lan_high_down": "LAN总下行",
    "lan_off_up": "高精流量↑上行",
    "lan_off_down": "高精流量↓下行"
}
global_data = payload.get("global", {})
devices_data = payload.get("devices", {})
sync_timestamp = payload.get("timestamp")
sync_time_str = payload.get("time_str")

# ================== [新增] 探针心跳监控 ==================
if sync_timestamp:
    hass.states.set("sensor.gbnpa_last_sync_ms", sync_time_str, {
        "friendly_name": "[哥哥科技] 探针最后握手时间",
        "icon": "mdi:heart-pulse",
        "raw_timestamp_ms": sync_timestamp})

# ================== 1. 大盘总账引擎 ==================
for key, value in global_data.items():
    # 不管前端传来 null/空串/乱码，一律清洗为干净的整数
    try:
        clean_val = int(float(value)) if value is not None else 0
    except (ValueError, TypeError):
        clean_val = 0

    entity_id = f"sensor.gbnpa_global_{key}"
    cn_name = global_name_map.get(key, key.upper())
    hass.states.set(entity_id, clean_val, {
        "friendly_name": f"[哥哥科技大盘]  {cn_name}",
        "unit_of_measurement": "B",       # 原始字节
        "state_class": "total_increasing",# LTS引擎触发器
        "device_class": "data_size",      # 触发HA原生单位换算
        "icon": "mdi:router-network"})

# ================== 2. 微观节点引擎 ==================
for mac, stats in devices_data.items():
    if not mac:
        continue
    # MAC 地址清洗确保符合 HA 实体命名
    safe_mac = str(mac).replace(":", "_").replace("-", "_").strip().lower()
    device_name = stats.get("name", mac)

    # 提取上下行数据 (DRY原则循环)
    for direction in ["up", "down"]:
        raw_val = stats.get(direction, 0)
        try:
            clean_val = int(float(raw_val)) if raw_val is not None else 0
        except (ValueError, TypeError):
            clean_val = 0

        entity_id = f"sensor.gbnpa_device_{safe_mac}_{direction}"
        hass.states.set(entity_id, clean_val, {
            "friendly_name": f"[哥哥科技] {device_name} {direction}",
            "unit_of_measurement": "B",
            "state_class": "total_increasing",
            "device_class": "data_size",
            "icon": "mdi:upload" if direction == "up" else "mdi:download"
        })

    # 提取并独立注册“防回流护盾”状态
    status_entity = f"sensor.gbnpa_device_{safe_mac}_status"
    current_status = stats.get("status", "unknown")
   # 状态值与图标的中文映射引擎
    if current_status == "offline_shield":
        display_status, icon = "断线护盾生效中", "mdi:shield-check"
    else:
        display_status, icon = f"在线 ({current_status})", "mdi:lan-connect"
    # 将写入 HA 的实体状态(State)从英文更改为中文，并应用缩句后的友好名称
    hass.states.set(status_entity, display_status, {
        "friendly_name": f"[哥哥科技] {device_name} 状态",
        "icon": icon
    })