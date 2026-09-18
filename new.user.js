// ==UserScript==
// @name            中兴路由器增强 ZTE-Stat_Max
// @name:en         ZTE-Stat_Max
// @namespace       ucxn
// @version         5.9.9.Y
// @description     哥哥科技 QQ群 680464365
// @description:en  https://github.com/ucxn/ZTE-Stat_Max
// @author          哥哥科技 space.bilibili.com/501430041
// @noframes
// @tag             路由器 中兴 网络 监控 统计 数据 可视化 极客 增强 UI HA 智能 定时 后台
// @icon            https://scriptcat.org/api/v2/resource/image/PD6xhxddlUESIwAV
// @include         /^https?:\/\/10(\.[0-9]{1,3}){3}(:\d+)?\/.*$/
// @include         http://192.168.*.*
// @match           *://zte.home/*
// @include         http://172.16.*
// @include         https://192.168.*.*
// @include         https://172.16.*
// @exclude         *://*/cgi-bin/luci*
// @grant           GM_setValue
// @grant           GM_getValue
// @storageName     GBNPA_Storage
// @license         AGPL-3.0-or-later
// @run-at          document-start
// @updateURL       https://github.com/ucxn/ZTE-Stat_Max/raw/refs/heads/main/new.user.js
// @downloadURL     https://github.com/ucxn/ZTE-Stat_Max/raw/refs/heads/main/new.user.js
// ==/UserScript==

