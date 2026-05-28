"""
GBNPA Sensor 路由代理
基于配置向导动态挂载不同的底层文件
"""

async def async_setup_entry(hass, config_entry, async_add_entities):
    # 提取状态码
    current_mode = config_entry.data.get("sensor_mode", 1)
    
    # 极客魔法：运行时动态模块挂载 (Dynamic Import)
    if current_mode == 1:
        from .sensor1 import async_setup_entry as setup_impl
    elif current_mode == 2:
        from .sensor2 import async_setup_entry as setup_impl
    else:
        # 防御性回退
        from .sensor1 import async_setup_entry as setup_impl

    # 将 HA 传过来的最高权限上下文，原封不动地转发给真正的脚本
    await setup_impl(hass, config_entry, async_add_entities)