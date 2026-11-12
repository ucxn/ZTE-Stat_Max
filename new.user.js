// ==UserScript==
// @name            中兴路由器增强 ZTE-Stat_Max
// @name:en         ZTE-Stat_Max
// @namespace       ucxn
// @version         6.0.8
// @website         https://github.com/ucxn/ZTE-Stat_Max
// @supportURL      https://b23.tv/BV1PtR7B8ECC
// @description     一款针对中兴官方计数器和UI不区分上下行、流量数据不可靠、网页隐藏API等问题而诞生的测控“引擎”，一个庞大的循环流程程序；融合了哥哥的大量思想和算法，探索属于家庭网关的真相。
// @description:en  A telemetry and control "engine" engineered to address the flaws of ZTE's official counters and UI—such as the lack of uplink/downlink separation, unreliable traffic data, and hidden web APIs. It is a massive cyclic processing program; infused with a wealth of BroTech's philosophies and algorithms, dedicated to uncovering the truth behind home gateways.
// @copyright       哥哥科技. All Rights Reserved. 使用必要条件之一：不得删除源码、用户界面、文本中的任何“哥哥”；传播官方链接不限；除安装自用外任何使用传输均需查看许可证。
// @author          哥哥科技 space.bilibili.com/501430041
// @noframes
// @tag             哥哥科技 路由器 中兴 网络 监控 统计 数据 可视化 极客 增强 UI HA 智能 定时 后台 Measurement M&C Bro 宽带 流量 网速 算法 JS C WebHook 网页 浏览器 微积分 公网 Brotech Bro-Tech
// @icon            https://scriptcat.org/api/v2/resource/image/PD6xhxddlUESIwAV
// @include         /^https?:\/\/10(\.[0-9]{1,3}){3}(:\d+)?\/.*$/
// @include         http://192.168.*.*
// @match           *://zte.home/*
// @include         http://172.16.*
// @include         https://192.168.*.*
// @include         https://172.16.*
// @include         /\/menu\/dashboard/
// @exclude         *://*/cgi-bin/luci*
// @note            发行版作者哥哥科技保留所有权利，必须完整转载，若摘取则需自行在GUI一级加上哥哥科技的显著署名；源码本身公开，请前往 GitHub 获得授权范围许可证。
// @grant           GM_setValue
// @grant           GM_getValue
// @storageName     GBNPA_Storage
// @license         LicenseRef-APL-Bro-0.1+ OR SUL-1.0 WITH AdditionRef-BroTech-Prominent-Attribution-Terms AND BR-BY-NC-1.0+
// @run-at          document-start
// @updateURL       https://github.com/ucxn/ZTE-Stat_Max/raw/refs/heads/main/new.user.js
// @downloadURL     https://github.com/ucxn/ZTE-Stat_Max/raw/refs/heads/main/new.user.js
// ==/UserScript==