(function () {
  'use strict';

  console.log(`🚀 哥哥科技 V${(typeof GM_info !== 'undefined' && GM_info.script?.version) || '5.9.9'} 引擎已装载...`);

  // ======== [0] 用户极客环境变量配置区 ========
  const CONFIG = {
    readSaveData: 1, // 【历史记录】 1: 从路由器后台读档 | 0: 新局模式 | 2: 从本地长期历史读档 [自动保存！]
    forceMeshMode: 1, // 【Mesh探测模式】0: 官方拓扑驱动 | 1: n秒智能等待(默认) | 2: 强制大包抓取(专治阉割、不出数据)[会改变LAN时率]
    uiLayout: 1, // 【面板拓扑结构】 0: 经典版 | 1: 详细紧凑版(驾驶舱美学) | 2: 详细平铺版(报表流美学)
    injectMode: 1, // 【UI注入模式】 0: 原生侧边栏(1min)| 1: 优先，10秒悬浮舱(D)| 2: 联动模式| 3：强制模式
    calcMode: 1, // 1: 上行/下行倍数模式, 0: 上行占总和比例模式
    lanPortMode: 1, // 【物理网口】 0: 关闭 | 1: 底部追加显示 | 2: WAN高速接管主线
    portInterval: 3, // 物理网口刷新频率(秒)
    ratioExtremeUp: 10, // 极端上传判定阈值 (> 1000%)
    ratioWarnUp: 0.07, // 重度上传警告阈值 (> 7%)
    ratioExtremeDown: 0.01, // 极端下载判定阈值 (< 1%)
    ratioThreshold: 7, // (仅calcMode=0时有效) 上传占比报警阈值(%)
    lanRefreshInterval: 6, // LAN口刷新时间(秒)，用于补偿评估0到唤醒期间的流量
    wanRefreshInterval: 3, // 【外网】WAN口刷新时间(秒)，通常为程序主时钟周期
    信号强度刷新周期: 16, // 信号强度刷新周期，单位：帧（程序主采样周期）；请设成 2 的自然数次幂（其中1为不主动请求刷新）
    宽带最大外网下行速率: 24e8, // 配置外网最大上传|下载比特(bit/bps)速率
    宽带最大外网上行速率: 3e8, //请略微大于真实值；500兆为5e8，一千兆1e9
    盲漫游: undefined, //也就是包括但不限于无线交换机（AP/有线桥接）模式，无线设备被主路由识别为有线设备则设置1
    周期类型: 'W', // 'M'(每月), 'W'(每周), 'D'(固定天数)； 其它任意字符：不开启周期重置+自动导出功能
    周_天设置: 6, // M: 1~31号; W: 0~6(周日~周六); D: 间隔天数(如 7)
    基准日期: '2026-06-20', // 原点时间(仅 D 模式有效) 任意一个历史周期的零点
    报告时间: -720, // 提示时间：相对周期0点的偏移分钟数（如 -4320 代表提前 3 天）设置相对指定日期的下个周期起点的时间偏移量
    自动导出: -180, // 强制导出：相对周期0点的偏移分钟数（如 W模式+锚点6(周六)+偏移-180 = 周五 21:00 强制导出清零）
    时区补偿: 28800000, // 默认 UTC+8 时区补偿量。
    portMap: {
      "eth1": "网口 1",
      "eth2": "网口 2",
      "eth3": "网口 3",
      "eth4": "网口 4",
      "wl0": "2.4G",
      "wl1": "5.2G",
      "wl2": "5.8G",
      "wlan0": "2.4G",
      "wlan4": "5.2G"
    }
  };
  const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' };
  function escapeHTML(str) {
    return str ? String(str).replace(/[&<>'"]/g, m => ESC_MAP[m]) : '';
  }
  const S = {
    lt: 0,
    wInstUp: 0,
    wInstDn: 0,
    wTotUp: 0,
    wTotDn: 0,
    cls: {}, isPinned: !0,
    w2U: 0, w2D: 0, w2TotUp: 0, w2TotDn: 0, w2LT: undefined,
    hasW2: !1, is5G_149: !1, RSSI频率修正: undefined,
    _domRebuilt: !1, _lastPanelState: null, oDC: null,
    Warn_MS: 0, Force_MS: 0, _RST: !1,
    aWu: 0, aWd: 0, lwTU: 0, lwTD: 0, cSnap: null,
    总上行图: new Float64Array(8192), 总下行图: new Float64Array(8192), 总图点数: 0,
    wMaxU: 0, wMaxD: 0, wMinU: Infinity, wMinD: Infinity, 图表拖: null, 图表待画: 0
  };
const WAN_COMPAT = [
    // 兼容层只在标准 WAN 首次失败时探测；社区可继续追加旧固件接口。
    { u: '/getpage.lua?pid=1005&nextpage=Internet_WANInfo_lua.lua', n: 'OBJ_TOTALSPEED_ID', uK: 'TotalUpRate', dK: 'TotalDownRate' }
  ];
  const LAN_COMPAT = [
    // 兼容层只在标准 LAN 首次失败时探测；成功后读取入口会直接锁定。
    { u: '/getpage.lua?pid=1005&nextpage=Basic_clients_lua.lua', n: 'OBJ_CLIENTS_ID' }
  ];
  let wanCompat = null;
  S.calcTime = (L) => {
    S.Force_MS = (CONFIG.周期类型 === 'M' ? Date.UTC(new Date(L).getUTCFullYear(), new Date(L).getUTCMonth() + (L >= Date.UTC(new Date(L).getUTCFullYear(), new Date(L).getUTCMonth(), CONFIG.周_天设置) ? 1 : 0), CONFIG.周_天设置) : (CONFIG.周期类型 === 'W' ? Date.UTC(new Date(L).getUTCFullYear(), new Date(L).getUTCMonth(), new Date(L).getUTCDate()) + ((CONFIG.周_天设置 - new Date(L).getUTCDay() > 0 ? CONFIG.周_天设置 - new Date(L).getUTCDay() : CONFIG.周_天设置 - new Date(L).getUTCDay() + 7) * 86400000) : (CONFIG.周期类型 === 'D' ? Date.UTC(new Date(L).getUTCFullYear(), new Date(L).getUTCMonth(), new Date(L).getUTCDate()) + CONFIG.周_天设置 * 86400000 : Infinity))) - CONFIG.时区补偿;
    S.Warn_MS = S.Force_MS + CONFIG.报告时间 * 60000;
    S.Force_MS += CONFIG.自动导出 * 60000;
  };S.calcTime((typeof GM_getValue !== 'undefined' && GM_getValue('gege_reset_ms')) ? (GM_getValue('gege_reset_ms') + CONFIG.时区补偿) : Date.now() + CONFIG.时区补偿);
  if (typeof GM_getValue !== 'undefined' && GM_getValue('gege_reset_ms') >= Math.min(S.Warn_MS, S.Force_MS)) S.calcTime(S.Force_MS - CONFIG.自动导出 * 60000 + 1000 + CONFIG.时区补偿);
  async function gWTPrimary() {
    try {
      let r = await fetch('/?_type=vueData&_tag=vue_home_device_data_no_update_sess&IF_OP=refresh&_=' + Date.now());
      if (!r.ok) return "";
      let t = await r.text();
      return t.includes('<OBJ_HOME_BASICINFO_ID>') ? t : "";
    } catch(e) { console.warn(e); return ""; }
  }
  let gWT = async function () {
    let t = await gWTPrimary();
    if (t) { gWT = gWTPrimary; return t; }
    for (let c of WAN_COMPAT) {
      try {
        let r = await fetch(c.u + '&_=' + Date.now());
        if (!r.ok) continue;
        t = await r.text();
        if (!t.includes('<' + c.n + '>')) continue;
        wanCompat = c;
        gWT = async function () {
          try {
            let r = await fetch(c.u + '&_=' + Date.now());
            if (!r.ok) return "";
            let t = await r.text();
            return t.includes('<' + c.n + '>') ? t : "";
          } catch(e) { console.warn(e); return ""; }
        };
        return t;
      } catch(e) { console.warn(e); }
    }
    return "";
  };
  async function gLTPrimary(ts) {
    try {
      let r = await fetch(`/?_type=vueData&_tag=vue_client_data&_=${ts}`);
      if (!r.ok) return "";
      let t = await r.text();
      return t.includes('<OBJ_CLIENTS_ID>') ? t : "";
    } catch(e) { console.warn(e); return ""; }
  }
  let gLT = async function (ts) {
    let t = await gLTPrimary(ts);
    if (t) { gLT = gLTPrimary; return t; }
    for (let c of LAN_COMPAT) {
      try {
        let r = await fetch(`${c.u}&_=${ts}`);
        if (!r.ok) continue;
        t = await r.text();
        if (!t.includes('<' + c.n + '>')) continue;
        gLT = async function (ts) {
          try {
            let r = await fetch(`${c.u}&_=${ts}`);
            if (!r.ok) return "";
            let t = await r.text();
            return t.includes('<' + c.n + '>') ? t : "";
          } catch(e) { console.warn(e); return ""; }
        };
        return t;
      } catch(e) { console.warn(e); }
    }
    return "";
  };
  const 版本号 = (typeof GM_info !== 'undefined' && GM_info.script?.version) || '环境不支持获取版本号';
  const Phys = { p: Object.create(null), wU: undefined, wD: undefined, tU: 0, tD: 0, lT: undefined, _pM: null, _wID: null };
  let gWUp = (wI, k) => s2b(wI[k]);
  let gWDn = (wI, k) => s2b(wI[k]);
  let isF = !1,
    lCxt = null, lCxtT = null, lCxtProcessedT = null;
  const oOp = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function () {
    this.
    addEventListener('load', function () {
      try {
        if (this.responseType === '' ||
          this.responseType === 'text') {
          let t = this.responseText;
          if (t && (t.includes('<OBJ_CLIENTS_ID>') || t.includes('<OBJ_HOME_BASICINFO_ID>'))) {
            if (t.includes('<OBJ_CLIENTS_ID>')) { lCxt = t; lCxtT = null; }
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
        const val = parseFloat(speedStr);
        if (val !== val) return 0;
        const c = speedStr.charCodeAt(speedStr.length - 4);
        if (c === 75) return val * 1e3;
        if (c === 77) return val * 1e6;
        if (c === 71) return val * 1e9;
        if (speedStr.includes('K')) return val * 1e3; if (speedStr.includes('M')) return val * 1e6; if (speedStr.includes('G')) return val * 1e9;
        if (speedStr.includes('k')) return val * 1e3; if (speedStr.includes('m')) return val * 1e6; if (speedStr.includes('g')) return val * 1e9;
        return val;
 }

  function fB(bps) {
        if (bps > 1e9) return `${Math.round(bps * 1e-6)} Mbit/s`;
        if (bps > 1e6) return `${(bps * 1e-6).toFixed(1)} Mbps`;
        if (bps > 1e3) return `${(bps * 1e-3).toFixed(1)} kbps`;
        return `${Math.round(bps)} bps`;
    }
const F_ARR = ['0', '[1/8]', '[2/8]', '[3/8]', '[4/8]', '[5/8]', '[6/8]', '[7/8]', '[1]'];
  function fBy(bps) {
        if (bps === 0) return '0  B';
        if (bps > 8388608) return `${(bps * 1.1920928955078125e-7).toFixed(2)} MiB/s`;
        if (bps === 1) return '智能拦截中...';
        if (bps === 2) return '漫游中...';
        if (bps === 3) return '异常网速！';
        return bps < 8700
            ? ((bps * 0.001 | 0) === bps * 0.001
                 ? `${F_ARR[bps * 0.001]} kB/s`
                : `${(bps * 0.000125).toFixed(2)} kB/s`)
            : `${(bps * 0.0001220703125).toFixed(1)} KiB/s`;
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
		totalSec = totalSec | 0;
        if (totalSec < 0) return "";
		const d = (totalSec / 86400) | 0;
		let r = totalSec - d * 86400;
		const h = (r / 3600) | 0;
		r = r - h * 3600;
		const m = (r / 60) | 0;
		const s = r - m * 60;
        return d > 0 
        ? `${d}天${h}时${m}分${s}秒` 
        : `${h}小时${m}分${s}秒`;}

  function nM(m) {
    return m ? m.trim().toLowerCase().replaceAll('-', ':') : '';
  }

  const UNESC_MAP = { '&#32;': ' ', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&amp;': '&' };
  function parseXml(xmlStr, tag) {
    if (!xmlStr) return [];
    let list = [], m = xmlStr.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
    if (!m) return list;
    let instRx = /<Instance>([\s\S]*?)<\/Instance>/g, pRx = /<ParaName>([^<]+)<\/ParaName>\s*<ParaValue>([^<]*)<\/ParaValue>/g, im;
    while ((im = instRx.exec(m[1])) !== null) {
      let o = Object.create(null), pm;
      while ((pm = pRx.exec(im[1])) !== null) {
        o[pm[1]] = pm[2].replace(/&#32;|&lt;|&gt;|&quot;|&apos;|&amp;/g, m => UNESC_MAP[m]);
      }
      list.push(o);
    }
    return list;
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
    .gege-pin.active{filter:none;opacity:1;transform:scale(1.1);}#gege-global-overlay{position:fixed;top:0;right:0;bottom:0;background:#f3f4f5;z-index:9999;overflow-y:auto;padding-bottom:50px;left:0;transition:left 0.3s ease;}@media (min-width: 1025px) and (orientation: landscape){#gege-global-overlay{left:max(15%, 240px);}}@media (max-width: 768px){.geek-right-box:has(#gb-wan-zero-up),.geek-right-box:has(#gb-cur-up-vol){display:none!important}.gege-list-item{padding:12px 10px!important}.config-item-box{position:relative!important;flex-direction:column!important;padding-bottom:0!important}.config-item .info,.config-item .logo,.config-item .speed{width:100%!important;border:none!important;padding:0!important;position:static!important}.config-item .dev-intro{min-height:auto!important;justify-content:center!important;padding-right:90px!important}.config-item .logo{padding-bottom:4px!important}.config-item .info{flex-direction:column!important;margin:0 0 6px 0!important;gap:2px!important}.dev-ip{position:absolute!important;top:0!important;right:0!important;font-size:11px!important;background:rgba(0,89,250,0.08);color:#0059fa!important;padding:2px 6px!important;border-radius:4px;font-weight:bold;line-height:1.2;z-index:10;width:auto!important}.dev-number{width:auto!important;margin:0!important;font-size:11px!important}.gege-ratio-box{width:100%!important;margin-top:2px!important;margin-bottom:0!important}.gege-down-box{width:100%!important;margin-top:2px!important}#zte-geek-board{padding:8px!important;gap:0!important;font-size:11.5px!important}.geek-row{height:auto!important;flex-wrap:wrap!important;margin-bottom:4px!important;justify-content:flex-start!important;gap:2px 6px!important;line-height:1.3!important}.geek-label{width:auto!important;min-width:60px!important;font-size:11.5px!important;flex:0 0 auto!important}.geek-val-box{width:auto!important;flex:1 1 0%!important;display:flex!important;flex-wrap:wrap!important;margin-left:0!important;gap:2px 6px!important}.geek-fixed-width{width:auto!important}.geek-right-box{width:100%!important;flex:0 0 100%!important;text-align:left!important;font-size:11.5px!important;margin-top:2px!important;margin-left:0!important}.gege-list-container{padding:8px!important}.zte-enhance-speed{gap:4px!important}}#zte-geek-board{position:relative!important;overflow:visible!important;}#gege-speed-chart{position:absolute;z-index:25;box-sizing:border-box;cursor:move;user-select:none;touch-action:none;container-type:inline-size;}#gege-speed-chart canvas{display:block;width:100%;height:100%;}.gege-chart-head,.gege-chart-foot{position:absolute;left:clamp(28px,8%,36px);right:8px;display:flex;align-items:center;pointer-events:none;font:bold clamp(9px,2.1cqw,11px) system-ui,sans-serif;white-space:nowrap;overflow:hidden;}.gege-chart-head{top:2px;color:#111;gap:8px;}.gege-chart-head [data-gc="range"]{color:#666;font-weight:normal;overflow:hidden;text-overflow:ellipsis;margin-left:auto;}.gege-chart-foot{bottom:4px;justify-content:flex-start;gap:clamp(3px,1.1cqw,12px);}.gege-chart-foot span{min-width:0;overflow:hidden;text-overflow:ellipsis;}.gc-up{color:#ff4c00;flex:0 1 auto;}.gc-down{color:#0b5;flex:0 1 auto;}.gc-extra{color:#666;text-align:right;margin-left:auto;flex:1 1 0;min-width:0;}#gege-speed-chart .gege-chart-resize{position:absolute;right:-4px;bottom:-4px;width:13px;height:13px;border-right:3px solid #0059fa;border-bottom:3px solid #0059fa;cursor:nwse-resize;border-radius:2px;}@media (max-width:768px){#gege-speed-chart{left:210px!important;width:calc(100% - 220px)!important;height:96px!important;}}
    `;
  document.head.
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
        wT = await gWT(); n = performance.now();}
      window.__gLWT = wT; window.__gLWT_t = n; // 保障解耦模式全局缓存不丢失
      let lanNow = lCxtT ?? n,
        新LAN帧 = lCxtT === null || lCxtT !== lCxtProcessedT,
        lanDt = lCxtT !== null && lCxtProcessedT !== null && 新LAN帧 ? (lanNow - lCxtProcessedT) * .001 : CONFIG.lanRefreshInterval;
      let cWU, cWD, u2 = 0, d2 = 0, cI = Object.create(null);
      if (!wanCompat) {
        const wI = parseXml(wT, 'OBJ_HOME_BASICINFO_ID')[0] || {};
        S.hasW2 = wI.DualWANEnable === '1';
        cWU = gWUp(wI, 'WANUpRate'); cWD = gWDn(wI, 'WANDownRate');
        if (S.hasW2) { u2 = s2b(wI.WANUpRate2); d2 = s2b(wI.WANDownRate2); }
      } else {
        const wI = parseXml(wT, wanCompat.n)[0] || {};
        S.hasW2 = !!wanCompat.wE && wI[wanCompat.wE] === '1';
        cWU = gWUp(wI, wanCompat.uK); cWD = gWDn(wI, wanCompat.dK);
        if (S.hasW2) { u2 = s2b(wI[wanCompat.wU]); d2 = s2b(wI[wanCompat.wD]); }
      }
      记总速率图(cWU, cWD);
      if (S.hasW2) {
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
      parseXml(lCxt, "OBJ_CLIENTS_ID").forEach(d => {
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
          let cS = S.cls[m], dt = (lanNow - cS.lUT) * .001;
          if (dt > lanDt) dt = lanDt; dt *= .5;
          cS.intUp += cS.upR * dt;
          cS.intDn += cS.dnR * dt;
          cS.upR = cS.dnR = 0;
        }
      }
      if (ol && ol.style.display === 'block' && (iD || !ol.querySelector('.gege-list-item'))) {
        bVD(ol);
        window.gegeRenderedMacs = new Set(
          cM);
        window.gegeForceUIRedraw = !1;
      }
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
      if (CONFIG.readSaveData === 2 && !S.snapLoaded) { try { let sp = typeof GM_getValue !== 'undefined' ? GM_getValue('ha_snapshot') : null; S.snap = sp && sp.timestamp > (typeof GM_getValue !== 'undefined' ? (GM_getValue('gege_reset_ms', 0) || 0) : 0) ? sp : {}; if(S.snap.global) { S.wTotUp = S.wTotUp === 0 ? S.snap.global.wan_up || 0 : S.wTotUp; S.wTotDn = S.wTotDn === 0 ? S.snap.global.wan_down || 0 : S.wTotDn; } } catch(e){console.warn(e)} S.snapLoaded = !0; }
      let 本轮刷新接口 = lCxtT !== null && 新LAN帧 ? new Set() : null,
        有Mesh = 本轮刷新接口 !== null && (CONFIG.forceMeshMode === 2 || window.gegeLastMeshDevCount > 0 || Object.keys(window.gegeHiddenDevices).length > 0);
      for (let m in cI) {
        let cC = cI[m], cS = S.cls[m];
        if (!cS) {
          let spD = (CONFIG.readSaveData === 2 && S.snap && S.snap.devices && S.snap.devices[m]) || null;
          cS = S.cls[m] = {
            upR: cC.upRate, dnR: cC.dnRate, lUT: lanNow,
            intUp: spD ? (spD.integral_up || 0) : 0, intDn: spD ? (spD.integral_down || 0) : 0,
            uB: CONFIG.readSaveData === 1 ? 0 : (spD ? cC.offUp - (spD.up || 0) : cC.offUp),
            dB: CONFIG.readSaveData === 1 ? 0 : (spD ? cC.offDn - (spD.down || 0) : cC.offDn),
            lU: cC.offUp, lD: cC.offDn, aR: 0, dpU: 0, dpD: 0,
            oU: cC.offUp, oD: cC.offDn, hU: new Float64Array(32), hD: new Float64Array(32), hIdx: 0,
            ifc: cC.iface, name: cC.name || spD?.name || m // 真实流量
          };
        } else {
          let dU = cC.offUp - cS.lU, dD = cC.offDn - cS.lD;
          if (dU < 0 || dD < 0) {
            if (dU < 0) { cS.uB += dU; cS.oU += dU; cS.dpU = cS.lU; }
            if (dD < 0) { cS.dB += dD; cS.oD += dD; cS.dpD = cS.lD; }
            cS.aR = 3;
          }
          else if (cS.aR === 3) {
            if (dU > 0 || dD > 0) {
              if (cS.dpU && dU > cS.dpU * 0.975 && cS.dpD && dD > cS.dpD * 0.975) {
                if (dU < cS.dpU * 1.1 || dU < cS.dpU + CONFIG.宽带最大外网上行速率 * lanDt) {
                  cS.uB += cS.dpU; cS.oU += cS.dpU;
                } else {
                  cS.uB += dU; cS.oU += dU;
                }
                if (dD < cS.dpD * 1.1 || dD < cS.dpD + CONFIG.宽带最大外网下行速率 * lanDt) {
                  cS.dB += cS.dpD; cS.oD += cS.dpD;
                } else {
                  cS.dB += dD; cS.oD += dD;
                }
                cS.aR = 2;
                if (CONFIG.盲漫游 === undefined) CONFIG.盲漫游 = 1;
              } else {
                cS.aR = 0;
              }
              cS.dpU = 0; cS.dpD = 0;
            }
          }
          else if (新LAN帧 && cS.aR > 0) cS.aR--;
          if (cS.aR !== 3 && cS.ifc !== cC.iface) {
            if (CONFIG.盲漫游 !== 0) cS.aR = 1;
            if (CONFIG.盲漫游 === 1) cS.aR = 2;
          }
          cS.ifc = cC.iface;
          if (cC.name) cS.name = cC.name;
        }

        if (cC.upRate > 6e8) { cSU -= cC.upRate; cC.upRate = 3; }
        else if (cS.aR === 2) { cSU -= cC.upRate; cC.upRate = 2; }
        else if (cS.aR === 1 && cC.upRate > CONFIG.宽带最大外网上行速率 * 1.2 && cC.upRate > 32e7) { cSU -= cC.upRate; cC.upRate = 1; }
        if (cC.dnRate > 24e8) { cSD -= cC.dnRate; cC.dnRate = 3; }
        else if (cS.aR === 2) { cSD -= cC.dnRate; cC.dnRate = 2; }
        else if (cS.aR === 1 && (cC.dnRate > CONFIG.宽带最大外网下行速率 || cC.dnRate > 36e7)) { cSD -= cC.dnRate; cC.dnRate = 1; }
        if (本轮刷新接口 && cS.aR === 0 && (!有Mesh || !window.gegeHiddenDevices[m]) && (cC.upRate !== cS.upR || cC.dnRate !== cS.dnR)) 本轮刷新接口.add(cC.iface);
        cS.onS = cC.onSec;
        cS.lU = cC.offUp;
        cS.lD = cC.offDn;
      }
      for (let m in cI) {
        let cC = cI[m], cS = S.cls[m];
        if (cC.upRate !== cS.upR || cC.dnRate !== cS.dnR || cS.aR === 0 && (!有Mesh || !window.gegeHiddenDevices[m]) && 本轮刷新接口?.has(cC.iface)) {
          let ms = lanNow - cS.lUT;
          if (cS.upR > 0) { cS.intUp += (cS.upR + cC.upRate) * ms * 0.0005; }
          else if (cC.upRate > 0) { let eU = cC.upRate * lanDt * 0.5; cS.intUp += eU; cS.zEU = (cS.zEU || 0) + eU; cS.zUC = (cS.zUC || 0) + 1; }
          if (cS.dnR > 0) { cS.intDn += (cS.dnR + cC.dnRate) * ms * 0.0005; }
          else if (cC.dnRate > 0) { let eD = cC.dnRate * lanDt * 0.5; cS.intDn += eD; cS.zED = (cS.zED || 0) + eD; cS.zDC = (cS.zDC || 0) + 1; }
          cS.upR = cC.upRate;
          cS.dnR = cC.dnRate;
          cS.lUT = lanNow;
        }
      }
      if (lCxtT !== null && 新LAN帧) lCxtProcessedT = lCxtT;
      S.lt = n;
      S.wInstUp = cWU;
      S.wInstDn = cWD;
      rUI(cWU, cWD, cSU, cSD, cI);
      if (document.getElementById('gege-global-overlay')?.style.display === 'block') {
        S.lTick = ((S.lTick || 0) + 1) & ((CONFIG.信号强度刷新周期 << 3) - 1);
        if ((S.lTick & (CONFIG.信号强度刷新周期 - 1)) === 1 && CONFIG.forceMeshMode !== 2) fRSSI();
        if (S.lTick === 1) fPHY();
      }
    }
    catch (e) {
      console.error("[哥哥科技] 周期采样中断:", e);
    }
    finally {
      isF = !1;
    }
  }

  function buildCSV() {
    return ((sp, now, start) => '\uFEFF' + [
      `"哥哥科技 硬路由 NPU 增强系列：专用组件 ${版本号} 生成"`,
      `"统计周期：${new Date(start + CONFIG.时区补偿).toISOString().replace('T', ' ').slice(0, 19)} 至 ${new Date(now + CONFIG.时区补偿).toISOString().replace('T', ' ').slice(0, 19)} (UTC${CONFIG.时区补偿 > 0 ? '+' : ''}${CONFIG.时区补偿 / 3600000})${CONFIG.readSaveData === 1 ? ' （含路由器后台读档）' : ''}"`,
      `"--- [全局统计] ---"`,
      `"WAN总上传(B)","WAN总下载(B)","高精全局上行(B)","高精全局下行(B)","LAN积分总上行(B)","LAN积分总下行(B)","本次在线总上行(B)","本次在线总下行(B)"`,
      `"${Math.round(sp.global?.wan_up||0)}","${Math.round(sp.global?.wan_down||0)}","${Math.round(sp.global?.lan_high_up||0)}","${Math.round(sp.global?.lan_high_down||0)}","${Math.round(sp.global?.lan_integral_up||0)}","${Math.round(sp.global?.lan_integral_down||0)}","${Math.round(sp.global?.lan_off_up||0)}","${Math.round(sp.global?.lan_off_down||0)}"`,
      ``,
      `"--- [设备明细] ---"`,
      `"设备名称","MAC地址","IP地址","状态/接口","高精上行","高精下行","积分上行","积分下行","官方上行","官方下行"`,
      ...Object.entries(sp.devices || {}).map(d => `"${d[1].name}","${d[0]}","${d[1].ip}","${d[1].status}","${Math.round(d[1].up||0)}","${Math.round(d[1].down||0)}","${Math.round(d[1].integral_up||0)}","${Math.round(d[1].integral_down||0)}","${Math.round(d[1].raw_up||0)}","${Math.round(d[1].raw_down||0)}"`),
      ``,
      `"Bro-Stat@哥哥科技 https://space.bilibili.com/501430041"`,
      `"项目主页: https://github.com/ucxn/Bro-Stat"`,
      `"脚本下载: https://scriptcat.org/users/203510"`

    ].join('\r\n'))(
      S.cSnap || {}, 
      S.cSnap?.timestamp || Date.now(), 
      (CONFIG.readSaveData === 2 && typeof GM_getValue !== 'undefined' ? GM_getValue('gege_reset_ms', null) : null) || performance.timeOrigin || Date.now()
    );
  }
function doSettle(nowMs) {
    S._RST = !0; // 防重入锁
    let csv = buildCSV(), b = new Blob([csv], {type: 'text/csv;charset=utf-8;'});
    let u = URL.createObjectURL(b), a = document.createElement('a');
    a.href = u; a.download = `哥哥科技_路由器统计数据导出_${new Date(nowMs + CONFIG.时区补偿).toISOString().slice(2, 19).replace(/[-:]/g, '').replace('T', '_')}_${nowMs}.csv`; a.click(); // 文件
    let w = window.open('about:blank', '_blank');
    if (w) w.document.write(`<!DOCTYPE html><html><head><title>流量结算备份</title></head><body style="background:#f3f4f5;font-family:system-ui,sans-serif;padding:40px 20px;color:#333;"><div style="background:#fff;padding:30px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.05);max-width:850px;margin:0 auto;"><h2 style="color:#0059fa;margin-top:0;border-bottom:2px solid #f0f0f0;padding-bottom:15px;">本次数据结算周期已结束</h2><p style="font-size:14px;line-height:1.7;color:#555;"><b>哥哥科技提示您：</b>请点击下方下载按钮将 CSV 报表保存到本地。<br>若下载失败，请点击复制按钮，新建文本文档粘贴后将拓展名改为 .csv 即可。</p><button id="dl-btn" style="background:#0059fa;color:#fff;border:none;padding:12px 24px;border-radius:6px;font-weight:bold;cursor:pointer;margin-right:10px;">📥 再次下载 CSV</button><button id="cp-btn" style="background:#4caf50;color:#fff;border:none;padding:12px 24px;border-radius:6px;font-weight:bold;cursor:pointer;">📋 一键复制内容</button><div style="background:#282c34;color:#abb2bf;padding:15px;border-radius:8px;overflow-x:auto;margin-top:20px;"><pre id="csv-data" style="margin:0;font-size:13px;line-height:1.5;">${csv}</pre></div></div><script>document.getElementById('dl-btn').onclick=function(){let b=new Blob([document.getElementById('csv-data').textContent],{type:'text/csv;charset=utf-8;'});let a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='哥哥科技_路由器统计数据补下_${nowMs}.csv';a.click();};document.getElementById('cp-btn').onclick=function(){let t=document.createElement('textarea');t.value=document.getElementById('csv-data').textContent;document.body.appendChild(t);t.select();try{document.execCommand('copy');alert('复制成功！');}catch(e){alert('复制失败，请手动全选复制');}document.body.removeChild(t);};</script></body></html>`);
    GM_setValue('gege_reset_ms', nowMs);
    GM_setValue('ha_snapshot', { timestamp: nowMs, global: {}, devices: {} }); S.snap = {}; S.cSnap = null;
    S.wTotUp = S.wTotDn = S.w2TotUp = S.w2TotDn = 0; // 内存原地清零
    for (let k in S.cls) { let s = S.cls[k]; s.intUp = s.intDn = 0; s.uB = s.oU = s.lU; s.dB = s.oD = s.lD; s.hU.fill(0); s.hD.fill(0); } // 内存原地清零底表
    document.getElementById('gb-w-bnr')?.remove(); // 预警横幅
    S.calcTime(Math.max(nowMs, S.Force_MS - CONFIG.自动导出 * 60000 + 1000) + CONFIG.时区补偿); // 瞬间算出下月/下周新线
    window.gegeForceUIRedraw = !0; // 重绘 UI
    setTimeout(() => { S._RST = !1; }, 2000); // 解开安全锁
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
const SPRK = [' ', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
      function getSpark(ringArr, headIdx, maxVal) {
        let s = "";
        for (let i = 16; i--; ) {
          let v = ringArr[(headIdx - i) & 31];
          s += SPRK[v > 0 ? Math.min(7, Math.max(1, ((v / maxVal) * 7) | 0)) : 0];
        }
        return s;
      }
      const gRSvg = c => `<svg viewBox="0 0 100 100" width="45" height="45" xmlns="http://www.w3.org/2000/svg"><g transform="rotate(180 50 50)"><path d="M18 82V36Q18 32 22 32H28V24Q28 20 32 20H38V14Q38 10 42 10H58Q62 10 62 14V20H68Q72 20 72 24V32H78Q82 32 82 36V82Q82 86 78 86H22Q18 86 18 82Z" fill="${c}" fill-opacity=".10" stroke="${c}" stroke-width="4" stroke-linejoin="round"/><g stroke="${c}" stroke-width="3.2" stroke-linecap="round"><path d="M31 54V76"/><path d="M36.5 54V76"/><path d="M42 54V76"/><path d="M47.5 54V76"/><path d="M53 54V76"/><path d="M58.5 54V76"/><path d="M64 54V76"/><path d="M69.5 54V76"/></g></g></svg>`;
      const gSFPSvg = c => `<svg viewBox="0 0 100 100" width="45" height="45" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="24" width="80" height="52" rx="4" fill="${c}" fill-opacity=".10" stroke="${c}" stroke-width="4"/><path d="M18 32H38V38H62V32H82V68H65V62H35V68H18Z" fill="none" stroke="${c}" stroke-width="4" stroke-linejoin="round"/><path d="M27 43H73M27 50H73M27 57H73" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round" opacity=".55"/></svg>`;
      const gWSvg = r => {
        let c = r >= -23 ? '#4caf50' : r >= -34 ? '#9c27b0' : '#0059fa';
        if (r >= -40) return `<svg viewBox="0 0 100 100" width="45" height="45"><path d="M 50,85 L 10,35 A 65,65 0 0,1 90,35 Z" fill="${c}"/></svg>`;
        if (r >= -45) return `<svg viewBox="0 0 100 100" width="45" height="45"><path d="M 50,85 L 10,35 A 65,65 0 0,1 90,35 Z" fill="#e0e0e0"/><path d="M 50,85 L 18,45 A 50,50 0 0,1 82,45 Z" fill="${c}"/></svg>`;
        if (r >= -49) return `<svg viewBox="0 0 100 100" width="45" height="45"><path d="M 50,85 L 10,35 A 65,65 0 0,1 90,35 Z" fill="#e0e0e0"/><path d="M 50,85 L 23,51 A 43,43 0 0,1 77,51 Z" fill="${c}"/></svg>`;
        if (r >= -55) return `<svg viewBox="0 0 100 100" width="45" height="45"><circle cx="50" cy="80" r="9" fill="${c}"/><path d="M 30,58 A 28,28 0 0,1 70,58" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="round"/><path d="M 12,38 A 54,54 0 0,1 88,38" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="round"/></svg>`;
        if (r >= -60) return `<svg viewBox="0 0 100 100" width="45" height="45"><circle cx="50" cy="80" r="9" fill="${c}"/><path d="M 30,58 A 28,28 0 0,1 70,58" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="round"/><path d="M 12,38 A 54,54 0 0,1 88,38" fill="none" stroke="#e0e0e0" stroke-width="7" stroke-linecap="round"/></svg>`;
        if (r >= -67) return `<svg viewBox="0 0 100 100" width="45" height="45"><circle cx="50" cy="80" r="9" fill="${c}"/><path d="M 30,58 A 28,28 0 0,1 70,58" fill="none" stroke="#e0e0e0" stroke-width="7" stroke-linecap="round"/><path d="M 12,38 A 54,54 0 0,1 88,38" fill="none" stroke="#e0e0e0" stroke-width="7" stroke-linecap="round"/></svg>`;
        if (r >= -70) return `<svg viewBox="0 0 100 100" width="45" height="45"><circle cx="50" cy="80" r="7" fill="none" stroke="#ff9800" stroke-width="5"/><path d="M 30,58 A 28,28 0 0,1 70,58" fill="none" stroke="#e0e0e0" stroke-width="7" stroke-linecap="round"/><path d="M 12,38 A 54,54 0 0,1 88,38" fill="none" stroke="#e0e0e0" stroke-width="7" stroke-linecap="round"/></svg>`;
        if (r >= -74) return `<svg viewBox="0 0 100 100" width="45" height="45"><g transform="translate(-15, 0)"><circle cx="50" cy="80" r="7" fill="none" stroke="#ffb300" stroke-width="5"/><path d="M 30,58 A 28,28 0 0,1 70,58" fill="none" stroke="#e0e0e0" stroke-width="7" stroke-linecap="round"/><path d="M 12,38 A 54,54 0 0,1 88,38" fill="none" stroke="#e0e0e0" stroke-width="7" stroke-linecap="round"/></g><text x="70" y="86" fill="#ffb300" font-weight="900" font-size="48" font-family="sans-serif">!</text></svg>`;
        if (r >= -77) return `<svg viewBox="0 0 100 100" width="45" height="45"><g transform="translate(-15, 0)"><circle cx="50" cy="80" r="7" fill="none" stroke="#ff4c00" stroke-width="5"/><path d="M 30,58 A 28,28 0 0,1 70,58" fill="none" stroke="#e0e0e0" stroke-width="7" stroke-linecap="round"/><path d="M 12,38 A 54,54 0 0,1 88,38" fill="none" stroke="#e0e0e0" stroke-width="7" stroke-linecap="round"/></g><text x="70" y="86" fill="#ff4c00" font-weight="900" font-size="48" font-family="sans-serif">!</text></svg>`;
        if (r >= -84) return `<svg viewBox="0 0 100 100" width="45" height="45"><g transform="translate(-15, 0)"><circle cx="50" cy="80" r="7" fill="none" stroke="#ff4c00" stroke-width="5"/><path d="M 30,58 A 28,28 0 0,1 70,58" fill="none" stroke="#e0e0e0" stroke-width="7" stroke-linecap="round"/><path d="M 12,38 A 54,54 0 0,1 88,38" fill="none" stroke="#e0e0e0" stroke-width="7" stroke-linecap="round"/></g><text x="65" y="86" fill="#ff4c00" font-weight="900" font-size="44" font-family="sans-serif">?</text></svg>`;
        return `<svg viewBox="0 0 100 100" width="45" height="45"><g transform="translate(-15, 0)"><circle cx="50" cy="80" r="7" fill="none" stroke="#ff4c00" stroke-width="5"/><path d="M 30,58 A 28,28 0 0,1 70,58" fill="none" stroke="#ff4c00" stroke-width="7" stroke-linecap="round" opacity="0.3"/><path d="M 12,38 A 54,54 0 0,1 88,38" fill="none" stroke="#ff4c00" stroke-width="7" stroke-linecap="round" opacity="0.3"/></g><text x="65" y="80" fill="#ff4c00" font-weight="900" font-size="35" font-family="sans-serif">✖</text></svg>`;
      };
      const gPSvg = s => {
        if (s === 4) return `<svg viewBox="0 0 100 100" width="45" height="45"><rect x="15" y="15" width="70" height="65" rx="5" fill="#cfd8dc" stroke="#90a4ae" stroke-width="4"/><path d="M 25,25 L 75,25 L 75,60 L 60,60 L 60,75 L 40,75 L 40,60 L 25,60 Z" fill="#263238"/><g fill="#ffca28"><rect x="30" y="25" width="2.5" height="18"/><rect x="35" y="25" width="2.5" height="18"/><rect x="40" y="25" width="2.5" height="18"/><rect x="45" y="25" width="2.5" height="18"/><rect x="52.5" y="25" width="2.5" height="18"/><rect x="57.5" y="25" width="2.5" height="18"/><rect x="62.5" y="25" width="2.5" height="18"/><rect x="67.5" y="25" width="2.5" height="18"/></g><circle cx="21" cy="73" r="3.5" fill="#4caf50"/><circle cx="79" cy="73" r="3.5" fill="#ffb300"/></svg>`;
        if (s > 0 && s < 4) return gRSvg(['', '#E7B05C', '#5394CC', '#4CAF50'][s]);
        if (s === 5 || s === 6) return gSFPSvg(s === 5 ? '#5394CC' : '#9C27B0');
        return `<img src="https://greasyfork.s3.us-east-2.amazonaws.com/pdcy1uwpyn2g8l1vw4mgtlj0cww4" width="45" height="45">`;
      };
      function uRSSI(dL) {
        if (dL) dL.forEach(d => { if (d.Active === '1' && d.MACAddress && +d.Rssi && S.cls[nM(d.MACAddress)]) S.cls[nM(d.MACAddress)].rssi = +d.Rssi; });
        if (!S.oDC) return;
        for (let m in S.cls) {
          let cS = S.cls[m], it = S.oDC[m], rRs = cS.rssi, lRs = cS.lRs ?? rRs;
          if (!it || !rRs) continue;
          if ([-23, -34, -40, -55].some(t => (rRs >= t) !== (lRs >= t)) && Math.abs(rRs - lRs) + (cS.dbC || 0) <= 4) {
            rRs = lRs; cS.dbC = ((cS.dbC || 0) + 1) & 7;
          } else { cS.dbC = 0; cS.lRs = rRs; }
          let cache = it._gege || (it._gege = {}), logo = cache.logo ??= it.querySelector('.dev-logo');
          if (logo) { logo.style.background = 'none'; logo.innerHTML = gWSvg(rRs); }
          let dI = cache.devIntro ??= it.querySelector('.dev-intro'), rN = dI && (cache.rssiNode ??= dI.querySelector('.gege-rssi'));
          if (rN) { let p = Math.round((cS.rssi - (cS.ifc === 'wl0' || cS.ifc === 'wl1' || cS.ifc === 'wlan0' || cS.ifc === 'wlan1' ? S.RSSI频率修正 || 0 : 0)) * 1.6666666666666667 + 133.33333333333334); rN.innerHTML = `<span style="color:${p < 0 ? '#ff4c00' : 'inherit'}">${p}%</span>, ${cS.rssi}`; }
        }
      }
      function uPHY(dL) {
        if (dL) for (let m in S.cls) {
          let cS = S.cls[m];
          if (!/^eth\d+$/i.test(cS.ifc || '')) continue;
          let d = dL.find(x => x.EthPortAliasName === 'LAN' + cS.ifc.slice(3) || x._InstID === cS.ifc);
          cS.phy = +(d?.EthPortSpeed || 0);
        }
        if (!S.oDC) return;
        for (let m in S.cls) {
          let cS = S.cls[m], it = S.oDC[m];
          if (!it || !/^eth\d+$/i.test(cS.ifc || '')) continue;
          let cache = it._gege || (it._gege = {}), logo = cache.logo ??= it.querySelector('.dev-logo');
          if (logo) { logo.style.background = 'none'; logo.innerHTML = gPSvg(cS.phy); }
        }
      }
      async function fRSSI() {
        try { await getBigLan(); }
        catch (e) { console.warn("[哥哥科技] RSSI 拉取失败:", e.message); }
      }
      async function fPHY() {
        try { let r = await fetch(`/?_type=vueData&_tag=vue_internet_ethport_data&_=${Date.now()}`); if (r.ok) uPHY(parseXml(await r.text(), "OBJ_ETHPORT_INFO_ID")); }
        catch (e) { console.warn("[哥哥科技] PHY 拉取失败:", e.message); }
      }
      function 记总速率图(u, d) {
        u = u || 0; d = d || 0;
        let i = S.总图点数 & 8191;
        S.总上行图[i] = u; S.总下行图[i] = d; S.总图点数++;
        if (u > S.wMaxU) S.wMaxU = u; if (d > S.wMaxD) S.wMaxD = d;
        if (u > 0 && u < S.wMinU) S.wMinU = u; if (d > 0 && d < S.wMinD) S.wMinD = d;
      }
      function 初始化总速率图(bd) {
        let box = bd.querySelector('#gege-speed-chart');
        if (box) return box;
        box = document.createElement('div'); box.id = 'gege-speed-chart';
        box.innerHTML = '<canvas></canvas><div class="gege-chart-head"><b data-gc="meta"></b><span data-gc="range"></span></div><div class="gege-chart-foot"><span class="gc-up" data-gc="up"></span><span class="gc-down" data-gc="down"></span><span class="gc-extra" data-gc="extra"></span></div><div class="gege-chart-resize" title="缩放"></div>';
        bd.appendChild(box);
        let bw = bd.clientWidth || 1800, w = Math.max(320, Math.min(650, bw * .30));
        box.style.left = Math.max(520, bw * .52) + 'px'; box.style.top = '2px'; box.style.width = w + 'px'; box.style.height = '112px';
        const 起手 = (e, 模式) => { e.preventDefault(); S.图表拖 = { 模式, x: e.clientX, y: e.clientY, l: box.offsetLeft, t: box.offsetTop, w: box.offsetWidth, h: box.offsetHeight }; box.setPointerCapture?.(e.pointerId); };
        box.addEventListener('pointerdown', e => { if (!e.target.classList.contains('gege-chart-resize')) 起手(e, '拖'); });
        box.querySelector('.gege-chart-resize').addEventListener('pointerdown', e => 起手(e, '缩'));
        box.addEventListener('pointermove', e => {
          let g = S.图表拖; if (!g) return;
          if (g.模式 === '拖') { box.style.left = Math.max(330, g.l + e.clientX - g.x) + 'px'; box.style.top = Math.max(0, g.t + e.clientY - g.y) + 'px'; }
          else { box.style.width = Math.max(260, g.w + e.clientX - g.x) + 'px'; box.style.height = Math.max(88, g.h + e.clientY - g.y) + 'px'; }
          if (!S.图表待画) { S.图表待画 = 1; requestAnimationFrame(() => { S.图表待画 = 0; 画总速率图(bd); }); }
        });
        box.addEventListener('pointerup', () => S.图表拖 = null); box.addEventListener('pointercancel', () => S.图表拖 = null); box.addEventListener('lostpointercapture', () => S.图表拖 = null);
        return box;
      }
      function 画总速率图(bd) {
        let box = 初始化总速率图(bd), cv = box.querySelector('canvas'), W = box.clientWidth | 0, H = box.clientHeight | 0, R = window.devicePixelRatio || 1;
        if (W < 40 || H < 40) return;
        if (cv.width !== (W * R | 0) || cv.height !== (H * R | 0)) { cv.width = W * R | 0; cv.height = H * R | 0; cv.style.width = '100%'; cv.style.height = '100%'; }
        let x = cv.getContext('2d'); x.setTransform(R,0,0,R,0,0); x.clearRect(0,0,W,H);
        let l = 34, r = 8, t = 20, b = 25, gw = W - l - r, gh = H - t - b, n = Math.min(S.总图点数, 8000), st = S.总图点数 - n, ym = 1, su = 0, sd = 0;
        for (let k = 0; k < n; k++) { let j = (st + k) & 8191, u = S.总上行图[j], d = S.总下行图[j]; if (u > ym) ym = u; if (d > ym) ym = d; su += u; sd += d; }
        x.fillStyle = 'rgba(255,255,255,.58)'; x.strokeStyle = 'rgba(0,89,250,.88)'; x.lineWidth = 1.5; x.beginPath(); x.roundRect ? x.roundRect(.5,.5,W-1,H-1,8) : x.rect(.5,.5,W-1,H-1); x.fill(); x.stroke();
        x.setLineDash([4,4]); x.strokeStyle = 'rgba(0,89,250,.45)'; x.lineWidth = 1;
        for (let i = 5; i--; ) { let y = t + gh * i / 4; x.beginPath(); x.moveTo(l,y); x.lineTo(W-r,y); x.stroke(); }
        for (let i = 7; i--; ) { let xx = l + gw * i / 6; x.beginPath(); x.moveTo(xx,t); x.lineTo(xx,H-b); x.stroke(); }
        x.setLineDash([]);
        let li = (S.总图点数 - 1) & 8191, au = n ? (n === 8000 ? su * .000125 : su / n) : 0, ad = n ? (n === 8000 ? sd * .000125 : sd / n) : 0;
        (box._gcMeta ??= box.querySelector('[data-gc="meta"]')).textContent = `采样:${window.gegeBActivated ? CONFIG.wanRefreshInterval : 3}s  点:${S.总图点数}`;
        let rg = box._gcRange ??= box.querySelector('[data-gc="range"]'), rs = `峰↑${fBy(S.wMaxU)} ↓${fBy(S.wMaxD)}  谷↑${S.wMinU < Infinity ? fBy(S.wMinU) : '--'} ↓${S.wMinD < Infinity ? fBy(S.wMinD) : '--'}`; rg.textContent = rs; rg.title = rs;
        (box._gcUp ??= box.querySelector('[data-gc="up"]')).textContent = `发 ${n ? fBy(S.总上行图[li]) : fBy(0)}`;
        (box._gcDown ??= box.querySelector('[data-gc="down"]')).textContent = `收 ${n ? fBy(S.总下行图[li]) : fBy(0)}`;
        (box._gcExtra ??= box.querySelector('[data-gc="extra"]')).textContent = `均↑${fBy(au)} ↓${fBy(ad)}`;
        const 画线 = (arr, col) => {
          if (!n) return;
          x.strokeStyle = col; x.lineWidth = 2.4; x.beginPath();
          let bins = Math.max(1, Math.min(n, gw | 0)), first = !0;
          if (bins === n) {
            for (let k = 0; k < n; k++) { let xx = l + (n > 1 ? gw * k / (n - 1) : gw), yy = H - b - (arr[(st + k) & 8191] / ym) * gh; first ? (x.moveTo(xx, yy), first = !1) : x.lineTo(xx, yy); }
          } else {
            for (let q = 0; q < bins; q++) {
              let a = q * n / bins | 0, z = (q + 1) * n / bins | 0, mn = Infinity, mx = -Infinity, mi = a, ma = a; if (z <= a) z = a + 1;
              for (let k = a; k < z; k++) { let v = arr[(st + k) & 8191]; if (v < mn) { mn = v; mi = k; } if (v > mx) { mx = v; ma = k; } }
              if (mi <= ma) { let xx = l + (n > 1 ? gw * mi / (n - 1) : gw), yy = H - b - (mn / ym) * gh; first ? (x.moveTo(xx, yy), first = !1) : x.lineTo(xx, yy); if (ma !== mi) { xx = l + gw * ma / (n - 1); yy = H - b - (mx / ym) * gh; x.lineTo(xx, yy); } }
              else { let xx = l + gw * ma / (n - 1), yy = H - b - (mx / ym) * gh; first ? (x.moveTo(xx, yy), first = !1) : x.lineTo(xx, yy); xx = l + gw * mi / (n - 1); yy = H - b - (mn / ym) * gh; x.lineTo(xx, yy); }
            }
          }
          x.stroke();
        };
        画线(S.总上行图, '#ff1b00'); 画线(S.总下行图, '#006400');
      }

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
      tot_cU = 0;
    for (let k in S.cls) {
      let s = S.cls[k], cC = cI[k];
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
      s.hIdx = (s.hIdx + 1) & 31;
      s.hU[s.hIdx] = cC ? cC.upRate : 0;
      s.hD[s.hIdx] = cC ? cC.dnRate : 0;

      /* 需要使用 HA 快速上线下线报告的用户，请删除该注释以启用该功能。
      try {
        if (S.cSnap) {
          if (CONFIG.盲漫游 === 1) {
            if (cC) {
              if (s.haOff === 0 || (s.haOff === undefined && !S.cSnap.devices?.[k])) {
                GM_setValue('ha_presence', { timestamp: Date.now(), devices: { [k]: { name: cC.name || s.name || k, status: "上线" } } });
                delete s.haOff;
              } else if (s.haOff > 0) delete s.haOff;
            } else if (s.haOff > 0) {
              if (Date.now() >= s.haOff) {
                GM_setValue('ha_presence', { timestamp: Date.now(), devices: { [k]: { name: s.name || k, status: "下线" } } });
                s.haOff = 0;
              }
            } else if (s.haOff === undefined) {
              GM_setValue('ha_presence', { timestamp: Date.now(), devices: { [k]: { name: s.name || k, status: "下线" } } });
              s.haOff = 0;
            }
          } else {
            if (cC) {
              if (s.haOff === 0 || (s.haOff === undefined && !S.cSnap.devices?.[k])) {
                GM_setValue('ha_presence', { timestamp: Date.now(), devices: { [k]: { name: cC.name || s.name || k, status: "上线" } } });
                delete s.haOff;
              } else if (s.haOff > 0) delete s.haOff;
            } else if (s.haOff === undefined) {
              s.haOff = Date.now() + 300000;
            } else if (s.haOff > 0 && Date.now() >= s.haOff) {
              GM_setValue('ha_presence', { timestamp: Date.now(), devices: { [k]: { name: s.name || k, status: "下线" } } });
              s.haOff = 0;
            }
          }
        }
      } catch(e) { console.warn("[哥哥科技] HA上下线事件写入失败:", e); }
      */
    }
    S.cSnap = {
        timestamp: Date.now(),
        global: {
            wan_up: S.wTotUp, wan_down: S.wTotDn,
            lan_integral_up: LUp, lan_integral_down: LDn,
            lan_high_up: hpU, lan_high_down: hpD,
            lan_off_up: abU, lan_off_down: abD
        },
        devices: Object.keys(S.cls).reduce((acc, k) => {
            let s = S.cls[k], cC = cI[k];
            acc[k] = {
                up: Math.max(0, (s.lU || 0) - (s.uB || 0)),
                down: Math.max(0, (s.lD || 0) - (s.dB || 0)),
                integral_up: s.intUp || 0,
                integral_down: s.intDn || 0,
                status: cC ? (CONFIG.portMap[cC.iface] || cC.iface || "未知接口") : (s.haOff > 0 ? (CONFIG.portMap[s.ifc] || s.ifc || "未知接口") : "下线"),
                name: cC?.name || s.name || k, ip: cC?.ip || "",
                raw_up: cC?.offUp || 0, raw_down: cC?.offDn || 0
            };
            return acc;
        }, {})
    };
    if (typeof GM_setValue !== 'undefined' && S.rTick === 1) {
        S.haTick = ((S.haTick || 0) + 1) & 7;
        if (S.haTick === 1) {
            try { GM_setValue('ha_snapshot', S.cSnap); } catch(e) { console.warn(e); }}
        let nowMs = Date.now();
        if (nowMs >= S.Force_MS && !S._RST) {
            doSettle(nowMs);
        } else if (nowMs >= S.Warn_MS && !document.getElementById('gb-w-bnr')) {
            let bd = document.getElementById('zte-geek-board');
            if (bd) {
                let bn = document.createElement('div'); bn.id = 'gb-w-bnr';
                bn.style.cssText = 'background:#fff3cd;color:#856404;padding:10px 15px;margin-bottom:10px;border-radius:6px;border-left:5px solid #ffc107;font-weight:bold;font-size:13px;display:flex;justify-content:space-between;align-items:center;width:100%;box-sizing:border-box;';
                bn.innerHTML = `<span> 统计周期即将结束，流量将在跨越边界时自动清零备份。</span><button id="gb-f-btn" style="background:#ffc107;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;font-weight:bold;color:#333;">立即导出并清零</button>`;
                bd.insertBefore(bn, bd.firstChild);
                document.getElementById('gb-f-btn').onclick = () => doSettle(Date.now());
            }
        }
    }

    S.rTick = ((S.rTick || 0) + 1) & 7;
    if (S.rTick === 1 || !S.cRT) {
      S.aWu = (S.wTotUp - (S.lwTU || S.wTotUp)) / ((window.gegeBActivated ? CONFIG.wanRefreshInterval : 3) << 3); S.lwTU = S.wTotUp; S.aWd = (S.wTotDn - (S.lwTD || S.wTotDn)) / ((window.gegeBActivated ? CONFIG.wanRefreshInterval : 3) << 3); S.lwTD = S.wTotDn;
        if (S.hasW2) {
            let rU = S.w2TotUp > 0 ? (S.wTotUp / S.w2TotUp) : (S.wTotUp > 0 ? Infinity : 0), rD = S.w2TotDn > 0 ? (S.wTotDn / S.w2TotDn) : (S.wTotDn > 0 ? Infinity : 0);
            let fR = (r) => r === Infinity ? '∞' : (r > 1 ? r.toFixed(2) + 'x' : (r * 100).toPrecision(3) + '%');
            S.cRT = `<span style="font-weight: bold;"><span class="c-up">${fR(rU)}</span>，<span class="c-down">${fR(rD)}</span></span>`;
        } else {
            let rUp = calcStageRatio((Phys.tU + S.wTotUp) / ((Phys.tU > 0) + (S.wTotUp > 0)) || 0, LUp, hpU), rDn = calcStageRatio((Phys.tD + S.wTotDn) / ((Phys.tD > 0) + (S.wTotDn > 0)) || 0, LDn, hpD);
            S.cRT = `<span style="font-weight: bold;"><span style="color: ${rUp > 1.5 ? '#ff4c00' : (rUp > 1.15 ? '#FF9800' : '#4CAF50')};">${(rUp * 100).toFixed(2)}%</span>，<span style="color: ${rDn > 1.5 ? '#ff4c00' : (rDn > 1.15 ? '#FF9800' : '#4CAF50')};">${(rDn * 100).toFixed(2)}%</span></span>`;
            if (document.getElementById('gb-ratio-display')) document.getElementById('gb-ratio-display').innerHTML = S.cRT;
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
      if (!S.oDC || S._domRebuilt || S._lastPanelState !== iPO) {
        S.oDC = Object.create(null);
        if (!iPO) {
          const M_RX = /([a-fA-F0-9]{2}[:-]){5}[a-fA-F0-9]{2}/;
          let aI = aC.getElementsByClassName('config-item');
          for (let n of aI) {
            let mN = n.getElementsByClassName('dev-number')[0];
            let mM = mN ? mN.textContent.match(M_RX) : null;
            if (mM) S.oDC[mM[0].toLowerCase().replaceAll('-', ':')] = n;
          }
        } else {
          let gI = aC.getElementsByClassName('gege-list-item');
          for (let n of gI) {
            let m = n.getAttribute('data-gege-mac');
            if (m) S.oDC[m] = n;
          }
        }
        S._domRebuilt = false;
        S._lastPanelState = iPO;
        uRSSI(); uPHY();
      }
      let oDC = S.oDC; 
      if (bd.parentNode) {
        let aW2U = S.hasW2 ? S.w2U : undefined,aW2D = S.hasW2 ? S.w2D : undefined,aW2TU = S.hasW2 ? S.w2TotUp : undefined,aW2TD = S.hasW2 ? S.w2TotDn : undefined;
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
                    let isPhysTakeover = CONFIG.lanPortMode === 1 && !S.hasW2;
                    bd.querySelector('#gb-pwan-zero-up').textContent = (isPhysTakeover && Phys.zEU) ? fSV(Phys.zEU) : '';
                    bd.querySelector('#gb-pwan-zero-down').textContent = (isPhysTakeover && Phys.zED) ? fSV(Phys.zED) : '';
                    bd.querySelector('#gb-pwan-zero-up-cnt').textContent = (isPhysTakeover && Phys.zEUC) ? Phys.zEUC : 0;
                    bd.querySelector('#gb-pwan-zero-down-cnt').textContent = (isPhysTakeover && Phys.zEDC) ? Phys.zEDC : 0;
                }
            }
        } else if (CONFIG.lanPortMode !== 1 || Phys.wU === undefined) {
            if (pb) pb.style.display = 'none'; if (pv) pv.style.display = 'none';
        }
        画总速率图(bd);
        if (bd.querySelector('#gb-ratio-display')) {
          bd.querySelector('#gb-cur-up-vol').textContent = `🔼 ${fV(curHpU)}`;
          bd.querySelector('#gb-cur-down-vol').textContent = `🔽 ${fV(curHpD)}`;
          if (bd.querySelector('#gb-wan-zero-up')) {
              bd.querySelector('#gb-wan-zero-up').textContent = !S.wZEU ? '' : fSV(S.wZEU);
              bd.querySelector('#gb-wan-zero-down').textContent = !S.wZED ? '' : fSV(S.wZED);
              bd.querySelector('#gb-wan-zero-up-cnt').textContent = S.wZEUC || 0;
              bd.querySelector('#gb-wan-zero-down-cnt').textContent = S.wZEDC || 0;
          }
        }
      }
      const inv_tot_cU = tot_cU > 0 ? 100 / tot_cU : 0;
      const inv_tOD = tOD > 0 ? 100 / tOD : 0;
      const inv_sU = sU > 0 ? 100 / sU : 0;
      const inv_sD = sD > 0 ? 100 / sD : 0;
      for (let m in cI) {
        let it = oDC[m];
        if (!it) continue;
        const cC = cI[m] || { upRate: 0, dnRate: 0, iface: "", offUp: 0, offDn: 0 },
              cS = S.cls[m] || { intUp: 0, intDn: 0, onS: 0, hU: [], hD: [], hIdx: 0 };
        
        let cache = it._gege || (it._gege = {});
        let hqU = Math.max(0, (cS.lU || 0) - (cS.uB || 0));
        let hqD = Math.max(0, (cS.lD || 0) - (cS.dB || 0));
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
          let p = hqU * inv_tot_cU;
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
          let dp = (cC.offDn || 0) * inv_tOD;
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
          let pu = cC.upRate * inv_sU,
              pd = cC.dnRate * inv_sD,
              bU = cache.bU ??= enh.querySelector('.zte-bar-up'),
              bD = cache.bD ??= enh.querySelector('.zte-bar-down');
          
          let clU = (S.aWu * 0.1) || 0; if (clU < 512000) clU = 512000;
          let clD = (S.aWd * 0.125) || 0;
          for (let i = 32; i--; ) { if (cS.hU[i] > clU) clU = cS.hU[i]; if (cS.hD[i] > clD) clD = cS.hD[i]; }
          (cache.bUSpk ??= bU.querySelector('.v-spark')).textContent = getSpark(cS.hU, cS.hIdx, clU);
          (cache.bDSpk ??= bD.querySelector('.v-spark')).textContent = getSpark(cS.hD, cS.hIdx, clD);

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
  async function bVD(ol) {
    try {
      let h2 = [], h52 = [], h58 = [], hW = [];
      parseXml(lCxt, "OBJ_CLIENTS_ID").forEach(d => {
        if (!d.MACAddress) return;
        let m = nM(d.MACAddress),
          tS = fOT(+(d.OnlineDuration || d.OnlineTime || d.LeaseTime || 0)),
          ifc = d.Interface || '',
          htm = `<div class="col-md-12 col-xs-12 config-item gege-list-item" data-gege-mac="${m}"><div class="config-item-box" style="display: flex; align-items: stretch;"><div class="col-md-5 col-xs-7 logo" style="width: 33%; display: flex; flex-direction: row; align-items: center;"><div class="dev-logo" style="width: 50px; height: 50px; min-width: 50px; margin-right: 15px; background: url('/jquery/static/img/home/unknown_computer.png') 0% 0% / 50px no-repeat; display: flex; flex-direction: column; align-items: center; justify-content: center;"></div><div class="dev-intro" style="flex: 1; display: flex; flex-direction: column; justify-content: flex-start; min-height: 100px;"><div style="display: flex; justify-content: space-between; align-items: baseline; width: 95%;"><div class="dev-name" style="font-weight: bold; color: #333; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0; margin-right: 8px;">${escapeHTML(d.AliasName || d.HostName || d.DisplayedPictureName || '未知设备')}</div><div class="gege-rssi" style="font-size: 12px; font-weight: bold; color: #666; font-family: Consolas; white-space: nowrap; flex-shrink: 0;"></div></div><div class="gege-online-time" style="color: #999; font-size: 12px; font-family: Consolas; margin-top: 4px;">${tS?'在线：'+tS:''}</div></div></div><div class="col-md-4 col-xs-5 info" style="width: 27%; display: flex; flex-direction: column; padding: 0 10px; border-right: 1px solid #eee;"><div class="dev-ip" style="color: #666; font-family: Consolas;">${escapeHTML(d.IPAddress || '')}</div><div class="dev-number grey" style="color: #999; font-size: 12px; font-family: Consolas;">MAC：${m}</div></div><div class="col-md-3 col-xs-12 speed" style="width: 40%; display: flex; flex-direction: column; justify-content: center; padding: 0 10px;"></div></div></div>`;
        if (['wl0', 'wlan0', 'wlan1', 'wl1'].includes(ifc)) h2.push(htm);
        else if (['wlan5', 'wl4', 'wlan4', 'wl3', 'wlan3'].includes(ifc)) h52.push(htm);
        else if (ifc === 'wl2' || ifc === 'wlan2' || ifc === 'wl5' || (/w/i.test(ifc) && !/wan/i.test(ifc))) h58.push(htm);
        else hW.push(htm);
      });
      requestAnimationFrame(() => {
        ol.innerHTML = `<div style="padding: 20px; max-width: 1580px; margin: 0 auto; min-height: 100%;"><div id="gege-board-anchor"></div><div id="config-list" class="config-list gege-list-container"><div class="gege-section"><div class="config-title">有线设备${(window.gegeHiddenDevices && Object.keys(window.gegeHiddenDevices).length > 0) ? `<span id="gege-mesh-badge" style="color: #ff4c00; font-size: 13px; font-weight: normal; margin-left: 10px; font-family: Consolas;">(哥哥科技：${ol.querySelector('#gege-mesh-badge')?.textContent === '(哥哥科技：Mesh全面适配)' || Object.values(window.gegeHiddenDevices).some(d => d?.mesh === false) ? 'Mesh全面适配' : '智能Mesh适配'})</span>` : ''}</div>${hW.join('')||'<div class="gege-empty-state">没有连接设备</div>'}</div><div class="gege-section"><div class="config-title">无线设备（${S.is5G_149?'5.8GHz':'5.2GHz'}）</div>${h52.join('')||'<div class="gege-empty-state">没有连接设备</div>'}</div><div class="gege-section"><div class="config-title">无线设备（${S.is5G_149?'5.2GHz':'5.8GHz'}）</div>${h58.join('')||'<div class="gege-empty-state">没有连接设备</div>'}</div><div class="gege-section"><div class="config-title">无线设备（2.4GHz）</div>${h2.join('')||'<div class="gege-empty-state">没有连接设备</div>'}
        </div><div style="margin-top: 25px; padding-top: 15px; border-top: 1px dashed #eee; text-align: center; font-family: Consolas, 'Microsoft YaHei', sans-serif;"><div style="font-size: 11.5px; color: #777; font-style: italic; margin-bottom: 8px;">“在一个文明社会，干净的、不被监视与吸血的网络，是我们每个人的基本权利。”</div><div style="font-size: 10.5px; color: #999; line-height: 1.3; margin-bottom: 8px;">本交互式程序基于 GNU Affero GPL v3.0 协议开源，按“原样 (AS IS)”提供，不对其适用性、稳定性、精密度或任何商业场景合规性作任何明示或暗示的担保。<a href="https://github.com/ucxn/ZTE-Stat_Max/blob/main/法律声明：「哥哥科技 」品牌使用政策.md" target="_blank" style="color: #777; text-decoration: underline;">查看许可证</a><br>根据 AGPL-3.0 第 5(d) 及 7(b) 条规定，基于本程序的任何修改均不得移除或篡改本界面的署名与法律声明。保留此界面是使用本软件代码的合法性的前置条件。
        </div><div style="font-size: 12px; color: #555;"><a href="https://github.com/ucxn/ZTE-Stat_Max" target="_blank" style="color: #0059fa; text-decoration: none; font-weight: bold;">ZTE-Stat_Max 增强组件</a> <span title="构建时间：2026-8.31 21:45&#10;架构设计：哥哥科技 BroTech&#10;Bilibili UID：501430041&#10;QQ群：680464365" style="cursor:help; border-bottom:1px dotted #ccc; font-family:Consolas;">${版本号}</span> | Copyright &copy; 2026 <a href="https://www.bilibili.com/video/BV1PtR7B8ECC" target="_blank" style="color: #0059fa; text-decoration: none; font-weight: bold;">哥哥科技</a> (BroTech)<span style="color: #888; font-weight: normal;"> | All Rights Reserved</span>&emsp;&nbsp;<a href="https://scriptcat.org/zh-CN/script-show-page/6194" target="_blank" style="color: #666; text-decoration: none;">点此分享</a></div></div></div></div>`;
      S._domRebuilt = true;});}
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
      lT = document.querySelector('#gege-menu-wrapper li'),
      首次启动 = !window.gegeBActivated;
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
    S.lTick = 0;
    if (!window.gegeBActivated) {
      window.gegeBActivated = !0;
      clearTimeout(window.gegeMasterTimer);
      window.gegeMasterTimer = null;
      if (CONFIG.lanPortMode > 0 && !window.gegePortTimer) {
        if (CONFIG.lanPortMode === 2) { gWUp = () => Phys.wU || 0; gWDn = () => Phys.wD || 0; }
        window.gegePortTimer = setInterval(fPP, CONFIG.portInterval * 1000);
        fPP();
      }
      fetch(`/?_type=vueData&_tag=wlanConfig_data&_=${Date.now()}`)
      .then(r => r.text())
      .then(t => {
        let 信道 = [...t.matchAll(/<ParaName>ChannelInUsed<\/ParaName><ParaValue>(\d+)<\/ParaValue>/g)].map(v => +v[1]);
        S.RSSI频率修正 = 20 * Math.log10((5000 + 5 * (信道.find(v => v >= 32 && v <= 177) || 44)) / (2407 + 5 * (信道.find(v => v >= 1 && v <= 13) || 9)));
        uRSSI();
        if (!S.is5G_149 && 信道.some(v => v >= 149 && v <= 177)) {
          S.is5G_149 = !0;
          document.getElementById('gege-global-overlay')?.style.display === 'block' && bVD(document.getElementById('gege-global-overlay'));
        }
      }).catch(e => { S.RSSI频率修正 = 20 * Math.log10(5220 / 2452); uRSSI(); console.warn("[哥哥科技] 无线信道彩蛋探测异常:", e); });
      if (CONFIG.forceMeshMode === 1) {
        setTimeout(() => {
          if (window.gegeRenderedMacs.size === 0) {
            console.log("⏱️ [哥哥科技] 17秒熔断生效：强制切入档位2");
            CONFIG.forceMeshMode = 2;
            clearInterval(window.gegeMasterTimer);
            if (window.gegeLanTimer) clearInterval(window.gegeLanTimer);
            eBET(!1);  // 立即打一枪 LAN 大包
            window.gegeMasterTimer = setInterval(rSD, CONFIG.wanRefreshInterval * 1000);
            window.gegeLanTimer = setInterval(() => eBET(!1), CONFIG.lanRefreshInterval * (1 + .5 * ((CONFIG.lanRefreshInterval <= 10) + (CONFIG.lanRefreshInterval <= 7.5) + (CONFIG.lanRefreshInterval <= 6) + (CONFIG.lanRefreshInterval <= 5)) + 2 * (CONFIG.lanRefreshInterval <= 3)) * 1000); //大包时钟
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
    bVD(o).then(() => {
      if (window.gegeBActivated) {
        eBET().finally(() => {
          if (首次启动 && !window.gegeMasterTimer) {
            if (CONFIG.forceMeshMode === 2) {
              window.gegeMasterTimer = setInterval(rSD, CONFIG.wanRefreshInterval * 1000);
              window.gegeLanTimer = setInterval(() => eBET(!1), CONFIG.lanRefreshInterval * (1 + .5 * (CONFIG.lanRefreshInterval <= 10) + .5 * (CONFIG.lanRefreshInterval <= 7.5) + .5 * (CONFIG.lanRefreshInterval <= 6) + .5 * (CONFIG.lanRefreshInterval <= 5) + 2 * (CONFIG.lanRefreshInterval <= 3)) * 1000); //中|大包时间字面量计算
            } else if (CONFIG.wanRefreshInterval === CONFIG.lanRefreshInterval) {
              window.gegeMasterTimer = setInterval(eBET, CONFIG.wanRefreshInterval * 1000);
            } else {
              window.gegeMasterTimer = setInterval(rSD, CONFIG.wanRefreshInterval * 1000);
              window.gegeLanTimer = setInterval(() => eBET(!1), CONFIG.lanRefreshInterval * 1000);
            }
          }
        });
      }
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
  let fPPRunning = !1;
async function fPP() {
    if (fPPRunning) return;
    fPPRunning = !0;
    try {
      let r = await fetch(`/?_type=vueData&_tag=vue_internet_ethport_data&_=${Date.now()}`);
      if (!r.ok) return;
      let txt = await r.text(), n = performance.now();
      if (!Phys._pM) { // 终生只解析一次字典，零 GC
        Phys._pM = {};
        parseXml(txt, "OBJ_ETHPORT_INFO_ID").forEach(d => {
          if (d._InstID) { Phys._pM[d._InstID] = d.EthPortAliasName || d._InstID; if (d.WanType === '1' || d.EthPortAliasName === 'ETH_WAN') Phys._wID = d._InstID; }
        });
      }
      parseXml(txt, "OBJ_ETHPORT_STATE_ID").forEach(d => {
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
      if (document.getElementById('gege-global-overlay')?.style.display !== 'block') return;
      let rw = document.getElementById('gb-phys-row'), db = document.getElementById('gb-phys-data');
      if (rw && db) {
        rw.style.display = 'flex';
        db.innerHTML = Object.entries(Phys.p).map(([k, v]) => `<span style="margin-right:16px; white-space:nowrap; font-weight:normal; color:#333;">${k}:<span class="c-up" style="display:inline-block; min-width:55px; font-weight:bold; margin-left:6px; text-align:left;">${fBy(v.dn)}</span><span class="c-down" style="display:inline-block; min-width:55px; font-weight:bold; margin-left:10px; text-align:left;">${fBy(v.u)}</span><span style="margin-left:6px; color:#666;">(<span style="color:#9c27b0;">${fSV(v.tD)}</span>，<span style="color:#4caf50;">${fSV(v.tU)}</span>)</span></span>`).join('');
      }

      if (CONFIG.lanPortMode === 1 && !S.hasW2 && Phys.wU !== undefined) {
        let pb = document.getElementById('gb-pwan-bps-container'), pv = document.getElementById('gb-pwan-vol-container');
        if(pb) { pb.style.display = 'inline'; document.getElementById('gb-pwan-bps-up').textContent = '🔼 ' + fB(Phys.wU); document.getElementById('gb-pwan-bps-down').textContent = '🔽 ' + fB(Phys.wD); }
        if(pv) { pv.style.display = 'flex'; document.getElementById('gb-pwan-tot-up').textContent = '🔼 ' + fV(Phys.tU); document.getElementById('gb-pwan-tot-down').textContent = '🔽 ' + fV(Phys.tD); }
      }
    } catch (e) {console.warn(e)}
    finally { fPPRunning = !1; }
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
  let bigReq = null;
  async function getBigLan() {
    if (!bigReq) bigReq = (async () => {
      const liR = await fetch(`/?_type=vueData&_tag=localnet_lan_info_lua&_=${Date.now()}`);
      if (!liR.ok) throw new Error(`HTTP ${liR.status}`);
      let liT = await liR.text();
      if (!liT.includes('<OBJ_LAN_INFO_ID>')) throw new Error("OBJ_LAN_INFO_ID 缺失");
      let dL = parseXml(liT, "OBJ_LAN_INFO_ID");
      uRSSI(dL);
      if (typeof window.gegeLastLanFingerprint === 'string') {
        let mS = new Set(window.gegeLastLanFingerprint ? window.gegeLastLanFingerprint.split('|') : []),
          nHD = Object.create(null);
        dL.forEach(d => {
          if (d.Active === '1' && d.MACAddress && d.MACAddress !== "00:00:00:00:00:00") {
            let m = nM(d.MACAddress);
            if (!mS.has(m)) {
              let bN = d.DevName || d.HostName || d.DisplayedPictureName || d.AliasName || "Mesh设备",
                bI = d.Interface || "";
              if (d.IFAliasName === 'SSID1') bI = 'wl0';
              else if (d.IFAliasName === 'SSID5') bI = 'wl4';
              nHD[m] = { name: bN, iface: bI, origMac: d.MACAddress, mesh: d.DevMeshType === '3' };
            }
          }
        });
        if (Object.keys(nHD).sort().join('|') !== Object.keys(window.gegeHiddenDevices).sort().join('|') ||
            Object.values(nHD).some(d => d?.mesh === false) !== Object.values(window.gegeHiddenDevices).some(d => d?.mesh === false)) {
          window.gegeForceUIRedraw = !0;
          if (Object.keys(nHD).length > 0) console.log("🎯 [哥哥科技] 破甲弹命中！强制狙击名单:", Object.keys(nHD));
        }
        window.gegeHiddenDevices = nHD;
        if (!Object.keys(nHD).length) document.getElementById('gege-mesh-badge')?.remove();
      }
      return dL;
    })().catch(e => {
      console.warn("[哥哥科技] 大包拉取失败:", e.message);
      return null;
    }).finally(() => { bigReq = null; });
    return bigReq;
  }
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
      } else wT = window.__gLWT || "";
      if (wT) {
        if (!wanCompat) {
          let wI = parseXml(wT, 'OBJ_HOME_BASICINFO_ID')[0] || {};
          cDC = +(wI.AccessDevNum || -1) || -1;
        } else if (wanCompat.cK) {
          let wI = parseXml(wT, wanCompat.n)[0] || {};
          cDC = +(wI[wanCompat.cK] || -1) || -1;
        }
      }

      let lT = "", lF = window.gegeLastLanFingerprint, lST = null;
      if (CONFIG.forceMeshMode === 2) {
        const liR = await fetch(`/?_type=vueData&_tag=localnet_lan_info_lua&_=${ts}`);
        if (liR.ok) {
          let liT = await liR.text();
          lST = performance.now();
          let iI_arr = [],
            nHD = Object.create(null),
            dC = 0,
            dL = parseXml(liT, "OBJ_LAN_INFO_ID");
          uRSSI(dL);
          dL.forEach(d => {
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
                  oS = +(d.OnlineTime || d.OnlineTimes || 0);
              iI_arr.push(`<Instance><ParaName>MACAddress</ParaName><ParaValue>${escapeHTML(m)}</ParaValue><ParaName>IPAddress</ParaName><ParaValue>${d.IPAddress||""}</ParaValue><ParaName>AliasName</ParaName><ParaValue>${escapeHTML(bN)}</ParaValue><ParaName>HostName</ParaName><ParaValue>${escapeHTML(bN)}</ParaValue><ParaName>Interface</ParaName><ParaValue>${escapeHTML(bI)}</ParaValue><ParaName>UpRate</ParaName><ParaValue>${uR}</ParaValue><ParaName>DownRate</ParaName><ParaValue>${dR}</ParaValue><ParaName>UpThroughput</ParaName><ParaValue>${uT}</ParaValue><ParaName>DownThroughput</ParaName><ParaValue>${dT}</ParaValue><ParaName>OnlineDuration</ParaName><ParaValue>${oS}</ParaValue></Instance>`);
            }
          });
          window.gegeHiddenDevices = nHD;
          lT = `<ajax_response_xml_root><OBJ_CLIENTS_ID>${iI_arr.join('')}</OBJ_CLIENTS_ID></ajax_response_xml_root>`;
          lF = [...lT.matchAll(/<ParaName>MACAddress<\/ParaName><ParaValue>([^<]+)<\/ParaValue>/g)].map(m => nM(m[1])).sort().join('|');
          cDC = dC;
        }
      }
      else {
        lT = await gLT(ts);
        if (lT) {
          lST = performance.now();
          lF = [...lT.matchAll(/<ParaName>MACAddress<\/ParaName><ParaValue>([^<]+)<\/ParaValue>/g)].map(m => nM(m[1])).sort().join('|');
        }
      }
      if (cDC !== window.gegeLastDevCount || lF !== window.gegeLastLanFingerprint) {
        if (CONFIG.forceMeshMode !== 2) {
          let mDC = null;
          try {
            const tR = await fetch(`/?_type=vueData&_tag=vue_topo_data&_=${ts}`);
            if (tR.ok) {
              let tJ = JSON.parse(await tR.text());
              mDC = tJ.agentlay1?.reduce((s, a) => s + (+(a.accdevCount) || 0), 0) || 0;
            }
          } catch(e) {console.warn(`[哥哥科技] Mesh狙击失败`, e.message);}
          if (mDC !== null) {
            if (lF !== window.gegeLastLanFingerprint && typeof window.gegeLastLanFingerprint === 'string') {
              let oM = new Set(window.gegeLastLanFingerprint ? window.gegeLastLanFingerprint.split('|') : []);
              (lF ? lF.split('|') : []).forEach(m => {
                if (!oM.has(m) && window.gegeHiddenDevices[m]) {
                  delete window.gegeHiddenDevices[m];
                  window.gegeForceUIRedraw = !0;
                }
              });
            }
            window.gegeLastDevCount = cDC;
            window.gegeLastLanFingerprint = lF;
            window.gegeLastMeshDevCount = mDC;
            if (mDC === 0) {
              for (let m in window.gegeHiddenDevices) {
                if (window.gegeHiddenDevices[m]?.mesh) {
                  delete window.gegeHiddenDevices[m];
                  window.gegeForceUIRedraw = !0;
                }
              }
            }
            else if (mDC !== Object.values(window.gegeHiddenDevices).reduce((n, d) => n + (d?.mesh ? 1 : 0), 0)) await getBigLan();
            if (!Object.keys(window.gegeHiddenDevices).length) document.getElementById('gege-mesh-badge')?.remove();
          }
        }
        else {
          window.gegeLastDevCount = cDC;
          window.gegeLastLanFingerprint = lF;
        }
      }
      if (CONFIG.forceMeshMode !== 2) {
        let hM = Object.keys(window.gegeHiddenDevices ?? {});
        if (hM.length > 0) {
          let iI_arr = [];
          for (let m of hM) {
            try {
              const mt = window.gegeHiddenDevices[m] || {};
              if (!mt || !mt.origMac) continue;
              const sR = await fetch(`/?_type=vueData&_tag=localnet_lan_detailinfo_lua&MACAddress=${encodeURIComponent(mt.origMac||m)}&_=${Date.now()}`);
              if (!sR.ok) continue;
              let sD = parseXml(await sR.text(), "OBJ_LANINFO_BYMAC")[0];
              if (sD) {
                iI_arr.push(`<Instance><ParaName>MACAddress</ParaName><ParaValue>${escapeHTML(m)}</ParaValue><ParaName>IPAddress</ParaName><ParaValue>${sD.IPAddress||""}</ParaValue><ParaName>AliasName</ParaName><ParaValue>${escapeHTML(mt.name)}</ParaValue><ParaName>HostName</ParaName><ParaValue>${escapeHTML(mt.name)}</ParaValue><ParaName>Interface</ParaName><ParaValue>${escapeHTML(mt.iface)}</ParaValue><ParaName>UpRate</ParaName><ParaValue>${sD.UploadSpeed||0}Kbps</ParaValue><ParaName>DownRate</ParaName><ParaValue>${sD.DownloadSpeed||0}Kbps</ParaValue><ParaName>UpThroughput</ParaName><ParaValue>${(+sD.BytesSend || 0) * 0.001}</ParaValue><ParaName>DownThroughput</ParaName><ParaValue>${(+sD.BytesReceived || 0) * 0.001}</ParaValue><ParaName>OnlineDuration</ParaName><ParaValue>${+(sD.OnlineTimes || 0)}</ParaValue></Instance>`);
              }
            }
            catch (e) {
              console.warn(`[哥哥科技] Mesh狙击失败(MAC:${m})`, e.message);
            }
          }
          if (iI_arr.length) lT = lT.replace('</OBJ_CLIENTS_ID>', `${iI_arr.join('')}</OBJ_CLIENTS_ID>`);
        }
      }
      if (lT.includes('<OBJ_CLIENTS_ID>')) { lCxt = lT; lCxtT = lST; }
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