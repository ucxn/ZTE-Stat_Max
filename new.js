// ==UserScript==
// @name         中兴路由器(ZTE) 自用
// @namespace    http://tampermonkey.net/
// @version      5
// @description  QQ群 680464365
// @author       哥哥科技
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
        calcMode: 1, // 1: 上行/下行倍数模式, 0: 上行占总和比例模式
        ratioExtremeUp: 10,   // 极端上传判定阈值 (> 1000%)
        ratioWarnUp: 0.07,    // 重度上传警告阈值 (> 7%)
        ratioExtremeDown: 0.01, // 极端下载判定阈值 (< 1%)
        ratioThreshold: 7, // (仅calcMode=0时有效) 上传占比报警阈值(%)
        portMap: {
            "eth1": "客厅 5.2",
            "eth2": "Win HA",
            "eth3": "玄关 5.8",
            "eth4": "书房 5.2G",
            "wl0":  "2.4G",
            "wl1":  "5.2G",
            "wl2":  "5.8G"
        }
    };

    const State = {
        lastTime: 0,
        wanUpSpeed: 0, wanDownSpeed: 0,
        wanUpTraffic: 0, wanDownTraffic: 0,
        clients: {}
    };

    let isFetching = false;
    const parser = new DOMParser();

    // ======== [1] 换算引擎 (1000进制 vs 1024进制) ========

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
        if (bytesPerSec >= 1024) return (bytesPerSec / 1024).toFixed(3) + ' KiB/s';
        return Math.round(bytesPerSec) + ' B/s';
    }

    function formatVolume(bits) {
        let bytes = bits / 8;
        if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(3) + ' GiB';
        if (bytes >= 1048576) return (bytes / 1048576).toFixed(3) + ' MiB';
        if (bytes >= 1024) return (bytes / 1024).toFixed(2) + ' KiB';
        return Math.round(bytes) + ' B';
    }

    // 新增：双轨制流量锚定渲染 (强行将官方数据约束在我方单位下)
    function formatVolumeDual(bitsIntegral, bitsOfficial) {
        let bytes = bitsIntegral / 8;
        let bytesOff = bitsOfficial / 8;
        if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(4) + ' | ' + (bytesOff / 1073741824).toFixed(4) + ' GiB';
        if (bytes >= 1048576) return (bytes / 1048576).toFixed(3) + ' | ' + (bytesOff / 1048576).toFixed(3) + ' MiB';
        if (bytes >= 1024) return (bytes / 1024).toFixed(2) + ' | ' + (bytesOff / 1024).toFixed(2) + ' KiB';
        return Math.round(bytes) + ' | ' + Math.round(bytesOff) + ' B';
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

    // ======== [2] 注入极客 CSS (实现 PS 级的底部对齐) ========

    const style = document.createElement('style');
    style.innerHTML = `
        /* 清除浮动，启用 Flex 布局控制 */
        .config-item { clear: both; }
        .config-item-box { display: flex !important; align-items: stretch !important; padding-bottom: 12px !important; }

        /* 列分配与对齐 */
        .config-item .logo { width: 33% !important; float: none !important; display: flex !important; flex-direction: row; }
        .config-item .dev-intro { flex: 1; display: flex !important; flex-direction: column; justify-content: flex-start; min-height: 100px; padding-bottom: 0 !important; margin-bottom: 0 !important; }

        .config-item .info { width: 27% !important; float: none !important; display: flex !important; flex-direction: column; justify-content: flex-start; padding: 0 10px !important; border-right: 1px solid #eee; }
        .config-item .speed { width: 40% !important; float: none !important; display: flex !important; flex-direction: column; justify-content: center; padding: 0 10px !important; }

        /* 看板样式 */
        #zte-geek-board {
            background: #fdfdfd; border-left: 5px solid #0059fa; border-radius: 4px;
            padding: 12px 20px; margin-bottom: 15px; font-family: Consolas, monospace;
            box-shadow: 0 2px 10px rgba(0,0,0,0.08); font-size: 14px; display: flex; flex-direction: column; gap: 6px;
        }
        .geek-row { display: flex; justify-content: space-between; align-items: center; white-space: nowrap; height: 20px; }
        .geek-label { width: 110px; color: #333; font-weight: bold; }
        .geek-val-box { flex: 1; display: flex; gap: 15px; margin-left: 10px; }
        .geek-fixed-width { display: inline-block; width: 120px; }
        .geek-right-box { text-align: right; min-width: 220px; font-weight: bold; }

        .c-up { color: #ff4c00; } /* 温和红 */
        .c-down { color: #0059fa; } /* 标准蓝 */

        /* 核心对齐法：推到底部 */
        .gege-up-box, .gege-down-box { margin-top: auto !important; margin-bottom: 0 !important; width: 95%; }
        .gege-ratio-box { margin-top: 10px; width: 95%; margin-bottom: 5px; }

        /* 细条组件 */
        .t-row { font-size: 12px; font-weight: bold; margin-bottom: 2px; display: flex; justify-content: space-between; font-family: Consolas; }
        .zte-thin-bar { width: 100%; height: 3px; background: rgba(0,0,0,0.05); border-radius: 1.5px; overflow: hidden; }
        .zte-thin-bar-inner { height: 100%; transition: width 0.5s ease-out; }
        .zte-thin-bar-inner.up { background: #ff4c00; }
        .zte-thin-bar-inner.down { background: #0059fa; }

        /* 雷达条：左红右蓝 */
        .gege-ratio-top { display: flex; justify-content: space-between; font-size: 12px; font-weight: bold; margin-bottom: 2px; }
        .gege-ratio-bar { width: 100%; height: 4px; background: #0059fa; border-radius: 2px; overflow: hidden; }
        .gege-ratio-bar-inner { height: 100%; background: #ff4c00; transition: width 0.5s ease-out; }

        /* 网速进度条 */
        .zte-enhance-speed { display: flex; flex-direction: column; gap: 6px; width: 100%; font-family: Consolas; }
        .zte-bar-wrap {
            position: relative; width: 100%; border-radius: 4px; border: 1px solid;
            font-size: 13px; font-weight: bold; overflow: hidden; padding: 3px 8px;
            display: flex; justify-content: space-between; align-items: center; z-index: 1; box-sizing: border-box;
        }
        .zte-bar-wrap span { font-size: inherit; font-weight: inherit; }
        .zte-bar-up { color: #ff4c00; border-color: rgba(255, 76, 0, 0.3); }
        .zte-bar-down { color: #0059fa; border-color: rgba(0, 89, 250, 0.3); }
        .zte-bar-up::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; z-index: -1; background: rgba(255, 76, 0, 0.12); width: var(--p-up, 0%); transition: width 0.5s; }
        .zte-bar-down::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; z-index: -1; background: rgba(0, 89, 250, 0.12); width: var(--p-down, 0%); transition: width 0.5s; }
    `;
    document.head.appendChild(style);

    // ======== [3] 核心拉取引擎 (1000ms 高频采样) ========

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
                    // 同步捕获官方底层累积流量 (单位转为 bits 以统一基准)
                    let upTp = parseFloat(dev.UpThroughput || 0) * 8000;
                    let downTp = parseFloat(dev.DownThroughput || 0) * 8000;
                    clientsInfo[mac] = { up: up, down: down, interface: dev.Interface || "", upTp: upTp, downTp: downTp };
                    curSumUp += up;
                    curSumDown += down;
                }
            });

            // 梯形积分
            if (State.lastTime !== 0) {
                let dt = (now - State.lastTime) / 1000;
                State.wanUpTraffic += ((State.wanUpSpeed + curWanUp) / 2) * dt;
                State.wanDownTraffic += ((State.wanDownSpeed + curWanDown) / 2) * dt;
                for (let mac in clientsInfo) {
                    if (!State.clients[mac]) State.clients[mac] = { upSpeed: 0, downSpeed: 0, upTraffic: 0, downTraffic: 0 };
                    let cS = State.clients[mac];
                    let cC = clientsInfo[mac];
                    cS.upTraffic += ((cS.upSpeed + cC.up) / 2) * dt;
                    cS.downTraffic += ((cS.downSpeed + cC.down) / 2) * dt;
                    cS.upSpeed = cC.up; cS.downSpeed = cC.down;
                }
            }
            State.lastTime = now;
            State.wanUpSpeed = curWanUp; State.wanDownSpeed = curWanDown;

            let lanUpVol = 0, lanDownVol = 0;
            for (let mac in State.clients) {
                lanUpVol += State.clients[mac].upTraffic; lanDownVol += State.clients[mac].downTraffic;
            }

            renderUI(curWanUp, curWanDown, curSumUp, curSumDown, lanUpVol, lanDownVol, clientsInfo);
        } catch (e) {
            console.error(e);
        } finally {
            isFetching = false;
        }
    }

    // ======== [4] 渲染层 (完美对齐逻辑) ========

    function renderUI(wanUp, wanDown, sumUp, sumDown, lanUpVol, lanDownVol, clientsInfo) {
        // 看板渲染
        let main = document.querySelector('.el-table') || document.querySelector('.config-item')?.closest('div') || document.querySelector('.main-content');
        if (main) {
            let board = document.getElementById('zte-geek-board');
            if (!board) {
                board = document.createElement('div');
                board.id = 'zte-geek-board';
                board.innerHTML = `
                    <div class="geek-row">
                        <span class="geek-label">WAN口速率</span>
                        <div class="geek-val-box"><span class="c-up geek-fixed-width" id="gb-wan-up-bps"></span><span class="c-down geek-fixed-width" id="gb-wan-down-bps"></span></div>
                        <div class="geek-right-box"><span class="c-up" id="gb-wan-up-bytes"></span> | <span class="c-down" id="gb-wan-down-bytes"></span></div>
                    </div>
                    <div class="geek-row">
                        <span class="geek-label">局域网代数和</span>
                        <div class="geek-val-box"><span class="c-up geek-fixed-width" id="gb-lan-up-bps"></span><span class="c-down geek-fixed-width" id="gb-lan-down-bps"></span></div>
                        <div class="geek-right-box">实时占比：<span class="c-up" id="gb-perc-up"></span> | <span class="c-down" id="gb-perc-down"></span></div>
                    </div>
                    <div class="geek-row">
                        <span class="geek-label">高精流量统计</span>
                        <div class="geek-val-box"><span class="c-up geek-fixed-width" id="gb-lan-up-vol"></span><span class="c-down geek-fixed-width" id="gb-lan-down-vol"></span></div>
                        <div class="geek-right-box">WAN：<span class="c-up" id="gb-wan-up-vol"></span> | <span class="c-down" id="gb-wan-down-vol"></span></div>
                    </div>`;
                main.parentNode.insertBefore(board, main);
            }
            document.getElementById('gb-wan-up-bps').textContent = `🔼 ${formatBps(wanUp)}`;
            document.getElementById('gb-wan-down-bps').textContent = `🔽 ${formatBps(wanDown)}`;
            document.getElementById('gb-wan-up-bytes').textContent = `🔼 ${formatBytes(wanUp)}`;
            document.getElementById('gb-wan-down-bytes').textContent = `🔽 ${formatBytes(wanDown)}`;
            document.getElementById('gb-lan-up-bps').textContent = `🔼 ${formatBps(sumUp)}`;
            document.getElementById('gb-lan-down-bps').textContent = `🔽 ${formatBps(sumDown)}`;
            document.getElementById('gb-perc-up').textContent = `🔼 ${wanUp>0?((sumUp/wanUp)*100).toFixed(1):0.0}%`;
            document.getElementById('gb-perc-down').textContent = `🔽 ${wanDown>0?((sumDown/wanDown)*100).toFixed(1):0.0}%`;
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
                    if (macMatch) { mac = macMatch[0].toLowerCase(); item.setAttribute('data-gege-mac', mac); }
                }
            }
            if (!mac) return;

            const cCur = clientsInfo[mac] || { up: 0, down: 0, interface: "", upTp: 0, downTp: 0 };
            const cS = State.clients[mac] || { upTraffic: 0, downTraffic: 0 };

            // --- 左侧：注入上行流量 (启用双轨制锚定) ---
            const devIntro = item.querySelector('.dev-intro');
            if (devIntro) {
                let box = devIntro.querySelector('.gege-up-box');
                if (!box) {
                    box = document.createElement('div'); box.className = 'gege-up-box';
                    box.innerHTML = `<div class="t-row c-up"><span>↑ <span class="v-vol"></span></span><span class="v-pct"></span></div><div class="zte-thin-bar"><div class="zte-thin-bar-inner up"></div></div>`;
                    devIntro.appendChild(box);
                }
                let p = State.wanUpTraffic>0?((cS.upTraffic/State.wanUpTraffic)*100).toFixed(1):0.0;
                box.querySelector('.v-vol').textContent = formatVolumeDual(cS.upTraffic, cCur.upTp);
                box.querySelector('.v-pct').textContent = p + '%';
                box.querySelector('.zte-thin-bar-inner').style.width = Math.min(p, 100) + '%';
            }

            // --- 中间：注入雷达与下行流量 ---
            const info = item.querySelector('.info');
            if (info) {
                Array.from(info.querySelectorAll('.dev-ip:not(.gege-box *)')).slice(1).forEach(n => n.style.display='none');
                info.querySelectorAll('.dev-number:not(.gege-box *)').forEach(n => n.style.display='none');

                let rBox = info.querySelector('.gege-ratio-box');
                if (!rBox) {
                    rBox = document.createElement('div'); rBox.className = 'gege-ratio-box';
                    rBox.innerHTML = `<div class="gege-ratio-top"><span class="v-port"></span><span class="v-rt-pct"></span></div><div class="gege-ratio-bar"><div class="gege-ratio-bar-inner"></div></div>`;
                    info.appendChild(rBox);
                }

                // 物理进度条比例 (严守旧版公式)
                let totalV = cS.upTraffic + cS.downTraffic;
                let barRatio = totalV > 0 ? (cS.upTraffic/totalV*100) : 0;

                // PCDN 雷达文本逻辑 (双模式适配)
                let textContent = "";
                let textColor = "#0059fa";

                if (CONFIG.calcMode === 1) {
                    let ratio = cS.downTraffic > 0 ? (cS.upTraffic / cS.downTraffic) : (cS.upTraffic > 0 ? Infinity : 0);
                    if (ratio > CONFIG.ratioExtremeUp) {
                        textColor = '#ff4c00';
                        textContent = (ratio === Infinity ? '∞' : ratio.toFixed(2)) + '⚠️';
                    } else if (ratio > CONFIG.ratioWarnUp) {
                        textColor = '#ff4c00';
                        textContent = (ratio * 100).toFixed(1) + '%';
                    } else if (ratio >= CONFIG.ratioExtremeDown) {
                        textColor = '#0059fa';
                        textContent = (ratio * 100).toFixed(1) + '%';
                    } else {
                        textColor = '#0059fa';
                        let revRatio = cS.upTraffic > 0 ? (cS.downTraffic / cS.upTraffic) : (cS.downTraffic > 0 ? Infinity : 0);
                        textContent = (revRatio === Infinity ? '∞' : revRatio.toFixed(1)) + 'x';
                    }
                } else {
                    textColor = barRatio > CONFIG.ratioThreshold ? '#ff4c00' : '#0059fa';
                    textContent = barRatio.toFixed(1) + '%';
                }

                rBox.querySelector('.v-port').textContent = CONFIG.portMap[cCur.interface] || cCur.interface || "未知";
                let rtPct = rBox.querySelector('.v-rt-pct');
                rtPct.textContent = textContent;
                rtPct.style.color = textColor;
                rBox.querySelector('.gege-ratio-bar-inner').style.width = Math.min(barRatio, 100) + '%';

                let dBox = info.querySelector('.gege-down-box');
                if (!dBox) {
                    dBox = document.createElement('div'); dBox.className = 'gege-down-box';
                    dBox.innerHTML = `<div class="t-row c-down"><span>↓ <span class="v-vol"></span></span><span class="v-pct"></span></div><div class="zte-thin-bar"><div class="zte-thin-bar-inner down"></div></div>`;
                    info.appendChild(dBox);
                }
                let dp = State.wanDownTraffic>0?((cS.downTraffic/State.wanDownTraffic)*100).toFixed(1):0.0;
                // 启用双轨制锚定渲染
                dBox.querySelector('.v-vol').textContent = formatVolumeDual(cS.downTraffic, cCur.downTp);
                dBox.querySelector('.v-pct').textContent = dp + '%';
                dBox.querySelector('.zte-thin-bar-inner').style.width = Math.min(dp, 100) + '%';
            }

            // --- 右侧：网速进度条 ---
            const speed = item.querySelector('.speed');
            if (speed) {
                speed.querySelectorAll('.connect-up, .connect-down').forEach(n => n.style.display='none');
                let enh = speed.querySelector('.zte-enhance-speed');
                if (!enh) {
                    enh = document.createElement('div'); enh.className = 'zte-enhance-speed';
                    enh.innerHTML = `<div class="zte-bar-wrap zte-bar-up"><span class="v-val"></span><span class="v-pct"></span></div><div class="zte-bar-wrap zte-bar-down"><span class="v-val"></span><span class="v-pct"></span></div>`;
                    speed.appendChild(enh);
                }
                let pu = wanUp>0?(cCur.up/wanUp*100):0, pd = wanDown>0?(cCur.down/wanDown*100):0;
                let bU = enh.querySelector('.zte-bar-up'), bD = enh.querySelector('.zte-bar-down');
                bU.style.setProperty('--p-up', Math.min(pu, 100)+'%');
                bU.querySelector('.v-val').textContent = `🔼 ${formatBytes(cCur.up)}`;
                bU.querySelector('.v-pct').textContent = (wanUp>0?pu.toFixed(1):0.0)+'%';
                bD.style.setProperty('--p-down', Math.min(pd, 100)+'%');
                bD.querySelector('.v-val').textContent = `🔽 ${formatBytes(cCur.down)}`;
                bD.querySelector('.v-pct').textContent = (wanDown>0?pd.toFixed(1):0.0)+'%';
            }
        });
    }

    setInterval(() => {
        if (location.hash && location.hash.includes('home') || document.querySelector('.config-item')) refreshSpeedData();
    }, 1000);

    window.addEventListener('load', () => setTimeout(refreshSpeedData, 500));
})();