(function () {
  'use strict';

  console.log(`🚀 哥哥科技 V${(typeof GM_info !== 'undefined' && GM_info.script?.version) || '6.0'} 引擎已装载...`);

  // ---[0]------------------------ 用户极客环境变量配置区 ------------------------
  const CONFIG = {
    readSaveData: 3, // 【历史记录】 1: 从路由器后台读档（继承基线） | 0: 新局模式 | 2: 从本地长期历史读档 [自动保存！] | 3: 启动时用后台临时值充当积分
    forceMeshMode: 1, // 【Mesh探测模式】0: 官方拓扑驱动 | 1: n秒智能等待(默认) | 2: 强制大包抓取(专治阉割、不出数据)[会改变LAN时率]
    uiLayout: 1, // 【面板拓扑结构】 0: 经典版 | 1: 详细紧凑版(驾驶舱美学) | 2: 详细平铺版(报表流美学)
    injectMode: 1, // 【UI注入模式】 0: 原生侧边栏(1min)| 1: 优先，10秒悬浮舱(D)| 2: 联动模式| 3：强制模式
    calcMode: 1, // 1: 上行/下行倍数模式, 0: 上行占总和比例模式
    lanPortMode: 1, // 【物理网口】 0: 关闭 | 1: 底部追加显示 | 2: WAN高速接管主线
    portInterval: 1, // 物理网口刷新频率(秒)

    // 上传/下载异常占比的判定阈值
    ratioExtremeUp: 10, // 极端上传判定阈值 (> 1000%)
    ratioWarnUp: 0.07, // 重度上传警告阈值 (> 7%)
    ratioExtremeDown: 0.01, // 极端下载判定阈值 (< 1%)
    ratioThreshold: 7, // (仅calcMode=0时有效) 上传占比报警阈值(%)

    // 刷新节奏
    lanRefreshInterval: 6, // LAN口刷新时间(秒)，用于补偿评估0到唤醒期间的流量
    wanRefreshInterval: 3, // 【外网】WAN口刷新时间(秒)，通常为程序主时钟周期
    外网计数器: undefined, // 【外网字节计数器】0: 关闭 | 1: vue_mainwan_data | 2: home_internetreg | undefined: 自动探测，失败即关
    外网计数器刷新: 10, // 秒；两次采样间的流量不能超过 4 GiB 的一圈，千兆满速别超过 30 秒

    // 统计周期与自动导出
    周期类型: 'W', // 'M'(每月), 'W'(每周), 'D'(固定天数)； 其它任意字符：不开启周期重置+自动导出功能
    周_天设置: 6, // M: 1~31号; W: 0~6(周日~周六); D: 间隔天数(如 7)
    基准日期: '2027-03-01', // 原点时间(仅 D 模式有效) 任意一个历史周期的零点
    报告时间: -720, // 提示时间：相对周期0点的偏移分钟数（如 -4320 代表提前 3 天）设置相对指定日期的下个周期起点的时间偏移量
    自动导出: -180, // 强制导出：相对周期0点的偏移分钟数（如 W模式+锚点6(周六)+偏移-180 = 周五 21:00 强制导出清零）
    时区补偿: 28800000, // 默认 UTC+8 时区补偿量。

    // 接口名 → 面板上显示的名称
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
    },

    // 性能和算法相关
    信号强度刷新周期: 16, // 信号强度刷新周期，单位：帧（程序主采样周期）；请设成 2 的自然数次幂（其中1为不主动请求刷新）
    盲漫游: undefined, //也就是包括但不限于无线交换机（AP/有线桥接）模式，无线设备被主路由识别为有线设备则设置1
    宽带最大外网下行速率: 24e8, // 配置外网最大上传|下载比特(bit/bps)速率
    宽带最大外网上行速率: 3e8 //请略微大于真实值；500兆为5e8，一千兆1e9
  };

  // ---[1]------------------------ 全局状态与运行时变量 ------------------------
  const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' };
  function escapeHTML(str) {
    return str ? String(str).replace(/[&<>'"]/g, m => ESC_MAP[m]) : '';
  }
  // S：全局运行状态，各字段含义见《中兴名词对照表》
  const S = {
    wInstUp: 0,
    wInstDn: 0,
    wTotUp: 0,
    wTotDn: 0,
    cls: {}, isPinned: !0,
    w2U: 0, w2D: 0, w2TotUp: 0, w2TotDn: 0, w2LT: 0,
    hasW2: !1, is5G_149: !1, RSSI频率修正: undefined,
    _domRebuilt: !1, _lastPanelState: null, oDC: null,
    Warn_MS: 0, Force_MS: 0, _RST: !1,
    aWu: 0, aWd: 0, lwTU: 0, lwTD: 0, cSnap: null,
    lInstUp: 0, lInstDn: 0, lTotUp: 0, lTotDn: 0, lLT: 0,
    总上行图: new Float64Array(8192), 总下行图: new Float64Array(8192), 总图点数: 0,
    wMaxU: 0, wMaxD: 0, wMinU: Infinity, wMinD: Infinity, 拖动图表: null, 图表待画: 0, pL: [], pLC: null,
    // 以下原本运行中才陆续追加；一次写全，S 的形状从头到尾不变，读 S.xxx 的地方不会因为形状变来变去退化成超多态
    wLT: 0, wZEU: 0, wZED: 0, wZEUC: 0, wZEDC: 0, rTick: 0, haTick: 0, lTick: 0, bd: null, cRT: '', snap: undefined, snapLoaded: !1, calcTime: null
  };
  // ---[2]------------------------ 数据获取层：WAN / LAN 文本拉取 + XHR 经典方案 ------------------------
const WAN_COMPAT = [
    // 兼容层只在标准 WAN 首次失败时探测；社区可继续追加旧固件接口。
    { u: '/getpage.lua?pid=1005&nextpage=Internet_WANInfo_lua.lua', n: 'OBJ_TOTALSPEED_ID', uK: 'TotalUpRate', dK: 'TotalDownRate' }
  ];
  const LAN_COMPAT = [
    { u: '/getpage.lua?pid=1005&nextpage=Basic_clients_lua.lua', n: 'OBJ_CLIENTS_ID' }
  ];
  let wanCompat = null; // 命中的 WAN 兼容条目；null 表示走标准接口
  // 周期判断线：计算下一个“预警时间”和“强制导出清零时间”。
  // 入参是已经叠加了时区补偿的“伪本地时间”；用 UTC 系列 API 取年月日，就等于取到了本地的年月日。
  S.calcTime = (L) => {
    S.Force_MS = (CONFIG.周期类型 === 'M' ? Date.UTC(new Date(L).getUTCFullYear(), new Date(L).getUTCMonth() + (L >= Date.UTC(new Date(L).getUTCFullYear(), new Date(L).getUTCMonth(), CONFIG.周_天设置) ? 1 : 0), CONFIG.周_天设置) : (CONFIG.周期类型 === 'W' ? Date.UTC(new Date(L).getUTCFullYear(), new Date(L).getUTCMonth(), new Date(L).getUTCDate()) + ((CONFIG.周_天设置 - new Date(L).getUTCDay() > 0 ? CONFIG.周_天设置 - new Date(L).getUTCDay() : CONFIG.周_天设置 - new Date(L).getUTCDay() + 7) * 86400000) : (CONFIG.周期类型 === 'D' ? Date.UTC(new Date(L).getUTCFullYear(), new Date(L).getUTCMonth(), new Date(L).getUTCDate()) + CONFIG.周_天设置 * 86400000 : Infinity))) - CONFIG.时区补偿;//这玩意本来就是个基础设施和艺术品，它的功能是非常明确的，不存在说后期还有频繁的维护需求。完全没有必要为了所谓的可读性而乱写或妥协。
    S.Warn_MS = S.Force_MS + CONFIG.报告时间 * 60000;
    S.Force_MS += CONFIG.自动导出 * 60000;
  };// 启动时：以上次导出时间（没有就用当前时间）为基准算出本周期的两个时间点；上次导出已不早于本周期的判断线，说明本周期导出过 → 顺延一个周期
  S.calcTime((typeof GM_getValue !== 'undefined' && GM_getValue('gege_reset_ms')) ? (GM_getValue('gege_reset_ms') + CONFIG.时区补偿) : Date.now() + CONFIG.时区补偿);
  if (typeof GM_getValue !== 'undefined' && GM_getValue('gege_reset_ms') >= Math.min(S.Warn_MS, S.Force_MS)) S.calcTime(S.Force_MS - CONFIG.自动导出 * 60000 + 1000 + CONFIG.时区补偿);
  // 拉取文本并确认含有目标标记；网络错误 / 非 200 / 缺少标记一律返回空串
  async function gWTPrimary() {
    try {
      let r = await fetch('/?_type=vueData&_tag=vue_home_device_data_no_update_sess&IF_OP=refresh&_=' + Date.now());
      if (!r.ok) return "";
      let t = await r.text();
      return t.includes('<OBJ_HOME_BASICINFO_ID>') ? t : "";
    } catch(e) { console.warn(e); return ""; }
  }
  // WAN 文本：先试标准接口；失败则依次探测兼容表。一旦某个接口跑通，就把后续调用永久替换成它。主接口性能或执行顺序地位最高，也就是一主加多从自动轮换架构。
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
        }; return t;
      } catch(e) { console.warn(e); }
    }
    return ""; };

  // LAN 设备列表文本：逻辑同上
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
      } catch(e) { console.warn(e); } }
    return "";
  };
  // ---- 运行时状态：物理网口 / 外网计数器 / LAN 文本缓存 ----
  const 版本号 = (typeof GM_info !== 'undefined' && GM_info.script?.version) || '环境不支持获取版本号'; // 虽然不喜欢废物变量，但是这里会使用两次或以上（也不是多次就必须要抽，还是只为了性能，可读性不作为加分项。主要是因为不同类型的数组序列化之类的，反而可能更不划算。而且敲起字来也太麻烦了…）
  // Phys：物理网口，独立于逻辑 WAN 的另一路数据。p 是非 WAN 网口表，wU/wD/tU/tD 是 WAN 口速率与积分，_pM 是 _InstID → 别名字典
  const Phys = { p: Object.create(null), wU: 0, wD: 0, tU: 0, tD: 0, lT: 0, _pM: null, _wID: null, zEU: 0, zED: 0, zEUC: 0, zEDC: 0 };
  // WC：外网字节计数器。rx/tx 是上次读到的原始计数，u/d 是累计 bit，p 表示拿物理WAN积分当对照（否则用逻辑口）
  const WC = { rx: undefined, tx: 0, u: undefined, d: undefined, p: !1 };
  let gWUp = (wI, k) => s2b(wI[k]);
  let gWDn = (wI, k) => s2b(wI[k]); // lanPortMode=2 时这两个会被换成直接读物理口
  let isF = !1, // rSD 防重入
    lCxt = null, lCxtT = null, lCxtProcessedT = null; // 最近一份 LAN 设备列表 XML / 它的到达时间（null 表示尚未标记）/ 已经积分过的那一份的到达时间
  // 劫持原版页面自己的 XHR：只要看到设备列表 / 首页基础信息的响应，就缓存设备列表并（在面板未激活时）启动引擎。这样官方页面每次刷新，我们都能零额外请求地拿到最新数据。
  // 作者备注：原厂的逻辑是你停留在哪个页面才给哪个页面的数据，所以你必须停留在LAN或者主MAC页面，而不是停留在主页看路由器的大头照和信息量不够的单只有Wan口速率。
  const oOp = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function () {
    this.
    addEventListener('load', function () {
      try {
        if (this.responseType === '' ||
          this.responseType === 'text') {
          let t = this.responseText;
          const c = t && t.includes('<OBJ_CLIENTS_ID>');
          if (c || t && t.includes('<OBJ_HOME_BASICINFO_ID>')) {
            if (c) { lCxt = t; lCxtT = null; }
            if (window.startGegePrecisionEngine) {
              window.startGegePrecisionEngine();
            }          }        }      }
      catch (e) {
        console.warn("[哥哥科技] XHR 拦截器异常:", e.message);
      }    });
    oOp.apply(this, arguments); };

  // ---[3]------------------------ 工具函数：格式化 / 解析 ------------------------
  // 单位换算：全程以 bit 为基准 | 官方速率字符串（如 "12.3Kbps"）→ bit/s
 function s2b(speedStr) {
        if (!speedStr) return 0;
        const val = parseFloat(speedStr);
        if (val !== val) return 0;
        const c = speedStr.charCodeAt(speedStr.length - 4); // 标准格式的单位字母固定在倒数第 4 位，先走快速通道；非标准格式退回到下面的子串搜索
        if (c === 75) return val * 1e3;
        if (c === 77) return val * 1e6;
        if (c === 71) return val * 1e9;
        if (speedStr.includes('K')) return val * 1e3; if (speedStr.includes('M')) return val * 1e6; if (speedStr.includes('G')) return val * 1e9;
        if (speedStr.includes('k')) return val * 1e3; if (speedStr.includes('m')) return val * 1e6; if (speedStr.includes('g')) return val * 1e9;
        return val;
 }

  function fB(bps) {  // bit/s → 十进制“比特率”文本（Mbps / kbps）
        if (bps > 1e9) return `${Math.round(bps * 1e-6)} Mbit/s`;
        if (bps > 1e6) return `${(bps * 1e-6).toFixed(1)} Mbps`;
        if (bps > 1e3) return `${(bps * 1e-3).toFixed(1)} kbps`;
        return `${Math.round(bps)} bps`;}

  // bit/s → “字节率”文本。小于 8700 的低速段用十进制 kB/s，并尽量显示成 1/8 的分数，避免单位频繁切换。
  const F_ARR = ['0', '[1/8]', '[2/8]', '[3/8]', '[4/8]', '[5/8]', '[6/8]', '[7/8]', '[1]'];
  function fBy(bps) {
        if (bps === 0) return '0  B';
        if (bps > 8388608) return `${(bps * 1.1920928955078125e-7).toFixed(2)} MiB/s`;
        // 1/2/3 是速率字段里的哨兵值（拦截 / 漫游 / 异常），由 rSD 的速率合法性检查写入
        if (bps === 1) return '智能拦截中...'; //中兴网页后台本身速率的分度值最高也只能精确到 100bits.
        if (bps === 2) return '漫游中...'; //况且这里必须要保持一个正数来维持正常的微积分和避免错误0补偿
        if (bps === 3) return '异常网速！'; //不要追求官僚教条的软工，有事在注释里说，不要污染执行的代码。
        return bps < 8700 //或者8601.6，避免前期必须使用二进制1024-Based的导致破坏这个数据美感；频繁的单位切换也会增加人类仪表阅读负担，毕竟这是一个使用很多测控算法的程序。
            ? ((bps * 0.001 | 0) === bps * 0.001
                 ? `${F_ARR[bps * 0.001]} kB/s`
                : `${(bps * 0.000125).toFixed(2)} kB/s`)
            : `${(bps * 0.0001220703125).toFixed(1)} KiB/s`;
    }

  // 累计流量 (bit) → 文本。
  function fV(bits) {
        if (bits > 83886080000) return `${(bits * 1.1641532182693481e-10).toFixed(4)} GiB`;
		if (bits >= 8589934592) return `${(bits / 8388608).toFixed(1)} MiB`;
        if (bits > 8388608) return `${(bits / 8388608).toFixed(4)} MiB`;
        if (bits > 8192) return `${(bits / 8192).toFixed(2)} KiB`;
        return `${Math.round(bits / 8)} B`;
    }

  // “官方值 | 积分值”双轨文本，以积分值决定用哪个单位
  function fVD(bitsIntegral, bitsOfficial) {
        if (bitsIntegral > 8796093022208) return `${(bitsOfficial * 1.1368683772161603e-13).toFixed(4)} | ${(bitsIntegral * 1.1368683772161603e-13).toFixed(4)} TiB`;
        if (bitsIntegral > 83886080000) return `${(bitsOfficial * 1.1641532182693481e-10).toPrecision(5)} | ${(bitsIntegral * 1.1641532182693481e-10).toPrecision(5)} GiB`;
		if (bitsIntegral > 8388608000) return `${(bitsOfficial * 1.1920928955078125e-7).toFixed(3)} | ${(bitsIntegral * 1.1920928955078125e-7).toFixed(2)} MiB`;
        if (bitsIntegral > 8388608) return `${(bitsOfficial * 1.1920928955078125e-7).toFixed(3)} | ${(bitsIntegral * 1.1920928955078125e-7).toFixed(3)} MiB`;
        if (bitsIntegral > 8192) return `${(bitsOfficial * 0.0001220703125).toFixed(2)} | ${(bitsIntegral * 0.0001220703125).toFixed(2)} KiB`;
        return `${Math.round(bitsOfficial * 0.125)} | ${Math.round(bitsIntegral * 0.125)} B`;}

  // 单字母单位的紧凑流量文本（B / K / M / G）。要么简洁，要么完整，所以不写“MB”这种半吊子。
  function fSV(bits) { //要偷懒或者简洁易读，就完整一点，不要弄个挂MB实则1024又不正确、又高不成低不就的偷一半懒；GNU本身也支持这种单字母UI写法.
    if (bits >= 84607500288) return `${(bits * 1.1641532182693481e-10).toPrecision(4)}G`;
	if (bits > 8388608000) return `${Math.round(bits * 1.1920928955078125e-7)}M`;
    if (bits > 8388608) return `${(bits * 1.1920928955078125e-7).toPrecision(4)}M`;
    if (bits >= 8192) return `${(bits / 8192).toFixed(1)}K`;
    return `${Math.round(bits / 8)}B`;}

  // 秒 → “X天X时X分X秒”。刻意不用 %，实测这种减法写法更快。
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
        : `${h}小时${m}分${s}秒`;} //跑过测试，这种写法实质性能较优

  // 解析官方的 <tag> … <Instance><ParaName>…</ParaName><ParaValue>…</ParaValue> … </Instance> 结构
  function nM(m) {
    return m ? m.trim().toLowerCase().replaceAll('-', ':') : '';
  }

  const UNESC_MAP = { '&#32;': ' ', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&#39;': "'", '&amp;': '&' }; // &#39; 来自 escapeHTML 拼的 Mesh 假 XML
  function parseXml(xmlStr, tag) {
    if (!xmlStr) return [];
    let list = [], a = xmlStr.indexOf(`<${tag}>`), b = xmlStr.indexOf(`</${tag}>`, a);
    if (a < 0 || b < 0) return list;
    const body = xmlStr.slice(a + tag.length + 2, b);
    let instRx = /<Instance>([\s\S]*?)<\/Instance>/g, pRx = /<ParaName>([^<]+)<\/ParaName>\s*<ParaValue>([^<]*)<\/ParaValue>/g, im;
    while ((im = instRx.exec(body)) !== null) {
      let o = Object.create(null), pm;
      while ((pm = pRx.exec(im[1])) !== null) {
        o[pm[1]] = pm[2].includes('&') ? pm[2].replace(/&#32;|&lt;|&gt;|&quot;|&apos;|&#39;|&amp;/g, m => UNESC_MAP[m]) : pm[2];
      }
      list.push(o);
    }
    return list;
  }
  // ---[4]------------------------ 样式注入 ------------------------
  // 分组顺序即层叠顺序，改动前请留意后面的规则会覆盖前面的同级选择器。
  const st = document.createElement('style');
  st.innerHTML = `.config-item{
        clear:both;}.config-item-box{display:flex!important;
        align-items:stretch!important;padding-bottom:
        12px!important;}.config-item .logo{width:33%!important;
        float:none!important;display:flex!important;flex-direction:row;}.config-item .dev-intro{flex:1;display:flex!important;flex-direction:column;justify-content:flex-start;min-height:100px;padding-bottom:0!important;margin-bottom:0!important;}.config-item .info{width:27%!important;float:none!important;display:flex!important;flex-direction:column;justify-content:flex-start;padding:0 10px!important;border-right:1px solid #eee;}.config-item .speed{width:40%!important;float:none!important;display:flex!important;flex-direction:column;justify-content:center;padding:0 10px!important;}.geek-row{display:flex;justify-content:space-between;align-items:center;white-space:nowrap;height:20px;}
    .geek-label{width:110px;color:#333;font-weight:bold;}.geek-val-box{flex:1;display:flex;gap:15px;margin-left:10px;}.geek-fixed-width{display:inline-block;width:120px;}.geek-right-box{text-align:right;min-width:220px;font-weight:bold;}.c-up{color:#ff4c00;}.c-down{color:#0059fa;}.gege-up-box,.gege-down-box{margin-top:auto!important;margin-bottom:0!important;width:95%;}.gege-ratio-box{margin-top:10px;width:95%;margin-bottom:5px;}.t-row{font-size:12px;font-weight:bold;margin-bottom:2px;display:flex;justify-content:space-between;font-family:Consolas;}.zte-thin-bar{width:100%;height:3px;background:rgba(0,0,0,0.05);border-radius:1.5px;overflow:hidden;}.zte-thin-bar-inner{height:100%;transition:width 0.5s ease-out;}.zte-thin-bar-inner.up{background:#ff4c00;}.zte-thin-bar-inner.down{background:#0059fa;}.gege-ratio-top{display:flex;justify-content:space-between;font-size:12px;font-weight:bold;margin-bottom:2px;}.gege-ratio-bar{width:100%;height:4px;background:#0059fa;border-radius:2px;overflow:hidden;}.gege-ratio-bar-inner{height:100%;background:#ff4c00;transition:width 0.5s ease-out;}.zte-enhance-speed{display:flex;flex-direction:column;gap:6px;width:100%;font-family:Consolas;}
    .zte-bar-wrap{position:relative;width:100%;border-radius:4px;border:1px solid;font-size:13px;font-weight:bold;overflow:hidden;padding:3px 8px;display:flex;justify-content:space-between;align-items:center;z-index:1;box-sizing:border-box;}.zte-bar-wrap span{font-size:inherit;font-weight:inherit;}.zte-bar-up{color:#ff4c00;border-color:rgba(255,76,0,0.3);}.zte-bar-down{color:#0059fa;border-color:rgba(0,89,250,0.3);}.zte-bar-up::before{content:'';position:absolute;left:0;top:0;bottom:0;z-index:-1;background:rgba(255,76,0,0.12);width:var(--p-up,0%);transition:width 0.5s;}.zte-bar-down::before{content:'';position:absolute;left:0;top:0;bottom:0;z-index:-1;background:rgba(0,89,250,0.12);width:var(--p-down,0%);transition:width 0.5s;}#config-list.gege-list-container{contain:content!important;background-color:#ffffff!important;border-radius:8px!important;border:1px solid #e0e0e0!important;padding:20px 30px!important;box-shadow:0 2px 10px rgba(0,0,0,0.02)!important;margin-top:10px!important;}.gege-section{margin-bottom:10px;}
    .gege-section:last-child{margin-bottom:0;}.gege-list-container .config-title{font-size:16px!important;font-weight:bold!important;color:#333!important;margin:15px 0 10px 0!important;padding-bottom:5px!important;}.gege-list-container .gege-section:first-child .config-title{margin-top:0!important;}.gege-empty-state{color:#999!important;font-size:14px!important;padding:0 0 15px 5px!important;border-bottom:1px solid #f0f0f0!important;margin-bottom:5px!important;}.gege-list-item{background-color:transparent!important;border-bottom:1px solid #f0f0f0!important;padding:15px 10px!important;margin-bottom:0!important;border-radius:0!important;}
    .gege-list-item:last-child{border-bottom:none!important;}#zte-geek-board{contain:layout;background-color:transparent!important;border-left:4px solid #0059fa!important;border-radius:0!important;padding:5px 0 5px 15px!important;margin:10px 0 15px 0!important;box-shadow:none!important;border-bottom:1px solid #f0f0f0!important;font-size:14px;display:flex;flex-direction:column;gap:6px;padding-bottom:15px!important;}#gege-global-overlay #zte-geek-board.geek-frozen-pane{position:sticky!important;top:0px!important;z-index:100!important;background-color:#f3f4f5!important;margin-top:0!important;padding-top:15px!important;box-shadow:0 10px 15px -3px rgba(0,0,0,0.05)!important;border-radius:0 0 8px 8px!important;}.gege-pin{cursor:pointer;font-size:11px;filter:grayscale(100%);opacity:0.5;transition:transform 0.2s;margin-left:2px;}
    .gege-pin.active{filter:none;opacity:1;transform:scale(1.1);}#gege-global-overlay{position:fixed;top:0;right:0;bottom:0;background:#f3f4f5;z-index:9999;overflow-y:auto;padding-bottom:50px;left:0;transition:left 0.3s ease;}@media (min-width: 1025px) and (orientation: landscape){#gege-global-overlay{left:max(15%, 240px);}}@media (max-width: 768px){.geek-right-box:has(#gb-wan-zero-up),.geek-right-box:has(#gb-cur-up-vol){display:none!important}.gege-list-item{padding:12px 10px!important}.config-item-box{position:relative!important;flex-direction:column!important;padding-bottom:0!important}.config-item .info,.config-item .logo,.config-item .speed{width:100%!important;border:none!important;padding:0!important;position:static!important}.config-item .dev-intro{min-height:auto!important;justify-content:center!important;padding-right:108px!important}.config-item .logo{padding-bottom:4px!important;position:relative!important}.gege-rssi{position:absolute!important;left:25px;top:calc(50% - 29px);transform:translate(-50%,-100%);font-size:11px!important;line-height:1.2;z-index:1}.gege-online-time{white-space:nowrap}.gege-online-time::before{content:none!important}.t-row{white-space:nowrap}.config-item .info{flex-direction:column!important;margin:0 0 6px 0!important;gap:2px!important}.dev-ip{position:absolute!important;top:0!important;right:0!important;font-size:11px!important;background:#e0e8f5;color:#0059fa!important;padding:2px 6px!important;border-radius:4px;font-weight:bold;line-height:1.2;z-index:20;width:auto!important;display:flex!important;flex-direction:column;align-items:flex-end}.dev-number{width:auto!important;margin:0!important;font-size:11px!important}.gege-via{display:block!important;font-size:10px!important;line-height:1.3!important;max-width:92px;overflow:hidden;text-overflow:ellipsis}.gege-ratio-box{width:100%!important;margin-top:2px!important;margin-bottom:0!important}.gege-down-box{width:100%!important;margin-top:2px!important}#zte-geek-board{padding:8px!important;gap:0!important;font-size:11.5px!important}.geek-row{height:auto!important;flex-wrap:wrap!important;margin-bottom:4px!important;justify-content:flex-start!important;gap:2px 6px!important;line-height:1.3!important}.geek-label{width:auto!important;min-width:60px!important;font-size:11.5px!important;flex:0 0 auto!important}.geek-val-box{width:auto!important;flex:1 1 0%!important;display:flex!important;flex-wrap:wrap!important;margin-left:0!important;gap:2px 6px!important}.geek-fixed-width{width:auto!important}.geek-right-box{width:100%!important;flex:0 0 100%!important;text-align:left!important;font-size:11.5px!important;margin-top:2px!important;margin-left:0!important}.gege-list-container{padding:8px!important}.zte-enhance-speed{gap:4px!important}}#zte-geek-board{position:relative!important;overflow:visible!important;}#gege-speed-chart{position:absolute;z-index:25;box-sizing:border-box;cursor:move;user-select:none;touch-action:none;container-type:inline-size;left:max(520px,52%);top:2px;width:clamp(320px,30%,650px);height:112px;}@media (max-width:768px){#gege-speed-chart{left:10px;width:clamp(180px,calc(100% - 20px),320px);height:96px}}#gege-speed-chart canvas{display:block;width:100%;height:100%;}.gege-chart-head,.gege-chart-foot{position:absolute;left:clamp(28px,8%,36px);right:8px;display:flex;align-items:center;pointer-events:none;font:bold clamp(9px,2.1cqw,11px) system-ui,sans-serif;white-space:nowrap;overflow:hidden;}.gege-chart-head{top:2px;color:#111;gap:8px;}.gege-chart-head [data-gc="range"]{color:#666;font-weight:normal;overflow:hidden;text-overflow:ellipsis;margin-left:auto;}.gege-chart-foot{bottom:4px;justify-content:flex-start;gap:clamp(3px,1.1cqw,12px);}.gege-chart-foot span{min-width:0;overflow:hidden;text-overflow:ellipsis;}.gc-up{color:#ff4c00;flex:0 1 auto;}.gc-down{color:#0b5;flex:0 1 auto;}.gc-extra{color:#666;text-align:right;margin-left:auto;flex:1 1 0;min-width:0;}#gege-speed-chart .gege-chart-resize{position:absolute;right:-4px;bottom:-4px;width:13px;height:13px;border-right:3px solid #0059fa;border-bottom:3px solid #0059fa;cursor:nwse-resize;border-radius:2px;}.gege-via{order:1;color:#9b72cf;font-size:12px;font-weight:bold;white-space:nowrap;}.gege-online-time:not(:empty)::before{content:'在线：'}@media (max-width:768px){.geek-val-box>span:has(#gb-wan-up-bps),.geek-right-box:has(#gb-wan-up-bps),#gb-pwan-bps-container,.geek-right-box:has(#gb-wc-pu){display:none!important}.geek-val-box>span:has(#gb-wan-up-vol),.geek-val-box>span:has(#gb-ratio-display){flex-basis:100%;margin-left:0!important}.geek-label{min-width:88px!important}.config-item .dev-intro .gege-up-box{width:auto!important;margin-right:-108px!important}.gege-up-box .t-row>span{white-space:nowrap}}
    `;
  document.head.
  appendChild(st);
  window.gegeRenderedMacs = new Set();

  // ---[5]------------------------ 核心采样引擎 refreshSpeedData ------------------------
  async function rSD(pWT = null, sT = null) {
    if (isF && pWT === null) return;
    isF = !0;
    let n, wT = "";
    try {
      if (pWT !== null) {
        wT = pWT; n = sT || performance.now();
      } else {
        wT = await gWT(); n = performance.now();}
      window.__gLWT = wT; // 保障解耦模式全局缓存不丢失
      // LAN 帧比 WAN 帧稀疏：lCxtT 与上次处理的相同，说明这是同一份 LAN 数据的重复使用
      let lanNow = lCxtT ?? n,
        新LAN帧 = lCxtT === null || lCxtT !== lCxtProcessedT,
         lanDt = lCxtT !== null && lCxtProcessedT !== null && 新LAN帧 ? Math.min((lanNow - lCxtProcessedT) * .001, CONFIG.forceMeshMode & 2 ? 30 : CONFIG.lanRefreshInterval) : CONFIG.lanRefreshInterval;
      // ---- 1. WAN 瞬时速率 ----
      let cWU, cWD, u2 = 0, d2 = 0, cI = Object.create(null); // cI：MAC → 本帧读到的设备信息
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
      // ---- 2. 第二条 WAN 的积分 ----
      if (S.hasW2) {
        if (!S.w2LT) S.w2LT = n;
        else if (S.w2U !== u2 || S.w2D !== d2) {
          const dt = n - S.w2LT;
          if (S.w2U > 0) S.w2TotUp += (S.w2U + u2) * dt * 0.0005; else if (u2 > 0) S.w2TotUp += u2 * 0.5 * CONFIG.wanRefreshInterval;
          if (S.w2D > 0) S.w2TotDn += (S.w2D + d2) * dt * 0.0005; else if (d2 > 0) S.w2TotDn += d2 * 0.5 * CONFIG.wanRefreshInterval;
          S.w2LT = n;
        }
        S.w2U = u2; S.w2D = d2;
      }
      let cSU = 0,
        cSD = 0;
      // ---- 3. 解析 LAN 设备列表 ----
      if (S.pLC !== lCxt) { // LAN 帧比 WAN 帧稀，同一份文本只解析、换算一次，挂在解析结果上给后面的 WAN 帧复用
        S.pL = parseXml(lCxt, "OBJ_CLIENTS_ID"); S.pLC = lCxt;
        for (const d of S.pL) if (d.MACAddress) { d.m = nM(d.MACAddress); d.u = s2b(d.UpRate); d.dn = s2b(d.DownRate); d.uT = (+d.UpThroughput || 0) * 8000; d.dT = (+d.DownThroughput || 0) * 8000; d.on = +(d.OnlineDuration || d.OnlineTime || d.LeaseTime || 0); d.nm = d.AliasName || d.HostName || d.DisplayedPictureName || ""; } // 官方累计流量 KB → bit
      }
      for (const d of S.pL) if (d.m) {
        cI[d.m] = { upRate: d.u, dnRate: d.dn, iface: d.Interface || "", offUp: d.uT, offDn: d.dT, onSec: d.on, name: d.nm, ip: d.IPAddress || "", s: null }; // s 稍后指向 S.cls[m]
        cSU += d.u; cSD += d.dn;
      }
      // ---- 4. 判断设备列表是否需要重绘 ----
      let ol = document.getElementById('gege-global-overlay'),
        cM = Object.keys(
          cI),
        rm = window.gegeRenderedMacs,
        iD = window.gegeForceUIRedraw || (cM.length !== rm.size);
      if (!iD && cM.length > 0) {
        for (let i = 0; i <
          cM.length; i++) {
          if (!rm.has(cM[i])) {
            iD = !0;
            break;
          }
        }
      }
      const olOn = ol?.style.display === 'block';
      if (iD) {
        for (let m in S.cls) if (!cI[m]) { // 已经下线的设备：把最后一段速率按半个周期补进积分，然后速率清零
          let cS = S.cls[m], dt = (lanNow - cS.lUT) * .001;
          if (dt > lanDt) dt = lanDt; dt *= .5;
          cS.intUp += cS.upR * dt;
          cS.intDn += cS.dnR * dt;
          cS.upR = cS.dnR = 0;
        }
      }
      if (olOn && (iD || !ol.querySelector('.gege-list-item'))) {
        bVD(ol);
        window.gegeRenderedMacs = new Set(
          cM);
        window.gegeForceUIRedraw = !1;
      }
      // ---- 5. WAN 主线路积分 ----
      // 积分公式里的 0.0005 = ½ × (1/1000)：毫秒换成秒，再取梯形的一半；上一帧速率为 0 时没有起点可积，按半个刷新周期估算并记入“0 估算”
      if (!S.wLT) {
        S.wLT = n;
      }
      else if (cWU !== S.wInstUp || cWD !== S.wInstDn) {
        const wDt = n - S.wLT;
        if (S.wInstUp > 0) { S.wTotUp += (S.wInstUp + cWU) * wDt * 0.0005; }
        else if (cWU > 0) { const wEU = cWU * 0.5 * CONFIG.wanRefreshInterval; S.wTotUp += wEU; S.wZEU = (S.wZEU || 0) + wEU; S.wZEUC = (S.wZEUC || 0) + 1; }
        if (S.wInstDn > 0) { S.wTotDn += (S.wInstDn + cWD) * wDt * 0.0005; }
        else if (cWD > 0) { const wED = cWD * 0.5 * CONFIG.wanRefreshInterval; S.wTotDn += wED; S.wZED = (S.wZED || 0) + wED; S.wZEDC = (S.wZEDC || 0) + 1; }
        S.wLT = n;
      }
      // ---- 6. 读档（readSaveData = 2）：只在第一帧加载一次本地快照 ---- 快照早于最近一次清零，就视为作废
      if (CONFIG.readSaveData === 2 && !S.snapLoaded) { try { let sp = typeof GM_getValue !== 'undefined' ? GM_getValue('ha_snapshot') : null; S.snap = sp && sp.timestamp > (typeof GM_getValue !== 'undefined' ? (GM_getValue('gege_reset_ms', 0) || 0) : 0) ? sp : {}; if(S.snap.global) { S.wTotUp = S.wTotUp === 0 ? S.snap.global.wan_up || 0 : S.wTotUp; S.wTotDn = S.wTotDn === 0 ? S.snap.global.wan_down || 0 : S.wTotDn; S.lTotUp = S.lTotUp === 0 ? S.snap.global.lan_integral_up || 0 : S.lTotUp; S.lTotDn = S.lTotDn === 0 ? S.snap.global.lan_integral_down || 0 : S.lTotDn; } WC.u = S.snap.wc_up; WC.d = S.snap.wc_down; } catch(e){console.warn(e);} S.snapLoaded = !0; }
      // ---- 7. 逐设备：建档 / 官方计数器恢复状态机 / 速率合法性检查 ----
      // 同一接口（如同一个 Wi-Fi 频段）下的设备由路由器同时刷新，下面记录“本轮被刷新过的接口”
      const 本轮刷新接口 = lCxtT !== null && 新LAN帧 ? new Set() : null;
      const hid = 本轮刷新接口 && window.gegeHiddenDevices;
      const 有Mesh = 本轮刷新接口 !== null && (CONFIG.forceMeshMode === 2 || window.gegeLastMeshDevCount > 0 || Object.keys(hid).length > 0);
      for (let m in cI) {
        let cC = cI[m], cS = S.cls[m];
        if (!cS) { // 第一次见到这台设备：建档；readSaveData 为 1 或 3 时，把路由器后台已有的累计值直接当作本期流量的起点
          const spD = (CONFIG.readSaveData === 2 && S.snap && S.snap.devices && S.snap.devices[m]) || null;
          cS = S.cls[m] = {
            upR: cC.upRate, dnR: cC.dnRate, lUT: lanNow,
            intUp: CONFIG.readSaveData === 3 ? cC.offUp : (spD ? (spD.integral_up || 0) : 0), intDn: CONFIG.readSaveData === 3 ? cC.offDn : (spD ? (spD.integral_down || 0) : 0),
            uB: (CONFIG.readSaveData === 1 || CONFIG.readSaveData === 3) ? 0 : (spD ? cC.offUp - (spD.up || 0) : cC.offUp),
            dB: (CONFIG.readSaveData === 1 || CONFIG.readSaveData === 3) ? 0 : (spD ? cC.offDn - (spD.down || 0) : cC.offDn),
            lU: cC.offUp, lD: cC.offDn, aR: 0, dpU: 0, dpD: 0,
            oU: cC.offUp, oD: cC.offDn, hU: new Float64Array(32), hD: new Float64Array(32), hIdx: 0,
            ifc: cC.iface, name: cC.name || spD?.name || m, ip: cC.ip || spD?.ip || '', // 真实流量；ip 是最后一次见到的
            // 下面这些原本是运行中按条件追加的；一次写全，所有设备共用一个隐藏类。会反复写小数的给 0（原地改写不分配），靠“有没有值”判断的给 undefined
            onS: 0, qU: 0, qD: 0, zEU: 0, zED: 0, zUC: 0, zDC: 0, dbC: 0,
            rssi: undefined, lRs: undefined, via: undefined, viaMac: undefined, phy: undefined, haOff: undefined
          };
        } else {
          let dU = cC.offUp - cS.lU, dD = cC.offDn - cS.lD;
          if (dU < 0 || dD < 0) { // 官方累计值回退：把负增量并进基线与原点（保持周期流量连续），记下回退前的值
            if (dU < 0) { cS.uB += dU; cS.oU += dU; cS.dpU = cS.lU; }
            if (dD < 0) { cS.dB += dD; cS.oD += dD; cS.dpD = cS.lD; }
            cS.aR = 3; //前面已经讲过原因，不要跟我讲可复用性、特定特殊性，大不了我搞个3e-9不就不可能冲突了？
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
                if (CONFIG.盲漫游 === undefined) CONFIG.盲漫游 = 1; // 出现过这种回退，说明这台路由器会“盲漫游”
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
          if (cC.ip) cS.ip = cC.ip;
        }

        // 速率合法性检查：不可信的速率换成哨兵值，并从代数和里扣掉
        cC.s = cS;
        if (cC.upRate > 6e8) { cSU -= cC.upRate; cC.upRate = 3; }
        else if (cS.aR === 2) { cSU -= cC.upRate; cC.upRate = 2; }
        else if (cS.aR === 1 && cC.upRate > CONFIG.宽带最大外网上行速率 * 1.2 && cC.upRate > 32e7) { cSU -= cC.upRate; cC.upRate = 1; }
        if (cC.dnRate > 24e8) { cSD -= cC.dnRate; cC.dnRate = 3; }
        else if (cS.aR === 2) { cSD -= cC.dnRate; cC.dnRate = 2; }
        else if (cS.aR === 1 && (cC.dnRate > CONFIG.宽带最大外网下行速率 || cC.dnRate > 36e7)) { cSD -= cC.dnRate; cC.dnRate = 1; }
        if (本轮刷新接口 && cS.aR === 0 && (!有Mesh || !hid[m]) && (cC.upRate !== cS.upR || cC.dnRate !== cS.dnR)) 本轮刷新接口.add(cC.iface);
        cS.onS = cC.onSec;
        cS.lU = cC.offUp;
        cS.lD = cC.offDn;
      }
      // ---- 8. LAN 速率代数和的积分 ----
      if (!S.lLT) {
        S.lLT = lanNow;
      } else if (cSU !== S.lInstUp || cSD !== S.lInstDn) {
        const lDt = lanNow - S.lLT;
        if (S.lInstUp > 0) S.lTotUp += (S.lInstUp + cSU) * lDt * 0.0005;
        else if (cSU > 0) S.lTotUp += cSU * 0.5 * lanDt;
        if (S.lInstDn > 0) S.lTotDn += (S.lInstDn + cSD) * lDt * 0.0005;
        else if (cSD > 0) S.lTotDn += cSD * 0.5 * lanDt;
        S.lLT = lanNow;
      }
      S.lInstUp = cSU; S.lInstDn = cSD;
      // ---- 9. 逐设备积分：速率变了，或同接口的其他设备刚被路由器刷新过，就结算一次 ----
      for (const m in cI) {
        let cC = cI[m], cS = cC.s;
        if (cC.upRate !== cS.upR || cC.dnRate !== cS.dnR || cS.aR === 0 && (!有Mesh || !hid[m]) && 本轮刷新接口?.has(cC.iface)) {
          const ms = lanNow - cS.lUT;
          if (cS.upR > 0) { cS.intUp += (cS.upR + cC.upRate) * ms * 0.0005; }
          else if (cC.upRate > 0) { const eU = cC.upRate * lanDt * 0.5; cS.intUp += eU; cS.zEU = (cS.zEU || 0) + eU; cS.zUC = (cS.zUC || 0) + 1; }
          if (cS.dnR > 0) { cS.intDn += (cS.dnR + cC.dnRate) * ms * 0.0005; }
          else if (cC.dnRate > 0) { const eD = cC.dnRate * lanDt * 0.5; cS.intDn += eD; cS.zED = (cS.zED || 0) + eD; cS.zDC = (cS.zDC || 0) + 1; }
          cS.upR = cC.upRate;
          cS.dnR = cC.dnRate;
          cS.lUT = lanNow;
        }
      }
      // ---- 10. 收尾：标记这份 LAN 数据已处理，渲染，按节拍刷新信号强度与网口协商 ----
      if (lCxtT !== null && 新LAN帧) lCxtProcessedT = lCxtT;
      S.wInstUp = cWU;
      S.wInstDn = cWD;
      rUI(cWU, cWD, cSU, cSD, cI);
      if (olOn) {
        S.lTick = ((S.lTick || 0) + 1) & ((CONFIG.信号强度刷新周期 << 3) - 1);
        if ((S.lTick & (CONFIG.信号强度刷新周期 - 1)) === 1 && CONFIG.forceMeshMode !== 2) fRSSI();
        if (S.lTick === 1) fPHY();
      }} 
      catch (e) {
      console.error("[哥哥科技] 周期采样中断:", e); }
    finally {
      isF = !1;}
  }

  // ---[6]------------------------ 周期结算与 CSV 导出 ------------------------
  // 周期判断线的计算在 [3] 的 S.calcTime
  function buildCSV() {
    const csvQ = s => `"${s.replaceAll('"', '""')}"`; // RFC 4180：字段整体加引号，内部双引号翻倍
    const csvE = v => {
      let s = String(v ?? '');
      if (typeof v === 'string' && /^(?:\s*[=+\-@＝＋－＠]|[\t\r\n])/.test(s)) s = "'" + s;
      return csvQ(s); };

    const csvRow = a => a.map(csvE).join(','); // 字符串公式防护
    const csvRowT = a => a.map(v => csvQ(String(v ?? ''))).join(','); // 仅限脚本自带的可信常量行分节标记
    return ((sp, now, start) => '\uFEFF' + [
      csvRow([`哥哥科技 硬路由 NPU 增强系列：专用组件 ${版本号} 生成`]),
      csvRow([`统计周期：${new Date(start + CONFIG.时区补偿).toISOString().replace('T', ' ').slice(0, 19)} 至 ${new Date(now + CONFIG.时区补偿).toISOString().replace('T', ' ').slice(0, 19)} (UTC${CONFIG.时区补偿 > 0 ? '+' : ''}${CONFIG.时区补偿 / 3600000})${CONFIG.readSaveData === 1 ? ' （含路由器后台读档）' : ''}`]),
      csvRowT(['--- [全局统计] ---']),
      csvRow(['WAN总上传(bit)','WAN总下载','高精全局上行','高精全局下行','LAN积分总上行','LAN积分总下行','本次在线总上行','本次在线总下行(b)']),
      csvRow([Math.round(sp.global?.wan_up||0),Math.round(sp.global?.wan_down||0),Math.round(sp.global?.lan_high_up||0),Math.round(sp.global?.lan_high_down||0),Math.round(sp.global?.lan_integral_up||0),Math.round(sp.global?.lan_integral_down||0),Math.round(sp.global?.lan_off_up||0),Math.round(sp.global?.lan_off_down||0)]),
      '',
      csvRowT(['--- [设备明细] ---']),
      csvRow(['设备名称','MAC地址','IP地址','状态/接口','高精上行','高精下行','积分上行','积分下行','官方上行','官方下行']),
      ...Object.entries(sp.devices || {}).map(d => csvRow([d[1].name,d[0],d[1].ip,d[1].status,Math.round(d[1].up||0),Math.round(d[1].down||0),Math.round(d[1].integral_up||0),Math.round(d[1].integral_down||0),Math.round(d[1].raw_up||0),Math.round(d[1].raw_down||0)])),
      '',
      csvRow(['Bro-Stat@哥哥科技 https://space.bilibili.com/501430041']),
      csvRow(['项目主页: https://github.com/ucxn/ZTE-Stat_Max']),
      csvRow(['脚本下载: https://scriptcat.org/users/203510'])
    ].join('\r\n'))(
      S.cSnap || {}, 
      S.cSnap?.timestamp || Date.now(), 
      (CONFIG.readSaveData === 2 && typeof GM_getValue !== 'undefined' ? GM_getValue('gege_reset_ms', null) : null) || performance.timeOrigin || Date.now()
    );}

  // 结算：导出 CSV（下载 + 弹窗备份）→ 记录结算时间 → 清零所有累计量 → 重新计算下个周期的时间点
function doSettle(nowMs) {
    S._RST = !0; // 防重入锁
    let csv = buildCSV(), a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], {type: 'text/csv;charset=utf-8;'})); a.download = `哥哥科技_路由器统计数据导出_${new Date(nowMs + CONFIG.时区补偿).toISOString().slice(2, 19).replace(/[-:]/g, '').replace('T', '_')}_${nowMs}.csv`; a.click(); // 文件
    let w = window.open('about:blank', '_blank'); // 结算弹窗：下载按钮失败时可以复制 CSV 文本手动保存
    if (w) {
      w.document.write(`<!DOCTYPE html><html><head><title>流量结算备份</title></head><body style="background:#f3f4f5;font-family:system-ui,sans-serif;padding:40px 20px;color:#333;"><div style="background:#fff;padding:30px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.05);max-width:850px;margin:0 auto;"><h2 style="color:#0059fa;margin-top:0;border-bottom:2px solid #f0f0f0;padding-bottom:15px;">本次数据结算周期已结束</h2><p style="font-size:14px;line-height:1.7;color:#555;"><b>哥哥科技提示您：</b>请点击下方下载按钮将 CSV 报表保存到本地。<br>若下载失败，请点击复制按钮，新建文本文档粘贴后将拓展名改为 .csv 即可。</p><button id="dl-btn" style="background:#0059fa;color:#fff;border:none;padding:12px 24px;border-radius:6px;font-weight:bold;cursor:pointer;margin-right:10px;">📥 再次下载 CSV</button><button id="cp-btn" style="background:#4caf50;color:#fff;border:none;padding:12px 24px;border-radius:6px;font-weight:bold;cursor:pointer;">📋 一键复制内容</button><div style="background:#282c34;color:#abb2bf;padding:15px;border-radius:8px;overflow-x:auto;margin-top:20px;"><pre id="csv-data" style="margin:0;font-size:13px;line-height:1.5;"></pre></div></div><script>document.getElementById('dl-btn').onclick=function(){let a=document.createElement('a');a.href=URL.createObjectURL(new Blob([document.getElementById('csv-data').textContent],{type:'text/csv;charset=utf-8;'}));a.download='哥哥科技_路由器统计数据补下_${nowMs}.csv';a.click();};document.getElementById('cp-btn').onclick=function(){let t=document.createElement('textarea');t.value=document.getElementById('csv-data').textContent;document.body.appendChild(t);t.select();try{document.execCommand('copy');alert('复制成功！');}catch(e){alert('复制失败，请手动全选复制');}document.body.removeChild(t);};</script></body></html>`);
      w.document.getElementById('csv-data').textContent = csv;
    }
    GM_setValue('gege_reset_ms', nowMs);
    GM_setValue('ha_snapshot', { timestamp: nowMs, global: {}, devices: {} }); S.snap = {}; S.cSnap = null; WC.u = WC.d = WC.rx = undefined;
    S.wTotUp = S.wTotDn = S.w2TotUp = S.w2TotDn = S.lTotUp = S.lTotDn = S.wZEU = S.wZED = S.wZEUC = S.wZEDC = S.lwTU = S.lwTD = 0; // 内存原地清零；lwTU 不清的话下一个窗口的平均速率会算成负数
    Phys.tU = Phys.tD = Phys.zEU = Phys.zED = Phys.zEUC = Phys.zEDC = 0; for (const k in Phys.p) Phys.p[k].tU = Phys.p[k].tD = 0; // 物理口和逻辑 WAN 同一个周期起点：内外网比取两者平均，外网计数器首帧也从这里借起点
    S.lLT = performance.now();
    for (let k in S.cls) { let s = S.cls[k]; s.intUp = s.intDn = 0; s.uB = s.oU = s.lU; s.dB = s.oD = s.lD; s.hU.fill(0); s.hD.fill(0); } // 内存原地清零底表
    document.getElementById('gb-w-bnr')?.remove(); // 预警横幅
    S.calcTime(Math.max(nowMs, S.Force_MS - CONFIG.自动导出 * 60000 + 1000) + CONFIG.时区补偿); // 瞬间算出下月/下周新判断线
    window.gegeForceUIRedraw = !0; // 重绘 UI
    setTimeout(() => { S._RST = !1; }, 2000); // 解开安全锁
  }

  // 内外网流量比：LAN 侧流量 / WAN 侧流量。
  // LAN 侧有两种估计（积分值、高精值），按它们与 WAN 的吻合程度挑选或取平均。
