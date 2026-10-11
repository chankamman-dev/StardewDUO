/* Architecture v2, phase 1: live game state pushed by the mod over one stream instead of polling
   /bridge/state. The mod sends each topic when it changes (and a heartbeat every second); topics are
   merged back into the snapshot shape every page already uses and handed to model.accept, so pages do
   not change. On Android the App's Java side holds the connection (ThorCommands.openStream) and hands
   batches of lines to window.stardewStream; in a browser the preview pipes /bridge/stream to fetch().
   When the stream is down, or the mod is older and has no stream, app.js keeps polling as before. */
(()=>{'use strict';
// reel: the fishing minigame, live, outside the snapshot (reel.js draws it; older mods never send it).
const TOPICS=['hud','bag','social','tracking','target','journal','reel'];
const native=()=>typeof window.ThorCommands?.openStream==='function';
let streamId=null,sentDemand=null,demanding=false;
let parts={},session=null,seq=0,mod=null,lastBeat=-Infinity,connectedAt=0,open=false,retryAt=0,failures=0,unsupported=0,pending='',reader=null,renderQueued=false;
function snapshot(){const h=parts.hud.d,b=parts.bag?.d,t=parts.target?.d;
 return {session,seq,revision:b?.revision??0,state:h.state,language:h.language,bag:b?.bag??null,collectMs:0,source:h.source,world:h.world??null,
  social:parts.social?.d?.social??null,control:h.control??null,tracking:parts.tracking?.d?.tracking??null,target:t?.target??null,targetState:t?.targetState??null,
  journal:parts.journal?.d?.journal??null,scene:t?.scene??null,night:h.night??false,context:h.context??null};}
function queueRender(){if(renderQueued)return;renderQueued=true;requestAnimationFrame(()=>{renderQueued=false;if(!stopped&&!document.hidden)render();});}
// One batch of newline-separated frames. Topic frames are merged and accepted once per batch.
function receive(text){
 const lines=(pending+text).split('\n');pending=lines.pop();let changed=false,beat=null;
 for(const line of lines){if(!line)continue;let f;try{f=JSON.parse(line);}catch{continue;}window.PerfLog?.frame(f);
  if(f.t==='hb'){beat=f;continue;}
  if(f.t==='hello'&&typeof f.id==='string'){streamId=f.id;sentDemand=null;continue;}
  if(f.t==='doc'&&typeof f.n==='string'){window.LiveData?.notice(f.n,f.r);continue;}
  if(f.t==='reel'){if(typeof f.session==='string')window.Reel?.frame(f.d,f.session);continue;}
  if(!TOPICS.includes(f.t)||typeof f.session!=='string')continue;
  if(f.session!==session){session=f.session;parts={};seq=0;}
  parts[f.t]=f;if(Number.isSafeInteger(f.seq)&&f.seq>seq)seq=f.seq;changed=true;}
 const now=performance.now();
 if(beat){lastBeat=now;failures=0;if(typeof beat.mod==='string')mod=beat.mod;if(Number.isSafeInteger(beat.seq)&&beat.seq>seq&&!changed)seq=beat.seq;}
 const age=beat&&Number.isSafeInteger(beat.age)?beat.age:0,busy=beat?.busy;
 if(changed&&parts.hud){const envelope={protocol:'stardew-thor.readonly.v1',gameAgeMs:age,snapshot:snapshot()};if(mod)envelope.modVersion=mod;if(busy)envelope.busy=busy;
  try{if(model.accept(envelope,now)!==false)queueRender();}catch(e){model.fail(e.message,'data');close();retryAt=now+2000;}}
 else if(beat&&model.snapshot?.session===session&&model.touch({gameAgeMs:age,busy,seq:beat.seq},now))queueRender();
}
function ended(code){open=false;reader=null;pending='';streamId=null;sentDemand=null;
 // An older mod has no stream: keep polling and look again in a minute.
 if(code===404||code===400)unsupported=performance.now()+60000;
 retryAt=performance.now()+Math.min(5000,500*2**Math.min(failures++,4));}
function close(){if(!open)return;open=false;streamId=null;sentDemand=null;if(native())ThorCommands.closeStream();else reader?.cancel().catch(()=>{});reader=null;pending='';}
async function connect(){open=true;connectedAt=performance.now();parts={};session=null;seq=0;
 if(native()){ThorCommands.openStream(TOPICS.join(','));return;}
 try{const r=await fetch('/bridge/stream?topics='+TOPICS.join(','),{cache:'no-store'});if(!r.ok||!r.body){ended(r.status);return;}
  reader=r.body.getReader();const decoder=new TextDecoder();
  for(;;){const {value,done}=await reader.read();if(done)break;receive(decoder.decode(value,{stream:true}));}
  ended(0);}catch{ended(0);}}
window.stardewStream=text=>{if(open)receive(String(text));};
window.stardewStreamEnd=code=>{if(open)ended(Number(code)||0);};
// Keep one stream while the page is visible and running; drop it when hidden or paused.
setInterval(()=>{const now=performance.now(),want=!stopped&&!document.hidden&&now>=unsupported;
 if(!want){close();return;}
 if(open&&now-Math.max(lastBeat,connectedAt)>4000){close();retryAt=now+500;}
 if(!open&&now>=retryAt)connect();},250);
// Phase 4: tell the mod which documents the page reads (it then renews their leases and announces
// changes); sent when the set changes. Documents count as pushed only once the mod has the current set.
// Phase 5: display leases (farm, target, tracking-map, tracking-profile) join the same demand. A want
// lapses 2.5 s after its module last renewed it, so a page that stops asking (left, hidden) lets go.
const wants=new Map();
const demandKey=()=>{const now=performance.now();return [...new Set([...(window.LiveData?.demanded()||[]),...[...wants].filter(([,t])=>now-t<=2500).map(([n])=>n)])].sort().join(',');};
// A refused demand (an older App route, a restarting mod) waits 2 s before trying again.
let demandRetryAt=0;
setInterval(async()=>{if(!open||!streamId||demanding||performance.now()<demandRetryAt)return;const key=demandKey();if(key===sentDemand)return;demanding=true;const id=streamId;
 try{const r=await fetch('/bridge/demand?id='+id+'&docs='+encodeURIComponent(key),{cache:'no-store'});if(r.ok&&id===streamId)sentDemand=key;else demandRetryAt=performance.now()+2000;}catch{demandRetryAt=performance.now()+2000;}finally{demanding=false;}},250);
const live=()=>open&&lastBeat>=connectedAt&&performance.now()-lastBeat<2500;
window.StardewStream={live,docsLive:()=>live()&&!!streamId&&sentDemand!==null&&sentDemand===demandKey(),topics:TOPICS,
 // A module holds a display lease through the stream while it wants it; acked() once the mod has it.
 setWant:(name,on)=>{if(on)wants.set(name,performance.now());else wants.delete(name);},
 acked:name=>live()&&!!streamId&&sentDemand!==null&&sentDemand.split(',').includes(name)};
})();
