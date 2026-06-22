// ==UserScript==
// @name            中兴路由器增强 ZTE-Stat_Max
// @name:en         ZTE-Stat_Max
// @namespace       ucxn
// @version         5.9.9.gz0
// @description     哥哥科技 QQ群 680464365
// @description:en  https://github.com/ucxn/ZTE-Stat_Max
// @author          哥哥科技 space.bilibili.com/501430041
// @noframes
// @icon            https://scriptcat.org/api/v2/resource/image/cRkcAvu6aH90bpAa
// @include         http://10.*.*.*
// @include         http://192.168.*.*
// @match           http://zte.home*
// @include         http://172.16.*
// @include         https://10.*.*.*
// @include         https://192.168.*.*
// @match           https://zte.home*
// @include         https://172.16.*
// @run-at          document-end
// @grant           GM_setValue
// @grant           GM_getValue
// @storageName     GBNPA_Storage
// @license         AGPL-3.0-or-later
// @updateURL       https://github.com/ucxn/ZTE-Stat_Max/raw/refs/heads/main/new.user.js
// @downloadURL     https://github.com/ucxn/ZTE-Stat_Max/raw/refs/heads/main/new.user.js
// ==/UserScript==

(function () {
  'use strict';

  console.log("🚀 哥哥科技 V5.9.9 终极引擎已装载...");

  function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, function (match) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      } [match];
    });
  }

  // ======== [0] 用户极客环境变量配置区 ========
  const CONFIG = {
    readSaveData: 2, // 【历史记录】 1: 从路由器后台读档 | 0: 新局模式 | 2: 从本地长期历史读档
    forceMeshMode: 1, // 【Mesh探测模式】0: 官方拓扑驱动 | 1: n秒智能等待(默认) | 2: 强制大包抓取(专治阉割、不出数据)
    uiLayout: 1, // 【面板拓扑结构】 0: 经典版 | 1: 详细紧凑版(驾驶舱美学) | 2: 详细平铺版(报表流美学)
    injectMode: 1, // 【UI注入模式】 0: 原生侧边栏(1min)| 1: 优先，10秒悬浮舱(D)| 2: 联动模式| 3：强制模式
    calcMode: 1, // 1: 上行/下行倍数模式, 0: 上行占总和比例模式
    lanPortMode: 1, // 【物理网口】 0: 关闭 | 1: 底部追加显示 | 2: WAN高速接管主线
    portInterval: 1, // 物理网口刷新频率(秒)
    ratioExtremeUp: 10, // 极端上传判定阈值 (> 1000%)
    ratioWarnUp: 0.07, // 重度上传警告阈值 (> 7%)
    ratioExtremeDown: 0.01, // 极端下载判定阈值 (< 1%)
    ratioThreshold: 7, // (仅calcMode=0时有效) 上传占比报警阈值(%)
    lanRefreshInterval: 3, // LAN口刷新时间(秒)，用于精准补偿0到唤醒时的瞬时流量
    wanRefreshInterval: 3, // 【新增】WAN口刷新时间(秒)，用于精准补偿0到唤醒时的瞬时流量
    portMap: {
      "eth1": "网口 1",
      "eth2": "网口 2",
      "eth3": "网口 3",
      "eth4": "网口 4",
      "wl0": "2.4G",
      "wl1": "5.2G",
      "wl2": "5.8G"
    }
  };

  const S = {
    lt: 0,
    wInstUp: 0,
    wInstDn: 0,
    wTotUp: 0,
    wTotDn: 0,
    cls: {}, isPinned: !0,
    w2U: 0, w2D: 0, w2TotUp: 0, w2TotDn: 0, w2LT: undefined,
    hasW2: !1, is5G_149: !1, fI: 0
  };
