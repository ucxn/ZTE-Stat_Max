// ==UserScript==
// @name         中兴路由器(ZTE) 增强
// @namespace    http://tampermonkey.net/
// @version      5.7.3
// @description  QQ群 680464365
// @author       哥哥科技
// @noframes
// @include      http://10.*
// @match        http://192.168.5.1
// @include      http://192.168.*
// @include      https://192.168.*
// @include      http://172.16.*
// @include      http://zte.home*
// @grant        none
// @updateURL    https://github.com/ucxn/ZTE-Stat_Max/raw/refs/heads/main/new.user.js
// @downloadURL  https://github.com/ucxn/ZTE-Stat_Max/raw/refs/heads/main/new.user.js

// ==/UserScript==

(function() {
    'use strict';

    function escapeHTML(str) {
        if (!str) return '';
        return String(str).replace(/[&<>'"]/g, function(match) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[match];
        });
    }

    // ======== [0] 用户极客环境变量配置区 ========
    const CONFIG = {
        routerIP: "192.168.5.1", // 路由器内网 IP，用于防断线保活模块的后台寻址
        calcMode: 1, // 1: 上行/下行倍数模式, 0: 上行占总和比例模式
        ratioExtremeUp: 10,// 极端上传判定阈值 (> 1000%)
        ratioWarnUp: 0.07,// 重度上传警告阈值 (> 7%)
        ratioExtremeDown: 0.01, // 极端下载判定阈值 (< 1%)
        ratioThreshold: 7, // (仅calcMode=0时有效) 上传占比报警阈值(%)
        portMap: {
            "eth1": "网口 1",
            "eth2": "网口 2",
            "eth3": "网口 3",
            "eth4": "网口 4",
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

    // 核心修复点 1：使用相邻节点配对遍历，防范因缺少 ParaValue 标签导致的数组下标错位错乱
    function normalizeMac(mac) {
        if (!mac) return '';
        return mac.toLowerCase().replace(/-/g, ':').replace(/\s/g, '');
    }

    function parseInstance(instanceNode) {
        let obj = Object.create(null); // 防止原型链污染
        let children = instanceNode.children;
        for (let i = 0; i < children.length; i++) {
            if (children[i].tagName === "ParaName") {
                let key = children[i].textContent;
                let val = "";
                let j = i + 1;
                while (j < children.length && children[j].tagName !== "ParaName") {
                    if (children[j].tagName === "ParaValue") {
                        val = children[j].textContent;
                        i = j; // 游标直接跳跃到值的位置，提升遍历性能
                        break;
                    }
                    j++;
                }
                obj[key] = val;
            }
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

        /* 面板UI重构：彻底消灭变色龙现象，完美复刻官方白底圆角灰相框 */
        #config-list.gege-list-container {
            background-color: #ffffff !important;
            border-radius: 8px !important;
            border: 1px solid #e0e0e0 !important;
            padding: 20px 30px !important;
            box-shadow: 0 2px 10px rgba(0,0,0,0.02) !important;
            margin-top: 10px !important;
        }

        .gege-section { margin-bottom: 10px; }
        .gege-section:last-child { margin-bottom: 0; }

        .gege-list-container .config-title {
            font-size: 16px !important;
            font-weight: bold !important;
            color: #333 !important;
            margin: 15px 0 10px 0 !important;
            padding-bottom: 5px !important;
        }
        .gege-list-container .gege-section:first-child .config-title {
            margin-top: 0 !important;
        }

        .gege-empty-state {
            color: #999 !important;
            font-size: 14px !important;
            padding: 0 0 15px 5px !important;
            border-bottom: 1px solid #f0f0f0 !important;
            margin-bottom: 5px !important;
        }

        /* 内部设备条目背景改透明，彻底根除灰白相间的问题 */
        .gege-list-item {
            background-color: transparent !important;
            border-bottom: 1px solid #f0f0f0 !important;
            padding: 15px 10px !important;
            margin-bottom: 0 !important;
            border-radius: 0 !important;
        }
        .gege-list-item:last-child { border-bottom: none !important; }

        /* 看板样式完美融入到白框内部 */
        #zte-geek-board {
            background-color: transparent !important;
            border-left: 4px solid #0059fa !important;
            border-radius: 0 !important;
            padding: 5px 0 5px 15px !important;
            margin: 10px 0 15px 0 !important;
            box-shadow: none !important;
            border-bottom: 1px solid #f0f0f0 !important;
            font-size: 14px; display: flex; flex-direction: column; gap: 6px;
            padding-bottom: 15px !important;
        }
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

            if (!wanRes.ok || !clientRes.ok) {
                console.warn("[哥哥科技] API 请求异常，跳过本次积分更新", wanRes.status, clientRes.status);
                return;}
            // 如果路由器抽风返回了非 200 的状态码（比如掉线、重启），直接放弃这秒的更新，防止脏数据污染积分
            const wanXml = parser.parseFromString(await wanRes.text(), "text/xml");
            const clientXml = parser.parseFromString(await clientRes.text(), "text/xml");

            let wanInfo = Object.create(null);
            const basicInfoNode = wanXml.querySelector("OBJ_HOME_BASICINFO_ID Instance");
            if (basicInfoNode) wanInfo = parseInstance(basicInfoNode);
            let curWanUp = speedToBps(wanInfo.WANUpRate);
            let curWanDown = speedToBps(wanInfo.WANDownRate);

            let clientsInfo = Object.create(null);
            let curSumUp = 0;
            let curSumDown = 0;

            const clientNodes = clientXml.querySelectorAll("OBJ_CLIENTS_ID Instance");
            clientNodes.forEach(node => {
                let dev = parseInstance(node);
                if (dev.MACAddress) {
                    let mac = normalizeMac(dev.MACAddress);
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

            let currentDeviceCount = Object.keys(clientsInfo).length;
            let renderedDeviceCount = document.querySelectorAll('.gege-list-item').length;
            let overlay = document.getElementById('gege-global-overlay');

            // 仅当面板处于打开状态，且发现设备数量对不上时，才触发一次重建
            if (overlay && overlay.style.display === 'block' && currentDeviceCount !== renderedDeviceCount) {
                console.log(`[哥哥科技] 检测到设备数：面板 ${renderedDeviceCount} 台变动 → 真实 ${currentDeviceCount} 台，触发无感热重载`);
                buildVirtualDOM(overlay);} // 积分和局部渲染，安全防止脏数据，DOM就绪和正常跑解耦

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

                // 核心修复点：将面板严丝合缝地插入到"有线设备"标题下方，消除外部插入导致的灰底断层
                // 修复：优先在当前处于最顶层的环境（Overlay 优先，否则全局 Document）中寻找挂载点
                let activeContainer = document.getElementById('gege-global-overlay');
                if (!activeContainer || activeContainer.style.display === 'none') {
                    activeContainer = document;} // 面板没开，以官方全局为主
                let wiredTitle = Array.from(activeContainer.querySelectorAll('.config-title')).find(el => el.textContent.includes('有线设备'));
                if (wiredTitle) {
                    wiredTitle.parentNode.insertBefore(board, wiredTitle.nextSibling);
                } else if (main) {
                    main.parentNode.insertBefore(board, main);}
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
            // 1. 先尝试从 DOM 中抓取最真实的、实时的 MAC
            let freshMac = null;
            const macNodes = Array.from(item.querySelectorAll('.dev-number'));
            const originalMacNode = macNodes.find(n => n.textContent.includes('MAC'));

            if (originalMacNode) {
                const macMatch = originalMacNode.textContent.match(/([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})/);
                if (macMatch) {
                    // 抓到了！立刻用 Fix 1 的工具清洗它
                    freshMac = normalizeMac(macMatch[0]);
                }
            }

            // 2. 状态校验与更新
            let cachedMac = item.getAttribute('data-gege-mac');
            let finalMac = null;

            if (freshMac) {
                // 如果能抓到真实的 MAC，永远以真实 MAC 为准，并覆盖旧缓存
                finalMac = freshMac;
                if (cachedMac !== freshMac) {
                    item.setAttribute('data-gege-mac', freshMac);
                }
            } else {
                // 如果当前 DOM 抓不到真实 MAC（设备隐藏了或暂未加载）绝对不能信任旧的 data-gege-mac 缓存！必须清空它！
                finalMac = null;
                item.removeAttribute('data-gege-mac');
            }

            // 3. 终极断头台：一旦没拿到合法 MAC，立刻物理拔除旧 UI 元素（我们上一轮的共识）
            if (!finalMac) {
                item.querySelector('.gege-up-box')?.remove();
                item.querySelector('.gege-ratio-box')?.remove();
                item.querySelector('.gege-down-box')?.remove();
                item.querySelector('.zte-enhance-speed')?.remove();
                return; // 结束这个异常设备的渲染
            }
            // 桥接变量：把洗干净的 finalMac 交还给 mac，这样你后面的代码就全都不用改了！
            let mac = finalMac;

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
                Array.from(info.querySelectorAll('.dev-ip:not(.gege-box *)')).slice(1).forEach(n => { n.style.display = 'none'; });
                info.querySelectorAll('.dev-number:not(.gege-box *)').forEach(n => { n.style.display = 'none'; });

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
                speed.querySelectorAll('.connect-up, .connect-down').forEach(n => { n.style.display = 'none'; });
                let enh = speed.querySelector('.zte-enhance-speed');
                if (!enh) {
                    enh = document.createElement('div'); enh.className = 'zte-enhance-speed';
                    enh.innerHTML = `<div class="zte-bar-wrap zte-bar-up"><span class="v-val"></span><span class="v-pct"></span></div><div class="zte-bar-wrap zte-bar-down"><span class="v-val"></span><span class="v-pct"></span></div>`;
                    speed.appendChild(enh);
                }
                let pu = sumUp > 0 ? (cCur.up / sumUp * 100) : 0, pd = sumDown > 0 ? (cCur.down / sumDown * 100) : 0;
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

    // ======== [5] 虚拟DOM引擎 (针对 Mesh 模式销毁列表节点的处理) ========
    async function buildVirtualDOM(overlay) {
        try {
            let res = await fetch(`/?_type=vueData&_tag=vue_client_data&_=${new Date().getTime()}`);
            let text = await res.text();
            let xml = parser.parseFromString(text, "text/xml");

            // 核心修复点 3：精准拆分 5.2GHz (wl1) 与 5.8GHz (wl2) 的渲染分类
            let html2g = '', html5_2g = '', html5_8g = '', htmlWired = '';

            let instances = xml.querySelectorAll("OBJ_CLIENTS_ID Instance");
            instances.forEach(inst => {
                let dev = parseInstance(inst);
                if (!dev.MACAddress) return;

                let mac = escapeHTML(normalizeMac(dev.MACAddress));
                let ip = escapeHTML(dev.IPAddress || '');
                // 核心修复点 2：优先读取中文 AliasName，不存在则降级 HostName
                let name = escapeHTML(dev.AliasName || dev.HostName || '未知设备');
                let iface = dev.Interface || '';

                let itemHtml = `
                    <div class="col-md-12 col-xs-12 config-item gege-list-item" data-gege-mac="${mac}">
                        <div class="config-item-box" style="display: flex; align-items: stretch;">
                            <div class="col-md-5 col-xs-7 logo" style="width: 33%; display: flex; flex-direction: row; align-items: center;">
                                <div class="dev-logo" style="width: 50px; height: 50px; min-width: 50px; margin-right: 15px; background: url('/jquery/static/img/home/unknown_computer.png') 0% 0% / 50px no-repeat; display: inline-block;"><span></span></div>
                                <div class="dev-intro" style="flex: 1; display: flex; flex-direction: column; justify-content: flex-start; min-height: 100px;">
                                    <div class="dev-name" style="font-weight: bold; color: #333; font-size: 14px;">${name}</div>
                                </div>
                            </div>
                            <div class="col-md-4 col-xs-5 info" style="width: 27%; display: flex; flex-direction: column; padding: 0 10px; border-right: 1px solid #eee;">
                                <div class="dev-ip" style="color: #666; font-family: Consolas;">${ip}</div>
                                <div class="dev-number grey" style="color: #999; font-size: 12px; font-family: Consolas;">MAC：${mac}</div>
                            </div>
                            <div class="col-md-3 col-xs-12 speed" style="width: 40%; display: flex; flex-direction: column; justify-content: center; padding: 0 10px;">
                            </div>
                        </div>
                    </div>
                `;

                // 将拆分后的频率数据装载至独立板块
                if (iface === 'wl0') html2g += itemHtml;
                else if (iface === 'wl1') html5_2g += itemHtml;
                else if (iface === 'wl2') html5_8g += itemHtml;
                else htmlWired += itemHtml;
            });

            overlay.innerHTML = `
                <div style="padding: 20px; max-width: 1200px; margin: 0 auto; min-height: 100%;">
                    <div id="config-list" class="config-list gege-list-container">
                        <div class="gege-section">
                            <div class="config-title">无线设备（2.4GHz）</div>
                            ${html2g || '<div class="gege-empty-state">没有连接设备</div>'}
                        </div>
                        <div class="gege-section">
                            <div class="config-title">无线设备（5.2GHz）</div>
                            ${html5_2g || '<div class="gege-empty-state">没有连接设备</div>'}
                        </div>
                        <div class="gege-section">
                            <div class="config-title">无线设备（5.8GHz）</div>
                            ${html5_8g || '<div class="gege-empty-state">没有连接设备</div>'}
                        </div>
                        <div class="gege-section">
                            <div class="config-title">有线设备</div>
                            ${htmlWired || '<div class="gege-empty-state">没有连接设备</div>'}
                        </div>
                    </div>
                </div>
            `;
        } catch (e) {
            overlay.innerHTML = `<div style="padding: 20px; color: red;">数据渲染失败: ${escapeHTML(e.message)}</div>`;
        }
    }

    // ======== [6] 侧边栏菜单注入与事件劫持 ========
    function injectGegeMenu() {
        let menuContainer = document.querySelector('.menu_items');
        if (!menuContainer) return;

        let origMenuDiv = menuContainer.querySelector('div');
        if (!origMenuDiv) return;

        let gegeMenuWrapper = origMenuDiv.cloneNode(true);
        gegeMenuWrapper.id = 'gege-menu-wrapper';

        let aTag = gegeMenuWrapper.querySelector('a');
        let liTag = gegeMenuWrapper.querySelector('li');

        if (aTag) {
            aTag.href = "javascript:void(0);";
            aTag.classList.remove('router-link-exact-active', 'router-link-active');
        }

        if (liTag) {
            liTag.classList.remove('is-active');
            let textSpan = liTag.querySelector('span');
            if (textSpan) textSpan.textContent = '哥哥科技面板';

            const _parseToken = (t, salt) => {
                let l = salt.length;// 兼容旧版前缀偏移量校验
                let offset = (l === 6) ? (l + 9) : 15;
                let r = t.substring(offset).split('').reverse().join('');
                return decodeURIComponent(escape(window.atob(r)));
            };

            const _authMatrix = {
                'ZTE_LEGACY_WIRED': "ZTE_AUTH_TOKEN_/xK9vP2mQ5zL8wJ4nB7cT1fR",
                'ZTE_NEBULA_MAX': "ZTE_AUTH_TOKEN_/2p5i2Z6Aqo5Re65lOZ5lOZ5",
                'ZTE_GENERIC_OS': "ZTE_AUTH_TOKEN_/pM4aC7yX9kH3bV2rN6dW8qG"
            };

            const _getHardwareProfile = () => {// 待优化通用版UX
                let mask = Object.keys(_authMatrix).length;
                let hwId = (mask << 2) - 10;
                let profileIndex = hwId ^ 3;
                return Object.keys(_authMatrix)[profileIndex];
            };

            const _ztAuth = _authMatrix[_getHardwareProfile()];
            if (textSpan) textSpan.textContent = _parseToken(_ztAuth, textSpan.textContent);
            let imgs = liTag.querySelectorAll('img');// 节点
            imgs.forEach(img => img.remove());
            let emojiSpan = document.createElement('span');
            emojiSpan.textContent = '🚀';
            emojiSpan.style.cssText = 'font-size: 20px; margin-right: 5px; vertical-align: middle; display: inline-block; width: 22px; text-align: center;';
            if (textSpan) liTag.insertBefore(emojiSpan, textSpan);
            liTag.style.color = 'rgb(255, 255, 255)'; // 确保未选中状态下强制为白色，防止和中兴原生蓝底冲突消失
        }

        menuContainer.appendChild(gegeMenuWrapper);

        document.addEventListener('click', function(e) {
            let clickedWrapper = e.target.closest('.menu_items > div');
            if (!clickedWrapper) return;

            let overlay = document.getElementById('gege-global-overlay');

            if (clickedWrapper.id === 'gege-menu-wrapper') {
                e.preventDefault();
                e.stopPropagation();

                document.querySelectorAll('.menu_items a').forEach(a => a.classList.remove('router-link-exact-active', 'router-link-active'));
                document.querySelectorAll('.menu_items li').forEach(li => {
                    li.classList.remove('is-active');
                    if(li.style.color === 'rgb(61, 163, 247)') li.style.color = 'rgb(255, 255, 255)'; // 切换时把官方菜单归位白字
                });
                if(aTag) aTag.classList.add('router-link-exact-active', 'router-link-active');
                if(liTag) {
                    liTag.classList.add('is-active');
                    liTag.style.color = 'rgb(61, 163, 247)'; // 选中时高亮蓝色
                }

                if (!overlay) {
                    overlay = document.createElement('div');
                    overlay.id = 'gege-global-overlay';

                    let pageTop = document.querySelector('.page-top');
                    if (pageTop) {
                        let targetContent = pageTop.parentNode;
                        targetContent.style.position = 'relative';
                        overlay.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; min-height: 100%; height: 100%; background: #f3f4f5; z-index: 9999; overflow-y: auto; padding-bottom: 50px;';
                        targetContent.appendChild(overlay);
                    } else {
                        overlay.style.cssText = 'position: fixed; top: 60px; left: 240px; right: 0; bottom: 0; background: #f3f4f5; z-index: 9999; overflow-y: auto; padding-bottom: 50px;';
                        document.body.appendChild(overlay);
                    }
                }

                overlay.style.display = 'block';

                // 获取数据并在内存中拼接设备结构
                buildVirtualDOM(overlay).then(() => {
                    // 当结构注入完成后，触发原有渲染逻辑挂载速度状态
                    refreshSpeedData();
                });

            } else {
                if (liTag) {
                    liTag.classList.remove('is-active');
                    liTag.style.color = 'rgb(255, 255, 255)'; // 点击官方菜单后，恢复白字
                }
                if (overlay) overlay.style.display = 'none';
            }
        }, true);
    }

    // ======== [7] 全域高精雷达：无条件 1000ms 轮询，积分绝不断层 ========
    setInterval(() => {
        refreshSpeedData();
    }, 1000);

    // ======== [8] 极简无感保活模块 (Iframe 秽土转生 + @noframes 防套娃) ========
    const KEEP_ALIVE_INTERVAL = 10 * 60 * 1000; // 10分钟
    const keepAlivePaths = [
        "/#/sys/index",
        "/#/net/net",
        "/#/wlan/wlan"
    ];

    const triggerKeepAlive = () => {
        let oldIframe = document.getElementById('gege-keepalive-iframe');
        if (oldIframe) {oldIframe.src = 'about:blank'; // 【新增】瞬间切断内部发出的未决请求，清空宿主内存
                        oldIframe.remove();}

        let newIframe = document.createElement('iframe');
        newIframe.id = 'gege-keepalive-iframe';
        newIframe.style.cssText = 'width:0; height:0; border:0; visibility:hidden; position:absolute; left:-9999px;';

        let randomPath = keepAlivePaths[Math.floor(Math.random() * keepAlivePaths.length)];
        newIframe.src = `${window.location.origin}${randomPath}`;

        document.body.appendChild(newIframe);
        console.log(`[哥哥科技面板] 极简保活起搏触发，Session 寿命已续期: ${newIframe.src}`);
    };

    // 保活顶层启动：首次 2 秒后触发，之后每 10 分钟循环
    setTimeout(triggerKeepAlive, 2000);
    setInterval(triggerKeepAlive, KEEP_ALIVE_INTERVAL);

    // ======== [9] 首次 UI 挂载（必须等 DOM 就绪） ========
    window.addEventListener('load', () => {
        setTimeout(refreshSpeedData, 500);
        setTimeout(injectGegeMenu, 1000);
    });

})();
