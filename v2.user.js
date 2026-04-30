// ==UserScript==
// @name         中兴路由器(ZTE) 赛博极客版增强脚本 (终极完美版)
// @namespace    http://tampermonkey.net/
// @version      3.0.0
// @description  原生浅色UI，强制修复宽度重叠，精准千/千二四进制转换，极致双行对齐大盘
// @include      http://10.*
// @match        http://192.168.5.1
// @include      http://192.168.*
// @include      https://192.168.*
// @include      http://172.16.*
// @include      http://zte.home*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // ======== [1] 极客级底层换算逻辑 ========

    // 解析路由器原始字符串为纯比特率 (bps) - 网络通信标准: 1000进制
    function speedToBps(speedStr) {
        if (!speedStr) return 0;
        let match = speedStr.match(/([\d.]+)\s*(G|M|K)?bps/i);
        if (!match) return 0;
        let val = parseFloat(match[1]);
        let unit = (match[2] || "").toUpperCase();
        if (unit === 'G') return val * 1000000000;
        if (unit === 'M') return val * 1000000;
        if (unit === 'K') return val * 1000;
        return val;
    }

    // 格式化为网络速率 (Mbps / Kbps) - 严格 1000 进制 (保留2位小数对齐)
    function formatBps(bps) {
        if (bps >= 1000000) return (bps / 1000000).toFixed(2) + ' Mbps';
        if (bps >= 1000) return (bps / 1000).toFixed(2) + ' Kbps';
        return Math.round(bps) + ' bps';
    }

    // 格式化为系统读写速率 (MiB/s / KiB/s) - 严格除以8后走 1024 进制
    function formatBytes(bps) {
        let bytesPerSec = bps / 8;
        if (bytesPerSec >= 1048576) return (bytesPerSec / 1048576).toFixed(2) + ' MiB/s';
        if (bytesPerSec >= 1024) return (bytesPerSec / 1024).toFixed(2) + ' KiB/s';
        return Math.round(bytesPerSec) + ' B/s';
    }

    function parseInstance(instanceNode) {
        let obj = {};
        let names = instanceNode.querySelectorAll("ParaName");
        let values = instanceNode.querySelectorAll("ParaValue");
        for(let i = 0; i < names.length; i++) {
            obj[names[i].textContent] = values[i] ? values[i].textContent : "";
        }
        return obj;
    }

    // ======== [2] 注入极客宽屏 CSS (修复重叠与白底UI) ========

    const style = document.createElement('style');
    style.innerHTML = `
        /* 强制接管原网页列表的栅格布局，分配完美比例，解决重叠 */
        .config-item-box {
            display: flex !important;
            align-items: center !important;
            flex-wrap: nowrap !important;
        }
        .config-item-box > .logo { width: 30% !important; flex: 0 0 30% !important; max-width: 30% !important; }
        .config-item-box > .info { width: 30% !important; flex: 0 0 30% !important; max-width: 30% !important; }
        .config-item-box > .speed {
            width: 40% !important; flex: 0 0 40% !important; max-width: 40% !important;
            padding-right: 15px !important; padding-left: 0 !important; float: none !important;
        }

        /* 顶部总速度极客看板 - 回归清爽白底原生风 */
        #zte-geek-board {
            background: #ffffff; border: 1px solid #e8e8e8; border-left: 5px solid #0059fa; border-radius: 4px;
            padding: 15px 20px; margin-bottom: 15px; font-family: Consolas, "Courier New", monospace;
            box-shadow: 0 2px 8px rgba(0,0,0,0.04); font-size: 14.5px; display: flex; flex-direction: column; gap: 10px;
        }
        .geek-row { display: flex; justify-content: space-between; align-items: center; }
        .geek-row.line-1 { border-bottom: 1px dashed #f0f0f0; padding-bottom: 10px; }
        .geek-label { width: 120px; color: #333; font-weight: bold; }
        .geek-val-box { flex: 1; display: flex; gap: 20px; }
        .geek-right-box { width: 220px; text-align: right; color: #555; font-weight: bold; }

        /* 专属颜色 */
        .c-up { color: #ff4c00; }
        .c-down { color: #0059fa; }
        .c-gray { color: #888; font-weight: normal;}

        /* 单设备进度条 */
        .zte-enhance-speed {
            display: flex; flex-direction: column; gap: 6px; width: 100%;
            margin-top: 2px; font-family: Consolas, "Courier New", monospace;
        }
        .zte-bar-wrap {
            position: relative; width: 100%; border-radius: 4px; border: 1px solid;
            font-size: 13px; font-weight: bold; overflow: hidden; padding: 4px 8px;
            display: flex; justify-content: space-between; align-items: center; z-index: 1;
            box-sizing: border-box; height: 26px;
        }
        .zte-bar-up { color: #ff4c00; border-color: rgba(255, 76, 0, 0.4); }
        .zte-bar-down { color: #0059fa; border-color: rgba(0, 89, 250, 0.4); }

        /* 进度条背景动画 */
        .zte-bar-up::before, .zte-bar-down::before {
            content: ''; position: absolute; left: 0; top: 0; bottom: 0; z-index: -1;
            transition: width 0.5s ease-out;
        }
        .zte-bar-up::before { background: rgba(255, 76, 0, 0.15); width: var(--p-up, 0%); }
        .zte-bar-down::before { background: rgba(0, 89, 250, 0.15); width: var(--p-down, 0%); }
    `;
    document.head.appendChild(style);

    // ======== [3] 核心拉取与渲染引擎 ========

    async function refreshSpeedData() {
        try {
            const timestamp = new Date().getTime();

            const [wanRes, clientRes] = await Promise.all([
                fetch(`/?_type=vueData&_tag=vue_home_device_data_no_update_sess&IF_OP=refresh&_=${timestamp}`),
                fetch(`/?_type=vueData&_tag=vue_client_data&_=${timestamp}`)
            ]);

            const parser = new DOMParser();
            const wanXml = parser.parseFromString(await wanRes.text(), "text/xml");
            const clientXml = parser.parseFromString(await clientRes.text(), "text/xml");

            // 1. 获取公网 WAN口 真实上下行
            let wanInfo = {};
            const basicInfoNode = wanXml.querySelector("OBJ_HOME_BASICINFO_ID Instance");
            if (basicInfoNode) wanInfo = parseInstance(basicInfoNode);

            let wanUpBps = speedToBps(wanInfo.WANUpRate);
            let wanDownBps = speedToBps(wanInfo.WANDownRate);

            // 2. 遍历设备提取数据，严格算代数和
            let clientsInfo = {};
            let sumUpBps = 0;
            let sumDownBps = 0;

            const clientNodes = clientXml.querySelectorAll("OBJ_CLIENTS_ID Instance");
            clientNodes.forEach(node => {
                let dev = parseInstance(node);
                if (dev.MACAddress) {
                    let mac = dev.MACAddress.toLowerCase();
                    let up = speedToBps(dev.UpRate);
                    let down = speedToBps(dev.DownRate);
                    clientsInfo[mac] = { up: up, down: down };
                    sumUpBps += up;
                    sumDownBps += down;
                }
            });

            // 3. 计算顶部聚合利用率
            let percUp = wanUpBps > 0 ? ((sumUpBps / wanUpBps) * 100).toFixed(1) : "0.0";
            let percDown = wanDownBps > 0 ? ((sumDownBps / wanDownBps) * 100).toFixed(1) : "0.0";

            renderUI(wanUpBps, wanDownBps, sumUpBps, sumDownBps, percUp, percDown, clientsInfo);

        } catch (error) {
            console.error("增强脚本获取数据异常：", error);
        }
    }

    function renderUI(wanUp, wanDown, sumUp, sumDown, percUp, percDown, clientsInfo) {

        // --- A. 渲染顶部总大盘 ---
        let mainContainer = document.querySelector('.el-table') || document.querySelector('.config-item')?.closest('div') || document.querySelector('.main-content');

        if (mainContainer) {
            let totalBoard = document.getElementById('zte-geek-board');
            if (!totalBoard) {
                totalBoard = document.createElement('div');
                totalBoard.id = 'zte-geek-board';
                mainContainer.parentNode.insertBefore(totalBoard, mainContainer);
            }

            // 严格的双行对齐与进制分配
            totalBoard.innerHTML = `
                <div class="geek-row line-1">
                    <span class="geek-label">WAN口真实速率</span>
                    <span class="geek-val-box">
                        <span class="c-up">🔼 ${formatBps(wanUp).padEnd(12)}</span>
                        <span class="c-down">🔽 ${formatBps(wanDown).padEnd(12)}</span>
                    </span>
                    <span class="geek-right-box">
                        占用：<span class="c-up">🔼 ${percUp}%</span> | <span class="c-down">🔽 ${percDown}%</span>
                    </span>
                </div>
                <div class="geek-row">
                    <span class="geek-label c-gray">局域网代数和</span>
                    <span class="geek-val-box c-gray">
                        <span class="c-up">🔼 ${formatBps(sumUp).padEnd(12)}</span>
                        <span class="c-down">🔽 ${formatBps(sumDown).padEnd(12)}</span>
                    </span>
                    <span class="geek-right-box c-gray">
                        <span class="c-up">🔼 ${formatBytes(sumUp)}</span> | <span class="c-down">🔽 ${formatBytes(sumDown)}</span>
                    </span>
                </div>
            `;
        }

        // --- B. 渲染单设备网络负载条 ---
        const deviceItems = document.querySelectorAll('.config-item');
        deviceItems.forEach(item => {
            const macNode = item.querySelector('.dev-number');
            if (!macNode) return;

            const macMatch = macNode.textContent.match(/([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})/);
            if (!macMatch) return;
            const mac = macMatch[0].toLowerCase();

            const devData = clientsInfo[mac] || { up: 0, down: 0 };

            // 计算占比百分比
            let pUpNum = wanUp > 0 ? (devData.up / wanUp) * 100 : (devData.up > 0 ? 100 : 0);
            let pDownNum = wanDown > 0 ? (devData.down / wanDown) * 100 : (devData.down > 0 ? 100 : 0);

            let pUpDisp = wanUp > 0 ? pUpNum.toFixed(1) + '%' : (devData.up > 0 ? ">100%" : "0.0%");
            let pDownDisp = wanDown > 0 ? pDownNum.toFixed(1) + '%' : (devData.down > 0 ? ">100%" : "0.0%");

            const speedContainer = item.querySelector('.speed');
            if (!speedContainer) return;

            // 隐藏原厂废话
            const originalSpans = speedContainer.querySelectorAll('.connect-up, .connect-down');
            originalSpans.forEach(span => span.style.display = 'none');

            let enhanceDiv = speedContainer.querySelector('.zte-enhance-speed');
            if (!enhanceDiv) {
                enhanceDiv = document.createElement('div');
                enhanceDiv.className = 'zte-enhance-speed';
                enhanceDiv.innerHTML = `
                    <div class="zte-bar-wrap zte-bar-up">
                        <span class="val-txt">🔼 0 B/s</span><span class="pct-txt">0.0%</span>
                    </div>
                    <div class="zte-bar-wrap zte-bar-down">
                        <span class="val-txt">🔽 0 B/s</span><span class="pct-txt">0.0%</span>
                    </div>
                `;
                speedContainer.appendChild(enhanceDiv);
            }

            const upBar = enhanceDiv.querySelector('.zte-bar-up');
            const downBar = enhanceDiv.querySelector('.zte-bar-down');

            // 设置进度条宽度与文字 (MiB/s / KiB/s)
            upBar.style.setProperty('--p-up', `${Math.min(pUpNum, 100)}%`);
            upBar.querySelector('.val-txt').innerHTML = `🔼 ${formatBytes(devData.up)}`;
            upBar.querySelector('.pct-txt').innerHTML = pUpDisp;

            downBar.style.setProperty('--p-down', `${Math.min(pDownNum, 100)}%`);
            downBar.querySelector('.val-txt').innerHTML = `🔽 ${formatBytes(devData.down)}`;
            downBar.querySelector('.pct-txt').innerHTML = pDownDisp;
        });
    }

    // ======== [4] 点火启动 ========
    setInterval(() => {
        if (location.hash && location.hash.includes('home') || document.querySelector('.config-item')) {
            refreshSpeedData();
        }
    }, 2000);

    window.addEventListener('load', () => setTimeout(refreshSpeedData, 500));

})();
