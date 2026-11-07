import voluptuous as vol
from homeassistant import config_entries

DOMAIN = "gbnpa_router"
SENSOR_MODES = {
    1: "独立隐藏实体模式 (数据独立，可长期追踪，推荐)",
    2: "附加属性折叠模式 (极简面板，不生成多余实体)",
    3: "附加属性折叠模式 (自动添加可能存在的实体，汉化)",
    4: "独立隐藏实体模式 (包含网页计算的微积分流量值)"
}

class GbnpaConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None):
        data_schema = vol.Schema({
            vol.Required("sensor_mode", default=1): vol.In(SENSOR_MODES),
            vol.Required("webhook_secret"): str,
            # 设备位置：在家/离家 + 按接入路由分组；默认不勾，想改就重新添加集成
            vol.Optional("enable_tracker", default=False): bool,
        })

        if user_input is not None:
            user_input["webhook_secret"] = user_input["webhook_secret"].strip()
            if not user_input["webhook_secret"]:
                return self.async_show_form(
                    step_id="user",
                    data_schema=data_schema,
                    errors={"webhook_secret": "required"},
                )
            return self.async_create_entry(title="哥哥科技中枢", data=user_input)

        return self.async_show_form(step_id="user", data_schema=data_schema)