const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
// Exercise the real report reader under the same periodic render calls as the App.
// Fetch completion is controlled to reproduce an old save's late response.
const source=fs.readFileSync('android/assets/farm.js','utf8');
const calls=[],pending=[];let now=0;
const c={page:'farm',stopped:false,document:{hidden:false},performance:{now:()=>now},AbortSignal,
 model:{snapshot:{session:'a',state:'ready',journal:{farmVersion:1}},status:()=>c.status},status:'ready',
 StardewModel:{validFarm:r=>r&&Number.isSafeInteger(r.version)},draw:()=>{},
 fetch:(url,options)=>{calls.push({url,at:now,options});return new Promise((resolve,reject)=>pending.push({resolve,reject}));}};
c.window=c;vm.createContext(c);
vm.runInContext("let report=null,reportSession=null,fetching=false,retryAt=0,readAt=-Infinity;"+
 source.slice(source.indexOf('function fresh()'),source.indexOf('function current()'))+
 "globalThis.reader={sync,report:()=>report};",c);
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
const finish=async(version=1)=>{pending.shift().resolve({ok:true,json:async()=>({version})});await flush();};
(async()=>{
 c.reader.sync();assert.equal(calls.length,1);assert.equal(calls[0].url,'/bridge/farm');
 c.reader.sync();assert.equal(calls.length,1,'one request at a time');await finish();
 const stable=c.reader.report();now=1000;c.reader.sync();now=2000;c.reader.sync();assert.equal(calls.length,1);
 now=3000;c.reader.sync();assert.equal(calls.length,2,'stable version still renews visible farm demand');await finish();
 assert.equal(c.reader.report(),stable,'unchanged response retains the rendered report');
 c.model.snapshot.journal.farmVersion=2;now=3200;c.reader.sync();assert.equal(calls.length,3,'new version reads immediately');await finish(2);
 now=6200;c.page='bag';c.reader.sync();assert.equal(calls.length,3,'leaving farm stops periodic renewal');
 c.page='farm';c.document.hidden=true;c.reader.sync(true);assert.equal(calls.length,3,'hidden never reads, including forced callers');
 c.document.hidden=false;c.stopped=true;c.reader.sync(true);assert.equal(calls.length,3,'paused never reads');
 c.stopped=false;c.status='stale';c.reader.sync(true);assert.equal(calls.length,3,'stale data never establishes demand');
 c.status='ready';c.reader.sync();assert.equal(calls.length,4,'returning to visible farm resumes');
 pending.shift().reject(Error('offline'));await flush();now=9000;c.reader.sync();assert.equal(calls.length,4,'failure backs off');
 now=9200;c.reader.sync();assert.equal(calls.length,5);await finish(2);
 now=12200;c.reader.sync();assert.equal(calls.length,6);
 c.model.snapshot={session:'b',state:'ready',journal:{farmVersion:1}};
 await finish(99);assert.equal(c.reader.report().version,2,'late response is rejected even before rendering the new session');
 c.reader.sync();assert.equal(c.reader.report(),null,'new session clears old report');assert.equal(calls.length,7);
 await finish(1);assert.equal(c.reader.report().version,1,'new save is allowed to restart version numbering');
 // Briefing.ensure can request a new version off-page, but does not sustain the farm lease.
 c.page='target';now=15200;c.reader.sync(true);assert.equal(calls.length,7,'explicit stable off-page read does not renew');
 c.model.snapshot.journal.farmVersion=2;c.reader.sync(true);assert.equal(calls.length,8);await finish(2);
 now=18200;c.reader.sync();assert.equal(calls.length,8);
 // A current mod reports farmVersion null until the first scan, which it only starts once asked:
 // the farm tab must ask anyway (at the renewal pace), or both sides wait forever.
 c.page='farm';c.model.snapshot={session:'c',state:'ready',journal:{farmVersion:null}};now=30000;c.reader.sync();const asked=calls.length;assert.equal(asked,9,'null farmVersion still asks');
 pending.shift().resolve({ok:false,status:404});await flush();now=30500;c.reader.sync();assert.equal(calls.length,asked,'no hammering before the scan exists');
 now=33600;c.reader.sync();assert.equal(calls.length,asked+1,'keeps the lease alive until the first report');await finish(1);
  // Architecture v2 phase 5: with the push stream live the stream holds the lease; only a new version reads.
 const wants=[];c.StardewStream={live:()=>true,setWant:(n,on)=>wants.push(on)};
 now=40000;c.reader.sync();assert.equal(calls.length,asked+1,'streamed: stable version never renews');assert.equal(wants.at(-1),true,'streamed: farm page wants the lease');
 c.model.snapshot.journal.farmVersion=2;c.reader.sync();assert.equal(calls.length,asked+2,'streamed: new version reads');await finish(2);
 c.page='bag';c.reader.sync();assert.equal(wants.at(-1),false,'streamed: leaving farm drops the want');
 c.page='farm';c.model.snapshot={session:'d',state:'ready',journal:{farmVersion:null}};now=50000;c.reader.sync();assert.equal(calls.length,asked+2,'streamed: null version waits for the pushed scan');
 console.log('PASS farm demand: stable-version renewal, unchanged-render reuse, immediate updates, hidden/paused/stale/off-page stop, backoff, late-session isolation, first-scan lease, streamed lease');
})().catch(e=>{console.error(e);process.exitCode=1;});
