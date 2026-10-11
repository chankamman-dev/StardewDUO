/* Performance log for the real device. Once a minute one line says what the lower screen did:
   pages shown, what was rebuilt (by section), requests, stream frames and how late they arrived,
   render cost and delay, long tasks, pixel-text redraws. Page changes and script errors get a line
   of their own. The App writes the lines to its own files directory (ThorCommands.perfLog; pull
   with tools/thor-report.cjs); in a browser preview the last lines stay in memory (PerfLog.lines()).
   Counts and timings only: no save data, pairing key or request bodies. */
(()=>{'use strict';
const native=!!(window.ThorCommands&&typeof ThorCommands.perfLog==='function'),kept=[];
const now=()=>performance.now(),round=v=>v==null?null:Math.round(v*10)/10;
const pct=(list,p)=>{if(!list.length)return null;const s=list.slice().sort((a,b)=>a-b);return round(s[Math.min(s.length-1,Math.floor(p*s.length))]);};
const top=(map,n)=>Object.fromEntries(Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,n));
const where=()=>typeof page==='string'?page:'?';
let w=fresh(),errorsThisMinute=0,lastPage=null,arrived=null,font=null;
function fresh(){return {start:now(),visible:0,pages:{},rebuilds:{},parts:{},textRedraws:0,requests:{},failed:0,requestMs:[],frames:{},docs:{},late:[],gameAge:[],renders:0,renderMs:[],renderDelay:[],longTasks:0,longMs:0,longMax:0};}
function write(kind,data){const text=JSON.stringify({at:new Date().toISOString(),kind,...data});
 if(native){try{ThorCommands.perfLog(text);}catch{}}else{kept.push(text);if(kept.length>300)kept.shift();}}
// Page time, sampled once a second while the screen is visible; a line when the page changes.
setInterval(()=>{if(document.hidden)return;const p=where();w.visible++;w.pages[p]=(w.pages[p]||0)+1;if(p!==lastPage){write('page',{page:p,from:lastPage});lastPage=p;}},1000);
// Rebuilds: nodes added or removed, by the nearest element with an id. Pixel text swapping its own
// raster is counted apart (a redraw of the same words, not a rebuild). "parts" names the kind of node
// changed (its first class), so a log says what was rebuilt, not only where.
new MutationObserver(records=>{for(const r of records){if(!r.addedNodes.length&&!r.removedNodes.length)continue;const t=r.target;if(t.nodeType!==1)continue;
 if(r.addedNodes[0]?.classList?.contains('raster-copy')){w.textRedraws++;continue;}
 let id='body';for(let e=t;e&&e!==document.body;e=e.parentElement)if(e.id){id=e.id;break;}
 const key=where()+' #'+id;w.rebuilds[key]=(w.rebuilds[key]||0)+1;
 const n=r.addedNodes[0]||r.removedNodes[0],part='#'+id+' '+(n.nodeType===1?(n.classList[0]||n.tagName.toLowerCase()):'text');w.parts[part]=(w.parts[part]||0)+1;}}).observe(document.body,{childList:true,subtree:true});
// Requests to the game, by path (no query string): count, failures, time to answer.
const realFetch=window.fetch.bind(window);
window.fetch=function(input,init){const url=typeof input==='string'?input:input?.url||'';const m=/^(?:https?:\/\/[^/]+)?\/bridge\/([^?]*)/.exec(url);
 if(!m)return realFetch(input,init);const name=m[1].replace(/^(asset|localmap\/blob)\/[0-9a-f]+$/,'$1').replace(/^receipt\/[0-9a-f]+$/,'receipt'),t=now();w.requests[name]=(w.requests[name]||0)+1;
 return realFetch(input,init).then(r=>{w.requestMs.push(now()-t);if(!r.ok)w.failed++;return r;},e=>{if(e?.name!=='AbortError')w.failed++;throw e;});};
// Stream frames (stream.js calls this per frame): topic changes and how long after the change they
// arrived (the mod stamps when the topic changed, same device clock), document notices, heartbeats.
function frame(f){const t=f?.t;if(typeof t!=='string')return;w.frames[t]=(w.frames[t]||0)+1;
 if(t==='doc'&&typeof f.n==='string')w.docs[f.n]=(w.docs[f.n]||0)+1;
 if(t==='hb'&&Number.isFinite(f.age))w.gameAge.push(f.age);
 if(Number.isFinite(f.at)&&f.at>0){w.late.push(Math.max(0,Date.now()-f.at));if(arrived==null)arrived=now();}}
// Render: how often, how long, and how long after a topic frame arrived the screen was redrawn.
const baseRender=window.render;
if(typeof baseRender==='function')window.render=function(...args){const t=now();try{return baseRender.apply(this,args);}finally{const d=now()-t;w.renders++;w.renderMs.push(d);if(arrived!=null){w.renderDelay.push(now()-arrived);arrived=null;}}};
// Main-thread tasks over 50 ms (what the player feels as a stuck lower screen).
try{new PerformanceObserver(list=>{for(const e of list.getEntries()){w.longTasks++;w.longMs+=e.duration;w.longMax=Math.max(w.longMax,e.duration);}}).observe({type:'longtask'});}catch{}
// Script errors: a line each, at most 20 a minute.
function error(message){if(errorsThisMinute++>=20)return;write('error',{page:where(),message:String(message||'').slice(0,240)});}
window.addEventListener('error',e=>error(e.message+(e.filename?' @'+e.filename.split('/').pop()+':'+e.lineno:'')));
window.addEventListener('unhandledrejection',e=>error('promise: '+(e.reason?.message||e.reason)));
function flush(reason){const d=w;w=fresh();errorsThisMinute=0;if(!d.visible&&!d.renders&&!Object.keys(d.requests).length)return;
 const fs=window.GameFont?.stats?.(),fontDelta=fs&&font?{drawn:fs.drawn-font.drawn,reused:fs.reused-font.reused,ms:round(fs.ms-font.ms)}:null;font=fs?{...fs}:font;
 write('minute',{reason,seconds:Math.round((now()-d.start)/1000),visible:d.visible,pages:d.pages,status:model?.status?.(now()),app:window.APP_VERSION,mod:model?.modVersion,
  rebuilds:top(d.rebuilds,8),parts:top(d.parts,6),textRedraws:d.textRedraws,font:fontDelta,
  requests:top(d.requests,10),failed:d.failed,requestMs:{p50:pct(d.requestMs,.5),p95:pct(d.requestMs,.95),max:pct(d.requestMs,1)},
  frames:d.frames,docs:d.docs,lateMs:{p50:pct(d.late,.5),p95:pct(d.late,.95),max:pct(d.late,1)},gameAgeMs:{p95:pct(d.gameAge,.95),max:pct(d.gameAge,1)},
  renders:d.renders,renderMs:{p95:pct(d.renderMs,.95),max:pct(d.renderMs,1)},renderDelayMs:{p50:pct(d.renderDelay,.5),p95:pct(d.renderDelay,.95),max:pct(d.renderDelay,1)},
  longTasks:d.longTasks,longMs:Math.round(d.longMs),longMax:Math.round(d.longMax),heapMB:performance.memory?Math.round(performance.memory.usedJSHeapSize/1048576):null});}
setInterval(()=>flush('minute'),60000);
document.addEventListener('visibilitychange',()=>{if(document.hidden)flush('hidden');else write('visible',{page:where()});});
write('start',{app:window.APP_VERSION,native,screen:[innerWidth,innerHeight,devicePixelRatio],agent:navigator.userAgent.slice(0,160)});
window.PerfLog={frame,flush,lines:()=>kept.slice()};
})();
