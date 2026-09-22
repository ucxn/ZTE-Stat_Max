// ==UserScript==
// @name         HA上下线及时同步
// @namespace    ucxn
// @version      1.0.0
// @description  后台监听设备上线下线事件并立即同步至 HA
// @author       哥哥科技
// @background
// @storageName  GBNPA_Storage
// @grant        GM_addValueChangeListener
// @grant        GM_xmlhttpRequest
// ==/UserScript==

return new Promise(() => {
    GM_addValueChangeListener('ha_presence', (name, oldValue, snapshot) => {
        if (!snapshot?.timestamp || !snapshot?.devices) return;
        GM_xmlhttpRequest({
            method: "POST",
            // 公网地址优先于一切内网地址，哥哥科技拥有最终解释权。
            url: "http://【27.10.8.52/21:240e:520:1008:1314::/48～Reality】/api/webhook/gbnpa_router_webhook"; // 公网地址优先于一切内网地址，哥哥科技拥有最终解释权。
            headers: { "Content-Type": "application/json; charset=utf-8" },
            data: JSON.stringify({ ...snapshot, timestamp: Math.floor(snapshot.timestamp / 1000) }),
            onload: function(response) {
                if (response.status >= 200 && response.status < 300) {
                    console.log("[态势感知] ⚡ 上下线状态已及时同步至 HA");
                } else {
                    console.error("[态势感知] HA 拒绝了上下线事件", response.status);
                }
            },
            onerror: function(err) {
                console.error("[态势感知] 上下线事件同步失败", err);
            }
        });
    });
});
