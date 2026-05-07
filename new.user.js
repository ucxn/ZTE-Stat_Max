// ==UserScript==
// @name         中兴路由器(ZTE) 增强
// @name:en      ZTE-Stat_Max
// @namespace    ucxn
// @version      5.9.7
// @description  QQ群 680464365 【B站 https://b23.tv/BV1PtR7B8ECC】
// @description:en https://github.com/ucxn/ZTE-Stat_Max
// @author       哥哥科技
// @noframes
// @include      http://10.*.*.*
// @match        http://192.168.*.*
// @match        http://zte.home*
// @grant        none
// @license      GPL-3.0-or-later
// @include      http://172.16.*
// @updateURL    https://update.greasyfork.org/scripts/576199/%E4%B8%AD%E5%85%B4%E8%B7%AF%E7%94%B1%E5%99%A8%28ZTE%29%20%E5%A2%9E%E5%BC%BA.meta.js
// @downloadURL  https://github.com/ucxn/ZTE-Stat_Max/raw/refs/heads/main/new.user.js

// ==/UserScript==

(function() {
    'use strict';

    console.log("🚀 哥哥科技 V5.9.5B 终极引擎已装载...");

    function escapeHTML(str) {
        if (!str) return '';
        return String(str).replace(/[&<>'"]/g, function(match) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[match];
        });
    }

    // ======== [0] 用户极客环境变量配置区 ========
    const CONFIG = {
        routerIP: "192.168.5.1", // 路由器内网 IP
        injectMode: 1, // 【UI注入模式】 0: 原生侧边栏(1min)| 1: 优先，10秒悬浮舱(D)| 2: 强制模式(30秒后强制霸屏)
        calcMode: 1, // 1: 上行/下行倍数模式, 0: 上行占总和比例模式
        ratioExtremeUp: 10,// 极端上传判定阈值 (> 1000%)
        ratioWarnUp: 0.07,// 重度上传警告阈值 (> 7%)
        ratioExtremeDown: 0.01, // 极端下载判定阈值 (< 1%)
        ratioThreshold: 7, // (仅calcMode=0时有效) 上传占比报警阈值(%)
        readSaveData: 1,// 【开关切换】 1: 读档模式(继承本次历史量) | 0: 新局模式(从打开网页此刻归零重新计流)
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

    const S={lt:0,wInstUp:0,wInstDn:0,wTotUp:0,wTotDn:0,cls:{}};let isF=!1,pr=new DOMParser(),lCxt=null;const oOp=XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open=function(){this.
    addEventListener('load',function(){try{if(this.responseType===''||
                                              this.responseType==='text'){let t=this.responseText;if(t&&(t.includes('<OBJ_CLIENTS_ID>')||t.includes('<OBJ_HOME_BASICINFO_ID>'))){
        if(t.includes('<OBJ_CLIENTS_ID>'))lCxt=t;if(window.startGegePrecisionEngine)
            window.startGegePrecisionEngine();}}}catch(e){}});
                                             oOp.apply(this,arguments);};function s2b(s){if(!s)return 0;let m=s.match(/([\d.]+)\s*(G|M|K)?bps/i);return m?parseFloat(m[1])*(m[2]?.toUpperCase()==='G'?1e9:m[2]?.toUpperCase()==='M'?1e6:m[2]?.toUpperCase()==='K'?1e3:1):0;}function fB(b){return b>=1e6?(b/1e6).toFixed(3)+' Mbps':b>=1e3?(b/1e3).toFixed(2)+' Kbps':Math.round(b)+' bps';}function fBy(b){return(b/=8)>=1048576?(b/1048576).toFixed(3)+' MiB/s':b>=1024?(b/1024).toFixed(2)+' KiB/s':Math.round(b)+' B/s';}function fV(b){return(b/=8)>=1073741824?(b/1073741824).toFixed(3)+' GiB':b>=1048576?(b/1048576).toFixed(2)+' MiB':b>=1024?(b/1024).toFixed(1)+' KiB':Math.round(b)+' B';}function fVD(i,o){let b=i/8,ob=o/8;return b>=1073741824?(b/1073741824).toFixed(3)+' | '+(ob/1073741824).toFixed(4)+' GiB':b>=1048576?(b/1048576).toFixed(2)+' | '+(ob/1048576).toFixed(3)+' MiB':b>=1024?(b/1024).toFixed(2)+' | '+(ob/1024).toFixed(1)+' KiB':Math.round(b)+' | '+Math.round(ob)+' B';}function fSV(b){return(b/=8)>=1073741824?(b/1073741824).toFixed(3)+'G':b>=1048576?(b/1048576).toFixed(2)+'M':b>=1024?(b/1024).toFixed(1)+'K':Math.round(b)+'B';}function nM(m){return m?m.toLowerCase().replace(/-/g,':').replace(/\s/g,''):'';}function pI(n){let o=Object.create(null),c=n.children;for(let i=0;i<c.length;i++){if(c[i].tagName==="ParaName"){let k=c[i].textContent,v="",j=i+1;while(j<c.length&&c[j].tagName!=="ParaName"){if(c[j].tagName==="ParaValue"){v=c[j].textContent;i=j;break;}j++;}o[k]=v;}}return o;}const st=document.createElement('style');
    st.innerHTML=`/* `+` */.config-item{`+
        `clear:both;}.config-item-box{display:flex!important;`+
        `align-items:stretch!important;padding-bottom:`+
        `12px!important;}.config-item .logo{width:33%!important;`+
        `float:none!important;display:flex!important;flex-direction:row;}.config-item .dev-intro{flex:1;display:flex!important;flex-direction:column;justify-content:flex-start;min-height:100px;padding-bottom:0!important;margin-bottom:0!important;}.config-item .info{width:27%!important;float:none!important;display:flex!important;flex-direction:column;justify-content:flex-start;padding:0 10px!important;border-right:1px solid #eee;}.config-item .speed{width:40%!important;float:none!important;display:flex!important;flex-direction:column;justify-content:center;padding:0 10px!important;}.geek-row{display:flex;justify-content:space-between;align-items:center;white-space:nowrap;height:20px;}.geek-label{width:110px;color:#333;font-weight:bold;}.geek-val-box{flex:1;display:flex;gap:15px;margin-left:10px;}.geek-fixed-width{display:inline-block;width:120px;}.geek-right-box{text-align:right;min-width:220px;font-weight:bold;}.c-up{color:#ff4c00;}.c-down{color:#0059fa;}.gege-up-box,.gege-down-box{margin-top:auto!important;margin-bottom:0!important;width:95%;}.gege-ratio-box{margin-top:10px;width:95%;margin-bottom:5px;}.t-row{font-size:12px;font-weight:bold;margin-bottom:2px;display:flex;justify-content:space-between;font-family:Consolas;}.zte-thin-bar{width:100%;height:3px;background:rgba(0,0,0,0.05);border-radius:1.5px;overflow:hidden;}.zte-thin-bar-inner{height:100%;transition:width 0.5s ease-out;}.zte-thin-bar-inner.up{background:#ff4c00;}.zte-thin-bar-inner.down{background:#0059fa;}.gege-ratio-top{display:flex;justify-content:space-between;font-size:12px;font-weight:bold;margin-bottom:2px;}.gege-ratio-bar{width:100%;height:4px;background:#0059fa;border-radius:2px;overflow:hidden;}.gege-ratio-bar-inner{height:100%;background:#ff4c00;transition:width 0.5s ease-out;}.zte-enhance-speed{display:flex;flex-direction:column;gap:6px;width:100%;font-family:Consolas;}.zte-bar-wrap{position:relative;width:100%;border-radius:4px;border:1px solid;font-size:13px;font-weight:bold;overflow:hidden;padding:3px 8px;display:flex;justify-content:space-between;align-items:center;z-index:1;box-sizing:border-box;}.zte-bar-wrap span{font-size:inherit;font-weight:inherit;}.zte-bar-up{color:#ff4c00;border-color:rgba(255,76,0,0.3);}.zte-bar-down{color:#0059fa;border-color:rgba(0,89,250,0.3);}.zte-bar-up::before{content:'';position:absolute;left:0;top:0;bottom:0;z-index:-1;background:rgba(255,76,0,0.12);width:var(--p-up,0%);transition:width 0.5s;}.zte-bar-down::before{content:'';position:absolute;left:0;top:0;bottom:0;z-index:-1;background:rgba(0,89,250,0.12);width:var(--p-down,0%);transition:width 0.5s;}#config-list.gege-list-container{background-color:#ffffff!important;border-radius:8px!important;border:1px solid #e0e0e0!important;padding:20px 30px!important;box-shadow:0 2px 10px rgba(0,0,0,0.02)!important;margin-top:10px!important;}.gege-section{margin-bottom:10px;}.gege-section:last-child{margin-bottom:0;}.gege-list-container .config-title{font-size:16px!important;font-weight:bold!important;color:#333!important;margin:15px 0 10px 0!important;padding-bottom:5px!important;}.gege-list-container .gege-section:first-child .config-title{margin-top:0!important;}.gege-empty-state{color:#999!important;font-size:14px!important;padding:0 0 15px 5px!important;border-bottom:1px solid #f0f0f0!important;margin-bottom:5px!important;}.gege-list-item{background-color:transparent!important;border-bottom:1px solid #f0f0f0!important;padding:15px 10px!important;margin-bottom:0!important;border-radius:0!important;}.gege-list-item:last-child{border-bottom:none!important;}#zte-geek-board{background-color:transparent!important;border-left:4px solid #0059fa!important;border-radius:0!important;padding:5px 0 5px 15px!important;margin:10px 0 15px 0!important;box-shadow:none!important;border-bottom:1px solid #f0f0f0!important;font-size:14px;display:flex;flex-direction:column;gap:6px;padding-bottom:15px!important;}`;document.
        head.
        appendChild(st);window.gegeRenderedMacs=new Set();async function rSD(pWT=null,sT=null){if(
            isF&&!pWT)return;isF=!0;let n,wX;try{if(pWT){wX=pr.parseFromString(pWT,
                                                                               "text/xml");n=sT||performance.now();}else{const wR=await fetch(`/?_type=vueData&_tag=vue_home_device_data_no_update_sess&IF_OP=refresh&_=${Date.now()}`);if(
            !wR.ok)return;const wT=await wR.text();n=performance.now();if(!wT.includes('<OBJ_HOME_BASICINFO_ID>'))return;wX=pr.parseFromString(
            wT,"text/xml");}let cX=lCxt?pr.parseFromString(lCxt,"text/xml"):null;const bIN=wX.querySelector(
            "OBJ_HOME_BASICINFO_ID Instance"),wI=bIN?pI(bIN):{},cWU=s2b(wI.WANUpRate),cWD=s2b(
            wI.WANDownRate),cI=Object.create(null);let cSU=0,cSD=0;(cX?.querySelectorAll("OBJ_CLIENTS_ID Instance")||[]).forEach(nd=>{let d=pI(
            nd);if(d.MACAddress){let m=nM(d.MACAddress),u=s2b(d.UpRate),dn=s2b(d.DownRate),uT=(
            parseFloat(d.UpThroughput)||0)*8000,dT=(parseFloat(d.DownThroughput)||0)*8000;cI[m]={upRate:u,dnRate:dn,iface:
                                                                                                 d.Interface||"",offUp:uT,offDn:dT};cSU+=u;cSD+=dn;}});let ol=document.getElementById('gege-global-overlay'),cM=Object.keys(
            cI),iD=window.gegeForceUIRedraw||(cM.length!==window.gegeRenderedMacs.size);if(!iD&&cM.length>0){for(let i=0;i<
                                                                                                                 cM.length;i++){if(!window.gegeRenderedMacs.has(cM[i])){iD=!0;break;}}}let iDW=ol&&ol.style.display==='block'&&!ol.querySelector(
            '.gege-list-item');if(ol&&ol.style.display==='block'&&(iD||iDW)){bVD(ol,cX);window.gegeRenderedMacs=new Set(
            cM);window.gegeForceUIRedraw=!1;}if(S.lt!==0){let dt=(n-S.lt)/1000;S.wTotUp+=((S.wInstUp+cWU)/2)*dt;S.wTotDn+=((
            S.wInstDn+cWD)/2)*dt;for(let m in cI){if(!S.cls[m]){S.cls[m]={upR:0,dnR:0,intUp:0,intDn:0,uB:
                                                                          CONFIG.readSaveData===1?0:cI[m].offUp,dB:CONFIG.readSaveData===1?0:cI[m].offDn,lU:cI[m].offUp,lD:cI[m].offDn};}let cS=S.cls[m],cC=cI[
                                                                              m],dU=cC.offUp-cS.lU,dD=cC.offDn-cS.lD;if(dU<0||dU>2.4e9)cS.uB+=dU;if(dD<0||dD>2.4e9)cS.dB+=
                                                                                  dD;cS.lU=cC.offUp;cS.lD=cC.offDn;cS.intUp+=((cS.upR+cC.upRate)/2)*dt;cS.intDn+=((cS.dnR+cC.dnRate)/2)*dt;cS.upR=cC.upRate;cS.dnR=
                                                                                      cC.dnRate;}}S.lt=n;S.wInstUp=cWU;S.wInstDn=cWD;rUI(cWU,cWD,cSU,cSD,cI);}catch(e){}finally{isF=!1;}}function rUI(wU,wD,sU,sD,cI){let tOU=
                                                                                          0,tOD=0;for(let m in cI){tOU+=cI[m].offUp||0;tOD+=cI[m].offDn||
                                                                                              0;}let ol=document.getElementById('gege-global-overlay'),iPO=ol&&ol.style.display==='block',aC=
                                                                                                  iPO?ol:document;for(let m in cI){let it=null;if(
                                                                                                      iPO){it=aC.querySelector(`.gege-list-item[data-gege-mac="${m}"]`);}else{let aI=aC.querySelectorAll(
                                                                                                      '.config-item');for(let n of aI){if(n.textContent.toLowerCase().includes(
                                                                                                      m)){it=n;break;}}}if(!it)continue;const cC=cI[m]||{upRate:0,dnRate:0,iface:"",offUp:0,offDn:0},cS=
                                                                                                        S.cls[m]||{intUp:0,intDn:0};const dI=it.querySelector('.dev-intro');if(dI){let bx=dI.querySelector(
                                                                                                            '.gege-up-box');if(!bx){bx=document.createElement('div');bx.className='gege-up-box';bx.innerHTML=`<div `+
                                                                                                            `class="t-row c-up"><span>↑ <span `+
                                                                                                            `class="v-vol"></span></span><span `+
                                                                                                            `class="v-pct"></span></div><div `+
                                                                                                            `class="zte-thin-bar"><div `+
                                                                                                            `class="zte-thin-bar-inner up"></div></div>`;dI.
                                                                                                            appendChild(bx);}let p=tOU>0?((cC.offUp||0)/tOU*100).toFixed(1):0.0;bx.querySelector('.v-vol').textContent=
                                                                                                                fVD(cS.intUp,cC.offUp);bx.querySelector('.v-pct').textContent=p+'%';bx.querySelector(
                                                                                                                '.zte-thin-bar-inner').style.width=Math.min(p,100)+'%';}const inf=it.querySelector('.info');if(
                                                                                                                inf){Array.from(inf.querySelectorAll('.dev-ip:not(.gege-box *)')).slice(1).forEach(n=>{n.style.display='none';});inf.querySelectorAll(
                                                                                                                '.dev-number:not(.gege-box *)').forEach(n=>{n.style.display='none';});let rB=inf.querySelector('.gege-ratio-box');if(
                                                                                                                !rB){rB=document.createElement('div');rB.className='gege-ratio-box';rB.innerHTML=`<div class="gege-ratio-top"><span class="v-port"></span><span class="v-interval" style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight: normal; font-size: 12.5px; opacity: 0.75; letter-spacing: 0.5px;"><span class="c-up"></span><span style="color:#666; margin:0 3px;">，</span><span class="c-down"></span></span><span class="v-rt-pct"></span></div><div class="gege-ratio-bar"><div class="gege-ratio-bar-inner"></div></div>`;inf.
                                                                                                            appendChild(rB);}let hqU=Math.max(0,cC.offUp-(cS.uB||0)),hqD=Math.max(0,cC.offDn-(cS.dB||0)),bR=(hqU+hqD)>0?(hqU/(hqU+hqD)*100):0,tC="",tCol="#0059fa";if(
                                                                                                                CONFIG.calcMode===1){let rt=hqD>0?(hqU/hqD):(hqU>0?Infinity:0);if(rt>CONFIG.ratioExtremeUp){tCol='#ff4c00';tC=(rt===Infinity?'∞':rt.toFixed(2))+'⚠️';}else if(
                                                                                                                rt>CONFIG.ratioWarnUp){tCol='#ff4c00';tC=(rt*100).toFixed(1)+'%';}else if(rt>=CONFIG.ratioExtremeDown){tCol='#0059fa';tC=(rt*100).toFixed(1)+'%';}else{tCol='#0059fa';let rRt=hqU>0?(hqD/hqU):(hqD>0?Infinity:0);tC=(
                                                                                                                rRt===Infinity?'∞':rRt.toFixed(1))+'x';}}else{tCol=bR>CONFIG.ratioThreshold?'#ff4c00':'#0059fa';tC=bR.toFixed(1)+'%';}rB.querySelector(
                                                                                                                '.v-port').textContent=CONFIG.portMap[cC.iface]||cC.iface||"未知";rB.querySelector('.v-interval .c-up').textContent=''+fSV(hqU);rB.querySelector('.v-interval .c-down').textContent=''+
                                                                                                                fSV(hqD);let rtP=rB.querySelector('.v-rt-pct');rtP.textContent=tC;rtP.style.color=tCol;rB.querySelector(
                                                                                                                '.gege-ratio-bar-inner').style.width=Math.min(bR,100)+'%';let dBx=inf.querySelector('.gege-down-box');if(!dBx){dBx=document.createElement('div');dBx.className='gege-down-box';dBx.innerHTML=`<div class="t-row c-down"><span>↓ <span class="v-vol"></span></span><span class="v-pct"></span></div><div class="zte-thin-bar"><div class="zte-thin-bar-inner down"></div></div>`;inf.
                                                                                                            appendChild(dBx);}let dp=tOD>0?((cC.offDn||0)/tOD*100).toFixed(1):0.0;dBx.querySelector('.v-vol').textContent=fVD(cS.intDn,cC.offDn);dBx.querySelector('.v-pct').textContent=dp+'%';dBx.querySelector(
                                                                                                                '.zte-thin-bar-inner').style.width=Math.min(dp,100)+'%';}const sp=it.querySelector('.speed');if(sp){sp.querySelectorAll(
                                                                                                                '.connect-up, .connect-down').forEach(n=>{n.style.display='none';});let enh=sp.querySelector('.zte-enhance-speed');if(!enh){enh=document.createElement(
                                                                                                                'div');enh.className='zte-enhance-speed';enh.innerHTML=`<div class="zte-bar-wrap zte-bar-up"><span class="v-val"></span><span class="v-pct"></span></div><div class="zte-bar-wrap zte-bar-down"><span class="v-val"></span><span class="v-pct"></span></div>`;sp.
                                                                                                            appendChild(enh);}let pu=sU>0?(cC.upRate/sU*100):0,pd=sD>0?(cC.dnRate/sD*100):0,bU=enh.querySelector(
                                                                                                                '.zte-bar-up'),bD=enh.querySelector('.zte-bar-down');bU.style.setProperty('--p-up',Math.min(pu,100)+'%');bU.querySelector(
                                                                                                                '.v-val').textContent=`🔼 ${fBy(cC.upRate)}`;bU.querySelector('.v-pct').textContent=(wU>0?pu.toFixed(1):0.0)+'%';bD.style.setProperty(
                                                                                                                '--p-down',Math.min(pd,100)+'%');bD.querySelector('.v-val').textContent=`🔽 ${fBy(cC.dnRate)}`;bD.querySelector('.v-pct').textContent=(wD>0?pd.toFixed(1):0.0)+'%';}}}async function bVD(ol,cX){try{let mB=(window.gegeHiddenDevices&&
    Object.keys(window.gegeHiddenDevices).length>0)?'<span style="color: #ff4c00; font-size: 13px; font-weight: normal; margin-left: 10px; font-family: Consolas;">(哥哥科技：智能Mesh适配)</span>':'',h2='',h52='',h58='',hW='';(
                                                                                                                cX?.querySelectorAll("OBJ_CLIENTS_ID Instance")||[]).forEach(i=>{let d=pI(i);if(!d.MACAddress)return;let m=
                                                                                                                nM(d.MACAddress),ip=escapeHTML(d.IPAddress||''),nm=escapeHTML(
                                                                                                                    d.AliasName||d.HostName||'未知设备'),ifc=d.Interface||'',htm=`<div class="col-md-12 col-xs-12 config-item gege-list-item" data-gege-mac="${m}"><div `+
                                                                                                                `class="config-item-box" style="display: flex; align-items: stretch;"><div `+
                                                                                                                `class="col-md-5 col-xs-7 logo" style="width: 33%; display: flex; flex-direction: row; align-items: center;"><div `+
                                                                                                                `class="dev-logo" style="width: 50px; height: 50px; min-width: 50px; margin-right: 15px; background: url('/jquery/static/img/home/unknown_computer.png') 0% 0% / 50px no-repeat; display: inline-block;"></div><div `+
                                                                                                                `class="dev-intro" style="flex: 1; display: flex; flex-direction: column; justify-content: flex-start; min-height: 100px;"><div `+
                                                                                                                `class="dev-name" style="font-weight: bold; color: #333; font-size: 14px;">${nm}</div></div></div><div `+
                                                                                                                `class="col-md-4 col-xs-5 info" style="width: 27%; display: flex; flex-direction: column; padding: 0 10px; border-right: 1px solid #eee;"><div `+
                                                                                                                `class="dev-ip" style="color: #666; font-family: Consolas;">${ip}</div><div `+
                                                                                                                `class="dev-number grey" style="color: #999; font-size: 12px; font-family: Consolas;">MAC：${m}</div></div><div `+
                                                                                                                `class="col-md-3 col-xs-12 speed" style="width: 40%; display: flex; flex-direction: column; justify-content: center; padding: 0 10px;"></div></div></div>`;if(['wl0','wlan0','wlan1','wl1'].includes(ifc))h2+=
                                                                                                                    htm;else if(['wlan5','wl4','wlan4','wl3','wlan3'].includes(ifc))h52+=
                                                                                                                        htm;else if(ifc==='wl2'||ifc==='wlan2'||ifc==='wl5'||(/w/i.test(ifc)&&!/wan/i.test(ifc)))h58+=
                                                                                                                            htm;else hW+=htm;});ol.innerHTML=`<div `+
                                                                                                                `style="padding: 20px; max-width: 1200px; margin: 0 auto; min-height: 100%;"><div id="config-list" class="config-list gege-list-container"><div `+
                                                                                                                `class="gege-section"><div class="config-title">无线设备（2.4GHz）</div>${h2||'<div class="gege-empty-state">没有连接设备</div>'}</div><div `+
                                                                                                                `class="gege-section"><div class="config-title">无线设备（5.2GHz）</div>${h52||'<div class="gege-empty-state">没有连接设备</div>'}</div><div `+
                                                                                                                `class="gege-section"><div class="config-title">无线设备（5.8GHz）</div>${h58||'<div class="gege-empty-state">没有连接设备</div>'}</div><div `+
                                                                                                                `class="gege-section"><div class="config-title">有线设备${mB}</div>${hW||'<div class="gege-empty-state">没有连接设备</div>'}</div></div></div>`;}catch(
                                                                                                                    e){ol.innerHTML=`<div style="padding: 20px; color: red;">数据渲染失败: ${escapeHTML(e.message)}</div>`;}}window.createGegeFloatingBtn=function(){if(document.getElementById('gege-floating-btn'))return;let b=
                                                                                                                        document.createElement('div');b.id='gege-floating-btn';b.innerHTML='🛸';b.style.cssText=`position: fixed; `+
                                                                                                                            `top: 20px; right: 20px; width: 50px; height: 50px; background: `+
                                                                                                                            `linear-gradient(135deg, #0059fa, #00c6ff); color: white; border-radius: 50%; display: flex; `+
                                                                                                                            `align-items: center; justify-content: center; font-size: 48px; box-shadow: 0 4px 15px rgba(0,89,250,0.5); `+
                                                                                                                            `cursor: pointer; z-index: 99999; transition: all 0.3s ease; user-select: none;`;b.
                                                                                                                            onmouseover=()=>{b.style.transform='scale(1.1) rotate(15deg)';};b.onmouseout=()=>{b.style.transform=
                                                                                                                                'scale(1) rotate(0deg)';};b.onclick=()=>window.gegeTogglePanel();document.body.appendChild(b);};window.gegeTogglePanel=function(fS=null){let o=document.getElementById('gege-global-overlay'),iCO=
                                                                                                                                    o&&o.style.display==='block',tS=fS!==null?fS:!iCO,aT=document.querySelector(
                                                                                                                                        '#gege-menu-wrapper a'),lT=document.querySelector('#gege-menu-wrapper li');if(!tS){if(lT){lT.classList.remove(
                                                                                                                                        'is-active');lT.style.color='rgb(255, 255, 255)';}if(o)o.style.display='none';return;}if(aT&&
    lT){aT.classList.add('router-link-exact-active','router-link-active');lT.classList.add('is-active');lT.style.color=
                                                                                                                                        'rgb(61, 163, 247)';}if(!o){o=document.createElement('div');o.id='gege-global-overlay';let pT=document.querySelector(
                                                                                                                                            '.page-top');if(pT){pT.parentNode.style.position='relative';o.style.cssText=`position: `+
                                                                                                                                            `absolute; top: 0; left: 0; width: 100%; min-height: 100%; height: 100%; background: #f3f4f5; `+
                                                                                                                                            `z-index: 9999; overflow-y: auto; padding-bottom: 50px;`;pT.parentNode.appendChild(o);}else{o.style.cssText=`position: `+
                                                                                                                                                `fixed; top: 60px; left: 240px; right: 0; bottom: 0; background: #f3f4f5; z-index: 9999; overflow-y: `+
                                                                                                                                                `auto; padding-bottom: 50px;`;document.body.appendChild(o);}}o.style.display='block';if(!window.
    gegeBActivated){window.gegeBActivated=!0;clearTimeout(window.gegeMasterTimer);window.gegeMasterTimer=setInterval(
                                                                                                                                                    eBET,1000);}bVD(o,lCxt?pr.parseFromString(lCxt,"text/xml"):null).then(()=>{if(window.gegeBActivated)eBET();else rSD();});};function iGM(){let mC=document.querySelector('.menu_items');if(!mC)return;let oD=mC.querySelector(
                                                                                                                                                    'div');if(!oD)return;let gW=oD.cloneNode(!0);gW.id='gege-menu-wrapper';let aT=gW.querySelector(
                                                                                                                                                    'a'),lT=gW.querySelector('li');if(aT){aT.href="javascript:void(0);";aT.classList.remove(
                                                                                                                                                    'router-link-exact-active','router-link-active');}if(lT){lT.classList.remove('is-active');let tS=
                                                                                                                                                    lT.querySelector('span');if(tS){const pT=(t,s)=>{let l=s.length,o=(l===6)?(l+9):15;return decodeURIComponent(
    escape(window.atob(t.substring(o).split('').reverse().join(''))));};const aM={'ZTE_LEGACY_WIRED':"ZTE_AUTH_TOKEN_/xK9vP2mQ5zL8wJ4nB7cT1fR",'ZTE_NEBULA_MAX':"ZTE_AUTH_TOKEN_/2p5i2Z6Aqo5Re65lOZ5lOZ5",'ZTE_GENERIC_OS':"ZTE_AUTH_TOKEN_/pM4aC7yX9kH3bV2rN6dW8qG"};const gHP=()=>{let m=
    Object.keys(aM).length,hI=(m<<2)-10;return Object.keys(aM)[hI^3];};tS.textContent=pT(aM[gHP()],tS.textContent);}lT.querySelectorAll(
        'img').forEach(i=>i.remove());let eS=document.createElement('span');eS.textContent='🚀';eS.style.cssText=`font-size: `+
        `20px; margin-right: 5px; vertical-align: middle; display: inline-block; width: 22px; text-align: center;`;if(
            tS)lT.insertBefore(eS,tS);lT.style.color='rgb(255, 255, 255)';}mC.appendChild(gW);document.
        addEventListener('click',function(e){let cW=e.target.closest('.menu_items > div');if(!cW)return;if(
            cW.id==='gege-menu-wrapper'){e.preventDefault();e.stopPropagation();let fB=document.getElementById(
            'gege-floating-btn');if(fB)fB.remove();window.gegeTogglePanel(!0);}else{window.
        gegeTogglePanel(!1);}},!0);}window.gegeBActivated=!1;window.gegeEngineRunning=!1;window.gegeLastDevCount=-1;window.gegeLastMeshDevCount=-1;window.gegeHiddenDevices={};window.gegeTimerStarted=!1;window.gegeSyncAnchor=0;window.gegeTickCount=0;window.gegeMasterTimer=null;window.startGegePrecisionEngine=function(){if(window.gegeTimerStarted||window.gegeBActivated)return;window.gegeTimerStarted=!0;window.gegeSyncAnchor=performance.now();window.gegeTickCount=0;window.scheduleNextGegeTick();};window.scheduleNextGegeTick=function(){if(window.gegeBActivated)return;window.gegeTickCount++;let dl=(window.gegeSyncAnchor+window.gegeTickCount*3000)-performance.now();if(dl<0){window.gegeSyncAnchor=performance.now();window.gegeTickCount=0;dl=3000;}window.gegeMasterTimer=setTimeout(()=>{rSD().finally(()=>{window.scheduleNextGegeTick();});},dl);};async function eBET(){if(window.gegeEngineRunning)return;window.
        gegeEngineRunning=!0;try{const ts=Date.now(),wR=await fetch(`/?_type=vueData&_tag=vue_home_device_data_no_update_sess&IF_OP=refresh&_=${ts}`);if(
            !wR.ok)throw new Error();const wT=await wR.text(),wST=performance.now();if(!wT.includes('<OBJ_HOME_BASICINFO_ID>'))throw new Error();const wX=
              pr.parseFromString(wT,"text/xml");let bIN=wX.querySelector("OBJ_HOME_BASICINFO_ID Instance"),wI=bIN?pI(bIN):{},cDC=parseInt(
                  wI.AccessDevNum);cDC=isNaN(cDC)?-1:cDC;const lR=await fetch(`/?_type=vueData&_tag=vue_client_data&_=${ts}`);let lT=await lR.text(),lF="";if(
                  lT.includes('<OBJ_CLIENTS_ID>')){let mL=[];pr.parseFromString(lT,"text/xml").querySelectorAll("OBJ_CLIENTS_ID Instance").forEach(ins=>{let d=
                  pI(ins);if(d.MACAddress)mL.push(d.MACAddress);});lF=mL.sort().join('|');}if(cDC!==window.gegeLastDevCount||lF!==window.gegeLastLanFingerprint){const tR=await fetch(
                  `/?_type=vueData&_tag=vue_topo_data&_=${ts}`);if(!tR.ok)throw new Error();let tJ=JSON.parse(await tR.text()),mDC=tJ.agentlay1?.reduce((s,a)=>s+(
                  parseInt(a.accdevCount)||0),0)||0;if(mDC!==window.gegeLastMeshDevCount){window.gegeLastMeshDevCount=mDC;window.
              gegeForceUIRedraw=!0;if(mDC>0){const liR=await fetch(`/?_type=vueData&_tag=localnet_lan_info_lua&_=${ts}`),liX=pr.parseFromString(await liR.text(),"text/xml");let nHD={};liX.querySelectorAll(
                  "OBJ_LAN_INFO_ID Instance").forEach(inst=>{let d=pI(inst);if(d.DevMeshType==='3'&&d.Active==='1'&&d.MACAddress){let m=nM(
                  d.MACAddress),bN=d.DevName||d.HostName||d.DisplayedPictureName||d.AliasName||"Mesh设备",bI=d.Interface||"";if(d.IFAliasName==='SSID1')bI='wl0';else if(
                  d.IFAliasName==='SSID5')bI='wl4';nHD[m]={name:bN,iface:bI,origMac:d.MACAddress};}});window.
              gegeHiddenDevices=nHD;}else{window.gegeLastMeshDevCount=0;window.gegeHiddenDevices={};}}window.gegeLastDevCount=cDC;window.gegeLastLanFingerprint=lF;}let hM=Object.keys(
                  window.gegeHiddenDevices??{});if(hM.length>0){let iI="";for(let m of hM){try{const mt=window.gegeHiddenDevices[m]||{};if(!mt||!mt.origMac)continue;const sR=await fetch(
                  `/?_type=vueData&_tag=localnet_lan_detailinfo_lua&MACAddress=${encodeURIComponent(mt.origMac||m)}&_=${Date.now()}`);if(!sR.ok)continue;const sI=pr.parseFromString(await sR.text(),
    "text/xml").querySelector("OBJ_LANINFO_BYMAC Instance");if(sI){let sD=pI(sI),uR=`${sD.UploadSpeed||0}Kbps`,dR=`${sD.DownloadSpeed||0}Kbps`,uT=((
                  parseFloat(sD.BytesSend)||0)/1000).toFixed(4),dT=((parseFloat(sD.BytesReceived)||0)/1000).toFixed(4);iI+=`<Instance><ParaName>MACAddress</ParaName><ParaValue>${escapeHTML(m)}</ParaValue><ParaName>IPAddress</ParaName><ParaValue>${sD.IPAddress||""}</ParaValue><ParaName>AliasName</ParaName><ParaValue>${escapeHTML(mt.name)}</ParaValue><ParaName>HostName</ParaName><ParaValue>${escapeHTML(mt.name)}</ParaValue><ParaName>Interface</ParaName><ParaValue>${escapeHTML(mt.iface)}</ParaValue><ParaName>UpRate</ParaName><ParaValue>${uR}</ParaValue><ParaName>DownRate</ParaName><ParaValue>${dR}</ParaValue><ParaName>UpThroughput</ParaName><ParaValue>${uT}</ParaValue><ParaName>DownThroughput</ParaName><ParaValue>${dT}</ParaValue></Instance>`;}}catch(
                  e){}}if(iI!=="")lT=lT.replace('</OBJ_CLIENTS_ID>',`${iI}</OBJ_CLIENTS_ID>`);}if(lT.includes(
                      '<OBJ_CLIENTS_ID>'))lCxt=lT;await rSD(wT,wST);}catch(e){}finally{window.gegeEngineRunning=!1;}}const tKA=()=>{let i=document.createElement('iframe');i.id='gege-keepalive-iframe';i.style.display='none';const p=["/#/sys","/#/app","/#/wlan/"];i.src=`${window.location.origin}${p[Math.floor(Math.random()*p.length)]}`;let z=document.getElementById('gege-keepalive-iframe');if(z)z.remove();document.body.appendChild(i);setTimeout(()=>{if(i.parentNode){i.src='about:blank';i.remove();}},12000);};setTimeout(tKA,2000);setInterval(tKA,720000);window.addEventListener('load',()=>{setTimeout(()=>{if(!window.gegeTimerStarted&&window.startGegePrecisionEngine)window.startGegePrecisionEngine();},60000);if(CONFIG.injectMode===1||CONFIG.injectMode===2){if(window.createGegeFloatingBtn)window.createGegeFloatingBtn();}if(CONFIG.injectMode===2){setTimeout(()=>{if(window.gegeTogglePanel)window.gegeTogglePanel(!0);},30000);}if(CONFIG.injectMode===0||CONFIG.injectMode===1){let dC=0;const mO=setInterval(()=>{let mC=document.querySelector('.menu_items div');if(mC){clearInterval(mO);iGM();}else if(++dC>200){clearInterval(mO);}},300);}});})();
