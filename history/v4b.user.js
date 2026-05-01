// ==UserScript==
// @name         中兴路由器(ZTE) 赛博极客增强版 (雷达排版终极版)
// @namespace    http://tampermonkey.net/
// @version      6.0.0
// @description  物理端口映射，上下行比例雷达，Flexbox底部对齐，1000ms微秒积分
// @author       哥哥科技 & Gemini
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

    // ======== [0] 用户极客环境变量配置区 ========
    const CONFIG = {
        ratioThreshold: 50, // 上传占比报警阈值(%)：大于此值百分数变红，小于等于变蓝
        portMap: {          // 物理/虚拟端口中文映射字典 (可随意修改)
            "eth1": "端口 1",
            "eth2": "端口 2",
            "eth3": "端口 3",
            "eth4": "端口 4",
            "wl0":  "Wi-Fi 2.4G",
            "wl1":  "Wi-Fi 5G",
            "wl2":  "Wi-Fi 5G-Game"
        }
    };

    // ======== [1] 极客级高精状态机与换算 ========

    const State = {
        lastTime: 0,
        wanUpSpeed: 0, wanDownSpeed: 0,
        wanUpTraffic: 0, wanDownTraffic: 0,
        clients: {}
    };

    let isFetching = false;
    const parser = new DOMParser();

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

    function formatBps(bps) {
        if (bps >= 1000000) return (bps / 1000000).toFixed(3) + ' Mbps';
        if (bps >= 1000) return (bps / 1000).toFixed(2) + ' Kbps';
        return Math.round(bps) + ' bps';
    }

    function formatBytes(bps) {
        let bytesPerSec = bps / 8;
        if (bytesPerSec >= 1048576) return (bytesPerSec / 1048576).toFixed(3) + ' MiB/s';
        if (bytesPerSec >= 1024) return (bytesPerSec / 1024).toFixed(2) + ' KiB/s';
        return Math.round(bytesPerSec) + ' B/s';
    }

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

    // ======== [2] 注入极客宽屏 CSS (绝对对齐系统) ========

    const style = document.createElement('style');
    style.innerHTML = `
        /* 强制接管原厂栅格，启动 Flexbox 以实现底部完美对齐 */
        .config-item-box { display: flex !important; align-items: stretch !important; padding-bottom: 6px; }
        .config-item .logo { width: 32% !important; display: flex !important; }
        .config-item .dev-intro { flex: 1; display: flex; flex-direction: column; }
        .config-item .info { width: 28% !important; padding: 0 10px !important; display: flex; flex-direction: column; font-family: Consolas, monospace; }
        .config-item .speed { width: 40% !important; display: flex; flex-direction: column; justify-content: center; padding: 0 10px !important;}

        .info .dev-ip { color: #555; margin-bottom: 2px; }

        /* 顶部看板样式 */
        #zte-geek-board {
            background: #f8f9fa; border-left: 5px solid #0059fa; border-radius: 4px;
            padding: 12px 20px; margin-bottom: 15px; font-family: Consolas, "Courier New", monospace;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05); font-size: 14px; display: flex; flex-direction: column; gap: 8px;
            color: #333;
        }
        .geek-row { display: flex; justify-content: space-between; align-items: center; white-space: nowrap; }
        .geek-label { width: 110px; color: #555; font-weight: bold; }
        .geek-val-box { flex: 1; display: flex; gap: 15px; margin-left: 10px; }
        .geek-fixed-width { display: inline-block; width: 125px; }
        .geek-right-box { text-align: right; color: #666; min-width: 230px; font-weight: bold; }

        .c-up { color: #ff4c00; }
        .c-down { color: #0059fa; }

        /* 隐私保护专属细条 (独立在底部) */
        .gege-up-box, .gege-down-box { margin-top: auto !important; margin-bottom: 2px; width: 95%; }
        .t-row { font-size: 12px; font-weight: bold; margin-bottom: 2px; color: #666; display: flex; justify-content: space-between; }
        .zte-thin-bar { width: 100%; height: 3px; background: rgba(0,0,0,0.06); border-radius: 1.5px; overflow: hidden; }
        .zte-thin-bar-inner { height: 100%; transition: width 0.5s ease-out; }
        .zte-thin-bar-inner.up { background: rgba(255, 76, 0, 0.65); }
        .zte-thin-bar-inner.down { background: rgba(0, 89, 250, 0.65); }

        /* 新增：中间的上下行比例雷达 */
        .gege-ratio-box { margin-top: 8px; width: 95%; }
        .gege-ratio-top { display: flex; justify-content: space-between; font-size: 12px; font-weight: bold; margin-bottom: 3px; }
        .gege-ratio-bar { width: 100%; height: 4px; background: rgba(0, 89, 250, 0.8); border-radius: 2px; overflow: hidden; }
        .gege-ratio-bar-inner { height: 100%; background: #ff4c00; transition: width 0.5s ease-out; }

        /* 右侧实时网速进度条 */
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

    // ======== [3] 并发获取与超频微积分引擎 ========

    async function refreshSpeedData() {
        if (isFetching) return;
        isFetching = true;

        try {
            const timestamp = new Date().getTime();
            const now = performance.now();

            const [wanRes, clientRes] = await Promise.all([
                fetch(`/?_type=vueData&_tag=vue_home_device_data_no_update_sess&IF_OP=refresh&_=${timestamp}`),
                fetch(`/?_type=vueData&_tag=vue_client_data&_=${timestamp}`)
            ]);

            const wanXml = parser.parseFromString(await wanRes.text(), "text/xml");
            const clientXml = parser.parseFromString(await clientRes.text(), "text/xml");

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
                    let iface = dev.Interface || "";
                    clientsInfo[mac] = { up: up, down: down, interface: iface };
                    curSumUp += up;
                    curSumDown += down;
                }
            });

            if (State.lastTime !== 0) {
                let dt = (now - State.lastTime) / 1000;

                State.wanUpTraffic += ((State.wanUpSpeed + curWanUp) / 2) * dt;
                State.wanDownTraffic += ((State.wanDownSpeed + curWanDown) / 2) * dt;

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

            State.lastTime = now;
            State.wanUpSpeed = curWanUp;
            State.wanDownSpeed = curWanDown;

            let lanUpTrafficTotal = 0;
            let lanDownTrafficTotal = 0;
            for (let mac in State.clients) {
                lanUpTrafficTotal += State.clients[mac].upTraffic;
                lanDownTrafficTotal += State.clients[mac].downTraffic;
            }

            renderUI(curWanUp, curWanDown, curSumUp, curSumDown, lanUpTrafficTotal, lanDownTrafficTotal, clientsInfo);

        } catch (error) {
            console.error("增强脚本获取异常：", error);
        } finally {
            isFetching = false;
        }
    }

    // ======== [4] DOM 原地渲染层 ========

    function renderUI(wanUp, wanDown, sumUp, sumDown, lanUpVol, lanDownVol, clientsInfo) {

        // --- 顶部看板 ---
        let mainContainer = document.querySelector('.el-table') || document.querySelector('.config-item')?.closest('div') || document.querySelector('.main-content');
        if (mainContainer) {
            let totalBoard = document.getElementById('zte-geek-board');
            if (!totalBoard) {
                totalBoard = document.createElement('div');
                totalBoard.id = 'zte-geek-board';
                totalBoard.innerHTML = `
                    <div class="geek-row">
                        <span class="geek-label">WAN口公网速率</span>
                        <span class="geek-val-box">
                            <span class="c-up geek-fixed-width" id="gb-wan-up-bps"></span>
                            <span class="c-down geek-fixed-width" id="gb-wan-down-bps"></span>
                        </span>
                        <span class="geek-right-box"><span class="c-up" id="gb-wan-up-bytes"></span> | <span class="c-down" id="gb-wan-down-bytes"></span></span>
                    </div>
                    <div class="geek-row">
                        <span class="geek-label">局域网代数和</span>
                        <span class="geek-val-box">
                            <span class="c-up geek-fixed-width" id="gb-lan-up-bps"></span>
                            <span class="c-down geek-fixed-width" id="gb-lan-down-bps"></span>
                        </span>
                        <span class="geek-right-box">实时占比：<span class="c-up" id="gb-perc-up"></span> | <span class="c-down" id="gb-perc-down"></span></span>
                    </div>
                    <div class="geek-row">
                        <span class="geek-label">高精积分总流</span>
                        <span class="geek-val-box">
                            <span class="c-up geek-fixed-width" id="gb-lan-up-vol"></span>
                            <span class="c-down geek-fixed-width" id="gb-lan-down-vol"></span>
                        </span>
                        <span class="geek-right-box">WAN：<span class="c-up" id="gb-wan-up-vol"></span> | <span class="c-down" id="gb-wan-down-vol"></span></span>
                    </div>
                `;
                mainContainer.parentNode.insertBefore(totalBoard, mainContainer);
            }

            let percUp = wanUp > 0 ? ((sumUp / wanUp) * 100).toFixed(1) : "0.0";
            let percDown = wanDown > 0 ? ((sumDown / wanDown) * 100).toFixed(1) : "0.0";

            document.getElementById('gb-wan-up-bps').textContent = `🔼 ${formatBps(wanUp)}`;
            document.getElementById('gb-wan-down-bps').textContent = `🔽 ${formatBps(wanDown)}`;
            document.getElementById('gb-wan-up-bytes').textContent = `🔼 ${formatBytes(wanUp)}`;
            document.getElementById('gb-wan-down-bytes').textContent = `🔽 ${formatBytes(wanDown)}`;
            document.getElementById('gb-lan-up-bps').textContent = `🔼 ${formatBps(sumUp)}`;
            document.getElementById('gb-lan-down-bps').textContent = `🔽 ${formatBps(sumDown)}`;
            document.getElementById('gb-perc-up').textContent = `🔼 ${percUp}%`;
            document.getElementById('gb-perc-down').textContent = `🔽 ${percDown}%`;
            document.getElementById('gb-lan-up-vol').textContent = `🔼 ${formatVolume(lanUpVol)}`;
            document.getElementById('gb-lan-down-vol').textContent = `🔽 ${formatVolume(lanDownVol)}`;
            document.getElementById('gb-wan-up-vol').textContent = `🔼 ${formatVolume(State.wanUpTraffic)}`;
            document.getElementById('gb-wan-down-vol').textContent = `🔽 ${formatVolume(State.wanDownTraffic)}`;
        }

        const deviceItems = document.querySelectorAll('.config-item');
        deviceItems.forEach(item => {
            let mac = item.getAttribute('data-gege-mac');
            if (!mac) {
                const macNodes = Array.from(item.querySelectorAll('.dev-number'));
                const originalMacNode = macNodes.find(n => n.textContent.includes('MAC'));
                if (originalMacNode) {
                    const macMatch = originalMacNode.textContent.match(/([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})/);
                    if (macMatch) {
                        mac = macMatch[0].toLowerCase();
                        item.setAttribute('data-gege-mac', mac);
                    }
                }
            }
            if (!mac) return;

            const cCur = clientsInfo[mac] || { up: 0, down: 0, interface: "" };
            const cState = State.clients[mac] || { upTraffic: 0, downTraffic: 0 };

            let devTUpPerc = State.wanUpTraffic > 0 ? ((cState.upTraffic / State.wanUpTraffic) * 100).toFixed(1) : "0.0";
            let devTDownPerc = State.wanDownTraffic > 0 ? ((cState.downTraffic / State.wanDownTraffic) * 100).toFixed(1) : "0.0";

            // --- 节点1：左侧放上行流量 (置底) ---
            const devIntro = item.querySelector('.dev-intro');
            if (devIntro) {
                let upBox = devIntro.querySelector('.gege-up-box');
                if (!upBox) {
                    upBox = document.createElement('div');
                    upBox.className = 'gege-up-box';
                    upBox.innerHTML = `
                        <div class="t-row c-up"><span>↑ <span class="v-vol"></span></span> <span><span class="v-pct"></span>%</span></div>
                        <div class="zte-thin-bar"><div class="zte-thin-bar-inner up" style="width: 0%;"></div></div>
                    `;
                    devIntro.appendChild(upBox);
                }
                upBox.querySelector('.v-vol').textContent = formatVolume(cState.upTraffic);
                upBox.querySelector('.v-pct').textContent = devTUpPerc;
                upBox.querySelector('.zte-thin-bar-inner.up').style.width = `${Math.min(devTUpPerc, 100)}%`;
            }

            // --- 节点2：中间放雷达 & 下行流量 ---
            const infoDiv = item.querySelector('.info');
            if (infoDiv) {
                // 隐藏废话
                const originalIps = Array.from(infoDiv.querySelectorAll('.dev-ip:not(.gege-down-box *):not(.gege-ratio-box *)'));
                if (originalIps.length > 1) {
                    for(let i = 1; i < originalIps.length; i++) originalIps[i].style.display = 'none';
                }
                const originalMacs = Array.from(infoDiv.querySelectorAll('.dev-number:not(.gege-down-box *):not(.gege-ratio-box *)'));
                originalMacs.forEach(node => node.style.display = 'none');

                // A. 新增雷达比例条 (置于 IPv4 之下)
                let ratioBox = infoDiv.querySelector('.gege-ratio-box');
                if (!ratioBox) {
                    ratioBox = document.createElement('div');
                    ratioBox.className = 'gege-ratio-box';
                    ratioBox.innerHTML = `
                        <div class="gege-ratio-top">
                            <span class="v-port" style="color: #000;"></span>
                            <span class="v-rt-pct"></span>
                        </div>
                        <div class="gege-ratio-bar">
                            <div class="gege-ratio-bar-inner" style="width: 0%;"></div>
                        </div>
                    `;
                    let firstIp = infoDiv.querySelector('.dev-ip');
                    if (firstIp) firstIp.after(ratioBox);
                    else infoDiv.appendChild(ratioBox);
                }

                // 计算比例：上行流量 / (上行流量 + 下行流量)
                let totalDevVol = cState.upTraffic + cState.downTraffic;
                let upRatio = totalDevVol > 0 ? (cState.upTraffic / totalDevVol * 100) : 0;
                let portName = CONFIG.portMap[cCur.interface] || cCur.interface || "未知端口";

                ratioBox.querySelector('.v-port').textContent = portName;
                let rtPctNode = ratioBox.querySelector('.v-rt-pct');
                rtPctNode.textContent = `${upRatio.toFixed(1)}%`;
                rtPctNode.style.color = upRatio > CONFIG.ratioThreshold ? '#ff4c00' : '#0059fa'; // 根据阈值变色
                ratioBox.querySelector('.gege-ratio-bar-inner').style.width = `${upRatio}%`;

                // B. 下行流量组件 (置于最底，与左侧对齐)
                let downBox = infoDiv.querySelector('.gege-down-box');
                if (!downBox) {
                    downBox = document.createElement('div');
                    downBox.className = 'gege-down-box';
                    downBox.innerHTML = `
                        <div class="t-row c-down"><span>↓ <span class="v-vol"></span></span> <span><span class="v-pct"></span>%</span></div>
                        <div class="zte-thin-bar"><div class="zte-thin-bar-inner down" style="width: 0%;"></div></div>
                    `;
                    infoDiv.appendChild(downBox);
                }
                downBox.querySelector('.v-vol').textContent = formatVolume(cState.downTraffic);
                downBox.querySelector('.v-pct').textContent = devTDownPerc;
                downBox.querySelector('.zte-thin-bar-inner.down').style.width = `${Math.min(devTDownPerc, 100)}%`;
            }

            // --- 节点3：右侧实时网速进度条 ---
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
            upBar.querySelector('.val-txt').textContent = `🔼 ${formatBytes(cCur.up)}`;
            upBar.querySelector('.pct-txt').textContent = pUpDisp;

            downBar.style.setProperty('--p-down', `${Math.min(pDownNum, 100)}%`);
            downBar.querySelector('.val-txt').textContent = `🔽 ${formatBytes(cCur.down)}`;
            downBar.querySelector('.pct-txt').textContent = pDownDisp;
        });
    }

    // ======== [5] 1秒超频点火启动 ========
    setInterval(() => {
        if (location.hash && location.hash.includes('home') || document.querySelector('.config-item')) {
            refreshSpeedData();
        }
    }, 1000);

    window.addEventListener('load', () => setTimeout(refreshSpeedData, 500));

})();
