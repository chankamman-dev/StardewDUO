const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),M=require('../android/assets/model.js');
function harness(){let now=0;const requests=[],pending=[],c={StardewModel:M,model:{snapshot:{session:'a',state:'ready'},status:()=>c.status},status:'ready',stopped:false,document:{hidden:false},performance:{now:()=>now},AbortController,setTimeout,clearTimeout,setInterval:()=>{},fetch:(url,options)=>{requests.push(url);return new Promise((resolve,reject)=>{const p={url,resolve,reject,options};pending.push(p);options.signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true});});}};c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync('android/assets/live-data.js','utf8'),c);c.LiveData._tick();return {c,requests,pending,time:n=>now=n};}
const flush=async()=>{for(let n=0;n<12;n++)await Promise.resolve();};
const event=(id)=>({id:String(id),name:'Event '+id,location:'Town',mod:null,source:null,seen:false,disabled:false,conditions:{raw:'',startTime:null,endTime:null,freeSlots:0,requiredItems:[],npcsPresent:[],hearts:[],when:[]}});
const page=(n,version=1)=>({state:'ready',version,language:'en',page:n,pages:2,total:51,sourceTotal:51,entries:n?[event(50)]:Array.from({length:50},(_,i)=>event(i)),limited:[]});
const unavailable={state:'unavailable',version:1,language:'en',page:0,pages:0,total:0,sourceTotal:0,entries:[],limited:[]};
async function reply(h,value){h.pending.shift().resolve({ok:true,json:async()=>value});await flush();}
(async()=>{
 let h=harness();h.c.LiveData.need('events');h.c.LiveData._tick();h.c.LiveData._tick();assert.equal(h.requests.length,1,'one flight per resource');await reply(h,page(0));assert.equal(h.requests.length,2);assert.equal(h.c.LiveData.peek('events'),null,'incomplete pages are not published');await reply(h,page(1));const stable=h.c.LiveData.peek('events');assert.equal(stable.entries.length,51);
 h.time(10000);h.c.LiveData.need('events');h.c.LiveData._tick();await reply(h,page(0));assert.equal(h.requests.length,3,'same version reads only page zero');assert.equal(h.c.LiveData.peek('events'),stable);
 h.time(20000);h.c.LiveData.need('events');h.c.LiveData._tick();await reply(h,{...unavailable,state:'building'});assert.equal(h.c.LiveData.peek('events'),stable,'building retains last valid result');
 h.time(30000);h.c.LiveData.need('events');h.c.LiveData._tick();await reply(h,page(0,2));h.time(32000);h.c.LiveData._tick();assert(h.pending[0].options.signal.aborted,'leaving cancels paged request');await flush();assert.equal(h.c.LiveData.peek('events'),stable);assert.equal(h.requests.length,6);
 h.time(33000);h.c.LiveData.need('events');h.c.LiveData._tick();await reply(h,page(0,2));await reply(h,{...page(1,2),page:0});assert.equal(h.c.LiveData.peek('events'),stable,'repeated or moved page is rejected');
 h=harness();h.c.LiveData.need('events');h.c.LiveData._tick();h.c.model.snapshot.session='b';await reply(h,unavailable);assert.equal(h.c.LiveData.status('events'),null,'old save cannot publish status or data before the next tick');h.c.LiveData._tick();h.c.LiveData.need('events');h.c.LiveData._tick();assert.equal(h.requests.length,2);await reply(h,{...page(0),pages:1,total:1,sourceTotal:1,entries:[event(0)]});assert.equal(h.c.LiveData.peek('events').entries.length,1);
 h.time(10000);h.c.LiveData.need('events');h.c.LiveData._tick();h.c.model.snapshot.session='c';h.c.LiveData._tick();h.c.LiveData.need('events');h.c.LiveData._tick();assert.equal(h.requests.length,4,'new save is not blocked by old pending request');await flush();assert.equal(h.c.LiveData.peek('events'),null);
 h=harness();h.c.LiveData.need('events');h.c.document.hidden=true;h.c.LiveData._tick();assert.equal(h.requests.length,0);h.c.document.hidden=false;h.c.stopped=true;h.c.LiveData._tick();assert.equal(h.requests.length,0);h.c.stopped=false;h.c.status='stale';h.c.LiveData._tick();assert.equal(h.requests.length,0);h.c.status='ready';h.c.LiveData._tick();assert.equal(h.requests.length,1);await reply(h,unavailable);
 h=harness();h.c.LiveData.need('events');await flush();assert.equal(h.requests.length,1,'entering starts a cold read without waiting for the timer');
 const large=n=>({...page(n),pages:6,total:251,sourceTotal:251,entries:Array.from({length:n===5?1:50},(_,i)=>event(n*50+i))});
 await reply(h,large(0));assert.equal(h.pending.length,4,'bounded four-page window');assert.equal(h.c.LiveData.progress('events').done,50);
 const outOfOrder=async n=>{const i=h.pending.findIndex(p=>p.url.endsWith('page='+n));assert(i>=0);h.pending.splice(i,1)[0].resolve({ok:true,json:async()=>large(n)});await flush();};
 await outOfOrder(4);await outOfOrder(1);await outOfOrder(2);assert.equal(h.c.LiveData.peek('events'),null,'out-of-order partial pages remain invisible');
 h.time(2000);h.c.LiveData._tick();await flush();h.pending.length=0;const beforeResume=h.requests.length;
 h.time(2500);h.c.LiveData.need('events');await flush();await reply(h,large(0));
 assert.deepEqual(h.requests.slice(beforeResume),['/bridge/events?page=0','/bridge/events?page=3','/bridge/events?page=5'],'same-version resume downloads only missing pages');
 await outOfOrder(5);await outOfOrder(3);assert.equal(h.c.LiveData.peek('events').entries.length,251);
 assert.deepEqual(Array.from(h.c.LiveData.peek('events').entries,e=>e.id),Array.from({length:251},(_,i)=>String(i)),'publication follows page order, not response order');
 assert.equal(h.c.LiveData.progress('events'),null,'completed progress removed');
 // Page digests: a re-judged version keeps the pages whose digest did not change and reads only the rest.
 {const d=harness(),pageOf=q=>Number(q.url.split('page=')[1]),digests=v=>Array.from({length:6},(_,i)=>(i===3&&v===2?'B':'A').repeat(16));
  const body=(n,v)=>{const x=large(n);x.version=v;x.entries=x.entries.map(e=>({...e,name:'v'+(n===3?v:1)}));if(n===0)x.digests=digests(v);return x;};
  const answer=async v=>{while(d.pending.length){const q=d.pending.shift();q.resolve({ok:true,json:async()=>body(pageOf(q),v)});await flush();}};
  d.c.LiveData.need('events');d.c.LiveData._tick();await answer(1);assert.equal(d.c.LiveData.peek('events').entries.length,251);
  const before=d.requests.length;d.time(20000);d.c.LiveData.need('events');d.c.LiveData._tick();await answer(2);
  assert.deepEqual(d.requests.slice(before),['/bridge/events?page=0','/bridge/events?page=3'],'only the changed page is read again');
  const data=d.c.LiveData.peek('events');assert.equal(data.version,2);assert.equal(data.entries.length,251);assert.equal(data.digests,undefined,'digests stay out of the published value');
  assert.equal(data.entries[150].name,'v2','changed page is new');assert.equal(data.entries[60].name,'v1','unchanged page reused');}
 // The catalogues use the same page digests: an asset refresh that changes one page of items reads that page alone.
 {const d=harness(),pageOf=q=>Number(q.url.split('page=')[1]),item=(i,v)=>({id:'(O)'+i,name:'Item '+i+(i>=200?' v'+v:''),description:'',category:'',categoryId:0,price:null,icon:null,type:'object',mod:null,edible:false,recipe:null});
  const body=(n,v)=>{const x={kind:'items',version:v,language:'en',page:n,pages:3,total:250,state:'ready',entries:Array.from({length:n===2?50:100},(_,i)=>item(n*100+i,v)),limited:[]};if(n===0)x.digests=['A','A',v===2?'B':'A'].map(c=>c.repeat(16));return x;};
  const answer=async v=>{while(d.pending.length){const q=d.pending.shift();q.resolve({ok:true,json:async()=>body(pageOf(q),v)});await flush();}};
  assert(M.validateCatalog(body(0,1)),'catalogue page 0 with digests is valid');assert(!M.validateCatalog({...body(1,1),digests:['A'.repeat(16)]}),'digests only on page 0');
  d.c.LiveData.need('items');d.c.LiveData._tick();await answer(1);assert.equal(d.c.LiveData.peek('items').entries.length,250);
  const before=d.requests.length;d.time(20000);d.c.LiveData.need('items');d.c.LiveData._tick();await answer(2);
  assert.deepEqual(d.requests.slice(before),['/bridge/catalog/items?page=0','/bridge/catalog/items?page=2'],'only the changed catalogue page is read again');
  const data=d.c.LiveData.peek('items');assert.equal(data.version,2);assert.equal(data.entries[210].name,'Item 210 v2');assert.equal(data.entries[50].name,'Item 50');}
 // Architecture v2 phase 4: with the push stream holding the demand, a loaded document is read again
 // only when the mod announces a new revision (plus a one-minute safety net), not on the poll period.
 {const p=harness();let pushed=true;p.c.StardewStream={docsLive:()=>pushed};p.c.LiveData.need('events');p.c.LiveData._tick();await reply(p,page(0));await reply(p,page(1));
  assert.equal(p.requests.length,2);assert.deepEqual(Array.from(p.c.LiveData.demanded()),['events'],'the page demand is visible to the stream');
  for(const t of [11000,21000,40000]){p.time(t);p.c.LiveData.need('events');p.c.LiveData._tick();}assert.equal(p.requests.length,2,'no periodic reads while pushed');
  p.c.LiveData.notice('events',7);await flush();p.c.LiveData.need('events');p.c.LiveData._tick();assert.equal(p.requests.length,3,'a notice reads at once');await reply(p,page(0));
  p.c.LiveData.notice('events',7);p.time(41000);p.c.LiveData.need('events');p.c.LiveData._tick();assert.equal(p.requests.length,3,'the same revision is not read twice');
  p.time(100000);p.c.LiveData.need('events');p.c.LiveData._tick();assert.equal(p.requests.length,4,'one-minute safety net');await reply(p,page(0));
  pushed=false;p.time(111000);p.c.LiveData.need('events');p.c.LiveData._tick();assert.equal(p.requests.length,5,'without the stream it polls again');}
 console.log('PASS runtime reader: atomic/resumable four-page window, cold start, unchanged reuse, lease cancellation, moved-page rejection, save isolation, hidden/paused/stale stop, pushed documents');
})().catch(e=>{console.error(e);process.exitCode=1;});
