// ==UserScript==
// @name         态势感知探针 (HA Webhook)
// @namespace    ucxn
// @version      1.0.0
// @description  后台静默运行，每10分钟定点收割路由数据并送往HA
// @author       哥哥科技
// @background
// @crontab      */10 * * * *
// @match        10.3.1.1
// @storageName  GBNPA_Storage
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest

// ==/UserScript==

return new Promise((resolve, reject) => {
    // 1. 从共享黑板读取前台留下的快照
    let snapshot = GM_getValue('ha_snapshot');
    
    if (!snapshot) {
        console.warn("[态势感知] 黑板为空，前台 UI 可能未启动");
        resolve(); return;
    }

    // 防御机制：如果时间戳超过15分钟没更新，说明前台网页挂了或电脑休眠了
    if (Date.now() - snapshot.timestamp > 900000) {
        console.warn("[态势感知] 数据已过期，放弃本次上报");
        resolve(); return;
    }

    if (snapshot.timestamp) {
        let snapshotTime = new Date(snapshot.timestamp);
        let pad = (n) => n.toString().padStart(2, '0');
        // 将翻译好的时间字符串直接挂载到 snapshot 对象上
        snapshot.time_str = `${snapshotTime.getFullYear()}-${pad(snapshotTime.getMonth()+1)}-${pad(snapshotTime.getDate())} ${pad(snapshotTime.getHours())}:${pad(snapshotTime.getMinutes())}:${pad(snapshotTime.getSeconds())}`;
    }

    // 2. 将快照推向 HA Webhook
    const webhookUrl = "http://27.10.8.52:8123/api/webhook/gbnpa_router_webhook";

    GM_xmlhttpRequest({
        method: "POST",
        url: webhookUrl,
        headers: { "Content-Type": "application/json; charset=utf-8" },
        data: JSON.stringify(snapshot),
        onload: function(response) {
            if (response.status >= 200 && response.status < 300) {
                console.log("[态势感知] ⚡ 10分钟快照已成功空投至 HA");
                resolve("上报成功");
            } else {
                console.error("[态势感知] HA 拒绝了请求", response.status);
                reject(new CATRetryError("HA 服务端异常", 10)); // 10秒后系统底层自动重试！
            }
        },
        onerror: function(err) {
            console.error("[态势感知] 网络断联，无法访问 HA", err);
            reject(new CATRetryError("内网瘫痪", 10)); 
        }
    });
});