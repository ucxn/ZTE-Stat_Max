// --- [新增] 哥哥科技企业级物理心跳 (Δ) 雷达与高级统计分析仪 ---
if (!window.__gegeDebugCache) window.__gegeDebugCache = { isFrozen: false, targets: {} };
let hasChange = false;
let currentNow = performance.now();

// 1. 统合数据源：将 WAN 口伪装成特殊设备，强制塞入遍历矩阵
let monitorTargets = {
    "WAN_MASTER": { name: "[⭐总线 WAN口]", up: curWanUp, down: curWanDown, isWan: true }
};
for(let m in clientsInfo) {
    monitorTargets[m] = { name: m.slice(-8), up: clientsInfo[m].上行速率, down: clientsInfo[m].下行速率, isWan: false };
}

// 2. 数据采集引擎 (无上限模式，设为 10000 防爆内存)
for (let mac in monitorTargets) {
    let target = monitorTargets[mac];
    let cache = window.__gegeDebugCache.targets[mac];

    if (!cache) {
        window.__gegeDebugCache.targets[mac] = { up: target.up, down: target.down, lastTime: currentNow, deltas: [] };
        continue;
    }

    // 触发物理跳动判定
    if (cache.up !== target.up || cache.down !== target.down) {
        hasChange = true;
        let timeDiff = parseFloat((currentNow - cache.lastTime).toFixed(1));

        cache.deltas.push(timeDiff);
        if (cache.deltas.length > 10000) cache.deltas.shift(); // 维持万级样本池

        cache.up = target.up;
        cache.down = target.down;
        cache.lastTime = currentNow;
    }
}

