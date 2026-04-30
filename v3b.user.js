// ==UserScript==
// @name         中兴路由器(ZTE) 赛博极客增强版 (高精积分版)
// @namespace    http://tampermonkey.net/
// @version      4.0.0
// @description  微秒级梯形积分统计流量，纯公网 WAN 基准，Mega 3位精度，无痕保护隐私
// @author       Gege Technology & Gemini
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

    // ======== [1] 极客级高精状态机与换算 ========

    // 全局状态机，保存上一帧的时间和速度，用于梯形积分
    const State = {
        lastTime: 0,
        wanUpSpeed: 0, wanDownSpeed: 0,
        lanUpSpeed: 0, lanDownSpeed: 0,
        wanUpTraffic: 0, wanDownTraffic: 0, // 单位：bits (后续展示转Byte)
        lanUpTraffic: 0, lanDownTraffic: 0,
        clients: {} // mac: { upSpeed, downSpeed, upTraffic, downTraffic }
    };

    // 基础：字符串 -> bps
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

    // 格式化 Bps (Mega 3位小数)
    function formatBps(bps) {
        if (bps >= 1000000) return (bps / 1000000).toFixed(3) + ' Mbps';
        if (bps >= 1000) return (bps / 1000).toFixed(2) + ' Kbps';
        return Math.round(bps) + ' bps';
    }

    // 格式化 Byte 速率 (Mega 3位小数)
    function formatBytes(bps) {
        let bytesPerSec = bps / 8;
        if (bytesPerSec >= 1048576) return (bytesPerSec / 1048576).toFixed(3) + ' MiB/s';
        if (bytesPerSec >= 1024) return (bytesPerSec / 1024).toFixed(2) + ' KiB/s';
        return Math.round(bytesPerSec) + ' B/s';
    }

    // 格式化 流量累积 (Mega 3位小数)
    function formatVolume(bits) {
        let bytes = bits / 8;
        if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(3) + ' GiB';
        if (bytes >= 1048576) return (bytes / 1048576).toFixed(3) + ' MiB';
        if (bytes >= 1024) return (bytes / 1024).toFixed(2) + ' KiB';
        return Math.round(bytes) + ' B';
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

    // ======== [2] 注入极客宽屏 CSS ========

    const style = document.createElement('style');
    style.innerHTML = `
        /* 调整栅格给左边信息栏足够空间放流量数字，右边条不挤 */
        .config-item .logo { width: 23% !important; }
        .config-item .info { width: 32% !important; padding: 0 !important; font-family: Consolas, monospace; }
        .config-item .speed { width: 45% !important; padding: 0 10px !important; }
        
        /* 隐私保护：替换文字的颜色强化 */
        .info .dev-ip { color: #555; margin-bottom: 2px; }
        .info .dev-number { color: #666; font-size: 12px; }

        /* 顶部总速度极客看板 */
        #zte-geek-board {
            background: #f8f9fa; border-left: 5px solid #0059fa; border-radius: 4px;
            padding: 12px 20px; margin-bottom: 15px; font-family: Consolas, "Courier New", monospace;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05); font-size: 14px; display: flex; flex-direction: column; gap: 8px;
            color: #333;
        }
        .geek-row { display: flex; justify-content: space-between; align-items: center; white-space: nowrap; }
        .geek-label { width: 110px; color: #555; font-weight: bold; }
        .geek-val-box { flex: 1; display: flex; gap: 15px; margin-left: 10px; }
        .geek-fixed-width { display: inline-block; width: 115px; } /* 拉宽避免换行 */
        
        .geek-right-box { text-align: right; color: #666; min-width: 220px; font-weight: bold; }
        
        .c-up { color: #ff4c00; }
        .c-down { color: #0059fa; }

        /* 单设备进度条 */
        .zte-enhance-speed { 
            display: flex; flex-direction: column; gap: 6px; width: 100%; 
            margin-top: 5px; font-family: Consolas, "Courier New", monospace; 
        }
        .zte-bar-wrap {
            position: relative; width: 100%; border-radius: 4px; border: 1px solid;
            font-size: 13px; font-weight: bold; overflow: hidden; padding: 3px 8px;
            display: flex; justify-content: space-between; align-items: center; z-index: 1;
            box-sizing: border-box; white-space: nowrap; 
        }
        
        .zte-bar-up { color: #ff4c00; border-color: rgba(255, 76, 0, 0.4); }
        .zte-bar-down { color: #0059fa; border-color: rgba(0, 89, 250, 0.4); }
        
        .zte-bar-up::before, .zte-bar-down::before {
            content: ''; position: absolute; left: 0; top: 0; bottom: 0; z-index: -1;
            transition: width 0.5s ease-out;
        }
        .zte-bar-up::before { background: rgba(255, 76, 0, 0.15); width: var(--p-up, 0%); }
        .zte-bar-down::before { background: rgba(0, 89, 250, 0.15); width: var(--p-down, 0%); }
    `;
    document.head.appendChild(style);

    // ======== [3] 核心拉取与微秒积分引擎 ========

    async function refreshSpeedData() {
        try {
            // 获取并发微秒级时间戳 (用于积分算法 Delta Time)
            const timestamp = new Date().getTime();
            const now = performance.now(); 
            
            const [wanRes, clientRes] = await Promise.all([
                fetch(`/?_type=vueData&_tag=vue_home_device_data_no_update_sess&IF_OP=refresh&_=${timestamp}`),
                fetch(`/?_type=vueData&_tag=vue_client_data&_=${timestamp}`)
            ]);

            const parser = new DOMParser();
            const wanXml = parser.parseFromString(await wanRes.text(), "text/xml");
            const clientXml = parser.parseFromString(await clientRes.text(), "text/xml");

            // --- 数据提取 ---
            let wanInfo = {};
            const basicInfoNode = wanXml.querySelector("OBJ_HOME_BASICINFO_ID Instance");
            if (basicInfoNode) wanInfo = parseInstance(basicInfoNode);
            let curWanUp = speedToBps(wanInfo.WANUpRate);
            let curWanDown = speedToBps(wanInfo.WANDownRate);

            let clientsInfo = {};
            let curSumUp = 0;
            let curSumDown = 0;

            const clientNodes = clientXml.querySelectorAll("OBJ_CLIENTS_ID Instance");
            clientNodes.forEach(node => {
                let dev = parseInstance(node);
                if (dev.MACAddress) {
                    let mac = dev.MACAddress.toLowerCase();
                    let up = speedToBps(dev.UpRate);
                    let down = speedToBps(dev.DownRate);
                    clientsInfo[mac] = { up: up, down: down };
                    curSumUp += up;
                    curSumDown += down;
                }
            });

            // --- 梯形积分算法核心 ---
            if (State.lastTime !== 0) {
                let dt = (now - State.lastTime) / 1000; // 时间差转秒

                // 累加 WAN 和 LAN 总流量 (bits)
                State.wanUpTraffic += ((State.wanUpSpeed + curWanUp) / 2) * dt;
                State.wanDownTraffic += ((State.wanDownSpeed + curWanDown) / 2) * dt;
                State.lanUpTraffic += ((State.lanUpSpeed + curSumUp) / 2) * dt;
                State.lanDownTraffic += ((State.lanDownSpeed + curSumDown) / 2) * dt;

                // 累加 单设备流量
                for (let mac in clientsInfo) {
                    if (!State.clients[mac]) {
                        State.clients[mac] = { upSpeed: 0, downSpeed: 0, upTraffic: 0, downTraffic: 0 };
                    }
                    let cState = State.clients[mac];
                    let cCur = clientsInfo[mac];
                    
                    cState.upTraffic += ((cState.upSpeed + cCur.up) / 2) * dt;
                    cState.downTraffic += ((cState.downSpeed + cCur.down) / 2) * dt;
                    
                    cState.upSpeed = cCur.up;
                    cState.downSpeed = cCur.down;
                }
            }

            // 更新状态库
            State.lastTime = now;
            State.wanUpSpeed = curWanUp;
            State.wanDownSpeed = curWanDown;
            State.lanUpSpeed = curSumUp;
            State.lanDownSpeed = curSumDown;

            // 渲染 UI (屏蔽第一帧数据波动)
            if (State.wanUpTraffic > 0 || State.wanDownTraffic > 0) {
                renderUI(curWanUp, curWanDown, curSumUp, curSumDown, clientsInfo);
            }

        } catch (error) {
            console.error("高精积分版获取数据异常：", error);
        }
    }

    function renderUI(wanUp, wanDown, sumUp, sumDown, clientsInfo) {
        
        // --- A. 渲染顶部三行极客看板 ---
        let mainContainer = document.querySelector('.el-table') || document.querySelector('.config-item')?.closest('div') || document.querySelector('.main-content');
        
        if (mainContainer) {
            let totalBoard = document.getElementById('zte-geek-board');
            if (!totalBoard) {
                totalBoard = document.createElement('div');
                totalBoard.id = 'zte-geek-board';
                mainContainer.parentNode.insertBefore(totalBoard, mainContainer);
            }
            
            let percUp = wanUp > 0 ? ((sumUp / wanUp) * 100).toFixed(1) : "0.0";
            let percDown = wanDown > 0 ? ((sumDown / wanDown) * 100).toFixed(1) : "0.0";

            totalBoard.innerHTML = `
                <div class="geek-row">
                    <span class="geek-label">WAN口公网速率</span>
                    <span class="geek-val-box">
                        <span class="c-up geek-fixed-width">🔼 ${formatBps(wanUp)}</span>
                        <span class="c-down geek-fixed-width">🔽 ${formatBps(wanDown)}</span>
                    </span>
                    <span class="geek-right-box">
                        <span class="c-up">🔼 ${formatBytes(wanUp)}</span> | <span class="c-down">🔽 ${formatBytes(wanDown)}</span>
                    </span>
                </div>
                <div class="geek-row">
                    <span class="geek-label">局域网代数和</span>
                    <span class="geek-val-box">
                        <span class="c-up geek-fixed-width">🔼 ${formatBps(sumUp)}</span>
                        <span class="c-down geek-fixed-width">🔽 ${formatBps(sumDown)}</span>
                    </span>
                    <span class="geek-right-box">
                        实时占比：<span class="c-up">🔼 ${percUp}%</span> | <span class="c-down">🔽 ${percDown}%</span>
                    </span>
                </div>
                <div class="geek-row">
                    <span class="geek-label">高精积分总流</span>
                    <span class="geek-val-box">
                        <span class="c-up geek-fixed-width">🔼 ${formatVolume(State.lanUpTraffic)}</span>
                        <span class="c-down geek-fixed-width">🔽 ${formatVolume(State.lanDownTraffic)}</span>
                    </span>
                    <span class="geek-right-box">
                        WAN：<span class="c-up">🔼 ${formatVolume(State.wanUpTraffic)}</span> | <span class="c-down">🔽 ${formatVolume(State.wanDownTraffic)}</span>
                    </span>
                </div>
            `;
        }

        // --- B. 渲染设备与隐私替换 ---
        const deviceItems = document.querySelectorAll('.config-item');
        deviceItems.forEach(item => {
            
            // 首次绑定 MAC 到属性，防止替换文字后找不到身份
            let mac = item.getAttribute('data-gege-mac');
            if (!mac) {
                const macNode = item.querySelector('.dev-number');
                if (!macNode) return;
                const macMatch = macNode.textContent.match(/([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})/);
                if (macMatch) {
                    mac = macMatch[0].toLowerCase();
                    item.setAttribute('data-gege-mac', mac);
                } else return;
            }

            const cCur = clientsInfo[mac] || { up: 0, down: 0 };
            const cState = State.clients[mac] || { upTraffic: 0, downTraffic: 0 };
            
            // --- 替换信息 (抹除 IPv6 和 MAC，替换为流量数据) ---
            const infoDiv = item.querySelector('.info');
            if (infoDiv) {
                const lines = infoDiv.querySelectorAll('div');
                // 第 2 行替换为：累计流量
                if (lines.length >= 2 && !lines[1].classList.contains('injected-traffic')) {
                    lines[1].className = 'dev-ip injected-traffic';
                }
                if (lines[1] && lines[1].classList.contains('injected-traffic')) {
                    lines[1].innerHTML = `总流: <span class="c-up">🔼${formatVolume(cState.upTraffic)}</span> <span class="c-down">🔽${formatVolume(cState.downTraffic)}</span>`;
                }

                // 第 3 行替换为：流量累计占比
                if (lines.length >= 3 && !lines[2].classList.contains('injected-perc')) {
                    lines[2].className = 'dev-number injected-perc';
                }
                if (lines[2] && lines[2].classList.contains('injected-perc')) {
                    let devTUpPerc = State.wanUpTraffic > 0 ? ((cState.upTraffic / State.wanUpTraffic) * 100).toFixed(1) : "0.0";
                    let devTDownPerc = State.wanDownTraffic > 0 ? ((cState.downTraffic / State.wanDownTraffic) * 100).toFixed(1) : "0.0";
                    lines[2].innerHTML = `占比: <span class="c-up">🔼${devTUpPerc}%</span> <span class="c-down">🔽${devTDownPerc}%</span>`;
                }
            }

            // --- 测速进度条依然保留 (实时速率/WAN实时速率) ---
            let pUpNum = wanUp > 0 ? (cCur.up / wanUp) * 100 : (cCur.up > 0 ? 100 : 0);
            let pDownNum = wanDown > 0 ? (cCur.down / wanDown) * 100 : (cCur.down > 0 ? 100 : 0);
            
            let pUpDisp = wanUp > 0 ? pUpNum.toFixed(1) + '%' : (cCur.up > 0 ? ">100%" : "0.0%");
            let pDownDisp = wanDown > 0 ? pDownNum.toFixed(1) + '%' : (cCur.down > 0 ? ">100%" : "0.0%");

            const speedContainer = item.querySelector('.speed');
            if (!speedContainer) return;

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
            
            upBar.style.setProperty('--p-up', `${Math.min(pUpNum, 100)}%`);
            upBar.querySelector('.val-txt').innerHTML = `🔼 ${formatBytes(cCur.up)}`;
            upBar.querySelector('.pct-txt').innerHTML = pUpDisp;

            downBar.style.setProperty('--p-down', `${Math.min(pDownNum, 100)}%`);
            downBar.querySelector('.val-txt').innerHTML = `🔽 ${formatBytes(cCur.down)}`;
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