const W_APIS = [
    { u: '/?_type=vueData&_tag=vue_home_device_data_no_update_sess&IF_OP=refresh', n: 'OBJ_HOME_BASICINFO_ID', uK: 'WANUpRate', dK: 'WANDownRate', cK: 'AccessDevNum', wE: 'DualWANEnable', wU: 'WANUpRate2', wD: 'WANDownRate2', lU: '/?_type=vueData&_tag=vue_client_data' },
    { u: '/getpage.lua?pid=1005&nextpage=Internet_WANInfo_lua.lua', n: 'OBJ_TOTALSPEED_ID', uK: 'TotalUpRate', dK: 'TotalDownRate', cK: '_', wE: '_', wU: '_', wD: '_', lU: '/getpage.lua?pid=1005&nextpage=Basic_clients_lua.lua' }
  ];
  async function gWT() {
    if (S.fI === -1) return "";
    for (; S.fI < W_APIS.length; S.fI++) {
      try {
        let r = await fetch(W_APIS[S.fI].u + '&_=' + Date.now());
        if (r.ok) { let t = await r.text(); if (t.includes('<' + W_APIS[S.fI].n + '>')) return t; }
      } catch(e) {console.warn(e)}
    }
    S.fI = -1; return "";
  }

  const Phys = { p: Object.create(null), wU: undefined, wD: undefined, tU: 0, tD: 0, lT: undefined, _pM: null, _wID: null };
  let gWUp = (wI, k) => s2b(wI[k]);
  let gWDn = (wI, k) => s2b(wI[k]);
  let isF = !1,
    pr = new DOMParser(),
    lCxt = null;
  const oOp = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function () {
    this.
    addEventListener('load', function () {
      try {
        if (this.responseType === '' ||
          this.responseType === 'text') {
          let t = this.responseText;
          if (t && (t.includes('<OBJ_CLIENTS_ID>') || t.includes('<OBJ_HOME_BASICINFO_ID>'))) {
            if (t.includes('<OBJ_CLIENTS_ID>')) lCxt = t;
            if (window.startGegePrecisionEngine) {
              window.startGegePrecisionEngine();
            }
          }
        }
      }
      catch (e) {
        console.warn("[哥哥科技] XHR 拦截器异常:", e.message);
      }
    });
    oOp.apply(this, arguments);
  };

 function s2b(speedStr) {
        if (!speedStr) return 0;
        let val = parseFloat(speedStr);
        if (isNaN(val)) return 0;
        let upperStr = speedStr.toUpperCase();
        if (upperStr.includes('M')) return val * 1e6;
        if (upperStr.includes('K')) return val * 1e3;
        if (upperStr.includes('G')) return val * 1e9;
    return val;}

  function fB(bps) {
        if (bps > 1e9) return `${Math.round(bps * 1e-6)} Mbit/s`;
        if (bps > 1e6) return `${(bps * 1e-6).toFixed(1)} Mbps`;
        if (bps > 1e3) return `${(bps * 1e-3).toFixed(1)} Kbps`;
        return `${Math.round(bps)} bps`;
    }

  function fBy(bps) {
        if (bps === 0) return '0  B';
        if (bps > 8388608) return `${(bps / 8388608).toFixed(2)} MiB/s`;
        return bps < 8700
            ? ((bps * 0.001 | 0) === bps * 0.001
                ? `${['0', '[1/8]', '[2/8]', '[3/8]', '[4/8]', '[5/8]', '[6/8]', '[7/8]', '[1]'][bps * 0.001]} KB/s`
                : `${(bps * 0.000125).toFixed(2)} KB/s`)
            : `${(bps / 8192).toFixed(1)} KB/s`;
    }

  function fV(bits) {
        if (bits > 83886080000) return `${(bits / 8589934592).toFixed(4)} GiB`;
		if (bits > 8388608000) return `${(bits / 8388608).toFixed(1)} MiB`;
        if (bits > 8388608) return `${(bits / 8388608).toFixed(4)} MiB`;
        if (bits > 8192) return `${(bits / 8192).toFixed(2)} KiB`;
        return `${Math.round(bits / 8)} B`;
    }

  function fVD(bitsIntegral, bitsOfficial) {
        if (bitsIntegral > 8796093022208) return `${(bitsOfficial / 8796093022208).toFixed(4)} | ${(bitsIntegral / 8796093022208).toFixed(4)} TiB`;
        if (bitsIntegral >= 8589934592) return `${(bitsOfficial / 8589934592).toPrecision(5)} | ${(bitsIntegral / 8589934592).toPrecision(5)} GiB`;
        if (bitsIntegral > 8388608) return `${(bitsOfficial / 8388608).toFixed(3)} | ${(bitsIntegral / 8388608).toFixed(3)} MiB`;
        if (bitsIntegral > 8192) return `${(bitsOfficial / 8192).toFixed(2)} | ${(bitsIntegral / 8192).toFixed(2)} KiB`;
        return `${Math.round(bitsOfficial / 8)} | ${Math.round(bitsIntegral / 8)} B`;}

  function fSV(bits) {
    if (bits >= 84607500288) return `${(bits / 8589934592).toPrecision(4)}G`;
	if (bits > 8388608000) return `${Math.round(bits / 8388608)}M`;
    if (bits > 8388608) return `${(bits / 8388608).toPrecision(4)}M`;
    if (bits >= 8192) return `${(bits / 8192).toFixed(1)}K`;
    return `${Math.round(bits / 8)}B`;}

  function fOT(totalSec) {
		totalSec = Math.floor(totalSec);
        if (totalSec < 0) return "";
		const d = Math.floor(totalSec / 86400);
		let r = totalSec - d * 86400;
		const h = Math.floor(r / 3600);
		r = r - h * 3600;
		const m = Math.floor(r / 60);
		const s = r - m * 60;
        return d > 0 
        ? `${d}天${h}时${m}分${s}秒` 
        : `${h}小时${m}分${s}秒`;}

  function nM(m) {
    return m ? m.toLowerCase().replace(/-/g, ':').replace(/\s/g, '') : '';
  }

  function pI(n) {
    let o = Object.create(null),
      c = n.children;
    for (let i = 0; i < c.length; i++) {
      if (c[i].tagName === "ParaName") {
        let k = c[i].textContent,
          v = "",
          j = i + 1;
        while (j < c.length && c[j].tagName !== "ParaName") {
          if (c[j].tagName === "ParaValue") {
            v = c[j].textContent;
            i = j;
            break;
          }
          j++;
        }
        o[k] = v;
      }
    }
    return o;
  }
  const st = document.createElement('style');
  st.innerHTML = `.config-item{
        clear:both;}.config-item-box{display:flex!important;
        align-items:stretch!important;padding-bottom:
        12px!important;}.config-item .logo{width:33%!important;
        float:none!important;display:flex!important;flex-direction:row;}.config-item .dev-intro{flex:1;display:flex!important;flex-direction:column;justify-content:flex-start;min-height:100px;padding-bottom:0!important;margin-bottom:0!important;}.config-item .info{width:27%!important;float:none!important;display:flex!important;flex-direction:column;justify-content:flex-start;padding:0 10px!important;border-right:1px solid #eee;}.config-item .speed{width:40%!important;float:none!important;display:flex!important;flex-direction:column;justify-content:center;padding:0 10px!important;}.geek-row{display:flex;justify-content:space-between;align-items:center;white-space:nowrap;height:20px;}
    .geek-label{width:110px;color:#333;font-weight:bold;}.geek-val-box{flex:1;display:flex;gap:15px;margin-left:10px;}.geek-fixed-width{display:inline-block;width:120px;}.geek-right-box{text-align:right;min-width:220px;font-weight:bold;}.c-up{color:#ff4c00;}.c-down{color:#0059fa;}.gege-up-box,.gege-down-box{margin-top:auto!important;margin-bottom:0!important;width:95%;}.gege-ratio-box{margin-top:10px;width:95%;margin-bottom:5px;}.t-row{font-size:12px;font-weight:bold;margin-bottom:2px;display:flex;justify-content:space-between;font-family:Consolas;}.zte-thin-bar{width:100%;height:3px;background:rgba(0,0,0,0.05);border-radius:1.5px;overflow:hidden;}.zte-thin-bar-inner{height:100%;transition:width 0.5s ease-out;}.zte-thin-bar-inner.up{background:#ff4c00;}.zte-thin-bar-inner.down{background:#0059fa;}.gege-ratio-top{display:flex;justify-content:space-between;font-size:12px;font-weight:bold;margin-bottom:2px;}.gege-ratio-bar{width:100%;height:4px;background:#0059fa;border-radius:2px;overflow:hidden;}.gege-ratio-bar-inner{height:100%;background:#ff4c00;transition:width 0.5s ease-out;}.zte-enhance-speed{display:flex;flex-direction:column;gap:6px;width:100%;font-family:Consolas;}
    .zte-bar-wrap{position:relative;width:100%;border-radius:4px;border:1px solid;font-size:13px;font-weight:bold;overflow:hidden;padding:3px 8px;display:flex;justify-content:space-between;align-items:center;z-index:1;box-sizing:border-box;}.zte-bar-wrap span{font-size:inherit;font-weight:inherit;}.zte-bar-up{color:#ff4c00;border-color:rgba(255,76,0,0.3);}.zte-bar-down{color:#0059fa;border-color:rgba(0,89,250,0.3);}.zte-bar-up::before{content:'';position:absolute;left:0;top:0;bottom:0;z-index:-1;background:rgba(255,76,0,0.12);width:var(--p-up,0%);transition:width 0.5s;}.zte-bar-down::before{content:'';position:absolute;left:0;top:0;bottom:0;z-index:-1;background:rgba(0,89,250,0.12);width:var(--p-down,0%);transition:width 0.5s;}#config-list.gege-list-container{contain:content!important;background-color:#ffffff!important;border-radius:8px!important;border:1px solid #e0e0e0!important;padding:20px 30px!important;box-shadow:0 2px 10px rgba(0,0,0,0.02)!important;margin-top:10px!important;}.gege-section{margin-bottom:10px;}
    .gege-section:last-child{margin-bottom:0;}.gege-list-container .config-title{font-size:16px!important;font-weight:bold!important;color:#333!important;margin:15px 0 10px 0!important;padding-bottom:5px!important;}.gege-list-container .gege-section:first-child .config-title{margin-top:0!important;}.gege-empty-state{color:#999!important;font-size:14px!important;padding:0 0 15px 5px!important;border-bottom:1px solid #f0f0f0!important;margin-bottom:5px!important;}.gege-list-item{background-color:transparent!important;border-bottom:1px solid #f0f0f0!important;padding:15px 10px!important;margin-bottom:0!important;border-radius:0!important;}
    .gege-list-item:last-child{border-bottom:none!important;}#zte-geek-board{contain:content;background-color:transparent!important;border-left:4px solid #0059fa!important;border-radius:0!important;padding:5px 0 5px 15px!important;margin:10px 0 15px 0!important;box-shadow:none!important;border-bottom:1px solid #f0f0f0!important;font-size:14px;display:flex;flex-direction:column;gap:6px;padding-bottom:15px!important;}#gege-global-overlay #zte-geek-board.geek-frozen-pane{position:sticky!important;top:0px!important;z-index:100!important;background-color:#f3f4f5!important;margin-top:0!important;padding-top:15px!important;box-shadow:0 10px 15px -3px rgba(0,0,0,0.05)!important;border-radius:0 0 8px 8px!important;}.gege-pin{cursor:pointer;font-size:11px;filter:grayscale(100%);opacity:0.5;transition:transform 0.2s;margin-left:2px;}
    .gege-pin.active{filter:none;opacity:1;transform:scale(1.1);}#gege-global-overlay{position:fixed;top:0;right:0;bottom:0;background:#f3f4f5;z-index:9999;overflow-y:auto;padding-bottom:50px;left:0;transition:left 0.3s ease;}@media (min-width: 1025px) and (orientation: landscape){#gege-global-overlay{left:max(15%, 240px);}}@media (max-width: 768px){.geek-right-box:has(#gb-wan-zero-up),.geek-right-box:has(#gb-cur-up-vol){display:none!important}.gege-list-item{padding:12px 10px!important}.config-item-box{position:relative!important;flex-direction:column!important;padding-bottom:0!important}.config-item .info,.config-item .logo,.config-item .speed{width:100%!important;border:none!important;padding:0!important;position:static!important}.config-item .dev-intro{min-height:auto!important;justify-content:center!important;padding-right:90px!important}.config-item .logo{padding-bottom:4px!important}.config-item .info{flex-direction:column!important;margin:0 0 6px 0!important;gap:2px!important}.dev-ip{position:absolute!important;top:0!important;right:0!important;font-size:11px!important;background:rgba(0,89,250,0.08);color:#0059fa!important;padding:2px 6px!important;border-radius:4px;font-weight:bold;line-height:1.2;z-index:10;width:auto!important}.dev-number{width:auto!important;margin:0!important;font-size:11px!important}.gege-ratio-box{width:100%!important;margin-top:2px!important;margin-bottom:0!important}.gege-down-box{width:100%!important;margin-top:2px!important}#zte-geek-board{padding:8px!important;gap:0!important;font-size:11.5px!important}.geek-row{height:auto!important;flex-wrap:wrap!important;margin-bottom:4px!important;justify-content:flex-start!important;gap:2px 6px!important;line-height:1.3!important}.geek-label{width:auto!important;min-width:60px!important;font-size:11.5px!important;flex:0 0 auto!important}.geek-val-box{width:auto!important;flex:1 1 0%!important;display:flex!important;flex-wrap:wrap!important;margin-left:0!important;gap:2px 6px!important}.geek-fixed-width{width:auto!important}.geek-right-box{width:100%!important;flex:0 0 100%!important;text-align:left!important;font-size:11.5px!important;margin-top:2px!important;margin-left:0!important}.gege-list-container{padding:8px!important}.zte-enhance-speed{gap:4px!important}}`;
  document.
  head.
  appendChild(st);
  window.gegeRenderedMacs = new Set();
  async function rSD(pWT = null, sT = null) {
    if (isF && pWT === null) return;
    isF = !0;
    let n, wT = "";
    try {
      if (pWT !== null) {
        wT = pWT; n = sT || performance.now();
      } else {
        wT = await gWT(); n = performance.now();
      }
      window.__gLWT = wT; window.__gLWT_t = n; // 保障解耦模式全局缓存不丢失
      
      let wX = pr.parseFromString(wT, "text/xml");
      let cX = lCxt ? pr.parseFromString(lCxt, "text/xml") : null;
      let c = W_APIS[S.fI] || {};
      const bIN = c.n ? wX.querySelector(`${c.n} Instance`) : null, wI = bIN ? pI(bIN) : {};
      
      S.hasW2 = wI[c.wE] === '1';
      let cWU = gWUp(wI, c.uK), cWD = gWDn(wI, c.dK), cI = Object.create(null);
      if (S.hasW2) {
        let u2 = s2b(wI.WANUpRate2), d2 = s2b(wI.WANDownRate2);
        if (S.w2LT === undefined) S.w2LT = n;
        else if (S.w2U !== u2 || S.w2D !== d2) {
          let dt = n - S.w2LT;
          if (S.w2U > 0) S.w2TotUp += (S.w2U + u2) * dt * 0.0005; else if (u2 > 0) S.w2TotUp += u2 * 0.5 * CONFIG.wanRefreshInterval;
          if (S.w2D > 0) S.w2TotDn += (S.w2D + d2) * dt * 0.0005; else if (d2 > 0) S.w2TotDn += d2 * 0.5 * CONFIG.wanRefreshInterval;
          S.w2LT = n;
        }
        S.w2U = u2; S.w2D = d2;
      }
      let cSU = 0,
        cSD = 0;
      (cX?.querySelectorAll("OBJ_CLIENTS_ID Instance") || []).forEach(nd => {
        let d = pI(
          nd);
        if (d.MACAddress) {
          let m = nM(d.MACAddress),
            u = s2b(d.UpRate),
            dn = s2b(d.DownRate),
            uT = (+d.UpThroughput || 0) * 8000,
            dT = (+d.DownThroughput || 0) * 8000;
          let bN =
            d.AliasName || d.HostName || d.DisplayedPictureName || "";
          cI[m] = {
            upRate: u,
            dnRate: dn,
            iface: d.Interface || "",
            offUp: uT,
            offDn: dT,
            onSec: +(d.OnlineDuration || d.OnlineTime || d.LeaseTime || 0),
            name: bN,
            ip: d.IPAddress || ""
          };
          cSU += u;
          cSD += dn;
        }
      });
      let ol = document.getElementById('gege-global-overlay'),
        cM = Object.keys(
          cI),
        iD = window.gegeForceUIRedraw || (cM.length !== window.gegeRenderedMacs.size);
      if (!iD && cM.length > 0) {
        for (let i = 0; i <
          cM.length; i++) {
          if (!window.gegeRenderedMacs.has(cM[i])) {
            iD = !0;
            break;
          }
        }
      }
      if (iD) {
        for (let m in S.cls) if (!cI[m]) {
          S.cls[m].intUp += S.cls[m].upR * (n - S.cls[m].lUT) * 0.0005;
          S.cls[m].intDn += S.cls[m].dnR * (n - S.cls[m].lUT) * 0.0005;
          S.cls[m].upR = S.cls[m].dnR = 0;
        }
      }
      if (ol && ol.style.display === 'block' && (iD || !ol.querySelector('.gege-list-item'))) {
        bVD(ol, cX);
        window.gegeRenderedMacs = new Set(
          cM);
        window.gegeForceUIRedraw = !1;
      }
      let gDt = (S.lt !== 0) ? (n - S.lt) * 0.001 : 0;
      if (S.wLT === undefined) {
        S.wLT = n;
      }
      else if (cWU !== S.wInstUp || cWD !== S.wInstDn) {
        let wDt = n - S.wLT;
        if (S.wInstUp > 0) { S.wTotUp += (S.wInstUp + cWU) * wDt * 0.0005; }
        else if (cWU > 0) { let wEU = cWU * 0.5 * CONFIG.wanRefreshInterval; S.wTotUp += wEU; S.wZEU = (S.wZEU || 0) + wEU; S.wZEUC = (S.wZEUC || 0) + 1; }
        if (S.wInstDn > 0) { S.wTotDn += (S.wInstDn + cWD) * wDt * 0.0005; }
        else if (cWD > 0) { let wED = cWD * 0.5 * CONFIG.wanRefreshInterval; S.wTotDn += wED; S.wZED = (S.wZED || 0) + wED; S.wZEDC = (S.wZEDC || 0) + 1; }
        S.wLT = n;
      }
      if (CONFIG.readSaveData === 2 && !S.snapLoaded) { try { let sp = typeof GM_getValue !== 'undefined' ? GM_getValue('ha_snapshot') : null; S.snap = sp || {}; if(sp && sp.global) { S.wTotUp = S.wTotUp === 0 ? sp.global.wan_up || 0 : S.wTotUp; S.wTotDn = S.wTotDn === 0 ? sp.global.wan_down || 0 : S.wTotDn; } } catch(e){console.warn(e)} S.snapLoaded = !0; }
      for (const [m, cC] of Object.entries(cI)) {
        let spD = (CONFIG.readSaveData === 2 && S.snap && S.snap.devices && S.snap.devices[m]) || null;
        S.cls[m] ??= {
          upR: cC.upRate, dnR: cC.dnRate, lUT: n, 
          intUp: spD ? (spD.integral_up || 0) : 0, intDn: spD ? (spD.integral_down || 0) : 0,
          uB: CONFIG.readSaveData === 1 ? 0 : (spD ? cC.offUp - (spD.up || 0) : cC.offUp), 
          dB: CONFIG.readSaveData === 1 ? 0 : (spD ? cC.offDn - (spD.down || 0) : cC.offDn),
          lU: cC.offUp, lD: cC.offDn, aR: 0, dpU: 0, dpD: 0,
          oU: cC.offUp, oD: cC.offDn, hU: [], hD: [] // 真实流量
        };
        let cS = S.cls[m],
          dU = cC.offUp - cS.lU,
          dD = cC.offDn - cS.lD;
        if (dU < 0 || dD < 0) {
          if (dU < 0) {
            cS.uB += dU;
            cS.dpU = cS.lU;
          }
          if (dD < 0) {
            cS.dB += dD;
            cS.dpD = cS.lD;
          }
          cS.aR = 3;
        }
        else if (cS.aR === 3) {
          if (dD > 2516582400 || dU > 671088640 || (cS.dpD && dD >= cS.dpD) || (cS.dpU && dU >= cS.dpU)) {
            cS.uB += dU;
            cS.dB += dD;
            cS.aR = 2;
            cS.dpU = 0;
            cS.dpD = 0;
          }
        }
       else if (cS.aR > 0) { cS.aR--; }
        if (cS.aR === 2 || (cS.aR == 1 && cC.upRate > 1e8) || cC.upRate > 6e8) { cSU -= cC.upRate; cC.upRate = 0; }
        if (cS.aR === 2 || (cS.aR == 1 && cC.dnRate > 1e8) || cC.dnRate > 24e8) { cSD -= cC.dnRate; cC.dnRate = 0; }
        if (cS.lOS !== cC.onSec) {
          cS.onS = cC.onSec;
          cS.lOS = cC.onSec;
        }
        else {
          cS.onS = (cS.onS || cC.onSec || 0) + gDt;
        }
        if (cC.upRate !== cS.upR || cC.dnRate !== cS.dnR) {
          let ms = n - cS.lUT;
          if (cS.upR > 0) { cS.intUp += (cS.upR + cC.upRate) * ms * 0.0005; }
          else if (cC.upRate > 0) { let eU = cC.upRate * CONFIG.lanRefreshInterval * 0.5; cS.intUp += eU; cS.zEU = (cS.zEU || 0) + eU; cS.zUC = (cS.zUC || 0) + 1; }
          if (cS.dnR > 0) { cS.intDn += (cS.dnR + cC.dnRate) * ms * 0.0005; }
          else if (cC.dnRate > 0) { let eD = cC.dnRate * CONFIG.lanRefreshInterval * 0.5; cS.intDn += eD; cS.zED = (cS.zED || 0) + eD; cS.zDC = (cS.zDC || 0) + 1; }
          cS.upR = cC.upRate;
          cS.dnR = cC.dnRate;
          cS.lUT = n;
        }
        cS.lU = cC.offUp;
        cS.lD = cC.offDn;
      }
      S.lt = n;
      S.wInstUp = cWU;
      S.wInstDn = cWD;
      rUI(cWU, cWD, cSU, cSD, cI);
    }
    catch (e) {
      console.error("[哥哥科技] 周期采样中断:", e);
    }
    finally {
      isF = !1;
    }
  }