// 3. UI 渲染与复杂统计学计算引擎 (冻结状态下跳过渲染，但上方数据仍在悄悄采集)
if (hasChange && !window.__gegeDebugCache.isFrozen) {
    let dbgBox = document.getElementById('gege-debug-box');
    if (!dbgBox) {
        dbgBox = document.createElement('div');
        dbgBox.id = 'gege-debug-box';
        // 1080px 宽广视界，最大高度 80vh 自动延展
        dbgBox.style.cssText = 'position:fixed; bottom:20px; left:50%; transform:translateX(-50%); width:1080px; max-height:80vh; background:rgba(0,0,0,0.92); color:#0f0; font-family:Consolas, monospace; font-size:12px; z-index:99999; overflow-y:auto; padding:15px; border-radius:8px; box-shadow:0 10px 30px rgba(0,0,0,0.9); border: 1px solid #333; backdrop-filter: blur(5px);';
        document.body.appendChild(dbgBox);

        // 绑定冻结按钮事件 (利用事件委托)
        dbgBox.addEventListener('click', (e) => {
            if (e.target.id === 'gege-freeze-btn') {
                window.__gegeDebugCache.isFrozen = !window.__gegeDebugCache.isFrozen;
                e.target.textContent = window.__gegeDebugCache.isFrozen ? "▶️ 恢复实时渲染 (已冻结画面，可安心拖拽复制)" : "⏸️ 画面定格导出";
                e.target.style.color = window.__gegeDebugCache.isFrozen ? "#ff0" : "#fff";
            }
        });
    }

    let timeStr = new Date().toTimeString().split(' ')[0] + '.' + String(new Date().getMilliseconds()).padStart(3, '0');
    let html = `
                <div style="border-bottom:2px solid #0f0; padding-bottom:8px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:15px; font-weight:bold; text-shadow:0 0 5px #0f0;">[哥哥科技] 企业级物理心跳观测仪 & 统计分析台 (N≤10000)</span>
                    <div>
                        <span style="color:#aaa; margin-right:15px;">实时时间戳: ${timeStr}</span>
                        <button id="gege-freeze-btn" style="background:#333; color:#fff; border:1px solid #555; padding:3px 10px; border-radius:4px; cursor:pointer; font-family:inherit;">⏸️ 画面定格导出</button>
                    </div>
                </div>`;

    // 将 WAN 口提权置顶
    let macs = Object.keys(window.__gegeDebugCache.targets).sort((a, b) => (a === "WAN_MASTER" ? -1 : (b === "WAN_MASTER" ? 1 : 0)));

    for (let mac of macs) {
        let c = window.__gegeDebugCache.targets[mac];
        let n = c.deltas.length;
        if (n === 0) continue;

        let isWan = mac === "WAN_MASTER";
        let nameTag = isWan ? "<span style='color:#ffd700; text-shadow:0 0 3px #ffd700;'>[WAN] 出口总线</span>" : "<span style='color:#aaa;'>MAC: " + mac.slice(-8) + "</span>";
        let colorBase = isWan ? "#ffd700" : "#0f0";

        // --- 数学统计引擎运行 ---
        let sum = 0; for(let i=0; i<n; i++) sum += c.deltas[i];
        let mean = sum / n;

        let varianceSum = 0, jitterSum = 0, deviations = [];
        for(let i=0; i<n; i++) {
            let diff = c.deltas[i] - mean;
            varianceSum += diff * diff;
            deviations.push(Math.abs(diff));
            if (i > 0) jitterSum += Math.abs(c.deltas[i] - c.deltas[i-1]);
        }
        let variance = varianceSum / n;
        let stdDev = Math.sqrt(variance);
        let jitter = n > 1 ? (jitterSum / (n - 1)) : 0;
        let cv = mean > 0 ? (stdDev / mean * 100) : 0; 

        deviations.sort((a, b) => a - b);
        let d95 = deviations[Math.floor(n * 0.95)] || 0;
        let d98 = deviations[Math.floor(n * 0.98)] || 0;
        let maxD = deviations[n - 1] || 0;

        // --- 渲染模块 ---
        let statsHtml = `
                    <div style="font-size:12px; color:#999; display:grid; grid-template-columns: repeat(4, 1fr); gap: 4px 15px; margin-bottom: 6px; background:rgba(0,0,0,0.4); padding:6px; border-radius:4px;">
                        <span>N(样本量): <b style="color:${colorBase}">${n}</b></span>
                        <span>μ(均值): <b style="color:#fff">${mean.toFixed(1)}</b> ms</span>
                        <span>Jitter(抖动): <b style="color:#ff4c00">${jitter.toFixed(2)}</b> ms</span>
                        <span>CV(变异系数): <b style="color:#00ffff">${cv.toFixed(2)}%</b></span>
                        
                        <span>σ²(方差): <b style="color:#aaa">${variance.toFixed(1)}</b></span>
                        <span>95% 级差: <b style="color:#fff">±${d95.toFixed(1)}</b> ms</span>
                        <span>98% 级差: <b style="color:#ff8800">±${d98.toFixed(1)}</b> ms</span>
                        <span>Max(极差): <b style="color:#ff0000">±${maxD.toFixed(1)}</b> ms</span>
                    </div>`;

        // 序列带 (原味输出，用逗号分隔，极其方便你直接拷贝喂给 AI 或导入 Excel)
        let deltaStr = c.deltas.join(', ');

        html += `
                    <div style="border:1px solid ${isWan ? 'rgba(255,215,0,0.3)' : 'rgba(255,255,255,0.1)'}; background:${isWan ? 'rgba(255,215,0,0.05)' : 'rgba(255,255,255,0.03)'}; margin-bottom:12px; padding:10px; border-radius:6px; display:flex; flex-direction:column;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
                            <div style="width:160px; font-weight:bold; font-size:14px;">${nameTag}</div>
                            <div style="width:180px; color:#ddd; text-align:center;">↑${formatBps(c.up).padEnd(10)} <br> ↓${formatBps(c.down)}</div>
                            <div style="flex:1; margin-left:15px;">${statsHtml}</div>
                        </div>
                        <div style="width:100%; overflow-x:auto; white-space:nowrap; padding:8px 5px; color:#ccc; background:#111; border-radius:4px; font-family:Consolas, monospace; scrollbar-width:thin; scrollbar-color:${colorBase} transparent;">
                            ${deltaStr}
                        </div>
                    </div>`;
    }
    dbgBox.innerHTML = html;
}
// --- 探针代码结束 ---

---

  新版



// ====================================================================
// --- [新增] 心跳间隔雷达 (10秒硬预热 + 紧凑UI) ---
// ====================================================================
if (!window.__gegeDebugCache) {
    window.__gegeDebugCache = { 
        isFrozen: false, 
        targets: {},
        bootTime: performance.now() // [新增] 记录探针引擎启动的绝对时间
    };
}

let hasChange = false;
let currentNow = performance.now();
let bootElapsed = currentNow - window.__gegeDebugCache.bootTime;
let isWarmingUp = bootElapsed < 10000; // 10秒绝对预热期

