// ==UserScript==
// @name         中兴路由器(ZTE) 赛博增强脚本 (总速与占比显示)
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  为中兴路由器后台增加全局总网速显示，并为每个设备注入类似小米的红蓝网速占比进度条。
// @author       Gemini & 哥哥科技
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

    // ======== [1] 核心工具函数 ========

    // 将带有单位的速度字符串转换为纯数字 (bps)
    function speedToBps(speedStr) {
        if (!speedStr) return 0;
        let match = speedStr.match(/([\d.]+)\s*(G|M|K)?bps/i);
        if (!match) return 0;
        let val = parseFloat(match[1]);
        let unit = (match[2] || "").toUpperCase();
        if (unit === 'G') return val * 1024 * 1024 * 1024;
        if (unit === 'M') return val * 1024 * 1024;
        if (unit === 'K') return val * 1024;
        return val;
    }

    // 将 bps 转换为人类可读的字节速度 (B/s, KB/s, MB/s)
    function formatSpeed(bps) {
        let bytes = bps / 8; // 比特转字节
        if (bytes === 0) return '0 B/s';
        if (bytes > 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB/s';
        if (bytes > 1024) return (bytes / 1024).toFixed(2) + ' KB/s';
        return bytes.toFixed(2) + ' B/s';
    }

    // 解析中兴那种复古的 XML <Instance> 为标准的 JS 对象
    function parseInstance(instanceNode) {
        let obj = {};
        let names = instanceNode.querySelectorAll("ParaName");
        let values = instanceNode.querySelectorAll("ParaValue");
        for(let i = 0; i < names.length; i++) {
            obj[names[i].textContent] = values[i] ? values[i].textContent : "";
        }
        return obj;
    }

    // ======== [2] 注入专属 CSS 样式 ========

    const style = document.createElement('style');
    style.innerHTML = `
        /* 顶部总速度看板 */
        #zte-total-speed-board {
            background: #f8f9fa; border-left: 5px solid #0059fa; border-radius: 4px;
            padding: 12px 20px; margin-bottom: 15px; display: flex; align-items: center;
            justify-content: space-between; box-shadow: 0 2px 8px rgba(0,0,0,0.05);
            font-size: 16px; font-weight: bold; color: #333;
        }
        .zte-total-up { color: #ff4c00; margin-right: 20px; }
        .zte-total-down { color: #0059fa; }

        /* 单设备进度条容器 */
        .zte-enhance-speed { display: flex; flex-direction: column; gap: 6px; width: 100%; min-width: 140px; margin-top: 5px;}

        /* 进度条本体 */
        .zte-bar-wrap {
            position: relative; width: 100%; border-radius: 4px; border: 1px solid;
            font-size: 12px; font-weight: bold; overflow: hidden; padding: 2px 6px;
            display: flex; justify-content: space-between; z-index: 1;
        }
        .zte-bar-up { color: #ff4c00; border-color: rgba(255, 76, 0, 0.4); }
        .zte-bar-down { color: #0059fa; border-color: rgba(0, 89, 250, 0.4); }

        /* 进度条填充动画层 */
        .zte-bar-up::before, .zte-bar-down::before {
            content: ''; position: absolute; left: 0; top: 0; bottom: 0; z-index: -1;
            transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .zte-bar-up::before { background: rgba(255, 76, 0, 0.15); width: var(--p-up, 0%); }
        .zte-bar-down::before { background: rgba(0, 89, 250, 0.15); width: var(--p-down, 0%); }
    `;
    document.head.appendChild(style);

    // ======== [3] 核心拉取与渲染逻辑 ========

    async function refreshSpeedData() {
        try {
            const timestamp = new Date().getTime();

            // 并发请求两个 API
            const [wanRes, clientRes] = await Promise.all([
                fetch(`/?_type=vueData&_tag=vue_home_device_data_no_update_sess&IF_OP=refresh&_=${timestamp}`),
                fetch(`/?_type=vueData&_tag=vue_client_data&_=${timestamp}`)
            ]);

            const wanText = await wanRes.text();
            const clientText = await clientRes.text();

            const parser = new DOMParser();
            const wanXml = parser.parseFromString(wanText, "text/xml");
            const clientXml = parser.parseFromString(clientText, "text/xml");

            // 1. 获取官方 WAN 口总带宽
            let wanInfo = {};
            const basicInfoNode = wanXml.querySelector("OBJ_HOME_BASICINFO_ID Instance");
            if (basicInfoNode) wanInfo = parseInstance(basicInfoNode);

            let officialWanUpBps = speedToBps(wanInfo.WANUpRate);
            let officialWanDownBps = speedToBps(wanInfo.WANDownRate);

            // 2. 解析所有单设备网速，并累加局域网总速
            let clientsInfo = {};
            let sumLanUpBps = 0;
            let sumLanDownBps = 0;

            const clientNodes = clientXml.querySelectorAll("OBJ_CLIENTS_ID Instance");
            clientNodes.forEach(node => {
                let dev = parseInstance(node);
                if (dev.MACAddress) {
                    let mac = dev.MACAddress.toLowerCase();
                    let up = speedToBps(dev.UpRate);
                    let down = speedToBps(dev.DownRate);

                    clientsInfo[mac] = { up: up, down: down };
                    sumLanUpBps += up;
                    sumLanDownBps += down;
                }
            });

            // 3. 完美防爆分母逻辑：取官方 WAN 速 和 局域网累加总速 的最大值
            let finalTotalUpBps = Math.max(officialWanUpBps, sumLanUpBps);
            let finalTotalDownBps = Math.max(officialWanDownBps, sumLanDownBps);

            // 4. 渲染 UI
            renderUI(finalTotalUpBps, finalTotalDownBps, clientsInfo);

        } catch (error) {
            console.error("赛博增强脚本获取数据出错：", error);
        }
    }

    function renderUI(totalUp, totalDown, clientsInfo) {
        // --- A. 渲染顶部总看板 ---
        let mainContainer = document.querySelector('.el-table') || document.querySelector('.config-item')?.closest('div') || document.querySelector('.main-content');

        if (mainContainer) {
            let totalBoard = document.getElementById('zte-total-speed-board');
            if (!totalBoard) {
                totalBoard = document.createElement('div');
                totalBoard.id = 'zte-total-speed-board';
                // 插入到列表容器的顶部
                mainContainer.parentNode.insertBefore(totalBoard, mainContainer);
            }
            totalBoard.innerHTML = `
                <div>
                    <span>🚀 赛博组网总速率监控</span>
                </div>
                <div>
                    <span class="zte-total-up">🔼 上行：${formatSpeed(totalUp)}</span>
                    <span class="zte-total-down">🔽 下行：${formatSpeed(totalDown)}</span>
                </div>
            `;
        }

        // --- B. 渲染每个设备的进度条 ---
        const deviceItems = document.querySelectorAll('.config-item');
        deviceItems.forEach(item => {
            // 提取 MAC 地址
            const macNode = item.querySelector('.dev-number');
            if (!macNode) return;

            // 使用正则精准提取 MAC (兼容不同大小写和空格)
            const macMatch = macNode.textContent.match(/([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})/);
            if (!macMatch) return;
            const mac = macMatch[0].toLowerCase();

            const devData = clientsInfo[mac] || { up: 0, down: 0 };

            // 计算占比百分比 (防除以 0)
            const pUp = totalUp > 0 ? ((devData.up / totalUp) * 100).toFixed(1) : 0;
            const pDown = totalDown > 0 ? ((devData.down / totalDown) * 100).toFixed(1) : 0;

            // 寻找挂载点 (你截图里的 div.speed)
            const speedContainer = item.querySelector('.speed');
            if (!speedContainer) return;

            // 隐藏官方那些不带占比的灰色老旧文字
            const originalSpans = speedContainer.querySelectorAll('.connect-up, .connect-down');
            originalSpans.forEach(span => span.style.display = 'none');

            // 查找是否已经注入了我们的定制条
            let enhanceDiv = speedContainer.querySelector('.zte-enhance-speed');
            if (!enhanceDiv) {
                enhanceDiv = document.createElement('div');
                enhanceDiv.className = 'zte-enhance-speed';
                enhanceDiv.innerHTML = `
                    <div class="zte-bar-wrap zte-bar-up">
                        <span>🔼 ${formatSpeed(0)}</span><span class="p-text">0.0%</span>
                    </div>
                    <div class="zte-bar-wrap zte-bar-down">
                        <span>🔽 ${formatSpeed(0)}</span><span class="p-text">0.0%</span>
                    </div>
                `;
                speedContainer.appendChild(enhanceDiv);
            }

            // 更新动态数据和样式宽度
            const upBar = enhanceDiv.querySelector('.zte-bar-up');
            const downBar = enhanceDiv.querySelector('.zte-bar-down');

            upBar.style.setProperty('--p-up', `${pUp}%`);
            upBar.children[0].innerHTML = `🔼 ${formatSpeed(devData.up)}`;
            upBar.children[1].innerHTML = `${pUp}%`;

            downBar.style.setProperty('--p-down', `${pDown}%`);
            downBar.children[0].innerHTML = `🔽 ${formatSpeed(devData.down)}`;
            downBar.children[1].innerHTML = `${pDown}%`;
        });
    }

    // ======== [4] 启动引擎 ========

    // 每 2 秒刷新一次，保证极高的丝滑响应度
    setInterval(() => {
        // 只有在路由器的对应组网/设备页面才去跑逻辑，节省性能
        if (location.hash && location.hash.includes('home') || document.querySelector('.config-item')) {
            refreshSpeedData();
        }
    }, 2000);

    // 页面加载完成后立刻执行一次
    window.addEventListener('load', () => {
        setTimeout(refreshSpeedData, 500);
    });

})();