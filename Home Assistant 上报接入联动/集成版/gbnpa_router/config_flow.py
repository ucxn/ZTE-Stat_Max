import voluptuous as vol
from homeassistant import config_entries

DOMAIN = "gbnpa_router"
SENSOR_MODES = {
    1: "独立隐藏实体模式 (数据独立，可长期追踪，推荐)",
    2: "附加属性折叠模式 (极简面板，不生成多余实体)"
}

class GbnpaConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None):
        if user_input is not None:
            return self.async_create_entry(title="哥哥科技中枢", data=user_input)

        data_schema = vol.Schema({vol.Required("sensor_mode", default=1): vol.In(SENSOR_MODES)})
        return self.async_show_form(step_id="user", data_schema=data_schema)