const calcStageRatio = (W, L_int, L_hp) => {
    if (W === 0) return 1.0;
    const L_max = Math.max(L_int, L_hp);
    const L_min = Math.min(L_int, L_hp);
    const Gap = Math.abs(L_int - L_hp);
    if (L_int > 0.84 * W && L_hp > 0.75 * W && (L_max < 1.5 * W || Gap < 0.6 * W)) {
        return ((L_int + L_hp) / (2 * W));
    } else if (L_min < W && W < L_max && L_max < 1.5 * W) {
        return L_max / W;
    } else {
        return (Math.abs(L_int - W) < Math.abs(L_hp - W) ? L_int : L_hp) / W; }
  };

  // ---[7]------------------------ 可视化部件：火花线 / 图标 / 信号 / 总速率曲线 ------------------------
  // 火花线：取 32 点环形缓冲里最近 16 个采样（从旧到新），按 maxValue 缩放到 ▂~█ 八档
const SPRK = [' ', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
const RS_T = [-23, -34, -40, -55]; // 信号图标的档位门槛
// 设备卡片的节点与数值缓存（it._gege）的模板：每张卡片都从它复制，所有卡片共用一个隐藏类。
// uRSSI、uPHY、rUI 各自往里写的顺序不同，按需追加的话每张卡片形状不一，rUI 逐卡读缓存会退化成超多态。
// 数值键初值 -1、字符串键 undefined：保证第一帧的“有没有变”判断一定成立
const GC = { bD: undefined, bDPct: undefined, bDSpk: undefined, bDVal: undefined, bU: undefined, bUPct: undefined, bUSpk: undefined, bUVal: undefined, dBox: undefined, dBoxBar: undefined, dBoxPct: undefined, dBoxVol: undefined, devIntro: undefined, enh: undefined, info: undefined, ipNode: undefined, logo: undefined, rBox: undefined, rBoxBar: undefined, rBoxDn: undefined, rBoxPort: undefined, rBoxUp: undefined, rssiNode: undefined, rtPct: undefined, speed: undefined, timeNode: undefined, upBar: undefined, upBox: undefined, upPct: undefined, upVol: undefined, viaNode: undefined, zBadge: undefined,
  kU: -1, kB: -1, kD: -1, kPU: -1, kPD: -1, rU: -1, rD: -1, kC: undefined, kCol: undefined, pt: undefined, spU: undefined, spD: undefined, sv: undefined, rv: undefined };
      function getSpark(ringArr, headIdx, maxVal) {
        let s = "", k = 7 / maxVal;
        for (let i = 16; i--; ) {
          let v = ringArr[(headIdx - i) & 31];
          s += SPRK[v < 4 ? 0 : Math.min(7, Math.max(1, (v * k) | 0))]; // 1/2/3 是拦截、漫游、异常的哨兵值，按无流量画
        }
        return s;
      }
  // ---- 图标 ----
      // RJ45 口：颜色表示协商速率档位
      const gRSvg = c => `<svg viewBox="0 0 100 100" width="45" height="45" xmlns="http://www.w3.org/2000/svg"><g transform="rotate(180 50 50)"><path d="M18 82V36Q18 32 22 32H28V24Q28 20 32 20H38V14Q38 10 42 10H58Q62 10 62 14V20H68Q72 20 72 24V32H78Q82 32 82 36V82Q82 86 78 86H22Q18 86 18 82Z" fill="${c}" fill-opacity=".10" stroke="${c}" stroke-width="4" stroke-linejoin="round"/><g stroke="${c}" stroke-width="3.2" stroke-linecap="round"><path d="M31 54V76"/><path d="M36.5 54V76"/><path d="M42 54V76"/><path d="M47.5 54V76"/><path d="M53 54V76"/><path d="M58.5 54V76"/><path d="M64 54V76"/><path d="M69.5 54V76"/></g></g></svg>`;
      // 光口（SFP）
      const gSFPSvg = c => `<svg viewBox="0 0 100 100" width="45" height="45" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="24" width="80" height="52" rx="4" fill="${c}" fill-opacity=".10" stroke="${c}" stroke-width="4"/><path d="M18 32H38V38H62V32H82V68H65V62H35V68H18Z" fill="none" stroke="${c}" stroke-width="4" stroke-linejoin="round"/><path d="M27 43H73M27 50H73M27 57H73" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round" opacity=".55"/></svg>`;
      // Wi-Fi 信号图标：RSSI 越强，图形越饱满；极差时换成带 ! ? ✖ 的告警样式：圆点环偏左，右侧挂一个符号
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
      // 有线口图标：按协商速率档位选择，档位 4 是带金色引脚的高速口
      const gPSvg = s => {
        if (s === 4) return `<svg viewBox="0 0 100 100" width="45" height="45"><rect x="15" y="15" width="70" height="65" rx="5" fill="#cfd8dc" stroke="#90a4ae" stroke-width="4"/><path d="M 25,25 L 75,25 L 75,60 L 60,60 L 60,75 L 40,75 L 40,60 L 25,60 Z" fill="#263238"/><g fill="#ffca28"><rect x="30" y="25" width="2.5" height="18"/><rect x="35" y="25" width="2.5" height="18"/><rect x="40" y="25" width="2.5" height="18"/><rect x="45" y="25" width="2.5" height="18"/><rect x="52.5" y="25" width="2.5" height="18"/><rect x="57.5" y="25" width="2.5" height="18"/><rect x="62.5" y="25" width="2.5" height="18"/><rect x="67.5" y="25" width="2.5" height="18"/></g><circle cx="21" cy="73" r="3.5" fill="#4caf50"/><circle cx="79" cy="73" r="3.5" fill="#ffb300"/></svg>`;
        if (s > 0 && s < 4) return gRSvg(['', '#E7B05C', '#5394CC', '#4CAF50'][s]);
        if (s === 5 || s === 6) return gSFPSvg(s === 5 ? '#5394CC' : '#9C27B0');
        return `<img src="https://greasyfork.s3.us-east-2.amazonaws.com/pdcy1uwpyn2g8l1vw4mgtlj0cww4" width="45" height="45">`;
      };
  // ---- 信号强度 / 有线口协商速率：写入设备卡片 ----
      function uRSSI(dL) { // dL：大包接口解析出的设备列表；不传则只刷新界面
        if (dL) dL.forEach(d => {
          let c, r;
          if (d.Active !== '1' || !(c = S.cls[nM(d.MACAddress)])) return;
          if (r = +d.Rssi) c.rssi = r;
          if (d.ParentDeviceMac) { c.via = d.ParentDeviceName; c.viaMac = d.ParentDeviceMac === '00:00:00:00:00:00' ? '' : d.ParentDeviceMac; }
        });
        const oDC = S.oDC, fx = S.RSSI频率修正 || 0;
        if (!oDC) return;
        for (let m in S.cls) {
          let cS = S.cls[m], it = oDC[m], rRs = cS.rssi, lRs = cS.lRs ?? rRs;
          if (!it) continue;
          const cache = it._gege ??= { ...GC };
          // 如果值没有返回的话，它会一直显示缓存的旧值。它是程序本来就是这样子的，不是你专门做了一个防抖动。但是如果反之，为了避免显示缓存，要增加新的逻辑，那就不做。也就是说我们就是顺其自然，代码最简的思维：就是说如果没有新值就把旧值保留的逻辑，那也没有必要。
          // 不留废物变量：只用一次的内联，多次使用才起名；同等条件下 const 优于 let，let 只在写起来更方便或更快时用。
          // 我非常讨厌废物变量，也就是wasteful let 1.除非使用多次，否则可读性不构成任何加分项；我丝毫不在乎可读性，能内联就内联；你看我那么复杂的数学公式都宁可内联，而不是抽一条出来。
          // 在其他条件相同的情况下，个人审美认为const比let好。 // 当let对于写程序更方便或者性能更优时，那就用let，不一定非要遵守上面说的const。 // 无论是let还是const，我都不喜欢临时、中间、废物、未复用却为了“看上去有语义”的变量。
          if (cS.via) (cache.viaNode ??= it.querySelector('.dev-ip').appendChild(Object.assign(document.createElement('span'), { className: 'gege-via' }))).textContent = cS.via;
          if (!rRs) continue;
          if (RS_T.some(t => (rRs >= t) !== (lRs >= t)) && Math.abs(rRs - lRs) + (cS.dbC || 0) <= 4) {
            rRs = lRs; cS.dbC = ((cS.dbC || 0) + 1) & 7;
          } else { cS.dbC = 0; cS.lRs = rRs; }
          const logo = cache.logo ??= it.querySelector('.dev-logo');
          const sv = gWSvg(rRs); // 没变就不重写 innerHTML，免得整棵 SVG 重新解析
          if (logo && cache.sv !== sv) { cache.sv = sv; logo.style.background = 'none'; logo.innerHTML = sv; }
          let dI = cache.devIntro ??= it.querySelector('.dev-intro'), rN = dI && (cache.rssiNode ??= dI.querySelector('.gege-rssi'));
          // 我当然知道这是一个经验公式，我自然也知道RSSI不能简单粗暴的算，哪怕公式中的参数是正确的。不是我不聪明，是因为在实践中，城市里面通常2.4G，它就是体验非常不好。所以将其设置为一个惩罚系数，总比拍脑袋的数字要好的多吧？
          // 针对不同情况进行不同的处理，也是公平的一部分：思政课本上面教过我们这个道理。同时个人认为工程上有个“不更坏原则”：一个东西就算不完美，但是它比之前的解决方案并没有显著更差的地方，权衡后并不能说它不好。主要是要比较这么一个“diff”；你不能因为一个化学学霸只辅导了你的化学，然后没有同时指出你物理作业的问题，就说不能合并这个PR。
          if (rN) { let p = Math.round((cS.rssi - (cS.ifc === 'wl0' || cS.ifc === 'wl1' || cS.ifc === 'wlan0' || cS.ifc === 'wlan1' ? fx : 0)) * 1.6666666666666667 + 133.33333333333334); const h = `<span style="color:${p < 0 ? '#ff4c00' : 'inherit'}">${p}%</span>, ${cS.rssi}`; if (cache.rv !== h) { cache.rv = h; rN.innerHTML = h; } }
        }
      }
      function uPHY(dL) { // dL：vue_internet_ethport_data 解析出的网口列表；不传则只刷新界面
        if (dL) for (let m in S.cls) {
          let cS = S.cls[m];
          if (!/^eth\d+$/i.test(cS.ifc || '')) continue;
          let d = dL.find(x => x.EthPortAliasName === 'LAN' + cS.ifc.slice(3) || x._InstID === cS.ifc);
          cS.phy = +(d?.EthPortSpeed || 0);
        }
        const oDC = S.oDC;
        if (!oDC) return;
        for (let m in S.cls) {
          let cS = S.cls[m], it = oDC[m];
          if (!it || !/^eth\d+$/i.test(cS.ifc || '')) continue;
          let cache = it._gege || (it._gege = { ...GC }), logo = cache.logo ??= it.querySelector('.dev-logo'), sv = gPSvg(cS.phy);
          if (logo && cache.sv !== sv) { cache.sv = sv; logo.style.background = 'none'; logo.innerHTML = sv; }
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
  // ---- WAN 总速率曲线（环形缓冲 + canvas，可拖动缩放）----
      function 记总速率图(u, d) {
        u = u || 0; d = d || 0;
        const c = S.总图点数, i = c & 8191; // 环形缓冲容量，必须是2的次方（下标用 & 取模）
        S.总上行图[i] = u; S.总下行图[i] = d; S.总图点数 = c + 1;
        if (u > S.wMaxU) S.wMaxU = u; if (d > S.wMaxD) S.wMaxD = d;
        if (u > 0 && u < S.wMinU) S.wMinU = u; if (d > 0 && d < S.wMinD) S.wMinD = d;
      }
      // 创建（仅一次）曲线图容器并绑定拖动 / 缩放事件；初始位置和尺寸写在 CSS 里
      function 初始化总速率图(bd) {
        let box = bd._chart;
        if (box) return box;
        box = document.createElement('div'); box.id = 'gege-speed-chart';
        box.innerHTML = '<canvas></canvas><div class="gege-chart-head"><b data-gc="meta"></b><span data-gc="range"></span></div><div class="gege-chart-foot"><span class="gc-up" data-gc="up"></span><span class="gc-down" data-gc="down"></span><span class="gc-extra" data-gc="extra"></span></div><div class="gege-chart-resize" title="缩放"></div>';
        bd.appendChild(box); bd._chart = box;
        box._cv = box.querySelector('canvas'); box._cx = box._cv.getContext('2d'); box._rs = '';
        box._gcMeta = box.querySelector('[data-gc="meta"]'); box._gcRange = box.querySelector('[data-gc="range"]'); box._gcUp = box.querySelector('[data-gc="up"]'); box._gcDown = box.querySelector('[data-gc="down"]'); box._gcExtra = box.querySelector('[data-gc="extra"]');
        // '拖动中' 移动整个图；'缩' 拖右下角缩放，缩放时用 rAF 合并重绘，避免一次 pointermove 画一次
        const 图表起手 = (e, 图表模式) => { e.preventDefault(); S.拖动图表 = { 图表模式, x: e.clientX, y: e.clientY, l: box.offsetLeft, t: box.offsetTop, w: box.offsetWidth, h: box.offsetHeight }; box.setPointerCapture?.(e.pointerId); };
        box.addEventListener('pointerdown', e => { if (!e.target.classList.contains('gege-chart-resize')) 图表起手(e, '拖动中'); });
        box.querySelector('.gege-chart-resize').addEventListener('pointerdown', e => 图表起手(e, '缩'));
        box.addEventListener('pointermove', e => {
          const g = S.拖动图表; if (!g) return;
          if (g.图表模式 === '拖动中') { box.style.left = (g.l + e.clientX - g.x) + 'px'; box.style.top = (g.t + e.clientY - g.y) + 'px'; } // 只挪位置，画布内容不变，不重画
          else { box.style.width = Math.max(260, g.w + e.clientX - g.x) + 'px'; box.style.height = Math.max(88, g.h + e.clientY - g.y) + 'px';
            if (!S.图表待画) { S.图表待画 = 1; requestAnimationFrame(() => { S.图表待画 = 0; 画总速率图(bd); }); } }
        });
        box.addEventListener('pointerup', () => S.拖动图表 = null); box.addEventListener('pointercancel', () => S.拖动图表 = null); box.addEventListener('lostpointercapture', () => S.拖动图表 = null);
        return box;
      }
      function 画总速率图(bd) {
        let box = 初始化总速率图(bd), cv = box._cv, W = box.clientWidth | 0, H = box.clientHeight | 0, R = window.devicePixelRatio || 1;
        if (W < 40 || H < 40) return;
        if (cv.width !== (W * R | 0) || cv.height !== (H * R | 0)) { cv.width = W * R | 0; cv.height = H * R | 0; cv.style.width = '100%'; cv.style.height = '100%'; }
        const x = box._cx; x.setTransform(R,0,0,R,0,0); x.clearRect(0,0,W,H);
        // 绘图区边距，以及可见数据的范围；顺便统计纵轴上限与平均值
        let l = 34, r = 8, t = 20, b = 25, gw = W - l - r, gh = H - t - b, n = Math.min(S.总图点数, 8000), st = S.总图点数 - n, ym = 1, su = 0, sd = 0;
        const AU = S.总上行图, AD = S.总下行图;
        for (let k = 0; k < n; k++) { const j = (st + k) & 8191, u = AU[j], d = AD[j]; if (u > ym) ym = u; if (d > ym) ym = d; su += u; sd += d; }
        // 底板与边框；虚线网格横 5 条、竖 7 条，合成一条路径一次描边（比逐条描边省 CPU，交叉点不再叠色加深）
        x.fillStyle = 'rgba(255,255,255,.58)'; x.strokeStyle = 'rgba(0,89,250,.88)'; x.lineWidth = 1.5; x.beginPath(); x.roundRect ? x.roundRect(.5,.5,W-1,H-1,8) : x.rect(.5,.5,W-1,H-1); x.fill(); x.stroke();
        x.setLineDash([4,4]); x.strokeStyle = 'rgba(0,89,250,.45)'; x.lineWidth = 1;
        x.beginPath();
        for (let i = 5; i--; ) { const y = t + gh * i / 4; x.moveTo(l,y); x.lineTo(W-r,y); }
        for (let i = 7; i--; ) { const xx = l + gw * i / 6; x.moveTo(xx,t); x.lineTo(xx,H-b); }
        x.stroke();
        x.setLineDash([]);
        // 文字：采样信息、峰谷值、最新值、均值（满 8000 点时用乘 1/8000 代替除法）
        const li = (S.总图点数 - 1) & 8191, au = n ? (n === 8000 ? su * .000125 : su / n) : 0, ad = n ? (n === 8000 ? sd * .000125 : sd / n) : 0;
        box._gcMeta.textContent = `采样:${window.gegeBActivated ? CONFIG.wanRefreshInterval : 3}s  点:${S.总图点数}`;
        const rs = `峰↑${fBy(S.wMaxU)} ↓${fBy(S.wMaxD)}  谷↑${S.wMinU < Infinity ? fBy(S.wMinU) : '--'} ↓${S.wMinD < Infinity ? fBy(S.wMinD) : '--'}`;
        if (box._rs !== rs) { box._rs = rs; const rg = box._gcRange; rg.textContent = rs; rg.title = rs; }
        box._gcUp.textContent = `发 ${n ? fBy(S.总上行图[li]) : fBy(0)}`; // 每次采样几乎都变，直接写
        box._gcDown.textContent = `收 ${n ? fBy(S.总下行图[li]) : fBy(0)}`;
        box._gcExtra.textContent = `均↑${fBy(au)} ↓${fBy(ad)}`;
        // 画一条曲线。点数多于横向像素时按“桶”抽样：每个桶只保留最小值和最大值，按时间先后连接，既不丢尖峰也不糊成一团
        const DrawingTheLine = (arr, col) => {
          if (!n) return;
          x.strokeStyle = col; x.lineWidth = 2.4; x.beginPath();
          const bins = Math.max(1, Math.min(n, gw | 0)), sx = n > 1 ? gw / (n - 1) : 0, x0 = n > 1 ? l : l + gw, ky = gh / ym, yb = H - b, sp = n / bins + 1e-9; let first = 1;
          if (bins === n) {
            for (let k = 0; k < n; k++) { const xx = x0 + sx * k, yy = yb - arr[(st + k) & 8191] * ky; first ? (x.moveTo(xx, yy), first = !1) : x.lineTo(xx, yy); }
          } else {
            for (let q = 0; q < bins; q++) {
              let a = q * sp | 0, z = (q + 1) * sp | 0, mn = Infinity, mx = -Infinity, mi = a, ma = a; if (z <= a) z = a + 1;
              for (let k = a; k < z; k++) { let v = arr[(st + k) & 8191]; if (v < mn) { mn = v; mi = k; } if (v > mx) { mx = v; ma = k; } }
              if (mi <= ma) { first ? (x.moveTo(x0 + sx * mi, yb - mn * ky), first = !1) : x.lineTo(x0 + sx * mi, yb - mn * ky); if (ma !== mi) x.lineTo(x0 + sx * ma, yb - mx * ky); }
              else { first ? (x.moveTo(x0 + sx * ma, yb - mx * ky), first = !1) : x.lineTo(x0 + sx * ma, yb - mx * ky); x.lineTo(x0 + sx * mi, yb - mn * ky); }
            }
          }
          x.stroke();
        };
        DrawingTheLine(S.总上行图, '#ff1b00'); DrawingTheLine(S.总下行图, '#006400');
      }

  // ---[8]------------------------ 看板渲染 renderUI（看板 + 设备卡片）------------------------
  //   每个采样帧调用一次，分三步：
  //   1) 汇总各设备流量、生成存档快照、检查是否该预警 / 结算
  //   2) 建立并挂载看板（#zte-geek-board），重建「MAC → 卡片」索引
  //   3) 在 requestAnimationFrame 里统一写 DOM：先写看板文字，再逐张刷新设备卡片，最后画曲线图
  function rUI(wU, wD, sU, sD, cI) {
    // ---- 1. 汇总 ----
    // “周期流量”= 官方累计值 − 基线；“会话流量”= 官方累计值 − 会话原点。
    // readSaveData = 2 时高精统计按周期口径（跨会话延续），其余模式按本次会话口径。
    // hp*：高精之和（含已下线设备）；curHp*：仅在线设备；ab*：“当前总计”（官方累计之和）；tot_cU：周期上行之和（上行占比分母）；tOD：在线官方下行之和（下行占比分母）
    let tOD = 0, LUp = S.lTotUp, LDn = S.lTotDn,
      hpU = 0, hpD = 0, abU = 0, abD = 0, curHpU = 0,
      curHpD = 0, tot_cU = 0, dv = S.rTick === 1 ? {} : null; // 快照只在存档和结算的那一帧才有人读，其余帧不造
    const rs2 = CONFIG.readSaveData === 2;
    for (let k in S.cls) {
      let s = S.cls[k], cC = cI[k];
      const lU = s.lU || 0, lD = s.lD || 0;
      let cU = s.qU = Math.max(0, lU - (s.uB || 0));
      let cD = s.qD = Math.max(0, lD - (s.dB || 0));
      let sessU = Math.max(0, lU - (s.oU || 0));
      let sessD = Math.max(0, lD - (s.oD || 0));
      tot_cU += cU;
      hpU += rs2 ? cU : sessU;
      hpD += rs2 ? cD : sessD;
      if (cC) {
        curHpU += rs2 ? cU : sessU;
        curHpD += rs2 ? cD : sessD;
        tOD += cC.offDn || 0;
      }
      abU += rs2 ? sessU : (cC ? (cC.offUp || 0) : lU);
      abD += rs2 ? sessD : (cC ? (cC.offDn || 0) : lD);
      const h = s.hIdx = (s.hIdx + 1) & 31; // 火花线的 32 点环形缓冲：写入本帧速率（下线设备记 0）
      s.hU[h] = cC ? cC.upRate : 0;  s.hD[h] = cC ? cC.dnRate : 0;
      if (dv) dv[k] = {
        up: cU, down: cD,
        integral_up: s.intUp || 0,
        integral_down: s.intDn || 0,
        status: cC ? (CONFIG.portMap[cC.iface] || cC.iface || "未知接口") : (s.haOff > 0 ? (CONFIG.portMap[s.ifc] || s.ifc || "未知接口") : "下线"),
        name: cC?.name || s.name || k, ip: s.ip,
        raw_up: cC?.offUp || 0, raw_down: cC?.offDn || 0,
        rssi: s.rssi, via: s.via, via_mac: s.viaMac
      };

      /* ⚠️ 需要使用 HA 快速上线下线报告的用户，请删除该注释以启用该功能。
      try {
        if (S.cSnap) {
          if (CONFIG.盲漫游 === 1) {
            if (cC) {
              if (s.haOff === 0 || (s.haOff === undefined && !S.cSnap.devices?.[k])) {
                GM_setValue('ha_presence', { timestamp: Date.now(), devices: { [k]: { name: cC.name || s.name || k, ip: s.ip, status: "上线" } } });
                s.haOff = undefined;
              } else if (s.haOff > 0) s.haOff = undefined;
            } else if (s.haOff > 0) {
              if (Date.now() >= s.haOff) {
                GM_setValue('ha_presence', { timestamp: Date.now(), devices: { [k]: { name: s.name || k, ip: s.ip, status: "下线" } } });
                s.haOff = 0;
              }
            } else if (s.haOff === undefined) {
              GM_setValue('ha_presence', { timestamp: Date.now(), devices: { [k]: { name: s.name || k, ip: s.ip, status: "下线" } } });
              s.haOff = 0;
            }
          } else {
            if (cC) {
              if (s.haOff === 0 || (s.haOff === undefined && !S.cSnap.devices?.[k])) {
                GM_setValue('ha_presence', { timestamp: Date.now(), devices: { [k]: { name: cC.name || s.name || k, ip: s.ip, status: "上线" } } });
                s.haOff = undefined;
              } else if (s.haOff > 0) s.haOff = undefined;
            } else if (s.haOff === undefined) {
              s.haOff = Date.now() + 300000;
            } else if (s.haOff > 0 && Date.now() >= s.haOff) {
              GM_setValue('ha_presence', { timestamp: Date.now(), devices: { [k]: { name: s.name || k, ip: s.ip, status: "下线" } } });
              s.haOff = 0;
            }
          }
        }
      } catch(e) { console.warn("[哥哥科技] HA上下线事件写入失败:", e); }
      */
    }
    if (dv) S.cSnap = {
        timestamp: Date.now(),
        global: {
            wan_up: S.wTotUp, wan_down: S.wTotDn,
            lan_integral_up: LUp, lan_integral_down: LDn,
            lan_high_up: hpU, lan_high_down: hpD,
            lan_off_up: abU, lan_off_down: abD
        },
        devices: dv
    };
    // ---- 存档、预警、结算（只在 rTick === 1 的帧做）----
    if (typeof GM_setValue !== 'undefined' && S.rTick === 1) {
        S.haTick = ((S.haTick || 0) + 1) & 7;
        if (S.haTick === 1) {
            try { S.cSnap.wc_up = WC.u; S.cSnap.wc_down = WC.d; GM_setValue('ha_snapshot', S.cSnap); } catch(e) { console.warn(e); }}
        let nowMs = Date.now();
        if (nowMs >= S.Force_MS && !S._RST) {
            doSettle(nowMs);
        } else if (nowMs >= S.Warn_MS && !document.getElementById('gb-w-bnr')) { // 预警横幅：统计周期即将结束
            let bd = document.getElementById('zte-geek-board');
            if (bd) {
                let bn = document.createElement('div'); bn.id = 'gb-w-bnr';
                bn.style.cssText = 'background:#fff3cd;color:#856404;padding:10px 15px;margin-bottom:10px;border-radius:6px;border-left:5px solid #ffc107;font-weight:bold;font-size:13px;display:flex;justify-content:space-between;align-items:center;width:100%;box-sizing:border-box;';
                bn.innerHTML = `<span> 统计周期即将结束，流量将在跨越执行时间时自动清零备份。</span><button id="gb-f-btn" style="background:#ffc107;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;font-weight:bold;color:#333;">立即导出并清零</button>`;
                bd.insertBefore(bn, bd.firstChild);
                document.getElementById('gb-f-btn').onclick = () => doSettle(Date.now());
            }
        }
    }

    // ---- 内外网比（每 8 帧刷新一次）----
    S.rTick = ((S.rTick || 0) + 1) & 7;
    if (S.rTick === 1 || !S.cRT) {
      // 最近 8 帧（8 × 采样周期秒）内 WAN 累计量的增量 → 平均速率，供火花线定标
      const wi = (window.gegeBActivated ? CONFIG.wanRefreshInterval : 3) << 3;
      S.aWu = (S.wTotUp - (S.lwTU || S.wTotUp)) / wi; S.lwTU = S.wTotUp; S.aWd = (S.wTotDn - (S.lwTD || S.wTotDn)) / wi; S.lwTD = S.wTotDn;
        if (S.hasW2) { // 双 WAN：主线 / 次线的流量倍数（这个分支只更新缓存，不写 #gb-ratio-display）
            let rU = S.w2TotUp > 0 ? (S.wTotUp / S.w2TotUp) : (S.wTotUp > 0 ? Infinity : 0), rD = S.w2TotDn > 0 ? (S.wTotDn / S.w2TotDn) : (S.wTotDn > 0 ? Infinity : 0);
            let fR = (r) => r === Infinity ? '∞' : (r > 1 ? r.toFixed(2) + 'x' : (r * 100).toPrecision(3) + '%');
            S.cRT = `<span style="font-weight: bold;"><span class="c-up">${fR(rU)}</span>，<span class="c-down">${fR(rD)}</span></span>`;
        } else { // 单 WAN：LAN 总量 / WAN 总量。WAN 基准取逻辑 WAN 积分与物理口积分的平均（只有一个有数据就用那一个）
            let rUp = calcStageRatio((Phys.tU + S.wTotUp) / ((Phys.tU > 0) + (S.wTotUp > 0)) || 0, LUp, hpU), rDn = calcStageRatio((Phys.tD + S.wTotDn) / ((Phys.tD > 0) + (S.wTotDn > 0)) || 0, LDn, hpD);
            S.cRT = `<span style="font-weight: bold;"><span style="color: ${rUp > 1.5 ? '#ff4c00' : (rUp > 1.15 ? '#FF9800' : '#4CAF50')};">${(rUp * 100).toFixed(2)}%</span>，<span style="color: ${rDn > 1.5 ? '#ff4c00' : (rDn > 1.15 ? '#FF9800' : '#4CAF50')};">${(rDn * 100).toFixed(2)}%</span></span>`;
            const rd = S.bd?._g['gb-ratio-display']; if (rd) rd.innerHTML = S.cRT; // 第一帧看板还没建，跳过；开头那几帧的比值本来也没意义
        }
    }
    let bd = S.bd; // 面板重建 (bVD 整体 innerHTML) 会把看板摘下来，节点本身留着，下面的挂载逻辑会接回新锚点；一次性显示的外网计数器行、图表位置、冻结状态都靠它保留
    if (!bd) {
      bd = S.bd = document.createElement('div');
      bd.id = 'zte-geek-board';

    // 三种看板布局，行里的 id 是写看板文字时 bd._g 的索引，改名需同步。
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
        } // 三种布局共有的附加行：物理网口、外网计数器
        layoutHtml += `<div class="geek-row" id="gb-phys-row" style="display:none; height:auto!important; flex-wrap:wrap;"><span class="geek-label" style="font-weight:normal; color:#666;">物理网口:</span><div class="geek-val-box" id="gb-phys-data" style="flex-wrap:wrap; font-size:13px; font-weight:normal;"></div></div>`;
        if (CONFIG.外网计数器 !== 0) layoutHtml += `<div class="geek-row" id="gb-wc-row" style="display:none;"><span class="geek-label">外网计数器</span><div class="geek-val-box"><span class="c-up geek-fixed-width" id="gb-wc-up"></span><span class="c-down geek-fixed-width" id="gb-wc-down"></span></div><div class="geek-right-box" style="font-weight:normal; color:#666;">积分精度<span id="gb-wc-src"></span>：<span class="c-up" id="gb-wc-pu"></span> | <span class="c-down" id="gb-wc-pd"></span></div></div>`;
        bd.innerHTML = layoutHtml;
        bd._g = Object.create(null); for (const e of bd.querySelectorAll('[id]')) bd._g[e.id] = e; // 看板只建一次，每帧按 id 取节点，不再逐个 querySelector
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
        } }

    // ---- 2. 建立并挂载看板 ----
    // bVD 整体重写 innerHTML 后看板被摘下，在这里接回新锚点（见上面 S.bd 处的注释）
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
    // 重建「MAC → 设备卡片」索引：原生页面从官方卡片的 .dev-number 文本里抠 MAC，自家面板直接读 data 属性
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
            if (m) S.oDC[m] = n; }
          }
        S._domRebuilt = false;
        S._lastPanelState = iPO;
        uRSSI(); uPHY();
      }
      // ---- 3. 统一写 DOM ----
      let oDC = S.oDC; 
      // 把汇总数据写进看板各个节点
      if (bd.parentNode) {
        const g = bd._g;
        let aW2U = S.hasW2 ? S.w2U : undefined,aW2D = S.hasW2 ? S.w2D : undefined,aW2TU = S.hasW2 ? S.w2TotUp : undefined,aW2TD = S.hasW2 ? S.w2TotDn : undefined;
        g['gb-lan-up-bytes'].textContent = `🔼 ${fB(sU)}`;
        g['gb-lan-down-bytes'].textContent = `🔽 ${fB(sD)}`;
        g['gb-lan-up-vol'].textContent = `🔼 ${fV(LUp)}`;
        g['gb-lan-down-vol'].textContent = `🔽 ${fV(LDn)}`;
        g['gb-wan-up-vol'].textContent = `🔼 ${fV(S.wTotUp)}`;
        g['gb-wan-down-vol'].textContent = `🔽 ${fV(S.wTotDn)}`;
        g['gb-int-up-vol'].textContent = `🔼 ${fV(hpU)}`;
        g['gb-int-down-vol'].textContent = `🔽 ${fV(hpD)}`;
        g['gb-abs-up-vol'].textContent = `🔼 ${fV(abU)}`;
        g['gb-abs-down-vol'].textContent = `🔽 ${fV(abD)}`;
        // 实时占比：LAN 速率代数和 / 线路速率（取物理口与逻辑 WAN 中较大的）
        g['gb-perc-up'].textContent = `🔼 ${((sU * 100) / (Math.max(Phys.wU || 0, wU || 0) || Infinity) || 0).toFixed(1)}%`;
        g['gb-perc-down'].textContent = `🔽 ${((sD * 100) / (Math.max(Phys.wD || 0, wD || 0) || Infinity) || 0).toFixed(1)}%`;
        let pb = g['gb-pwan-bps-container'], pv = g['gb-pwan-vol-container']; // 副 WAN / 物理口的实时速率、累计流量
        if (aW2U !== undefined) { // 双 WAN：主行显示两条线路速率之和，副 WAN 单独列出
            g['gb-wan-up-bytes'].textContent = `🔼 ${fBy(wU + (aW2U||0))}`;
            g['gb-wan-down-bytes'].textContent = `🔽 ${fBy(wD + (aW2D||0))}`;
            g['gb-wan-up-bps'].textContent = `🔼 ${fB(wU)}`;
            g['gb-wan-down-bps'].textContent = `🔽 ${fB(wD)}`;
            if (pb) { pb.style.display = 'inline'; g['gb-pwan-bps-up'].textContent = '🔼 ' + fB(aW2U); g['gb-pwan-bps-down'].textContent = '🔽 ' + fB(aW2D); }
            if (pv) { 
                pv.style.display = 'flex'; 
                g['gb-pwan-tot-up'].textContent = '🔼 ' + fV(aW2TU); 
                g['gb-pwan-tot-down'].textContent = '🔽 ' + fV(aW2TD); 
                if (g['gb-pwan-zero-up']) { // 物理口“0 补偿”只在单 WAN + 物理口接管时才有意义，这里是双 WAN 分支，所以恒为不显示
                    let isPhysTakeover = CONFIG.lanPortMode === 1 && !S.hasW2;
                    g['gb-pwan-zero-up'].textContent = (isPhysTakeover && Phys.zEU) ? fSV(Phys.zEU) : '';
                    g['gb-pwan-zero-down'].textContent = (isPhysTakeover && Phys.zED) ? fSV(Phys.zED) : '';
                    g['gb-pwan-zero-up-cnt'].textContent = (isPhysTakeover && Phys.zEUC) ? Phys.zEUC : 0;
                    g['gb-pwan-zero-down-cnt'].textContent = (isPhysTakeover && Phys.zEDC) ? Phys.zEDC : 0;
                }
            }
        } else if (CONFIG.lanPortMode !== 1 || !Phys.lT) { // 没有物理口数据：常规显示
            g['gb-wan-up-bytes'].textContent = `🔼 ${fB(wU)}`;
            g['gb-wan-down-bytes'].textContent = `🔽 ${fB(wD)}`;
            g['gb-wan-up-bps'].textContent = `🔼 ${fBy(wU)}`;
            g['gb-wan-down-bps'].textContent = `🔽 ${fBy(wD)}`;
            if (pb) pb.style.display = 'none'; if (pv) pv.style.display = 'none';
        } else { // 有物理口数据：主位置换成字节率，物理口速率与积分由 fPP 另行写入
            g['gb-wan-up-bytes'].textContent = `🔼 ${fBy(wU)}`;
            g['gb-wan-down-bytes'].textContent = `🔽 ${fBy(wD)}`;
            g['gb-wan-up-bps'].textContent = `🔼 ${fB(wU)}`;
            g['gb-wan-down-bps'].textContent = `🔽 ${fB(wD)}`;
        }
        if (g['gb-ratio-display']) { // 只有紧凑 / 平铺布局里才有这几个节点
          g['gb-cur-up-vol'].textContent = `🔼 ${fV(curHpU)}`;
          g['gb-cur-down-vol'].textContent = `🔽 ${fV(curHpD)}`;
          if (g['gb-wan-zero-up']) {
              g['gb-wan-zero-up'].textContent = !S.wZEU ? '' : fSV(S.wZEU);
              g['gb-wan-zero-down'].textContent = !S.wZED ? '' : fSV(S.wZED);
              g['gb-wan-zero-up-cnt'].textContent = S.wZEUC || 0;
              g['gb-wan-zero-down-cnt'].textContent = S.wZEDC || 0;
          }
        }
      }
      // 刷新每张设备卡片：在线时长 / 上行流量条 / 零估算角标 / 占比条 / 下行流量条 / 实时网速条。
      // 所有找到过的子节点都缓存在 it._gege 里；数值没变的文字不重写，减少 DOM 写入。
      // 百分比统一用“一位小数的整数键”（percent × 10 四舍五入）判断是否变化
      const inv_tot_cU = tot_cU > 0 ? 100 / tot_cU : 0;
      const inv_tOD = tOD > 0 ? 100 / tOD : 0;
      const inv_sU = sU > 0 ? 100 / sU : 0;
      const inv_sD = sD > 0 ? 100 / sD : 0;
      // 火花线纵轴的下限：至少是 WAN 平均速率的一定比例，避免很小的流量被放大成满格
      const clU0 = Math.max(S.aWu * 0.1 || 0, 512000), clD0 = S.aWd * 0.125 || 0;
      const cm = CONFIG.calcMode === 1, rxU = CONFIG.ratioExtremeUp, rwU = CONFIG.ratioWarnUp, rxD = CONFIG.ratioExtremeDown, rth = CONFIG.ratioThreshold, pm = CONFIG.portMap;
      for (let m in cI) {
        let it = oDC[m];
        if (!it) continue;
        const cC = cI[m], cS = cC.s;
        
        let cache = it._gege || (it._gege = { ...GC });
        const hqU = cS.qU, hqD = cS.qD;
        const tN = cache.timeNode ??= it.querySelector('.gege-online-time');
        if (tN && cS.onS > 0) tN.textContent = fOT(cS.onS);
        
        const dI = cache.devIntro ??= it.querySelector('.dev-intro');
        if (dI) { // 左栏：上行流量（官方值 | 积分值）与占比条
          let bx = cache.upBox ??= dI.querySelector('.gege-up-box');
          if (!bx) {
            bx = document.createElement('div'); bx.className = 'gege-up-box';
            bx.innerHTML = `<div class="t-row c-up"><span>↑ <span class="v-vol"></span></span><span class="v-pct"></span></div><div class="zte-thin-bar"><div class="zte-thin-bar-inner up"></div></div>`;
            dI.appendChild(bx);
            cache.upBox = bx;
          }
          const p = hqU * inv_tot_cU;
          (cache.upVol ??= bx.querySelector('.v-vol')).textContent = fVD(cS.intUp, cC.offUp);
          const kU = (p * 10 + .5) | 0;
          if (cache.kU !== kU) { cache.kU = kU; (cache.upPct ??= bx.querySelector('.v-pct')).textContent = p.toFixed(1) + '%'; (cache.upBar ??= bx.querySelector('.zte-thin-bar-inner')).style.width = Math.min(p, 100) + '%'; }
        }
        
        const inf = cache.info ??= it.querySelector('.info');
        if (inf) { // 中栏：零估算角标、上下行占比条、下行流量
          let ipNode = cache.ipNode ??= inf.querySelector('.dev-ip');
          if (ipNode) {
            let zBadge = cache.zBadge ??= ipNode.querySelector('.gege-zero-badge');
            if (!zBadge) {
              zBadge = document.createElement('span'); zBadge.className = 'gege-zero-badge gege-box';
              ipNode.style.display = 'flex'; ipNode.style.alignItems = 'baseline';
              zBadge.style.cssText = 'color: #999; font-size: 11.5px; font-family: Consolas; margin-left: auto; margin-right: 5px;';
              ipNode.appendChild(zBadge);
              cache.zBadge = zBadge;
            }
            // 零估算累计不足 6 次时不显示，避免偶发的起跳干扰观感
            zBadge.textContent = ((cS.zUC || 0) + (cS.zDC || 0)) < 6 ? "" : `[0估] ${!cS.zEU ? '' : fSV(cS.zEU)}，${!cS.zED ? '' : fSV(cS.zED)}｜${cS.zUC || 0},${cS.zDC || 0}`;
          }
          
          let rB = cache.rBox ??= inf.querySelector('.gege-ratio-box');
          if (!rB) { // 第一次：隐藏官方多余的 IP / MAC 行，换成我们的占比盒
            Array.from(inf.querySelectorAll('.dev-ip:not(.gege-box *)')).slice(1).forEach(n => { n.style.display = 'none'; });
            inf.querySelectorAll('.dev-number:not(.gege-box *)').forEach(n => { n.style.display = 'none'; });
            rB = document.createElement('div'); rB.className = 'gege-ratio-box';
            rB.innerHTML = `<div class="gege-ratio-top"><span class="v-port"></span><span class="v-interval" style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight: normal; font-size: 12.5px; opacity: 0.75; letter-spacing: 0.5px;"><span class="c-up"></span><span style="color:#666; margin:0 3px;">，</span><span class="c-down"></span></span><span class="v-rt-pct"></span></div><div class="gege-ratio-bar"><div class="gege-ratio-bar-inner"></div></div>`;
            inf.appendChild(rB);
            cache.rBox = rB;
          }
          
          const bR = (hqU + hqD) > 0 ? (hqU * 100 / (hqU + hqD)) : 0;          let tC = "", tCol;
          if (cm) { // 倍数模式：上行/下行；上传远大于下载时标红并加 ⚠️，下载远大于上传时显示“下行是上行的 N 倍”
            const rt = hqD > 0 ? (hqU / hqD) : (hqU > 0 ? Infinity : 0);
            if (rt > rxU) { tCol = '#ff4c00'; tC = (rt === Infinity ? '∞' : rt.toFixed(2)) + '⚠️'; }
            else if (rt > rwU) { tCol = '#ff4c00'; tC = (rt * 100).toFixed(1) + '%'; }
            else if (rt > rxD) { tCol = '#0059fa'; tC = (rt * 100).toFixed(1) + '%'; }
            else { tCol = '#0059fa'; const rRt = hqU > 0 ? (hqD / hqU) : (hqD > 0 ? Infinity : 0); tC = (rRt === Infinity ? '∞' : rRt.toFixed(1)) + 'x'; }
          } else { // 占比模式：上行占总和的百分比，超过阈值标红
            tCol = bR > rth ? '#ff4c00' : '#0059fa';
            tC = bR.toFixed(1) + '%';
          }
          
          const pt = pm[cC.iface] || cC.iface || "未知";
          if (cache.pt !== pt) { cache.pt = pt; (cache.rBoxPort ??= rB.querySelector('.v-port')).textContent = pt; }
          (cache.rBoxUp ??= rB.querySelector('.v-interval .c-up')).textContent = '' + fSV(hqU);
          (cache.rBoxDn ??= rB.querySelector('.v-interval .c-down')).textContent = '' + fSV(hqD);
          const rtP = cache.rtPct ??= rB.querySelector('.v-rt-pct');
          if (cache.kC !== tC || cache.kCol !== tCol) { cache.kC = tC; cache.kCol = tCol; rtP.textContent = tC; rtP.style.color = tCol; }
          const kB = (bR * 10 + .5) | 0;
          if (cache.kB !== kB) { cache.kB = kB; (cache.rBoxBar ??= rB.querySelector('.gege-ratio-bar-inner')).style.width = Math.min(bR, 100) + '%'; }
          
          let dBx = cache.dBox ??= inf.querySelector('.gege-down-box');
          if (!dBx) {
            dBx = document.createElement('div'); dBx.className = 'gege-down-box';
            dBx.innerHTML = `<div class="t-row c-down"><span>↓ <span class="v-vol"></span></span><span class="v-pct"></span></div><div class="zte-thin-bar"><div class="zte-thin-bar-inner down"></div></div>`;
            inf.appendChild(dBx);
            cache.dBox = dBx;
          }
          const dp = (cC.offDn || 0) * inv_tOD;
          (cache.dBoxVol ??= dBx.querySelector('.v-vol')).textContent = fVD(cS.intDn, cC.offDn);
          const kD = (dp * 10 + .5) | 0;
          if (cache.kD !== kD) { cache.kD = kD; (cache.dBoxPct ??= dBx.querySelector('.v-pct')).textContent = dp.toFixed(1) + '%'; (cache.dBoxBar ??= dBx.querySelector('.zte-thin-bar-inner')).style.width = Math.min(dp, 100) + '%'; }
        }
        
        const sp = cache.speed ??= it.querySelector('.speed');
        if (sp) { // 右栏：实时网速条（左：速率，中：火花线，右：占 LAN 总速率的百分比）
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
          
          let clU = clU0, clD = clD0; // 火花线纵轴上限 = 下限与 32 点历史最大值中的较大者
          const hU = cS.hU, hD = cS.hD;
          for (let i = 32; i--; ) { if (hU[i] > clU) clU = hU[i]; if (hD[i] > clD) clD = hD[i]; }
          const spU = getSpark(hU, cS.hIdx, clU), spD = getSpark(hD, cS.hIdx, clD);
          if (cache.spU !== spU) { cache.spU = spU; (cache.bUSpk ??= bU.querySelector('.v-spark')).textContent = spU; }
          if (cache.spD !== spD) { cache.spD = spD; (cache.bDSpk ??= bD.querySelector('.v-spark')).textContent = spD; }

          const kPU = (pu * 10 + .5) | 0, kPD = (pd * 10 + .5) | 0;
          if (cache.kPU !== kPU) { cache.kPU = kPU; bU.style.setProperty('--p-up', Math.min(pu, 100) + '%'); (cache.bUPct ??= bU.querySelector('.v-pct')).textContent = pu.toFixed(1) + '%'; }
          if (cache.rU !== cC.upRate) { cache.rU = cC.upRate; (cache.bUVal ??= bU.querySelector('.v-val')).textContent = `🔼 ${fBy(cC.upRate)}`; }
          if (cache.kPD !== kPD) { cache.kPD = kPD; bD.style.setProperty('--p-down', Math.min(pd, 100) + '%'); (cache.bDPct ??= bD.querySelector('.v-pct')).textContent = pd.toFixed(1) + '%'; }
          if (cache.rD !== cC.dnRate) { cache.rD = cC.dnRate; (cache.bDVal ??= bD.querySelector('.v-val')).textContent = `🔽 ${fBy(cC.dnRate)}`; }
        }
      }
      if (bd.parentNode) 画总速率图(bd); // 放在所有文字写完之后：读画布尺寸只触发一次排版
    });
  }

  // ---[UI]------------------------ 设备列表重建 / 提示区 / 面板开关 / 菜单注入 ------------------------
  // 官方列表在 Mesh 模式下会被销毁，所以我们自己渲染一份全屏面板（#gege-global-overlay），
  // 里面按 有线 / 5G / 5G / 2.4G 分组列出设备；每张卡片的 data-gege-mac 就是 rUI 重建卡片索引的依据。
  // 重建整个面板内容。成功后把 _domRebuilt 置 true，让 rUI 下一帧重新索引卡片。
  async function bVD(ol) {
    try {
      let h2 = [], h52 = [], h58 = [], hW = [];
      (S.pLC === lCxt ? S.pL : parseXml(lCxt, "OBJ_CLIENTS_ID")).forEach(d => { // rSD 已解析过同一份文本就直接用
        if (!d.MACAddress) return;
        // 单台设备的卡片骨架（三列：头像+名称 / IP+MAC / 实时网速）；具体数字由 rUI 填充
        let m = nM(d.MACAddress),
          tS = fOT(+(d.OnlineDuration || d.OnlineTime || d.LeaseTime || 0)),
          ifc = d.Interface || '',
          htm = `<div class="col-md-12 col-xs-12 config-item gege-list-item" data-gege-mac="${m}"><div class="config-item-box" style="display: flex; align-items: stretch;"><div class="col-md-5 col-xs-7 logo" style="width: 33%; display: flex; flex-direction: row; align-items: center;"><div class="dev-logo" style="width: 50px; height: 50px; min-width: 50px; margin-right: 15px; background: url('/jquery/static/img/home/unknown_computer.png') 0% 0% / 50px no-repeat; display: flex; flex-direction: column; align-items: center; justify-content: center;"></div><div class="dev-intro" style="flex: 1; display: flex; flex-direction: column; justify-content: flex-start; min-height: 100px;"><div style="display: flex; justify-content: space-between; align-items: baseline; width: 95%;"><div class="dev-name" style="font-weight: bold; color: #333; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0; margin-right: 8px;">${escapeHTML(d.AliasName || d.HostName || d.DisplayedPictureName || '未知设备')}</div><div class="gege-rssi" style="font-size: 12px; font-weight: bold; color: #666; font-family: Consolas; white-space: nowrap; flex-shrink: 0;"></div></div><div class="gege-online-time" style="color: #999; font-size: 12px; font-family: Consolas; margin-top: 4px;">${tS}</div></div></div><div class="col-md-4 col-xs-5 info" style="width: 27%; display: flex; flex-direction: column; padding: 0 10px; border-right: 1px solid #eee;"><div class="dev-ip" style="color: #666; font-family: Consolas;">${escapeHTML(d.IPAddress || '')}</div><div class="dev-number grey" style="color: #999; font-size: 12px; font-family: Consolas;">MAC：${m}</div></div><div class="col-md-3 col-xs-12 speed" style="width: 40%; display: flex; flex-direction: column; justify-content: center; padding: 0 10px;"></div></div></div>`;
        if (['wl0', 'wlan0', 'wlan1', 'wl1'].includes(ifc)) h2.push(htm); // 按接口名分到 有线 / 5G / 5G / 2.4G 四组
        else if (['wlan5', 'wl4', 'wlan4', 'wl3', 'wlan3'].includes(ifc)) h52.push(htm);
        else if (ifc === 'wl2' || ifc === 'wlan2' || ifc === 'wl5' || (/w/i.test(ifc) && !/wan/i.test(ifc))) h58.push(htm);
        else hW.push(htm);
      });
      // Mesh 适配徽标：隐藏设备里存在“不是 Mesh 子节点”的（mesh 字段显式为 false）就显示“全面适配”；旧徽标要在 innerHTML 被替换之前读，显示过“全面适配”就不再降级
      requestAnimationFrame(() => {
        ol.innerHTML = `<div style="padding: 20px; max-width: 1580px; margin: 0 auto; min-height: 100%;"><div id="gege-board-anchor"></div><div id="config-list" class="config-list gege-list-container"><div class="gege-section"><div class="config-title">有线设备${(window.gegeHiddenDevices && Object.keys(window.gegeHiddenDevices).length > 0) ? `<span id="gege-mesh-badge" style="color: #ff4c00; font-size: 13px; font-weight: normal; margin-left: 10px; font-family: Consolas;">(哥哥科技：${ol.querySelector('#gege-mesh-badge')?.textContent === '(哥哥科技：Mesh全面适配)' || Object.values(window.gegeHiddenDevices).some(d => d?.mesh === false) ? 'Mesh全面适配' : '智能Mesh适配'})</span>` : ''}</div>${hW.join('')||'<div class="gege-empty-state">没有连接设备</div>'}</div><div class="gege-section"><div class="config-title">无线设备（${S.is5G_149?'5.8GHz':'5.2GHz'}）</div>${h52.join('')||'<div class="gege-empty-state">没有连接设备</div>'}</div><div class="gege-section"><div class="config-title">无线设备（${S.is5G_149?'5.2GHz':'5.8GHz'}）</div>${h58.join('')||'<div class="gege-empty-state">没有连接设备</div>'}</div><div class="gege-section"><div class="config-title">无线设备（2.4GHz）</div>${h2.join('')||'<div class="gege-empty-state">没有连接设备</div>'}
        </div><div style="margin-top: 25px; padding-top: 15px; border-top: 1px dashed #eee; text-align: center; font-family: Consolas, 'Microsoft YaHei', sans-serif;"><div style="font-size: 11.5px; color: #777; font-style: italic; margin-bottom: 8px;">“在一个文明社会，干净的、不被监视与吸血的网络，是我们每个人的基本权利。”</div><div style="font-size: 10.5px; color: #999; line-height: 1.3; margin-bottom: 8px;">本交互式程序为“哥哥软件”范本；分享请使用官方链接，仅对尊重署名且持续保留者开放源代码，按“原样”免费提供，不对其适用性、稳定性、精密度或任何商业场景的合规性作任何担保。<a href="https://github.com/ucxn/ZTE-Stat_Max/blob/main/LICENSE.markdown" target="_blank" style="color: #777; text-decoration: underline;">分享/查看许可证</a><br>协议规定：基于本程序的任何修改均不得移除本界面的署名，也不得弱化“显示的程度”。保持显著GUI署名、原样保留程序中所有“哥哥科技”样式完全不变且轻松可见，是使用本软件代码的合法性的前置条件。
        </div><div style="font-size:12px;color:#555;"><svg xmlns="http://www.w3.org/2000/svg" width="110" height="18" viewBox="0 0 122 20" role="img" aria-label="Broware BY NC" style="vertical-align:middle;margin-right:6px"><defs><linearGradient id="bg1" x2="0" y2="1"><stop stop-color="#4b4b4b"/><stop offset=".5" stop-color="#333"/><stop offset="1" stop-color="#1f1f1f"/></linearGradient><linearGradient id="bg2" x2="0" y2="1"><stop stop-color="#52d58c"/><stop offset=".52" stop-color="#31bc71"/><stop offset="1" stop-color="#218b50"/></linearGradient><linearGradient id="sh" x2="0" y2="1"><stop stop-color="#fff" stop-opacity=".32"/><stop offset=".45" stop-color="#fff" stop-opacity=".08"/><stop offset=".46" stop-opacity="0"/><stop offset="1" stop-opacity=".1"/></linearGradient><clipPath id="c"><rect width="122" height="20" rx="4"/></clipPath></defs><g clip-path="url(#c)"><path fill="url(#bg1)" d="M0 0h24v20H0z"/><path fill="url(#bg2)" d="M24 0h98v20H24z"/><path fill="url(#sh)" d="M0 0h122v20H0z"/></g><g transform="translate(4 2)"><rect width="15" height="15" rx=".6" fill="#fff"/><rect x="1" y="1" width="13" height="13" fill="#58d18d"/><path fill="#fff" d="M1 1h7v7z"/><path fill="#32bf70" d="M8 1h6v13H8z"/><path fill="#1ba856" d="M1 14h7V8l6 6z"/></g><g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11"><text x="73" y="15" fill="#000" fill-opacity=".28">Broware BY NC</text><text x="73" y="14">Broware BY NC</text></g></svg>
		<a href="https://github.com/ucxn/ZTE-Stat_Max" target="_blank" style="color:#0059fa;text-decoration:none;font-weight:bold;">ZTE-Stat_Max 增强组件</a> <span title="构建时间：2026-11.6 15时29&#10;架构设计：哥哥科技 BroTech&#10;Bilibili UID：501430041&#10;QQ群：680464365" style="cursor:help; border-bottom:1px dotted #ccc; font-family:Consolas;">${版本号}</span> | Copyright &copy; 2026 <a href="https://www.bilibili.com/video/BV1PtR7B8ECC" target="_blank" style="color: #0059fa; text-decoration: none; font-weight: bold;">哥哥科技</a> (BroTech)<span style="color: #888; font-weight: normal;">&nbsp;&nbsp;朋友：<a href="https://space.bilibili.com/544253177" target="_blank" style="color: #0059fa; text-decoration: none; font-weight: bold;">明明不远</a><span style="color: #888; font-weight: normal;"> | 保留所有权利</span>&nbsp;&nbsp;<a href="https://scriptcat.org/zh-CN/script-show-page/6194" target="_blank" style="color: #666; text-decoration: none;">点此分享</a>&nbsp;&nbsp;闲鱼友链：<a href="https://www.goofish.com/personal?userId=2216485229713" target="_blank" style="color: #0059fa; text-decoration: none; font-weight: bold;">音像闲置好物</a></div></div></div></div>`;
      window.gegeRenderNotice && window.gegeRenderNotice();
      S._domRebuilt = true;});}
    catch (e) {
      requestAnimationFrame(() => {
        ol.innerHTML = `<div style="padding: 20px; color: red;">数据渲染失败: ${escapeHTML(e.message)}</div>`;
      });
    }
  }
  // ---- 悬浮按钮（injectMode 1 / 2 / 3）----
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
  // ---- 面板开关 ---- fS：true 强制打开，false 强制关闭，缺省则在开 / 关之间切换
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
      // 面板第一次激活：关掉空闲期的定时器（改由 B 引擎接管），启动物理网口、外网计数器、信道探测与熔断监视
      // 点火：A 引擎在点开面板前只记了逻辑 WAN，这里归零，让它和物理口、外网计数器、LAN 积分同一个起点。整个页面周期只来一次。
      // 速率状态（wInstUp、wLT）不动，否则下一次积分的底边会乱；存档模式 2 已读档时不动，读档本来就要跨会话延续
      if (!S.snapLoaded) S.wTotUp = S.wTotDn = S.w2TotUp = S.w2TotDn = S.wZEU = S.wZED = S.wZEUC = S.wZEDC = S.lwTU = S.lwTD = 0;
      clearTimeout(window.gegeMasterTimer);
      window.gegeMasterTimer = null;
      if (CONFIG.lanPortMode > 0 && !window.gegePortTimer) {
        if (CONFIG.lanPortMode === 2) { gWUp = () => Phys.wU || 0; gWDn = () => Phys.wD || 0; } // WAN 高速接管主线：WAN 速率改为直接读物理口
        window.gegePortTimer = setInterval(fPP, CONFIG.portInterval * 1000);
        fPP();
      }
      if (CONFIG.外网计数器 !== 0) window.gegeWCTimer = setInterval(fWC, CONFIG.外网计数器刷新 * 1000);
      // 读取无线信道：算出 2.4G / 5G 的 RSSI 频率修正量 = 20·log10(5G 中心频率 / 2.4G 中心频率)，信道缺失时用 44 / 9 兜底；并判断 5G 是否用了 149~177 信道
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
      }).catch(e => { S.RSSI频率修正 = 20 * Math.log10(5220 / 2452); uRSSI(); console.warn("[哥哥科技] 无线信道彩蛋探测异常:", e); }); // 起到科普中国有5.2G和5.8G的作用，避免笼统的5GHz，哪怕用户的单个路由器不一定有三频功能。
      // 熔断：档位 1 下 8.5 秒内仍然没有设备数据，说明固件阉割了常规接口 → 自动切到档位 2（强制大包）
      if (CONFIG.forceMeshMode === 1) {
        setTimeout(() => {
          if (window.gegeRenderedMacs.size === 0) {
            console.log("⏱️ [哥哥科技] 超时熔断生效：强制切入档位2");
            CONFIG.forceMeshMode = 2;
            clearInterval(window.gegeMasterTimer);
            if (window.gegeLanTimer) clearInterval(window.gegeLanTimer);
            eBET(!1);  // 立即打一枪 LAN 大包
            // 大包请求的时钟：LAN 刷新间隔越短，请求间隔放大得越多，避免大包请求压垮路由器
            window.gegeMasterTimer = setInterval(rSD, CONFIG.wanRefreshInterval * 1000);
            window.gegeLanTimer = setInterval(() => eBET(!1), CONFIG.lanRefreshInterval * (1 + .5 * ((CONFIG.lanRefreshInterval <= 10) + (CONFIG.lanRefreshInterval <= 7.5) + (CONFIG.lanRefreshInterval <= 6) + (CONFIG.lanRefreshInterval <= 5)) + 2 * (CONFIG.lanRefreshInterval <= 3)) * 1000); //大包时钟
            // 熔断横幅 → 15 秒后无条件撤下；仍无设备则换成求助面板，有设备则直接显示列表，到此为止（只跑一次）
            window.gegeNotice = 'fallback';
            window.gegeRenderNotice();
            setTimeout(() => {
              window.gegeNotice = window.gegeRenderedMacs.size === 0 ? 'help' : null;
              window.gegeRenderNotice();
            }, 15000);
          }
        }, 8500);
      }
    }
    bVD(o).then(() => {
      if (window.gegeBActivated) {
        eBET().finally(() => {
          if (首次启动 && !window.gegeMasterTimer) { // 面板首次打开后的主定时器：按配置选择“合并节拍”或“WAN / LAN 分开节拍”
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

  // ---[9]------------------------ 后台探针：物理网口 / 外网计数器 / Mesh 大包引擎 / 调度 ------------------------
  // ---- 物理网口探针 ----
  // 注意方向：路由器“发送”= 设备下载，“接收”= 设备上传；WAN 口则正好相反（发送 = 上传）
  window.gegePortTimer = null;
  let fPPRunning = !1;
async function fPP() {// 物理网口探针：读取每个网口的收发速率，对 WAN 口和各 LAN 口分别做积分
    if (fPPRunning) return;
    fPPRunning = !0;
    try {
      let r = await fetch(`/?_type=vueData&_tag=vue_internet_ethport_data&_=${Date.now()}`);
      if (!r.ok) return;
      const n = performance.now(), txt = await r.text(); // 响应头到达即取时间，和外网计数器同口径
      if (!Phys._pM) { // 终生只解析一次字典，零 GC；首包为空就下一秒再来
        const pI = parseXml(txt, "OBJ_ETHPORT_INFO_ID");
        if (pI.length) { Phys._pM = {}; pI.forEach(d => {
          if (d._InstID) { Phys._pM[d._InstID] = d.EthPortAliasName || d._InstID; if (d.WanType === '1' || d.EthPortAliasName === 'ETH_WAN') Phys._wID = d._InstID; }
        }); } else return; // 没有网口字典就认不出 WAN，这一秒整个跳过
      }
      parseXml(txt, "OBJ_ETHPORT_STATE_ID").forEach(d => {
        if (d._InstID && d.EthPortStatus === '0') { // 只处理已连接的口
          let u = s2b(d.EthPortSendRate), dn = s2b(d.EthPortRecvRate);
          if (d._InstID === Phys._wID) {
            if (!Phys.lT) Phys.lT = n;
            else if (Phys.wU !== u || Phys.wD !== dn) {
              const ms = n - Phys.lT;
              if (Phys.wU > 0) { Phys.tU += (Phys.wU + u) * ms * 0.0005; } else if (u > 0) { const eU = u * 0.5 * CONFIG.portInterval; Phys.tU += eU; Phys.zEU = (Phys.zEU || 0) + eU; Phys.zEUC = (Phys.zEUC || 0) + 1; }
              if (Phys.wD > 0) { Phys.tD += (Phys.wD + dn) * ms * 0.0005; } else if (dn > 0) { const eD = dn * 0.5 * CONFIG.portInterval; Phys.tD += eD; Phys.zED = (Phys.zED || 0) + eD; Phys.zEDC = (Phys.zEDC || 0) + 1; }
              Phys.lT = n;
            }
            Phys.wU = u; Phys.wD = dn;
          } else {
            const nm = Phys._pM[d._InstID] || d._InstID;
            Phys.p[nm] ??= { u: u, dn: dn, tU: 0, tD: 0, lT: n };
            const s = Phys.p[nm];
            if (s.u !== u || s.dn !== dn) {
              const ms = n - s.lT;
              s.tU += s.u > 0 ? (s.u + u) * ms * 0.0005 : (u > 0 ? u * 0.5 * CONFIG.portInterval : 0);
              s.tD += s.dn > 0 ? (s.dn + dn) * ms * 0.0005 : (dn > 0 ? dn * 0.5 * CONFIG.portInterval : 0);
              s.lT = n;
            }
            s.u = u; s.dn = dn;
          }
        }
      });
      if (document.getElementById('gege-global-overlay')?.style.display !== 'block') return; // 面板没打开 / 看板还没建好就不用写界面
      const g = S.bd?._g;
      if (!g) return;
      const db = g['gb-phys-data'], ks = Object.keys(Phys.p);
      if (db._k !== ks.length) { // 每秒一次的地方：网口集合变了才重排结构，平时只改文字
        db._k = ks.length; g['gb-phys-row'].style.display = ks.length ? 'flex' : 'none'; // 一个 LAN 口都没插就整行不占位，插上后下一秒自己出现
        db.innerHTML = ks.map(k => `<span style="margin-right:16px; white-space:nowrap; font-weight:normal; color:#333;">${k}:<span class="c-up" style="display:inline-block; min-width:55px; font-weight:bold; margin-left:6px; text-align:left;"></span><span class="c-down" style="display:inline-block; min-width:55px; font-weight:bold; margin-left:10px; text-align:left;"></span><span style="margin-left:6px; color:#666;">(<span style="color:#9c27b0;"></span>，<span style="color:#4caf50;"></span>)</span></span>`).join('');
        // 每个网口 4 个文字节点：[速率1, 速率2, 积分1, 积分2]
        db._n = Array.from(db.children, e => [e.children[0], e.children[1], e.children[2].children[0], e.children[2].children[1]]);
      }
      const P = Phys.p, nn = db._n;
      for (let i = 0; i < ks.length; i++) {
        const v = P[ks[i]], n = nn[i];
        n[0].textContent = fBy(v.dn); n[1].textContent = fBy(v.u); n[2].textContent = fSV(v.tD); n[3].textContent = fSV(v.tU);
      }

      if (CONFIG.lanPortMode === 1 && !S.hasW2 && Phys.lT) {
        const pb = g['gb-pwan-bps-container'], pv = g['gb-pwan-vol-container'];
        if(pb) { pb.style.display = 'inline'; g['gb-pwan-bps-up'].textContent = '🔼 ' + fB(Phys.wU); g['gb-pwan-bps-down'].textContent = '🔽 ' + fB(Phys.wD); }
        if(pv) { pv.style.display = 'flex'; g['gb-pwan-tot-up'].textContent = '🔼 ' + fV(Phys.tU); g['gb-pwan-tot-down'].textContent = '🔽 ' + fV(Phys.tD); }
      }
    } catch (e) {console.warn(e);}
    finally { fPPRunning = !1; }
  }

  // ---- 外网字节计数器：读路由器 WAN 口的 Tx / Rx 字节数，用来校验积分精度 ----
  // 计数器是 32 位的，两次采样间不能跑满一圈（4 GiB）。两次响应若乱序，>>> 0 会把负差算成一整圈，所以必须防重入。
  let fWCRunning = !1; // 两次响应一旦乱序，>>> 0 会把负差算成一整圈 4 GiB
  async function fWC() {
    if (fWCRunning) return;
    fWCRunning = !0;
    try {
      const k = CONFIG.外网计数器; // -2: 接口 1 不通，正在试接口 2
      const r = await fetch(k & 2 ? `/?_type=vueData&_tag=home_internetreg_lua_no_update_sess&IF_OP=refresh&_=${Date.now()}` : `/?_type=vueData&_tag=vue_mainwan_data&_=${Date.now()}`);
      const n = performance.now(), t = r.ok ? await r.text() : '';
      // 实测核对：vue_mainwan_data 里 Rx 紧跟 Tx；home_internetreg 里 Tx 在前、Rx 在后且中间隔着几十个字段，所以两个字段必须各取各的
      const iR = t.indexOf('<ParaName>RxBytes</ParaName>'), iT = t.indexOf('<ParaName>TxBytes</ParaName>');
      if (iR < 0 || iT < 0) {
        if (k === undefined) CONFIG.外网计数器 = -2;
        else if (k < 0) { CONFIG.外网计数器 = 0; clearInterval(window.gegeWCTimer); }
        return;
      }
      // 官方 XML 里取一个字段的整数值：定位到 <ParaName> 之后的第一个 <ParaValue>
      const tx = parseInt(t.slice(t.indexOf('<ParaValue>', iT) + 11)), rx = parseInt(t.slice(t.indexOf('<ParaValue>', iR) + 11));
      if (!(k > 0)) CONFIG.外网计数器 = k & 2 || 1;
      if (WC.rx === undefined) WC.p = CONFIG.readSaveData !== 2 && Phys.lT > 0; // 物理积分不存档，读档模式只和逻辑 WAN 比
      // 积分只在速率变化时结账，此刻还有一段按当前速率没入账，补到计数器的采样时刻再比
      const iU = WC.p ? Phys.tU + Phys.wU * (n - Phys.lT) * 0.001 : S.wTotUp + S.wInstUp * (n - S.wLT) * 0.001,
        iD = WC.p ? Phys.tD + Phys.wD * (n - Phys.lT) * 0.001 : S.wTotDn + S.wInstDn * (n - S.wLT) * 0.001;
      // 首帧借积分当起点，两行数字从此对齐；读档模式接着存档里的计数器走，积分不再覆盖它
      const g = S.bd._g;
      if (WC.rx === undefined) { WC.u ??= iU; WC.d ??= iD; g['gb-wc-row'].style.display = 'flex'; g['gb-wc-src'].textContent = WC.p ? '(物理)' : '(逻辑)'; }
      else { WC.u += ((tx - WC.tx) >>> 0) * 8; WC.d += ((rx - WC.rx) >>> 0) * 8; }
      WC.tx = tx; WC.rx = rx;
      const wu = WC.u, wd = WC.d;
      g['gb-wc-up'].textContent = `🔼 ${fV(wu)}`;
      g['gb-wc-down'].textContent = `🔽 ${fV(wd)}`;
      let qU, qD;
  // 积分精度的百分比文本，保留两位小数（分子为积分值，分母为计数器值）
      g['gb-wc-pu'].textContent = wu ? (qU = (iU * 1e4 / wu + .5) | 0, (qU / 100 | 0) + (qU % 100 < 10 ? '.0' : '.') + qU % 100 + '%') : '--';
      g['gb-wc-pd'].textContent = wd ? (qD = (iD * 1e4 / wd + .5) | 0, (qD / 100 | 0) + (qD % 100 < 10 ? '.0' : '.') + qD % 100 + '%') : '--';
    } catch (e) {console.warn(e);}
    finally { fWCRunning = !1; }
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
  let bigReq = null; // 合并并发请求：同一时刻只发一个
  // ---- Mesh “大包”接口：一次性拿到所有设备（含官方列表里看不到的 Mesh 子节点设备）----
  // 同时顺便刷新 RSSI 与上联节点；并和官方列表对比，找出“官方看不到”的设备记入 gegeHiddenDevices。
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
            if (!mS.has(m)) { // 官方列表里已有的 MAC 之外的在线设备，就是“隐藏设备”
              let bN = d.DevName || d.HostName || d.DisplayedPictureName || d.AliasName || "Mesh设备",
                bI = d.Interface || "";
              if (d.IFAliasName === 'SSID1') bI = 'wl0';
              else if (d.IFAliasName === 'SSID5') bI = 'wl4';
              nHD[m] = { name: bN, iface: bI, origMac: d.MACAddress, mesh: d.DevMeshType === '3' };
            }
          }
        });
        const nk = Object.keys(nHD);
        if (nk.sort().join('|') !== Object.keys(window.gegeHiddenDevices).sort().join('|') ||
            Object.values(nHD).some(d => d?.mesh === false) !== Object.values(window.gegeHiddenDevices).some(d => d?.mesh === false)) {
          window.gegeForceUIRedraw = !0;
          if (nk.length > 0) console.log("🎯 [哥哥科技] 破甲弹命中！强制狙击名单:", nk);
        }
        window.gegeHiddenDevices = nHD;
        if (!nk.length) document.getElementById('gege-mesh-badge')?.remove();
      }
      return dL;
    })().catch(e => {
      console.warn("[哥哥科技] 大包拉取失败:", e.message);
      return null;
    }).finally(() => { bigReq = null; });
    return bigReq;
  }
  // 顶部提示区（熔断横幅 / 求助面板）：状态驱动。
  // 面板每次重建都会 ol.innerHTML=…，把直接插进去的节点全部抹掉（没有设备时每个 tick 都会重建），
  // 所以这里只记录状态 gegeNotice，并在每次重建之后调用 gegeRenderNotice 重新插入。
  window.gegeNotice = null; // null | 'fallback'(熔断横幅) | 'help'(求助面板)
  window.gegeRenderNotice = function () {
    const ol = document.getElementById('gege-global-overlay');
    if (!ol) return;
    if (window.gegeNotice && ol.querySelector('.gege-list-item')) window.gegeNotice = null; // 已有设备数据：一律撤下
    ['gege-fallback-alert', 'gege-nodata-help'].forEach(id => document.getElementById(id)?.remove());
    const ac = document.getElementById('gege-board-anchor');
    if (!ac || !window.gegeNotice) return;
    const b = document.createElement('div');
    if (window.gegeNotice === 'fallback') {
      b.id = 'gege-fallback-alert';
      b.style.cssText = 'background:#fff3cd;color:#856404;padding:12px 15px;margin:15px 30px 5px 30px;border-radius:6px;border:1px solid #ffeeba;border-left:5px solid #ffc107;font-weight:bold;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,0.05);';
      b.innerHTML = '⚠️ 17秒熔断机制触发：检测到当前固件常规接口异常（被阉割），已自动为您开启【深度大包抓取模式】：请耐心等待。';
    } else {
      b.id = 'gege-nodata-help';
      b.style.cssText = 'background:#fff;color:#333;padding:14px 18px;margin:15px 30px 15px 30px;border-radius:6px;border:1px solid #e5e5e5;border-left:5px solid #0059fa;font-size:13px;line-height:1.85;box-shadow:0 2px 8px rgba(0,0,0,0.05);';
      b.innerHTML = '<div style="font-weight:bold;font-size:14px;margin-bottom:6px;">🧭 未能获取到设备数据，请按你的设备类型选择：</div>'
        + '<div>• 如果您的路由器是<b>中兴在售的家用路由器</b>，您可以联系开发者排查原因：使用 Chrome 浏览器的 <b>F12 → 网络（Network）</b> 抓包发给我适配，或者直接私下协助。</div>'
        + '<div>• 如果您使用的是<b>运营商定制路由器</b>，适配起来通常比较简单，只需要发送抓包文件，走完路由器后台各界面流程。</div>'
		+ '<div>• 如果您在电脑上使用正常，却无法在 Android 手机上使用，请下载集成本程序的另用<a href="https://github.com/ucxn/ZTE-Stat_Max#问题排查" target="_blank" rel="noopener" style="color:#0059fa;font-weight:bold;text-decoration:none;"><b>App</b>并查看</a>相应下载说明。</div>'  
        + '<div>• 如果您使用的是<b>光猫之类的非消费级路由器</b>，您可以尝试打开 <a href="https://github.com/ucxn/Bro-Stat/blob/main/.github/Install.md" target="_blank" rel="noopener" style="color:#0059fa;font-weight:bold;text-decoration:none;">Bro-Stat 项目</a>，安装其兼容版本。</div>'
        + '<div>• 若兼容版本安装以后仍然无效，请联系开发者，并使用<b>视频/屏幕连线</b>的方式进行协助。</div>';
    }
    ac.parentNode.insertBefore(b, ac);
  };
  // ---- 面板未激活时的“精准节拍”：每 3 秒一帧，按固定锚点排程以避免定时器漂移 ----
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
    if (dl < 0) { // 落后了（标签页被挂起等）：重置锚点，从现在起重新计拍
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
  // ---- B 引擎：一个节拍里把 WAN、LAN、Mesh 隐藏设备的数据凑齐，再交给 rSD ----
  // fW = false 时只刷新 LAN（WAN 沿用 rSD 上一次缓存的文本）
  async function eBET(fW = !0) {
    if (window.gegeEngineRunning) return;
    window.gegeEngineRunning = !0;
    try {
      const ts = Date.now();
      let wT = "", wST = null, cDC = window.gegeLastDevCount;
      // ---- 1. WAN 文本，顺便取在线设备数 ----
      if (fW) {
        wT = await gWT();
        wST = performance.now();
      } else wT = window.__gLWT || "";
      if (wT) {
        if (!wanCompat) {
          const i = wT.indexOf('<ParaName>AccessDevNum</ParaName>', wT.indexOf('<OBJ_HOME_BASICINFO_ID>')); // rSD 还要整段解析同一份文本，这里只取一个数
          cDC = i < 0 ? -1 : parseInt(wT.slice(wT.indexOf('<ParaValue>', i) + 11)) || -1;
        } else if (wanCompat.cK) {
          let wI = parseXml(wT, wanCompat.n)[0] || {};
          cDC = +(wI[wanCompat.cK] || -1) || -1;
        }
      }

      // ---- 2. LAN 设备列表 ----
      // 把一台设备拼成官方 <Instance> 结构，让“大包接口”和“Mesh 狙击”的结果可以复用同一套解析路径：不去影响本人自用的非Mesh路径的性能，避免重构已有的底层单位等逻辑。
      let lT = "", lF = window.gegeLastLanFingerprint, lST = null;
      if (CONFIG.forceMeshMode === 2) {
        const liR = await fetch(`/?_type=vueData&_tag=localnet_lan_info_lua&_=${ts}`);
        if (liR.ok) {
          let liT = await liR.text();
          lST = performance.now();
          let iI_arr = [], mA = [],
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
              mA.push(m);
              if (d.DevMeshType === '3') nHD[m] = {
                name: bN,
                iface: bI,
                origMac: d.MACAddress
              };
              iI_arr.push(`<Instance><ParaName>MACAddress</ParaName><ParaValue>${escapeHTML(m)}</ParaValue><ParaName>IPAddress</ParaName><ParaValue>${d.IPAddress||""}</ParaValue><ParaName>AliasName</ParaName><ParaValue>${escapeHTML(bN)}</ParaValue><ParaName>HostName</ParaName><ParaValue>${escapeHTML(bN)}</ParaValue><ParaName>Interface</ParaName><ParaValue>${escapeHTML(bI)}</ParaValue><ParaName>UpRate</ParaName><ParaValue>${d.UploadSpeed||0}Kbps</ParaValue><ParaName>DownRate</ParaName><ParaValue>${d.DownloadSpeed||0}Kbps</ParaValue><ParaName>UpThroughput</ParaName><ParaValue>${(+d.BytesSend || 0) * 0.001}</ParaValue><ParaName>DownThroughput</ParaName><ParaValue>${(+d.BytesReceived || 0) * 0.001}</ParaValue><ParaName>OnlineDuration</ParaName><ParaValue>${+(d.OnlineTime || d.OnlineTimes || 0)}</ParaValue></Instance>`);
            }
          });
          window.gegeHiddenDevices = nHD;
          lT = `<ajax_response_xml_root><OBJ_CLIENTS_ID>${iI_arr.join('')}</OBJ_CLIENTS_ID></ajax_response_xml_root>`;
          lF = mA.sort().join('|'); // MAC 已在上面的循环里取好，不再对拼出来的串跑正则
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
      // ---- 3. 设备集合变化时，用官方拓扑接口核对 Mesh 子节点数量，必要时拉一次大包 ----
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
            else if (mDC !== Object.values(window.gegeHiddenDevices).reduce((n, d) => n + (d?.mesh ? 1 : 0), 0)) await getBigLan(); // 数量对不上：拉一次大包重新识别
            if (!Object.keys(window.gegeHiddenDevices).length) document.getElementById('gege-mesh-badge')?.remove();
          }
        }
        else {
          window.gegeLastDevCount = cDC;
          window.gegeLastLanFingerprint = lF;
        }
      }
      // ---- 4. 逐个“狙击”隐藏设备：用按 MAC 查询的详情接口补上它们的速率，并入设备列表文本 ----
      if (CONFIG.forceMeshMode !== 2) {
        let hM = Object.keys(window.gegeHiddenDevices ?? {});
        if (hM.length > 0) {
          let iI_arr = [];
          for (let m of hM) {
            try {
              const mt = window.gegeHiddenDevices[m];
              if (!mt?.origMac) continue;
              const sR = await fetch(`/?_type=vueData&_tag=localnet_lan_detailinfo_lua&MACAddress=${encodeURIComponent(mt.origMac)}&_=${Date.now()}`);
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
      // ---- 5. 交付：更新 LAN 缓存，并（需要时）带着预取的 WAN 文本触发一次采样 ----
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
  
  // ---[S]------------------------ 保活与启动 ------------------------
  // 每 12 分钟在隐藏 iframe 里随机打开一个官方页面，避免登录会话超时；iframe 12 秒后销毁
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
  setInterval(tKA, 720000); // 保活：不在首帧触发，首次在 12 分钟后；对不兼容的设备，保活 URL 会直接显示 404/Forbidden，推迟后故障不再一开机就糊脸
  window.addEventListener('load', () => {
    setTimeout(() => { // 兜底：加载一分钟后，若官方页面一次相关 XHR 都没触发过引擎，就主动启动
      if (!window.gegeTimerStarted && window.startGegePrecisionEngine) window.startGegePrecisionEngine();
    }, 60000);
    // 悬浮按钮：强制模式；或 injectMode > 0 且访问的是常见网关地址（x.x.x.0~5 或 zte.home）
    if (CONFIG.injectMode === 3 || CONFIG.injectMode > 0 && /\.[0-5]$|^zte\.home$/.test(location.hostname)) {
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