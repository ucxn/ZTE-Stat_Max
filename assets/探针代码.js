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

                    clientsInfo[mac] = { 上行速率: up, 下行速率: down, interface: dev.Interface || "", 官方上: upTp, 官方下: downTp };
                    curSumUp += up;
                    curSumDown += down;
                }
            });
// --- [新增] 极客调试探针：MAC专属 Δ心跳序列追踪器 ---
            if (!window.__gegeDebugCache) window.__gegeDebugCache = {};
            let hasChange = false;
            let currentNow = performance.now();

            for (let mac in clientsInfo) {
                let curU = clientsInfo[mac].上行速率;
                let curD = clientsInfo[mac].下行速率;
                let cache = window.__gegeDebugCache[mac];

                // 首次见面，建档建卡，但不算差值
                if (!cache) {
                    window.__gegeDebugCache[mac] = { up: curU, down: curD, lastTime: currentNow, deltas: [] };
                    continue;
                }

                // 抓到网速真实跳动
                if (cache.up !== curU || cache.down !== curD) {
                    hasChange = true;
                    // 1. 算高精度时间差
                    let timeDiff = (currentNow - cache.lastTime).toFixed(1);

                    // 2. 将这次的 Δ 塞进历史数组（最多保留最近 12 次跳动记录）
                    cache.deltas.push(timeDiff);
                    if (cache.deltas.length > 12) {
                        cache.deltas.shift(); // 踢掉最老的数据，保持队列长度
                    }

                    // 3. 覆盖更新网速和时间锚点
                    cache.up = curU;
                    cache.down = curD;
                    cache.lastTime = currentNow;
                }
            }

            // 只要有任何设备的数组更新了，就重绘整张表
            if (hasChange) {
                let dbgBox = document.getElementById('gege-debug-box');
                if (!dbgBox) {
                    dbgBox = document.createElement('div');
                    dbgBox.id = 'gege-debug-box';
                    // 狂暴加宽，给后面的 Δ 序列留足横向空间
                    dbgBox.style.cssText = 'position:fixed; bottom:20px; left:20px; width:750px; height:350px; background:rgba(0,0,0,0.85); color:#0f0; font-family:Consolas, monospace; font-size:12px; z-index:99999; overflow-y:auto; padding:15px; border-radius:6px; pointer-events:none; box-shadow:0 0 15px rgba(0,0,0,0.8);';
                    document.body.appendChild(dbgBox);
                }

                // 拼装表格内容
                let html = '<div style="border-bottom:2px solid #0f0; padding-bottom:5px; margin-bottom:5px; font-weight:bold;">[哥哥科技] 局域网设备底层物理心跳 (Δ) 观测仪</div>';

                for (let mac in window.__gegeDebugCache) {
                    let c = window.__gegeDebugCache[mac];
                    if (c.deltas.length === 0) continue; // 还没跳动过的设备先不显示

                    let shortMac = mac.slice(-8); // 截取 MAC 后半段
                    // 将时间差数组高亮拼接
                    let deltaStr = c.deltas.map(d => `<span style="color:#fff; font-weight:bold; background:rgba(255,255,255,0.15); padding:0 3px; border-radius:2px;">${d}</span>`).join(' , ');

                    // 极致排版：MAC宽度固定，网速宽度固定，最后面无限追加 Δ
                    html += `
                    <div style="display:flex; align-items:center; border-bottom:1px dashed #040; padding:4px 0;">
                        <span style="width:75px; color:#aaa;">${shortMac}</span>
                        <span style="width:160px; color:#888;">↑${formatBps(c.up).padEnd(10)} ↓${formatBps(c.down)}</span>
                        <span style="flex:1;">Δ历史: ${deltaStr}</span>
                    </div>`;
                }

                dbgBox.innerHTML = html;
            }
            // --- 探针代码结束 ---
            let currentDeviceCount = Object.keys(clientsInfo).length;
            let renderedDeviceCount = document.querySelectorAll('.gege-list-item').length;
            let overlay = document.getElementById('gege-global-overlay');
