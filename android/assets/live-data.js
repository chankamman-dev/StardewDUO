/* On-demand bridge data (catalog, progress, collections, mods, events, bundles). A page asks for
   a resource while it renders; nothing is fetched otherwise, and asking stops when the page is
   left, hidden or paused, so the mod's matching lease lapses. Each resource keeps its last valid
   result: a building or invalid reply never replaces it. A valid empty result is meaningful.
   Paged resources are committed
   only when every page of one version and language has arrived. A new save clears everything. */
(()=>{'use strict';
const M=window.StardewModel;
const specs={
 progress:{url:'/bridge/progress',validate:M.validateProgress,every:5000},
 collections:{url:'/bridge/collections',validate:M.validateCollections,every:5000},
 mods:{url:'/bridge/mods',validate:M.validateMods,every:15000},
 bundles:{url:'/bridge/bundles',validate:M.validateBundles,every:5000},
 items:{url:'/bridge/catalog/items',validate:M.validateCatalog,every:15000,paged:100},
 people:{url:'/bridge/catalog/people',validate:M.validateCatalog,every:10000,paged:100},
 // Page 0 carries every event's trigger verdict apart from the rows (EventDirectory): merged back here.
 events:{url:'/bridge/events',validate:M.validateEvents,every:10000,paged:50,merge:(value,first)=>{if(!Array.isArray(first.verdicts))return value;const verdicts=new Map(first.verdicts.map(v=>[v.id,M.fullTrigger(v.trigger)]));return {...value,entries:value.entries.map(e=>verdicts.has(e.id)?{...e,trigger:verdicts.get(e.id)}:e)};}}};
const state={},listeners=new Set();let session=null,generation=0;
for(const name of Object.keys(specs))state[name]={data:null,status:null,wantedAt:-Infinity,readAt:-Infinity,retryAt:0,busy:false,progress:null,parts:null,notice:0,loaded:-1};
function reset(){generation++;for(const s of Object.values(state)){s.flight?.abort();Object.assign(s,{data:null,rows:null,status:null,wantedAt:-Infinity,readAt:-Infinity,retryAt:0,progress:null,busy:false,flight:null,parts:null,notice:0,loaded:-1});}}
function paused(){return (typeof stopped!=='undefined'&&stopped)||document.hidden;}
function live(name){const status=model.status(performance.now());return status==='ready'&&model.snapshot?.state==='ready'||name==='mods'&&status==='title'&&model.snapshot?.state==='title';}
async function read(url,controller){const timeout=setTimeout(()=>controller.abort(),4000);try{const r=await fetch(url,{cache:'no-store',signal:controller.signal});if(!r.ok)throw Error('HTTP '+r.status);return await r.json();}finally{clearTimeout(timeout);}}
function changed(name){for(const fn of listeners)try{fn(name);}catch{}}
async function load(name){
 const spec=specs[name],s=state[name],owner=session,epoch=generation,controller=new AbortController();s.busy=true;s.flight=controller;s.readAt=performance.now();s.loaded=s.notice;
 const current=()=>epoch===generation&&owner===session&&owner===model.snapshot?.session;
 const wanted=()=>!paused()&&live(name)&&performance.now()-s.wantedAt<=1500;
 try{
  const first=await read(spec.url+(spec.paged?'?page=0':''),controller);if(!current()||!wanted())return;if(!spec.validate(first)||spec.paged&&first.page!==0)throw Error('invalid '+name);
  const oldStatus=s.status;s.status=first.state;s.progress=first.progress||null;if(oldStatus!==s.status)changed(name);
  if(first.state!=='ready'&&first.state!=='joja'){if(first.state!=='building'&&!s.data){s.data=first;changed(name);}return;}
  if(s.data&&s.data.version===first.version&&s.data.language===first.language&&s.data.state===first.state){s.parts=null;s.fails=0;return;}
  let value=first;
  if(spec.paged){
   const identity=JSON.stringify([first.version,first.language,first.pages,first.total,first.sourceTotal,first.kind]);
   if(s.parts?.identity!==identity)s.parts={identity,pages:new Map()};
   const parts=s.parts;parts.pages.set(0,first.entries);
   // Pages whose digest matches the previous complete version are reused instead of read again.
   if(Array.isArray(first.digests)&&first.digests.length===first.pages&&s.rows&&s.data?.language===first.language)first.digests.forEach((d,p)=>{if(p>0&&!parts.pages.has(p)&&s.rows.digests[p]===d&&s.rows.pages.has(p))parts.pages.set(p,s.rows.pages.get(p));});
   const progress=()=>{s.progress={done:[...parts.pages.values()].reduce((n,rows)=>n+rows.length,0),total:first.total};changed(name);};progress();
   const missing=Array.from({length:Math.max(0,first.pages-1)},(_,i)=>i+1).filter(p=>!parts.pages.has(p));
   // Four bounded requests, ordered publication, and a resumable cache for this exact
   // version/language. Never expose partial rows as a complete catalogue or event list.
   for(let i=0;i<missing.length;i+=4){if(!current()||!wanted())return;
    await Promise.all(missing.slice(i,i+4).map(async page=>{
     const next=await read(spec.url+'?page='+page,controller);if(!current()||!wanted())return;
     if(!spec.validate(next)||next.state!=='ready'||next.version!==first.version||next.language!==first.language||next.page!==page||next.pages!==first.pages||next.total!==first.total||next.sourceTotal!==first.sourceTotal||next.kind!==first.kind)throw Error('page moved '+name);
     parts.pages.set(page,next.entries);
    }));if(!current()||!wanted())return;progress();
   }
   const entries=Array.from({length:first.pages},(_,p)=>parts.pages.get(p)||[]).flat();
   if(entries.length!==first.total||new Set(entries.map(e=>e.id)).size!==entries.length)throw Error('incomplete '+name);
   if(Array.isArray(first.digests))s.rows={digests:first.digests,pages:new Map(parts.pages)};
   if(first.locationNames)window.MapNames?.learn?.(first.language,first.locationNames);
   const {digests:_,verdicts:__,locationNames:___,...head}=first;value=spec.merge?spec.merge({...head,page:0,entries},first):{...head,page:0,entries};}
  if(!current()||!wanted())return;s.data=value;s.parts=null;s.progress=null;s.fails=0;changed(name);
 }catch{if(current()&&!controller.signal.aborted){s.fails=(s.fails||0)+1;s.retryAt=performance.now()+Math.min(15000,750*2**(s.fails-1));}controller.abort();}
 finally{if(s.flight===controller){s.busy=false;s.flight=null;if(controller.signal.aborted||!wanted())s.readAt=-Infinity;}}
}
function tick(){
 const now=performance.now(),current=model.snapshot?.session??null;
 if(current&&current!==session){session=current;reset();changed('*');}
 for(const [name,s] of Object.entries(state))if(s.flight&&(paused()||!live(name)||now-s.wantedAt>1500))s.flight.abort();
 if(paused())return;
 for(const [name,spec] of Object.entries(specs)){const s=state[name];
  if(!live(name)||s.busy||now-s.wantedAt>1500||now<s.retryAt)continue;
  // Architecture v2 phase 4: with the push stream up, the mod announces each change (notice) and holds
  // the demand itself, so read on a new notice, while a document is still building (2 s), and as a
  // one-minute safety net; without the stream, poll as before.
  const pushed=window.StardewStream?.docsLive?.();
  if(pushed?(s.loaded===s.notice&&(s.data?now-s.readAt<60000:now-s.readAt<2000)):now-s.readAt<(s.data?spec.every:500))continue;load(name);}
}
setInterval(tick,250);
/** Ask for a resource while a page shows it; returns the last valid result or null. */
function need(name){const s=state[name];if(!s)return null;const now=performance.now(),entering=now-s.wantedAt>1500;s.wantedAt=now;if(entering)Promise.resolve().then(tick);return s.data;}
/** Names a page asked for in the last 1.5 s (the stream's document demand). */
function demanded(){const now=performance.now();return Object.keys(state).filter(n=>now-state[n].wantedAt<=1500);}
/** The mod announced a new revision of a document. */
function notice(name,revision){const s=state[name];if(!s||!Number.isSafeInteger(revision))return;s.notice=revision;Promise.resolve().then(tick);}
window.LiveData={need,demanded,notice,peek:name=>state[name]?.data??null,status:name=>state[name]?.status??null,progress:name=>state[name]?.progress??null,
 onChange:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},_tick:tick,_reset:()=>{session=null;reset();}};
})();
