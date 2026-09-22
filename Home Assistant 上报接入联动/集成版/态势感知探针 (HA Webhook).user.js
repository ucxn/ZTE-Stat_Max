// ==UserScript==
// @name         态势感知探针 (HA Webhook)
// @namespace    ucxn
// @version      1.0.8
// @description  后台静默运行，每10分钟定点旁路接收路由数据并送往HA
// @author       哥哥科技
// @background
// @crontab      */10 * * * *
// @include      http*://192.168.*.1/*
// @include      http*://192.168.*.254/*
// @match        *://zte.home/*
// @include      *://*/#/menu/dashboard
// @include      *://*/*#router*
// @include      *://*/*#networkMap*
// @include      *://*/*#status*
// @include      *://*/#/overview*
// @include      *://*/#/status*
// @include      *://*/#/home*
// @include      *://*/index.asp*
// @include      *://*/Advanced_*.asp*
// @include      *://*/main.html*
// @include      *://*/index.html*
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

    if (snapshot.timestamp) snapshot.timestamp = Math.floor(snapshot.timestamp / 1000);

    // 2. 将快照推向 HA Webhook ⚠️【请自行修改匹配】
    const webhookUrl = "http://【27.10.8.52/21:240e:520:1008:1314::/48～Reality】/api/webhook/gbnpa_router_webhook"; // 占位符：公网地址优先于一切内网地址，哥哥科技拥有最终解释权。

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