const calcStageRatio = (W, L_int, L_hp) => {
    if (W === 0) return 1.0;
    let L_max = Math.max(L_int, L_hp);
    let L_min = Math.min(L_int, L_hp);
    let Gap = Math.abs(L_int - L_hp);
    if (L_int > 0.84 * W && L_hp > 0.75 * W && (L_max < 1.5 * W || Gap < 0.6 * W)) {
        return ((L_int + L_hp) / (2 * W));
    } else if (L_min < W && W < L_max && L_max < 1.5 * W) {
        return L_max / W;
    } else {
        return (Math.abs(L_int - W) < Math.abs(L_hp - W) ? L_int : L_hp) / W;
    }
  };
  function rUI(wU, wD, sU, sD, cI) {
    let tOD = 0,
      LUp = 0,
      LDn = 0,
      hpU = 0,
      hpD = 0,
      abU = 0,
      abD = 0,
      curHpU = 0,
      curHpD = 0,
      tot_cU = 0,
      cln = {};
    for (const [k, s] of Object.entries(S.cls)) {
      let cC = cI[k];
      let cU = Math.max(0, (s.lU || 0) - (s.uB || 0));
      let cD = Math.max(0, (s.lD || 0) - (s.dB || 0));
      let sessU = Math.max(0, (s.lU || 0) - (s.oU || 0));
      let sessD = Math.max(0, (s.lD || 0) - (s.oD || 0));
      tot_cU += cU;
      LUp += s.intUp || 0;
      LDn += s.intDn || 0;
      hpU += (CONFIG.readSaveData === 2 ? cU : sessU); 
      hpD += (CONFIG.readSaveData === 2 ? cD : sessD);
      if (cC) {
        curHpU += (CONFIG.readSaveData === 2 ? cU : sessU); 
        curHpD += (CONFIG.readSaveData === 2 ? cD : sessD);
        tOD += cC.offDn || 0;
      }
      abU += CONFIG.readSaveData === 2 ? sessU : (cC ? (cC.offUp || 0) : (s.lU || 0));
      abD += CONFIG.readSaveData === 2 ? sessD : (cC ? (cC.offDn || 0) : (s.lD || 0));
      s.hU.push(cC ? cC.upRate : 0); if (s.hU.length > 30) s.hU.shift();
      s.hD.push(cC ? cC.dnRate : 0); if (s.hD.length > 30) s.hD.shift();
      cln[k] = {
        up: cU,
        down: cD,
        integral_up: s.intUp || 0,
        integral_down: s.intDn || 0,
        status: s.aR ? "off" : (CONFIG.portMap[cC?.iface] || cC?.iface || "未知接口"),
        name: cC?.name || k,
        ip: cC?.ip || "",
        raw_up: cC?.offUp || 0,
        raw_down: cC?.offDn || 0
      };
    }
    if (typeof GM_setValue !== 'undefined') {
      try {
        GM_setValue('ha_snapshot', {
          timestamp: Date.now(),
          global: {
            wan_up: S.wTotUp,
            wan_down: S.wTotDn,
            lan_integral_up: LUp,
            lan_integral_down: LDn,
            lan_high_up: hpU,
            lan_high_down: hpD,
            lan_off_up: abU,
            lan_off_down: abD
          },
          devices: cln
        });
      } catch(e) {console.warn(e);}
    }
    S.rTick = ((S.rTick || 0) + 1) & 15;
    if (S.rTick === 1 || !S.cRT) {
        S.aWu = (S.wTotUp - (S.lwTU || S.wTotUp)) / ((window.gegeBActivated ? (CONFIG.forceMeshMode === 2 ? 6 : CONFIG.wanRefreshInterval) : 3) << 4); S.lwTU = S.wTotUp;
        S.aWd = (S.wTotDn - (S.lwTD || S.wTotDn)) / ((window.gegeBActivated ? (CONFIG.forceMeshMode === 2 ? 6 : CONFIG.wanRefreshInterval) : 3) << 4); S.lwTD = S.wTotDn;
        if (S.hasW2) {
            let rU = S.w2TotUp > 0 ? (S.wTotUp / S.w2TotUp) : (S.wTotUp > 0 ? Infinity : 0), rD = S.w2TotDn > 0 ? (S.wTotDn / S.w2TotDn) : (S.wTotDn > 0 ? Infinity : 0);
            let fR = (r) => r === Infinity ? '∞' : (r > 1 ? r.toFixed(2) + 'x' : (r * 100).toPrecision(3) + '%');
            S.cRT = `<span style="font-weight: bold;"><span class="c-up">${fR(rU)}</span>，<span class="c-down">${fR(rD)}</span></span>`;
        } else {
            let rUp = calcStageRatio((Phys.tU + S.wTotUp) / ((Phys.tU > 0) + (S.wTotUp > 0)) || 0, LUp, hpU), rDn = calcStageRatio((Phys.tD + S.wTotDn) / ((Phys.tD > 0) + (S.wTotDn > 0)) || 0, LDn, hpD);
            S.cRT = `<span style="font-weight: bold;"><span style="color: ${rUp > 1.5 ? '#ff4c00' : (rUp > 1.15 ? '#FF9800' : '#4CAF50')};">${(rUp * 100).toFixed(2)}%</span>，<span style="color: ${rDn > 1.5 ? '#ff4c00' : (rDn > 1.15 ? '#FF9800' : '#4CAF50')};">${(rDn * 100).toFixed(2)}%</span></span>`;
        }
    }
    let bd = document.getElementById('zte-geek-board');
    if (!bd) {
      bd = document.createElement('div');
      bd.id = 'zte-geek-board';
 let layoutHtml = '';
        if (CONFIG.uiLayout === 1) { // 紧凑版 (驾驶舱)
            layoutHtml = `
                <div class="geek-row"><span class="geek-label">WAN口速率</span><div class="geek-val-box" style="position:relative;"><span class="c-up geek-fixed-width" id="gb-wan-up-bytes"></span><span class="c-down geek-fixed-width" id="gb-wan-down-bytes"></span><span style="margin-left: 5px;"><span class="c-up" id="gb-wan-up-bps"></span> | <span class="c-down" id="gb-wan-down-bps"></span></span><div id="gb-pwan-vol-container" style="display:none; position:absolute; left:clamp(450px, 60%, 700px); color:#333; white-space:nowrap; flex-direction:column; line-height:1.2; top:-4px;"><span style="font-weight:bold;">副WAN总：<span class="c-up" id="gb-pwan-tot-up"></span> | <span class="c-down" id="gb-pwan-tot-down"></span></span><span style="font-size:12px; font-weight:normal; color:#666;">0补偿：<span id="gb-pwan-zero-up"></span>，<span id="gb-pwan-zero-down"></span>｜<span id="gb-pwan-zero-up-cnt"></span>，<span id="gb-pwan-zero-down-cnt"></span></span></div></div><div class="geek-right-box" style="font-weight: normal; color: #666;"><span style="color: #333;">0估算：</span><span id="gb-wan-zero-up"></span>，<span id="gb-wan-zero-down"></span>｜<span id="gb-wan-zero-up-cnt"></span>，<span id="gb-wan-zero-down-cnt"></span></div></div>
                <div class="geek-row"><span class="geek-label">局域网代数和</span><div class="geek-val-box"><span class="c-up geek-fixed-width" id="gb-lan-up-bytes"></span><span class="c-down geek-fixed-width" id="gb-lan-down-bytes"></span><span id="gb-pwan-bps-container" style="display:none; margin-left: 5px;"><span class="c-up" id="gb-pwan-bps-up"></span> | <span class="c-down" id="gb-pwan-bps-down"></span></span></div><div class="geek-right-box">实时占比：<span class="c-up" id="gb-perc-up"></span> | <span class="c-down" id="gb-perc-down"></span></div></div>
                <div class="geek-row"><span class="geek-label">LAN：<span id="gege-pin-btn" class="gege-pin" title="冻结窗格">📌</span></span><div class="geek-val-box"><span class="c-up geek-fixed-width" id="gb-lan-up-vol"></span><span class="c-down geek-fixed-width" id="gb-lan-down-vol"></span><span style="font-weight: bold; margin-left: 5px;">WAN总计：<span class="c-up" id="gb-wan-up-vol"></span> | <span class="c-down" id="gb-wan-down-vol"></span></span></div><div class="geek-right-box">在线高精：<span style="color:#FF6700;" id="gb-cur-up-vol"></span> | <span style="color:#18A058;" id="gb-cur-down-vol"></span></div></div>
                <div class="geek-row"><span class="geek-label">高精流量统计 -></span><div class="geek-val-box"><span class="c-up geek-fixed-width" id="gb-int-up-vol"></span><span class="c-down geek-fixed-width" id="gb-int-down-vol"></span><span style="font-weight: normal; margin-left: 5px; color:#666;">${S.hasW2?'主次网比':'内外网比'}：<span id="gb-ratio-display"></span></span></div><div class="geek-right-box" style="color: #666;">当前总计：<span style="color:#FF6700;" id="gb-abs-up-vol"></span> | <span style="color:#18A058;" id="gb-abs-down-vol"></span></div></div>`;
        } else if (CONFIG.uiLayout === 2) { // 平铺版 (报表流)
            layoutHtml = `
                <div class="geek-row"><span class="geek-label">WAN口速率</span><div class="geek-val-box" style="position:relative;"><span class="c-up geek-fixed-width" id="gb-wan-up-bytes"></span><span class="c-down geek-fixed-width" id="gb-wan-down-bytes"></span><span id="gb-pwan-vol-container" style="display:none; position:absolute; left:clamp(450px, 60%, 700px); color:#333; font-weight:bold; white-space:nowrap;">副WAN总：<span class="c-up" id="gb-pwan-tot-up"></span> | <span class="c-down" id="gb-pwan-tot-down"></span></span></div><div class="geek-right-box"><span class="c-up" id="gb-wan-up-bps"></span> | <span class="c-down" id="gb-wan-down-bps"></span></div></div>
                <div class="geek-row"><span class="geek-label">局域网代数和</span><div class="geek-val-box"><span class="c-up geek-fixed-width" id="gb-lan-up-bytes"></span><span class="c-down geek-fixed-width" id="gb-lan-down-bytes"></span><span id="gb-pwan-bps-container" style="display:none; margin-left: 5px;"><span class="c-up" id="gb-pwan-bps-up"></span> | <span class="c-down" id="gb-pwan-bps-down"></span></span></div><div class="geek-right-box">实时占比：<span class="c-up" id="gb-perc-up"></span> | <span class="c-down" id="gb-perc-down"></span></div></div>
                <div class="geek-row"><span class="geek-label">LAN：<span id="gege-pin-btn" class="gege-pin" title="冻结窗格">📌</span></span><div class="geek-val-box"><span class="c-up geek-fixed-width" id="gb-lan-up-vol"></span><span class="c-down geek-fixed-width" id="gb-lan-down-vol"></span></div><div class="geek-right-box">在线高精：<span style="color:#FF6700;" id="gb-cur-up-vol"></span> | <span style="color:#18A058;" id="gb-cur-down-vol"></span></div></div>
                <div class="geek-row"><span class="geek-label">高精流量统计 -></span><div class="geek-val-box"><span class="c-up geek-fixed-width" id="gb-int-up-vol"></span><span class="c-down geek-fixed-width" id="gb-int-down-vol"></span></div><div class="geek-right-box" style="color: #666;">当前总计：<span style="color:#FF6700;" id="gb-abs-up-vol"></span> | <span style="color:#18A058;" id="gb-abs-down-vol"></span></div></div>
                <div class="geek-row"><span class="geek-label">WAN总计：</span><div class="geek-val-box"><span class="c-up geek-fixed-width" id="gb-wan-up-vol"></span><span class="c-down geek-fixed-width" id="gb-wan-down-vol"></span></div><div class="geek-right-box"><span style="font-weight: normal;">${S.hasW2?'主次网比':'内外网比'}：</span><span id="gb-ratio-display"></span></div></div>`;
        } else { // 经典版 (0)
            layoutHtml = `
                <div class="geek-row"><span class="geek-label">WAN口速率</span><div class="geek-val-box" style="position:relative;"><span class="c-up geek-fixed-width" id="gb-wan-up-bytes"></span><span class="c-down geek-fixed-width" id="gb-wan-down-bytes"></span><span id="gb-pwan-vol-container" style="display:none; position:absolute; left:clamp(450px, 60%, 700px); color:#333; font-weight:bold; white-space:nowrap;">副WAN总：<span class="c-up" id="gb-pwan-tot-up"></span> | <span class="c-down" id="gb-pwan-tot-down"></span></span></div><div class="geek-right-box"><span class="c-up" id="gb-wan-up-bps"></span> | <span class="c-down" id="gb-wan-down-bps"></span></div></div>
                <div class="geek-row"><span class="geek-label">局域网代数和</span><div class="geek-val-box"><span class="c-up geek-fixed-width" id="gb-lan-up-bytes"></span><span class="c-down geek-fixed-width" id="gb-lan-down-bytes"></span><span id="gb-pwan-bps-container" style="display:none; margin-left: 5px;"><span class="c-up" id="gb-pwan-bps-up"></span> | <span class="c-down" id="gb-pwan-bps-down"></span></span></div><div class="geek-right-box">实时占比：<span class="c-up" id="gb-perc-up"></span> | <span class="c-down" id="gb-perc-down"></span></div></div>
                <div class="geek-row"><span class="geek-label">LAN：<span id="gege-pin-btn" class="gege-pin" title="冻结窗格">📌</span></span><div class="geek-val-box"><span class="c-up geek-fixed-width" id="gb-lan-up-vol"></span><span class="c-down geek-fixed-width" id="gb-lan-down-vol"></span></div><div class="geek-right-box">WAN：<span class="c-up" id="gb-wan-up-vol"></span> | <span class="c-down" id="gb-wan-down-vol"></span></div></div>
                <div class="geek-row"><span class="geek-label">高精流量统计 -></span><div class="geek-val-box"><span class="c-up geek-fixed-width" id="gb-int-up-vol"></span><span class="c-down geek-fixed-width" id="gb-int-down-vol"></span></div><div class="geek-right-box" style="color: #666;">当前总计：<span style="color:#FF6700;" id="gb-abs-up-vol"></span> | <span style="color:#18A058;" id="gb-abs-down-vol"></span></div></div>`;
        }layoutHtml += `<div class="geek-row" id="gb-phys-row" style="display:none; height:auto!important; flex-wrap:wrap;"><span class="geek-label" style="font-weight:normal; color:#666;">物理网口:</span><div class="geek-val-box" id="gb-phys-data" style="flex-wrap:wrap; font-size:13px; font-weight:normal;"></div></div>`;
        bd.innerHTML = layoutHtml;
        let pinBtn = bd.querySelector('#gege-pin-btn');
        if (pinBtn) {
            if (S.isPinned) {
                bd.classList.add('geek-frozen-pane');
                pinBtn.classList.add('active');
            }
            pinBtn.onclick = () => {
                S.isPinned = !S.isPinned;
                bd.classList.toggle('geek-frozen-pane', S.isPinned);
                pinBtn.classList.toggle('active', S.isPinned);
            };
        }
    }
    let ol = document.getElementById('gege-global-overlay'),
      iPO = ol && ol.style.display === 'block',
      aC = iPO ? ol : document;
    if (iPO) {
      let ac = document.getElementById('gege-board-anchor');
      if (ac && bd.nextSibling !== ac) ac.parentNode.insertBefore(bd, ac);
    }
    else {
      let mn = document.querySelector('.el-table') || document.querySelector('.config-item')?.closest('div') || document.querySelector('.main-content');
      if (mn && bd.parentNode !== mn.parentNode) mn.parentNode.insertBefore(bd, mn);
    }
    requestAnimationFrame(() => {
    let oDC = Object.create(null);
    if (!iPO) {
      const M_RX = /([a-fA-F0-9]{2}[:-]){5}[a-fA-F0-9]{2}/;
      let aI = aC.querySelectorAll('.config-item');
      for (let n of aI) {
        let mN = n.querySelector('.dev-number'),
          mM = mN ? mN.textContent.match(M_RX) : null;
        if (mM) {
          oDC[mM[0].toLowerCase().replace(/-/g, ':')] = n;
        }
      }
    }
    else {
      let gI = aC.querySelectorAll('.gege-list-item');
      for (let n of gI) {
        let m = n.getAttribute('data-gege-mac');
        if (m) oDC[m] = n;
      }
    }
      if (bd.parentNode) {
        let aW2U = S.hasW2 ? S.w2U : (CONFIG.lanPortMode === 1 ? Phys.wU : undefined), aW2D = S.hasW2 ? S.w2D : (CONFIG.lanPortMode === 1 ? Phys.wD : undefined), aW2TU = S.hasW2 ? S.w2TotUp : (CONFIG.lanPortMode === 1 ? Phys.tU : undefined), aW2TD = S.hasW2 ? S.w2TotDn : (CONFIG.lanPortMode === 1 ? Phys.tD : undefined);
        bd.querySelector('#gb-wan-up-bytes').textContent = `🔼 ${fBy(wU + (aW2U||0))}`;
        bd.querySelector('#gb-wan-down-bytes').textContent = `🔽 ${fBy(wD + (aW2D||0))}`;
        bd.querySelector('#gb-wan-up-bps').textContent = `🔼 ${fB(wU)}`;
        bd.querySelector('#gb-wan-down-bps').textContent = `🔽 ${fB(wD)}`;
        bd.querySelector('#gb-lan-up-bytes').textContent = `🔼 ${fB(sU)}`;
        bd.querySelector('#gb-lan-down-bytes').textContent = `🔽 ${fB(sD)}`;
        bd.querySelector('#gb-lan-up-vol').textContent = `🔼 ${fV(LUp)}`;
        bd.querySelector('#gb-lan-down-vol').textContent = `🔽 ${fV(LDn)}`;
        bd.querySelector('#gb-wan-up-vol').textContent = `🔼 ${fV(S.wTotUp)}`;
        bd.querySelector('#gb-wan-down-vol').textContent = `🔽 ${fV(S.wTotDn)}`;
        bd.querySelector('#gb-int-up-vol').textContent = `🔼 ${fV(hpU)}`;
        bd.querySelector('#gb-int-down-vol').textContent = `🔽 ${fV(hpD)}`;
        bd.querySelector('#gb-abs-up-vol').textContent = `🔼 ${fV(abU)}`;
        bd.querySelector('#gb-abs-down-vol').textContent = `🔽 ${fV(abD)}`;
		bd.querySelector('#gb-perc-up').textContent = `🔼 ${((sU * 100) / (Math.max(Phys.wU || 0, wU || 0) || Infinity) || 0).toFixed(1)}%`;
        bd.querySelector('#gb-perc-down').textContent = `🔽 ${((sD * 100) / (Math.max(Phys.wD || 0, wD || 0) || Infinity) || 0).toFixed(1)}%`;
        let pb = bd.querySelector('#gb-pwan-bps-container'), pv = bd.querySelector('#gb-pwan-vol-container');
        if (aW2U !== undefined) {
            if (pb) { pb.style.display = 'inline'; bd.querySelector('#gb-pwan-bps-up').textContent = '🔼 ' + fB(aW2U); bd.querySelector('#gb-pwan-bps-down').textContent = '🔽 ' + fB(aW2D); }
            if (pv) { 
                pv.style.display = 'flex'; 
                bd.querySelector('#gb-pwan-tot-up').textContent = '🔼 ' + fV(aW2TU); 
                bd.querySelector('#gb-pwan-tot-down').textContent = '🔽 ' + fV(aW2TD); 
                if (bd.querySelector('#gb-pwan-zero-up')) {
                    bd.querySelector('#gb-pwan-zero-up').textContent = !Phys.zEU ? '' : fSV(Phys.zEU);
                    bd.querySelector('#gb-pwan-zero-down').textContent = !Phys.zED ? '' : fSV(Phys.zED);
                    bd.querySelector('#gb-pwan-zero-up-cnt').textContent = Phys.zEUC || 0;
                    bd.querySelector('#gb-pwan-zero-down-cnt').textContent = Phys.zEDC || 0;
                }
            }
        } else {
            if (pb) pb.style.display = 'none'; if (pv) pv.style.display = 'none';
        }
        if (bd.querySelector('#gb-ratio-display')) {
          bd.querySelector('#gb-cur-up-vol').textContent = `🔼 ${fV(curHpU)}`;
          bd.querySelector('#gb-cur-down-vol').textContent = `🔽 ${fV(curHpD)}`;
          bd.querySelector('#gb-ratio-display').innerHTML = S.cRT;
          if (bd.querySelector('#gb-wan-zero-up')) {
              bd.querySelector('#gb-wan-zero-up').textContent = !S.wZEU ? '' : fSV(S.wZEU);
              bd.querySelector('#gb-wan-zero-down').textContent = !S.wZED ? '' : fSV(S.wZED);
              bd.querySelector('#gb-wan-zero-up-cnt').textContent = S.wZEUC || 0;
              bd.querySelector('#gb-wan-zero-down-cnt').textContent = S.wZEDC || 0;
          }
        }
      }
            for (let m in cI) {
        let it = oDC[m];
        if (!it) continue;
        const cC = cI[m] || { upRate: 0, dnRate: 0, iface: "", offUp: 0, offDn: 0 },
              cS = S.cls[m] || { intUp: 0, intDn: 0, onS: 0 };
        
        let cache = it._gege || (it._gege = {});
        let hqU = cln[m] ? cln[m].up : 0;
        let hqD = cln[m] ? cln[m].down : 0;
        let tN = cache.timeNode ??= it.querySelector('.gege-online-time');
        if (tN && cS.onS > 0) tN.textContent = `在线：${fOT(cS.onS)}`;
        
        const dI = cache.devIntro ??= it.querySelector('.dev-intro');
        if (dI) {
          let bx = cache.upBox ??= dI.querySelector('.gege-up-box');
          if (!bx) {
            bx = document.createElement('div'); bx.className = 'gege-up-box';
            bx.innerHTML = `<div class="t-row c-up"><span>↑ <span class="v-vol"></span></span><span class="v-pct"></span></div><div class="zte-thin-bar"><div class="zte-thin-bar-inner up"></div></div>`;
            dI.appendChild(bx);
            cache.upBox = bx;
          }
          let p = tot_cU > 0 ? (hqU * 100 / tot_cU) : 0;
          (cache.upVol ??= bx.querySelector('.v-vol')).textContent = fVD(cS.intUp, cC.offUp);
          (cache.upPct ??= bx.querySelector('.v-pct')).textContent = p.toFixed(1) + '%';
          (cache.upBar ??= bx.querySelector('.zte-thin-bar-inner')).style.width = Math.min(p, 100) + '%';
        }
        
        const inf = cache.info ??= it.querySelector('.info');
        if (inf) {
          let ipNode = cache.ipNode ??= inf.querySelector('.dev-ip');
          if (ipNode) {
            let zBadge = cache.zBadge ??= ipNode.querySelector('.gege-zero-badge');
            if (!zBadge) {
              zBadge = document.createElement('span'); zBadge.className = 'gege-zero-badge gege-box';
              ipNode.style.display = 'flex'; ipNode.style.justifyContent = 'space-between';
              zBadge.style.cssText = 'color: #999; font-size: 11.5px; font-family: Consolas; margin-right: 5px;';
              ipNode.appendChild(zBadge);
              cache.zBadge = zBadge;
            }
            zBadge.textContent = ((cS.zUC || 0) + (cS.zDC || 0)) < 6 ? "" : `[0估] ${!cS.zEU ? '' : fSV(cS.zEU)}，${!cS.zED ? '' : fSV(cS.zED)}｜${cS.zUC || 0},${cS.zDC || 0}`;
          }
          
          let rB = cache.rBox ??= inf.querySelector('.gege-ratio-box');
          if (!rB) {
            Array.from(inf.querySelectorAll('.dev-ip:not(.gege-box *)')).slice(1).forEach(n => { n.style.display = 'none'; });
            inf.querySelectorAll('.dev-number:not(.gege-box *)').forEach(n => { n.style.display = 'none'; });
            rB = document.createElement('div'); rB.className = 'gege-ratio-box';
            rB.innerHTML = `<div class="gege-ratio-top"><span class="v-port"></span><span class="v-interval" style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight: normal; font-size: 12.5px; opacity: 0.75; letter-spacing: 0.5px;"><span class="c-up"></span><span style="color:#666; margin:0 3px;">，</span><span class="c-down"></span></span><span class="v-rt-pct"></span></div><div class="gege-ratio-bar"><div class="gege-ratio-bar-inner"></div></div>`;
            inf.appendChild(rB);
            cache.rBox = rB;
          }
          
          let bR = (hqU + hqD) > 0 ? (hqU * 100 / (hqU + hqD)) : 0, tC = "", tCol = "#0059fa";
          if (CONFIG.calcMode === 1) {
            let rt = hqD > 0 ? (hqU / hqD) : (hqU > 0 ? Infinity : 0);
            if (rt > CONFIG.ratioExtremeUp) { tCol = '#ff4c00'; tC = (rt === Infinity ? '∞' : rt.toFixed(2)) + '⚠️'; }
            else if (rt > CONFIG.ratioWarnUp) { tCol = '#ff4c00'; tC = (rt * 100).toFixed(1) + '%'; }
            else if (rt > CONFIG.ratioExtremeDown) { tCol = '#0059fa'; tC = (rt * 100).toFixed(1) + '%'; }
            else { tCol = '#0059fa'; let rRt = hqU > 0 ? (hqD / hqU) : (hqD > 0 ? Infinity : 0); tC = (rRt === Infinity ? '∞' : rRt.toFixed(1)) + 'x'; }
          } else {
            tCol = bR > CONFIG.ratioThreshold ? '#ff4c00' : '#0059fa';
            tC = bR.toFixed(1) + '%';
          }
          
          (cache.rBoxPort ??= rB.querySelector('.v-port')).textContent = CONFIG.portMap[cC.iface] || cC.iface || "未知";
          (cache.rBoxUp ??= rB.querySelector('.v-interval .c-up')).textContent = '' + fSV(hqU);
          (cache.rBoxDn ??= rB.querySelector('.v-interval .c-down')).textContent = '' + fSV(hqD);
          let rtP = cache.rtPct ??= rB.querySelector('.v-rt-pct');
          rtP.textContent = tC; rtP.style.color = tCol;
          (cache.rBoxBar ??= rB.querySelector('.gege-ratio-bar-inner')).style.width = Math.min(bR, 100) + '%';
          
          let dBx = cache.dBox ??= inf.querySelector('.gege-down-box');
          if (!dBx) {
            dBx = document.createElement('div'); dBx.className = 'gege-down-box';
            dBx.innerHTML = `<div class="t-row c-down"><span>↓ <span class="v-vol"></span></span><span class="v-pct"></span></div><div class="zte-thin-bar"><div class="zte-thin-bar-inner down"></div></div>`;
            inf.appendChild(dBx);
            cache.dBox = dBx;
          }
          let dp = tOD > 0 ? ((cC.offDn || 0) * 100 / tOD) : 0;
          (cache.dBoxVol ??= dBx.querySelector('.v-vol')).textContent = fVD(cS.intDn, cC.offDn);
          (cache.dBoxPct ??= dBx.querySelector('.v-pct')).textContent = dp.toFixed(1) + '%';
          (cache.dBoxBar ??= dBx.querySelector('.zte-thin-bar-inner')).style.width = Math.min(dp, 100) + '%';
        }
        
        const sp = cache.speed ??= it.querySelector('.speed');
        if (sp) {
          let enh = cache.enh ??= sp.querySelector('.zte-enhance-speed');
          if (!enh) {
            sp.querySelectorAll('.connect-up, .connect-down').forEach(n => { n.style.display = 'none'; });
            enh = document.createElement('div'); enh.className = 'zte-enhance-speed';
            enh.innerHTML = `<div class="zte-bar-wrap zte-bar-up"><span class="v-val" style="white-space: nowrap; flex-shrink: 0;"></span><span class="v-spark" style="font-family: monospace; letter-spacing: -2px; font-size: 10px; margin: 0 6px; opacity: 0.65; white-space: pre; flex: 1; overflow: hidden; text-align: right;"></span><span class="v-pct" style="white-space: nowrap; flex-shrink: 0;"></span></div><div class="zte-bar-wrap zte-bar-down"><span class="v-val" style="white-space: nowrap; flex-shrink: 0;"></span><span class="v-spark" style="font-family: monospace; letter-spacing: -2px; font-size: 10px; margin: 0 6px; opacity: 0.65; white-space: pre; flex: 1; overflow: hidden; text-align: right;"></span><span class="v-pct" style="white-space: nowrap; flex-shrink: 0;"></span></div>`;
            sp.appendChild(enh);
            cache.enh = enh;
          }
          let pu = sU > 0 ? (cC.upRate * 100 / sU) : 0,
              pd = sD > 0 ? (cC.dnRate * 100 / sD) : 0,
              bU = cache.bU ??= enh.querySelector('.zte-bar-up'),
              bD = cache.bD ??= enh.querySelector('.zte-bar-down');
          
          const SPRK = [' ', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
          let clU = Math.max(...cS.hU, (S.aWu * 0.1) || 0, 512000);
          let clD = Math.max(...cS.hD, (S.aWd / 8) || 0);
          (cache.bUSpk ??= bU.querySelector('.v-spark')).textContent = cS.hU.slice(-15).map(v => SPRK[v <= 0 ? 0 : Math.min(7, Math.ceil((v / clU) * 7))]).join('');
          (cache.bDSpk ??= bD.querySelector('.v-spark')).textContent = cS.hD.slice(-15).map(v => SPRK[v <= 0 ? 0 : Math.min(7, Math.ceil((v / clD) * 7))]).join('');

          bU.style.setProperty('--p-up', Math.min(pu, 100) + '%');
          (cache.bUVal ??= bU.querySelector('.v-val')).textContent = `🔼 ${fBy(cC.upRate)}`;
          (cache.bUPct ??= bU.querySelector('.v-pct')).textContent = pu.toFixed(1) + '%';
          
          bD.style.setProperty('--p-down', Math.min(pd, 100) + '%');
          (cache.bDVal ??= bD.querySelector('.v-val')).textContent = `🔽 ${fBy(cC.dnRate)}`;
          (cache.bDPct ??= bD.querySelector('.v-pct')).textContent = pd.toFixed(1) + '%';
        }
      }
    });
  }
  async function bVD(ol, cX) {
    try {
      let h2 = [],
        h52 = [],
        h58 = [],
        hW = [];
      (cX?.querySelectorAll("OBJ_CLIENTS_ID Instance") || []).forEach(i => {
        let d = pI(i);
        if (!d.MACAddress) return;
        let m = nM(d.MACAddress),
          tS = fOT(parseInt(d.OnlineDuration || d.OnlineTime || d.LeaseTime || 0)),
          ifc = d.Interface || '',
          htm = `<div class="col-md-12 col-xs-12 config-item gege-list-item" data-gege-mac="${m}"><div class="config-item-box" style="display: flex; align-items: stretch;"><div class="col-md-5 col-xs-7 logo" style="width: 33%; display: flex; flex-direction: row; align-items: center;"><div class="dev-logo" style="width: 50px; height: 50px; min-width: 50px; margin-right: 15px; background: url('/jquery/static/img/home/unknown_computer.png') 0% 0% / 50px no-repeat; display: inline-block;"></div><div class="dev-intro" style="flex: 1; display: flex; flex-direction: column; justify-content: flex-start; min-height: 100px;">
<div class="dev-name" style="font-weight: bold; color: #333; font-size: 14px;">${escapeHTML(d.AliasName || d.HostName || '未知设备')}</div><div class="gege-online-time" style="color: #999; font-size: 12px; font-family: Consolas; margin-top: 4px;">${tS?'在线：'+tS:''}</div></div></div><div class="col-md-4 col-xs-5 info" style="width: 27%; display: flex; flex-direction: column; padding: 0 10px; border-right: 1px solid #eee;"><div class="dev-ip" style="color: #666; font-family: Consolas;">${escapeHTML(d.IPAddress || '')}</div><div class="dev-number grey" style="color: #999; font-size: 12px; font-family: Consolas;">MAC：${m}</div></div><div class="col-md-3 col-xs-12 speed" style="width: 40%; display: flex; flex-direction: column; justify-content: center; padding: 0 10px;"></div></div></div>`;
        if (['wl0', 'wlan0', 'wlan1', 'wl1'].includes(ifc)) h2.push(htm);
        else if (['wlan5', 'wl4', 'wlan4', 'wl3', 'wlan3'].includes(ifc)) h52.push(htm);
        else if (ifc === 'wl2' || ifc === 'wlan2' || ifc === 'wl5' || (/w/i.test(ifc) && !/wan/i.test(ifc))) h58.push(htm);
        else hW.push(htm);
      });
      requestAnimationFrame(() => {
        ol.innerHTML = `<div style="padding: 20px; max-width: 1580px; margin: 0 auto; min-height: 100%;"><div id="gege-board-anchor"></div><div id="config-list" class="config-list gege-list-container"><div class="gege-section"><div class="config-title">有线设备${(window.gegeHiddenDevices && Object.keys(window.gegeHiddenDevices).length > 0) ? '<span style="color: #ff4c00; font-size: 13px; font-weight: normal; margin-left: 10px; font-family: Consolas;">(哥哥科技：智能Mesh适配)</span>' : ''}</div>${hW.join('')||'<div class="gege-empty-state">没有连接设备</div>'}</div><div class="gege-section"><div class="config-title">无线设备（${S.is5G_149?'5.8GHz':'5.2GHz'}）</div>${h52.join('')||'<div class="gege-empty-state">没有连接设备</div>'}</div><div class="gege-section"><div class="config-title">无线设备（${S.is5G_149?'5.2GHz':'5.8GHz'}）</div>${h58.join('')||'<div class="gege-empty-state">没有连接设备</div>'}</div><div class="gege-section"><div class="config-title">无线设备（2.4GHz）</div>${h2.join('')||'<div class="gege-empty-state">没有连接设备</div>'}
        </div><div style="margin-top: 25px; padding-top: 15px; border-top: 1px dashed #eee; text-align: center; font-family: Consolas, 'Microsoft YaHei', sans-serif;"><div style="font-size: 11.5px; color: #777; font-style: italic; margin-bottom: 8px;">“在一个文明社会，干净的、不被监视与吸血的网络，是我们每个人的基本权利。”</div><div style="font-size: 10.5px; color: #999; line-height: 1.3; margin-bottom: 8px;">本交互式程序基于 GNU Affero GPL v3.0 协议开源，按“原样 (AS IS)”提供，不对其适用性、稳定性、精密度或任何商业场景合规性作任何明示或暗示的担保。<br>根据 AGPL-3.0 第 5(d) 及 7(b) 条规定，基于本程序的任何修改均不得移除或篡改本界面的署名与法律声明。保留此界面是使用本软件代码的合法性的前置条件。
        </div><div style="font-size: 12px; color: #555;"><a href="https://github.com/ucxn/ZTE-Stat_Max" target="_blank" style="color: #0059fa; text-decoration: none; font-weight: bold;">ZTE-Stat_Max 增强组件</a> Copyright &copy; 2026 <a href="https://www.bilibili.com/video/BV1PtR7B8ECC" target="_blank" style="color: #0059fa; text-decoration: none; font-weight: bold;">哥哥科技</a> (BroTech)<span style="color: #888; font-weight: normal;"> | All Rights Reserved</span>&emsp;&nbsp;<a href="https://scriptcat.org/zh-CN/script-show-page/6194" target="_blank" style="color: #666; text-decoration: none;">点此分享</a></div></div></div></div>`;
      });}
    catch (e) {
      requestAnimationFrame(() => {
        ol.innerHTML = `<div style="padding: 20px; color: red;">数据渲染失败: ${escapeHTML(e.message)}</div>`;
      });
    }
  }
  window.createGegeFloatingBtn = function () {
    if (document.getElementById('gege-floating-btn')) return;
    let b =
      document.createElement('div');
    b.id = 'gege-floating-btn';
    b.innerHTML = '🛸';
    b.style.cssText = `position: fixed; ${CONFIG.injectMode === 3 ? 'bottom: 60px; right: 60px;' : 'top: 20px; right: 16%;'} width: 50px; height: 50px; background: linear-gradient(135deg, #0059fa, #00c6ff); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 48px; box-shadow: 0 4px 15px rgba(0,89,250,0.5); cursor: pointer; z-index: 99999; transition: transform 0.3s ease; user-select: none;`;
    b.
    onmouseover = () => {
      b.style.transform = 'scale(1.1) rotate(15deg)';
    };
    b.onmouseout = () => {
      b.style.transform =
        'scale(1) rotate(0deg)';
    };
    b.onclick = () => window.gegeTogglePanel();
    document.body.appendChild(b);
  };
  window.gegeTogglePanel = function (fS = null) {
    let o = document.getElementById('gege-global-overlay'),
      iCO =
      o && o.style.display === 'block',
      tS = fS !== null ? fS : !iCO,
      aT = document.querySelector(
        '#gege-menu-wrapper a'),
      lT = document.querySelector('#gege-menu-wrapper li');
    if (!tS) {
      if (lT) {
        lT.classList.remove(
          'is-active');
        lT.style.color = 'rgb(255, 255, 255)';
      }
      if (o) o.style.display = 'none';
      return;
    }
    if (aT &&
      lT) {
      aT.classList.add('router-link-exact-active', 'router-link-active');
      lT.classList.add('is-active');
      lT.style.color =
        'rgb(61, 163, 247)';
    }
    if (!o) {
      o = document.createElement('div');
      o.id = 'gege-global-overlay';
      document.body.appendChild(o);
    }
    o.style.display = 'block';
    if (!window.gegeBActivated) {
      window.gegeBActivated = !0;
      clearTimeout(window.gegeMasterTimer);
      
      if (CONFIG.forceMeshMode === 2 || CONFIG.wanRefreshInterval === CONFIG.lanRefreshInterval) {
        window.gegeMasterTimer = setInterval(eBET, (CONFIG.forceMeshMode === 2 ? 6 : CONFIG.wanRefreshInterval) * 1000);
      } else {
        window.gegeMasterTimer = setInterval(rSD, CONFIG.wanRefreshInterval * 1000);
        window.gegeLanTimer = setInterval(() => eBET(!1), CONFIG.lanRefreshInterval * 1000);
        eBET(!1);
      }
      if (CONFIG.lanPortMode > 0 && !window.gegePortTimer) {
        if (CONFIG.lanPortMode === 2) { gWUp = () => Phys.wU || 0; gWDn = () => Phys.wD || 0; }
        window.gegePortTimer = setInterval(fPP, CONFIG.portInterval * 1000);
        fPP();
      }
      fetch(`/?_type=vueData&_tag=wlanConfig_data&_=${Date.now()}`)
      .then(r => r.text())
      .then(t => {
      if (!S.is5G_149 && /<ParaName>ChannelInUsed<\/ParaName><ParaValue>(149|1[5-9]\d)<\/ParaValue>/.test(t)) {
            S.is5G_149 = !0;
            document.getElementById('gege-global-overlay')?.style.display === 'block' && 
            bVD(document.getElementById('gege-global-overlay'), lCxt ? pr.parseFromString(lCxt, "text/xml") : null);
        }}).catch(e => {console.warn("[哥哥科技] 5.8G彩蛋探测异常:", e);});
      if (CONFIG.forceMeshMode === 1) {
        setTimeout(() => {
          if (window.gegeRenderedMacs.size === 0) {
            console.log("⏱️ [哥哥科技] 17秒熔断生效：强制切入档位2");
            CONFIG.forceMeshMode = 2;
            clearInterval(window.gegeMasterTimer);
            window.gegeMasterTimer = setInterval(eBET, 6000);
            let ol = document.getElementById('gege-global-overlay');
            if (ol) {
              let aB = document.createElement('div');
              aB.id = 'gege-fallback-alert';
              aB.style.cssText = 'background:#fff3cd;color:#856404;padding:12px 15px;margin:15px 30px 5px 30px;border-radius:6px;border:1px solid #ffeeba;border-left:5px solid #ffc107;font-weight:bold;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,0.05);';
              aB.innerHTML = '⚠️ 17秒熔断机制触发：检测到当前固件常规接口异常（被阉割），已自动为您开启【深度大包抓取模式】。';
              let ac = document.getElementById('gege-board-anchor');
              if (ac && !document.getElementById('gege-fallback-alert')) {
                ac.parentNode.insertBefore(aB, ac);
              }
            }
          }
        }, 8500);
      }
    }
    bVD(o, lCxt ? pr.parseFromString(lCxt, "text/xml") : null).then(() => {
      if (window.gegeBActivated) eBET();
      else rSD();
    });
  };

  function iGM() {
    let mC = document.querySelector('.menu_items');
    if (!mC) return;
    let oD = mC.querySelector(
      'div');
    if (!oD) return;
    let gW = oD.cloneNode(!0);
    gW.id = 'gege-menu-wrapper';
    let aT = gW.querySelector(
        'a'),
      lT = gW.querySelector('li');
    if (aT) {
      aT.href = "javascript:void(0);";
      aT.classList.remove(
        'router-link-exact-active', 'router-link-active');
    }
    if (lT) {
      lT.classList.remove('is-active');
      let tS =
        lT.querySelector('span');
      if (tS) {
        const pT = (t, s) => {
          let l = s.length, o = (l === 6) ? (l + 9) : 15;
          return decodeURIComponent(
            escape(window.atob(t.substring(o).split('').reverse().join(''))));
        };
        const aM = {
          'ZTE_WIRED_PoE': "ZTE_AUTH_TOKEN_/xK9vP2mQ5zL8wJ4nB7cT1fR",
          'ZTE_NEBULA_MAX': "ZTE_AUTH_TOKEN_/2p5i2Z6Aqo5Re65lOZ5lOZ5",
          'ZTE_LEGACY_OS': "ZTE_AUTH_TOKEN_/pM4aC7yX9kH3bV2rN6dW8qG"
        };
        const gHP = () => {
          let m = Object.keys(aM).length,
            hI = (m << 2) - 10;
          return Object.keys(aM)[hI ^ 3];};
        tS.textContent = pT(aM[gHP()], tS.textContent);
      }
      lT.querySelectorAll(
        'img').forEach(i => i.remove());
      let eS = document.createElement('span');
      eS.textContent = '🚀';
      eS.style.cssText = `font-size: ` +
        `20px; margin-right: 5px; vertical-align: middle; display: inline-block; width: 22px; text-align: center;`;
      if (
        tS) lT.insertBefore(eS, tS);
      lT.style.color = 'rgb(255, 255, 255)';
    }
    mC.appendChild(gW);
    document.
    addEventListener('click', function (e) {
      let cW = e.target.closest('.menu_items > div');
      if (!cW) return;
      if (
        cW.id === 'gege-menu-wrapper') {
        e.preventDefault();
        e.stopPropagation();
        let fB = document.getElementById(
          'gege-floating-btn');
        if (fB) fB.remove();
        window.gegeTogglePanel(!0);
      }
      else {
        window.
        gegeTogglePanel(!1);
      }
    }, !0);
  }
  window.gegePortTimer = null;
  async function fPP() {
    if (document.getElementById('gege-global-overlay')?.style.display !== 'block') return;
    try {
      let r = await fetch(`/?_type=vueData&_tag=vue_internet_ethport_data&_=${Date.now()}`);
      if (!r.ok) return;
      let x = pr.parseFromString(await r.text(), "text/xml"), n = performance.now();
      if (!Phys._pM) { // 终生只解析一次字典，零 GC
        Phys._pM = {};
        x.querySelectorAll("OBJ_ETHPORT_INFO_ID Instance").forEach(i => {
          let d = pI(i);
          if (d._InstID) { Phys._pM[d._InstID] = d.EthPortAliasName || d._InstID; if (d.WanType === '1' || d.EthPortAliasName === 'ETH_WAN') Phys._wID = d._InstID; }
        });
      }
      x.querySelectorAll("OBJ_ETHPORT_STATE_ID Instance").forEach(i => {
        let d = pI(i);
        if (d._InstID && d.EthPortStatus === '0') {
          let u = s2b(d.EthPortSendRate), dn = s2b(d.EthPortRecvRate);
          if (d._InstID === Phys._wID) {
            if (Phys.lT === undefined) Phys.lT = n;
            else if (Phys.wU !== u || Phys.wD !== dn) {
              let ms = n - Phys.lT;
              if (Phys.wU > 0) { Phys.tU += (Phys.wU + u) * ms * 0.0005; } else if (u > 0) { Phys.tU += u * 0.5 * CONFIG.portInterval; Phys.zEU = (Phys.zEU || 0) + u * 0.5 * CONFIG.portInterval; Phys.zEUC = (Phys.zEUC || 0) + 1; }
              if (Phys.wD > 0) { Phys.tD += (Phys.wD + dn) * ms * 0.0005; } else if (dn > 0) { Phys.tD += dn * 0.5 * CONFIG.portInterval; Phys.zED = (Phys.zED || 0) + dn * 0.5 * CONFIG.portInterval; Phys.zEDC = (Phys.zEDC || 0) + 1; }
              Phys.lT = n;
            }
            Phys.wU = u; Phys.wD = dn;
          } else {
            let nm = Phys._pM[d._InstID] || d._InstID;
            Phys.p[nm] ??= { u: u, dn: dn, tU: 0, tD: 0, lT: n };
            let s = Phys.p[nm];
            if (s.u !== u || s.dn !== dn) {
              let ms = n - s.lT;
              s.tU += s.u > 0 ? (s.u + u) * ms * 0.0005 : (u > 0 ? u * 0.5 * CONFIG.portInterval : 0);
              s.tD += s.dn > 0 ? (s.dn + dn) * ms * 0.0005 : (dn > 0 ? dn * 0.5 * CONFIG.portInterval : 0);
              s.lT = n;
            }
            s.u = u; s.dn = dn;
          }
        }
      });
      let rw = document.getElementById('gb-phys-row'), db = document.getElementById('gb-phys-data');
      if (rw && db) {
        rw.style.display = 'flex';
        db.innerHTML = Object.entries(Phys.p).map(([k, v]) => `<span style="margin-right:16px; white-space:nowrap; font-weight:normal; color:#333;">${k}:<span class="c-up" style="display:inline-block; min-width:55px; font-weight:bold; margin-left:6px; text-align:left;">${fBy(v.u)}</span><span class="c-down" style="display:inline-block; min-width:55px; font-weight:bold; margin-left:10px; text-align:left;">${fBy(v.dn)}</span><span style="margin-left:6px; color:#666;">(<span style="color:#9c27b0;">${fSV(v.tU)}</span>，<span style="color:#4caf50;">${fSV(v.tD)}</span>)</span></span>`).join('');
      }

      if (CONFIG.lanPortMode === 1 && !S.hasW2 && Phys.wU !== undefined) {
        let pb = document.getElementById('gb-pwan-bps-container'), pv = document.getElementById('gb-pwan-vol-container');
        if(pb) { pb.style.display = 'inline'; document.getElementById('gb-pwan-bps-up').textContent = '🔼 ' + fB(Phys.wU); document.getElementById('gb-pwan-bps-down').textContent = '🔽 ' + fB(Phys.wD); }
        if(pv) { pv.style.display = 'inline'; document.getElementById('gb-pwan-tot-up').textContent = '🔼 ' + fV(Phys.tU); document.getElementById('gb-pwan-tot-down').textContent = '🔽 ' + fV(Phys.tD); }
      }
    } catch (e) {console.warn(e)}
  }
  window.gegeBActivated = !1;
  window.gegeEngineRunning = !1;
  window.gegeLastDevCount = -1;
  window.gegeLastMeshDevCount = -1;
  window.gegeHiddenDevices = {};
  window.gegeTimerStarted = !1;
  window.gegeSyncAnchor = 0;
  window.gegeTickCount = 0;
  window.gegeMasterTimer = null;
  window.triggerGegeMeshSniper = async function () {
    try {
      const liR = await fetch(`/?_type=vueData&_tag=localnet_lan_info_lua&_=${Date.now()}`),
        liX = pr.parseFromString(await liR.text(), "text/xml");
      let nHD = {};
      liX.querySelectorAll("OBJ_LAN_INFO_ID Instance").forEach(inst => {
        let d = pI(inst);
        if (d.DevMeshType === '3' && d.Active === '1' && d.MACAddress) {
          let m = nM(d.MACAddress),
            bN = d.DevName || d.HostName || d.DisplayedPictureName || d.AliasName || "Mesh设备",
            bI = d.Interface || "";
          if (d.IFAliasName === 'SSID1') bI = 'wl0';
          else if (d.IFAliasName === 'SSID5') bI = 'wl4';
          nHD[m] = {
            name: bN,
            iface: bI,
            origMac: d.MACAddress
          };
        }
      });
      if (Object.keys(nHD).length > 0) {
        window.gegeHiddenDevices = nHD;
        window.gegeForceUIRedraw = !0;
        console.log("🎯 [哥哥科技] 破甲弹命中！强制狙击名单:", Object.keys(nHD));
      }
    }
    catch (e) {
      console.warn("[哥哥科技] B2强启拉取失败:", e.message);
    }
  };
  window.startGegePrecisionEngine = function () {
    if (window.gegeTimerStarted || window.gegeBActivated) return;
    window.gegeTimerStarted = !0;
    window.gegeSyncAnchor = performance.now();
    window.gegeTickCount = 0;
    window.scheduleNextGegeTick();
  };
  window.scheduleNextGegeTick = function () {
    if (window.gegeBActivated) return;
    window.gegeTickCount++;
    let dl = (window.gegeSyncAnchor + window.gegeTickCount * 3000) - performance.now();
    if (dl < 0) {
      window.gegeSyncAnchor = performance.now();
      window.gegeTickCount = 0;
      dl = 3000;
    }
    window.gegeMasterTimer = setTimeout(() => {
      rSD().finally(() => {
        window.scheduleNextGegeTick();
      });
    }, dl);
  };
  async function eBET(fW = !0) {
    if (window.gegeEngineRunning) return;
    window.gegeEngineRunning = !0;
    try {
      const ts = Date.now();
      let wT = "", wST = null, cDC = window.gegeLastDevCount;
      if (fW) {
        wT = await gWT();
        wST = performance.now();
        let c = W_APIS[S.fI] || {}; // 读取锁定的字典结构
        let bN = c.n ? pr.parseFromString(wT, "text/xml").querySelector(`${c.n} Instance`) : null;
        cDC = parseInt((bN ? pI(bN) : {})[c.cK] || -1) || -1;
        try {
            const wR = await fetch(`/?_type=vueData&_tag=vue_home_device_data_no_update_sess&IF_OP=refresh&_=${ts}`);
            if (wR.ok) {
                wT = await wR.text();
                cDC = parseInt(pI(pr.parseFromString(wT, "text/xml").querySelector("OBJ_HOME_BASICINFO_ID Instance") || {}).AccessDevNum || -1) || -1;
            }
        } catch(e) {console.warn(e)}
        wST = performance.now();
      }

      let lT = "", lF = "";
      if (CONFIG.forceMeshMode === 2) {
        const liR = await fetch(`/?_type=vueData&_tag=localnet_lan_info_lua&_=${ts}`);
        if (liR.ok) {
          const liX = pr.parseFromString(await liR.text(), "text/xml");
          let iI = "",
            nHD = {},
            dC = 0;
          liX.querySelectorAll("OBJ_LAN_INFO_ID Instance").forEach(inst => {
            let d = pI(inst);
            if (d.MACAddress && d.MACAddress !== "00:00:00:00:00:00") {
              dC++;
              let m = nM(d.MACAddress),
                bN = d.DevName || d.HostName || d.DisplayedPictureName || d.AliasName || "未知设备",
                bI = d.Interface || "";
              if (d.IFAliasName === 'SSID1') bI = 'wl0';
              else if (d.IFAliasName === 'SSID5') bI = 'wl4';
              if (d.DevMeshType === '3') nHD[m] = {
                name: bN,
                iface: bI,
                origMac: d.MACAddress
              };
              let uR = `${d.UploadSpeed||0}Kbps`,
                  dR = `${d.DownloadSpeed||0}Kbps`,
                  uT = (+d.BytesSend || 0) * 0.001,
                  dT = (+d.BytesReceived || 0) * 0.001,
                  oS = parseInt(d.OnlineTime || d.OnlineTimes || 0);
              iI += `<Instance><ParaName>MACAddress</ParaName><ParaValue>${escapeHTML(m)}</ParaValue><ParaName>IPAddress</ParaName><ParaValue>${d.IPAddress||""}</ParaValue><ParaName>AliasName</ParaName><ParaValue>${escapeHTML(bN)}</ParaValue><ParaName>HostName</ParaName><ParaValue>${escapeHTML(bN)}</ParaValue><ParaName>Interface</ParaName><ParaValue>${escapeHTML(bI)}</ParaValue><ParaName>UpRate</ParaName><ParaValue>${uR}</ParaValue><ParaName>DownRate</ParaName><ParaValue>${dR}</ParaValue><ParaName>UpThroughput</ParaName><ParaValue>${uT}</ParaValue><ParaName>DownThroughput</ParaName><ParaValue>${dT}</ParaValue><ParaName>OnlineDuration</ParaName><ParaValue>${oS}</ParaValue></Instance>`;
            }
          });
          window.gegeHiddenDevices = nHD;
          lT = `<ajax_response_xml_root><OBJ_CLIENTS_ID>${iI}</OBJ_CLIENTS_ID></ajax_response_xml_root>`;
          let mM = lT.match(/<ParaName>MACAddress<\/ParaName><ParaValue>([^<]+)<\/ParaValue>/g) || [];
          lF = mM.map(mx => mx.replace(/[<>]/g, '')).sort().join('|');
          cDC = dC;
        }
      }
      else {
        let cApi = W_APIS[S.fI >= 0 ? S.fI : 0]; // 联动锁：WAN定江山，LAN随其后
        const lR = await fetch(`${cApi.lU}&_=${ts}`);
        lT = await lR.text();
        if (lT.includes('<OBJ_CLIENTS_ID>')) {
          let mM = lT.match(/<ParaName>MACAddress<\/ParaName><ParaValue>([^<]+)<\/ParaValue>/g) || [];
          lF = mM.map(m => m.replace(/[<>]/g, '')).sort().join('|');
        }
      }
      if (cDC !== window.gegeLastDevCount || lF !== window.gegeLastLanFingerprint) {
        if (CONFIG.forceMeshMode !== 2) {
          let mDC = 0;
          try {
            const tR = await fetch(`/?_type=vueData&_tag=vue_topo_data&_=${ts}`);
            if (tR.ok) {
              let tJ = JSON.parse(await tR.text());
              mDC = tJ.agentlay1?.reduce((s, a) => s + (parseInt(a.accdevCount) || 0), 0) || 0;
            }
          } catch(e) {console.warn(`[哥哥科技] Mesh狙击失败`, e.message);}
          if (mDC !== window.gegeLastMeshDevCount) {
            window.gegeLastMeshDevCount = mDC;
            window.gegeForceUIRedraw = !0;
            if (mDC > 0) {
              await window.triggerGegeMeshSniper();
            }
            else {
              window.gegeLastMeshDevCount = 0;
              window.gegeHiddenDevices = {};
            }
          }
        }
        window.gegeLastDevCount = cDC;
        window.gegeLastLanFingerprint = lF;
      }
      if (CONFIG.forceMeshMode !== 2) {
        let hM = Object.keys(window.gegeHiddenDevices ?? {});
        if (hM.length > 0) {
          let iI = "";
          for (let m of hM) {
            try {
              const mt = window.gegeHiddenDevices[m] || {};
              if (!mt || !mt.origMac) continue;
              const sR = await fetch(`/?_type=vueData&_tag=localnet_lan_detailinfo_lua&MACAddress=${encodeURIComponent(mt.origMac||m)}&_=${Date.now()}`);
              if (!sR.ok) continue;
              const sI = pr.parseFromString(await sR.text(), "text/xml").querySelector("OBJ_LANINFO_BYMAC Instance");
              if (sI) {
                let sD = pI(sI);
                iI += `<Instance><ParaName>MACAddress</ParaName><ParaValue>${escapeHTML(m)}</ParaValue><ParaName>IPAddress</ParaName><ParaValue>${sD.IPAddress||""}</ParaValue><ParaName>AliasName</ParaName><ParaValue>${escapeHTML(mt.name)}</ParaValue><ParaName>HostName</ParaName><ParaValue>${escapeHTML(mt.name)}</ParaValue><ParaName>Interface</ParaName><ParaValue>${escapeHTML(mt.iface)}</ParaValue><ParaName>UpRate</ParaName><ParaValue>${sD.UploadSpeed||0}Kbps</ParaValue><ParaName>DownRate</ParaName><ParaValue>${sD.DownloadSpeed||0}Kbps</ParaValue><ParaName>UpThroughput</ParaName><ParaValue>${(+sD.BytesSend || 0) * 0.001}</ParaValue><ParaName>DownThroughput</ParaName><ParaValue>${(+sD.BytesReceived || 0) * 0.001}</ParaValue><ParaName>OnlineDuration</ParaName><ParaValue>${parseInt(sD.OnlineTimes || 0)}</ParaValue></Instance>`;
              }
            }
            catch (e) {
              console.warn(`[哥哥科技] Mesh狙击失败(MAC:${m})`, e.message);
            }
          }
          if (iI !== "") lT = lT.replace('</OBJ_CLIENTS_ID>', `${iI}</OBJ_CLIENTS_ID>`);
        }
      }
      if (lT.includes('<OBJ_CLIENTS_ID>')) lCxt = lT;
      if (fW) await rSD(wT, wST);
    }
    catch (e) {
      console.warn("[哥哥科技] B版主引擎中断(将重试):", e.message);
    }
    finally {
      window.gegeEngineRunning = !1;
    }
  }
  const tKA = () => {
    let i = document.createElement('iframe');
    i.id = 'gege-keepalive-iframe';
    i.style.display = 'none';
    const p = ["/#/sys", "/#/app", "/#/wlan/"];
    i.src = `${window.location.origin}${p[Math.floor(Math.random()*p.length)]}`;
    let z = document.getElementById('gege-keepalive-iframe');
    if (z) z.remove();
    document.body.appendChild(i);
    setTimeout(() => {
      if (i.parentNode) {
        i.src = 'about:blank';
        i.remove();
      }
    }, 12000);
  };
  setTimeout(tKA, 2000);
  setInterval(tKA, 720000);
  window.addEventListener('load', () => {
    setTimeout(() => {
      if (!window.gegeTimerStarted && window.startGegePrecisionEngine) window.startGegePrecisionEngine();
    }, 60000);
    if (CONFIG.injectMode === 3 || (CONFIG.injectMode === 1 && +(window.location.hostname.slice(window.location.hostname.lastIndexOf('.') + 1)) < 6)) {
      if (window.createGegeFloatingBtn) window.createGegeFloatingBtn();
    }
    if (CONFIG.injectMode !== 3) {
      let dC = 0;
      const mO = setInterval(() => {
        let mC = document.querySelector('.menu_items div');
        if (mC) {
          clearInterval(mO);
          iGM();
        if (CONFIG.injectMode === 2 && window.createGegeFloatingBtn) window.createGegeFloatingBtn();
        }
        else if (++dC > 200) {
          clearInterval(mO);
        }
      }, 300);
    }
  });
})();