// 1. 统合数据源
let monitorTargets = {
    "WAN_MASTER": { name: "[⭐总线 WAN口]", up: curWanUp, down: curWanDown, isWan: true }
};
for(let m in clientsInfo) {
    monitorTargets[m] = { name: m.slice(-8), up: clientsInfo[m].上行速率, down: clientsInfo[m].下行速率, isWan: false };
}

// 2. 数据采集引擎 (预热锁死 + 真暂停拦截)
if (!window.__gegeDebugCache.isFrozen) {
    for (let mac in monitorTargets) {
        let target = monitorTargets[mac];
        let cache = window.__gegeDebugCache.targets[mac];

        if (!cache) {
            window.__gegeDebugCache.targets[mac] = { 
                up: target.up, down: target.down, lastTime: currentNow, 
                deltas: [], 
                isFirstJump: true 
            };
            continue;
        }

        // 触发物理跳动判定
        if (cache.up !== target.up || cache.down !== target.down) {
            hasChange = true;

            // [核心优化] 10秒预热期内：跟随网速变动，重置时间锚点，但死死按住不入库！
            if (isWarmingUp) {
                cache.up = target.up;
                cache.down = target.down;
                cache.lastTime = currentNow;
                cache.isFirstJump = true; // 确保 10 秒后开闸的第一跳依然被当做残缺帧丢弃
                continue;
            }

            let timeDiff = parseFloat((currentNow - cache.lastTime).toFixed(1));

            if (cache.isFirstJump) {
                cache.isFirstJump = false; // 丢弃开闸后的首个残缺帧
            } else {
                cache.deltas.push(timeDiff); // 纯净的完整心跳，正式入库！
                if (cache.deltas.length > 10000) cache.deltas.shift();
            }

            cache.up = target.up;
            cache.down = target.down;
            cache.lastTime = currentNow;
        }
    }
}

// 预热期间强制 UI 刷新，为了让倒计时动起来
if (isWarmingUp) hasChange = true;

// 3. 紧凑型 UI 渲染与事件绑定
if (hasChange && !window.__gegeDebugCache.isFrozen) {
    let dbgBox = document.getElementById('gege-debug-box');
    if (!dbgBox) {
        dbgBox = document.createElement('div');
        dbgBox.id = 'gege-debug-box';
        // 压缩整体 padding，调整阴影和边框
        dbgBox.style.cssText = 'position:fixed; bottom:20px; left:50%; transform:translateX(-50%); width:1080px; max-height:85vh; background:rgba(0,0,0,0.92); color:#0f0; font-family:Consolas, monospace; font-size:12px; z-index:99999; overflow-y:auto; padding:10px 12px; border-radius:6px; box-shadow:0 5px 20px rgba(0,0,0,0.9); border: 1px solid #444; backdrop-filter: blur(5px);';
        document.body.appendChild(dbgBox);

        dbgBox.addEventListener('click', (e) => {
            if (e.target.id === 'gege-freeze-btn') {
                window.__gegeDebugCache.isFrozen = !window.__gegeDebugCache.isFrozen;
                let isF = window.__gegeDebugCache.isFrozen;

                if (!isF) {
                    // 恢复时，不仅要重置预热首帧，还要把预热计时器也给重置（可选，这里采取直接进入工作状态，只丢首帧）
                    let now = performance.now();
                    for(let k in window.__gegeDebugCache.targets) {
                        window.__gegeDebugCache.targets[k].lastTime = now;
                        window.__gegeDebugCache.targets[k].isFirstJump = true; 
                    }
                }

                e.target.textContent = isF ? "▶️ 恢复侦测 (采集已停)" : "⏸️ 定格分析";
                e.target.style.color = isF ? "#ff0" : "#fff";
                e.target.style.background = isF ? "#520" : "#333";
            }
        });
    }

    // 预热倒计时视觉警告
    let warmUpHtml = "";
    if (isWarmingUp) {
        let remain = ((10000 - bootElapsed) / 1000).toFixed(1);
        warmUpHtml = `<span style="color:#ff4c00; background:rgba(255,76,0,0.2); padding:0 5px; border-radius:3px; margin-left:10px;">⚠️ 硬件预热中... 规避初始 CPU 抖动 (剩余 ${remain}s)</span>`;
    }

    let timeStr = new Date().toTimeString().split(' ')[0] + '.' + String(new Date().getMilliseconds()).padStart(3, '0');
    let html = `
                <div style="border-bottom:1px solid #0f0; padding-bottom:4px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:14px; font-weight:bold; text-shadow:0 0 3px #0f0;">[哥哥科技] 企业级心跳雷达${warmUpHtml}</span>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="color:#aaa;">时钟: ${timeStr}</span>
                        <button id="gege-freeze-btn" style="background:#333; color:#fff; border:1px solid #555; padding:2px 8px; border-radius:3px; cursor:pointer; font-weight:bold; font-size:11px;">⏸️ 定格分析</button>
                    </div>
                </div>`;

    let macs = Object.keys(window.__gegeDebugCache.targets).sort((a, b) => (a === "WAN_MASTER" ? -1 : (b === "WAN_MASTER" ? 1 : 0)));

    for (let mac of macs) {
        let c = window.__gegeDebugCache.targets[mac];
        let n = c.deltas.length;
        if (n === 0 && !isWarmingUp) continue; // 预热结束后没跳过的依然藏起来

        let isWan = mac === "WAN_MASTER";
        let nameTag = isWan ? "<span style='color:#ffd700; font-weight:bold;'>[WAN] 出口</span>" : "<span style='color:#aaa;'>MAC: " + mac.slice(-8) + "</span>";
        let colorBase = isWan ? "#ffd700" : "#0f0";

        let mean=0, variance=0, stdDev=0, jitter=0, cv=0, d95=0, d98=0, maxD=0;
        if (n > 0) {
            let sum = 0; for(let i=0; i<n; i++) sum += c.deltas[i];
            mean = sum / n;
            let varianceSum = 0, jitterSum = 0, deviations = [];
            for(let i=0; i<n; i++) {
                let diff = c.deltas[i] - mean;
                varianceSum += diff * diff;
                deviations.push(Math.abs(diff));
                if (i > 0) jitterSum += Math.abs(c.deltas[i] - c.deltas[i-1]);
            }
            variance = varianceSum / n;
            stdDev = Math.sqrt(variance);
            jitter = n > 1 ? (jitterSum / (n - 1)) : 0;
            cv = mean > 0 ? (stdDev / mean * 100) : 0; 
            deviations.sort((a, b) => a - b);
            d95 = deviations[Math.floor(n * 0.95)] || 0;
            d98 = deviations[Math.floor(n * 0.98)] || 0;
            maxD = deviations[n - 1] || 0;
        }

        // 极致压缩：四列变八列，padding 和 gap 全部缩小
        let statsHtml = `
                    <div style="font-size:11px; color:#999; display:flex; gap:12px; background:rgba(0,0,0,0.3); padding:2px 6px; border-radius:3px;">
                        <span style="width:50px;">N:<b style="color:${colorBase}">${n}</b></span>
                        <span style="width:70px;">μ:<b style="color:#fff">${mean.toFixed(1)}</b></span>
                        <span style="width:85px;">Jitter:<b style="color:#ff4c00">${jitter.toFixed(1)}</b></span>
                        <span style="width:65px;">CV:<b style="color:#00ffff">${cv.toFixed(1)}%</b></span>
                        <span style="width:65px;">σ²:<b style="color:#aaa">${variance.toFixed(1)}</b></span>
                        <span style="width:75px;">95%:<b style="color:#fff">±${d95.toFixed(1)}</b></span>
                        <span style="width:75px;">Max:<b style="color:#ff0000">±${maxD.toFixed(1)}</b></span>
                    </div>`;

        let deltaStr = c.deltas.join(', ');
        if (isWarmingUp) deltaStr = "<span style='color:#666;'>[预热静默中... 数据暂不入库]</span>";

        // 压缩条目之间的 margin 和内部 padding
        html += `
                    <div style="border:1px solid ${isWan ? 'rgba(255,215,0,0.2)' : 'rgba(255,255,255,0.08)'}; background:${isWan ? 'rgba(255,215,0,0.05)' : 'transparent'}; margin-bottom:4px; padding:4px 8px; border-radius:4px; display:flex; flex-direction:column; gap:2px;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <div style="width:110px; font-size:12px;">${nameTag}</div>
                            <div style="width:190px; color:#bbb; font-size:11px;">↑${formatBps(c.up).padEnd(10)} ↓${formatBps(c.down)}</div>
                            <div style="flex:1;">${statsHtml}</div>
                        </div>
                        <div style="width:100%; font-size:11px; overflow-x:auto; white-space:nowrap; padding:2px 4px; color:#aaa; background:#111; border-radius:2px; scrollbar-width:none; user-select:all;">
                            ${deltaStr}
                        </div>
                    </div>`;
    }
    dbgBox.innerHTML = html;}

// --- 探针代码结束 ---
