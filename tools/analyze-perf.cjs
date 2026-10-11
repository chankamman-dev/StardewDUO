// Analyze sampled /v1/perf windows; never merge window percentiles into a fake
// whole-session percentile. Spike history is sampled (40 records), not exhaustive.
const fs=require('node:fs'),path=require('node:path');
const roots=['perf.frame','commands','collect','background','localmap'];
function percentile(values,q){const a=[...values].sort((a,b)=>a-b);return a.length?a[Math.floor((a.length-1)*q)]:null;}
function analyze(samples){
 if(!samples.length)throw Error('No performance samples');
 samples=[...samples].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
 const spikes=new Map(),hitches=new Map();let lastTime=-1,lastFrames=-1;
 for(const s of samples){const d=s.data;
  if(!Number.isFinite(Date.parse(s.at))||!Number.isSafeInteger(d?.uptimeMs)||!Number.isSafeInteger(d.frames)||d.uptimeMs<lastTime||d.frames<lastFrames)throw Error('Invalid sample or mixed game processes');
  lastTime=d.uptimeMs;lastFrames=d.frames;
  for(const [target,points] of [[spikes,d.spikes??[]],[hitches,d.hitches??[]]])for(const p of points){if(!(p.frameMs>0))continue;
   const measuredMs=roots.reduce((n,k)=>n+(p.bridge?.[k]??0),0);
   target.set(p.atMs,{atMs:p.atMs,frameMs:p.frameMs,measuredMs,measuredPercent:100*measuredMs/p.frameMs,
    gc:[p.gen0??0,p.gen1??0,p.gen2??0],recorderMeasured:Object.hasOwn(p.bridge??{},'perf.frame')});
  }
 }
 const rows=[...spikes.values()];
 const summarize=values=>({retainedUnique:values.length,
  measuredShareMedian:percentile(values.map(s=>s.measuredPercent),.5),measuredShareP95:percentile(values.map(s=>s.measuredPercent),.95),
  withGc:values.filter(s=>s.gc.some(n=>n>0)).length,withGen2:values.filter(s=>s.gc[2]>0).length,
  recorderMissing:values.filter(s=>!s.recorderMeasured).length,rows:values});
 // The first response can still hold startup/loading spikes. Keep those visible,
 // but separately summarize only events strictly after the sampling baseline.
 const baseline=samples[0].data.uptimeMs,end=samples.at(-1).data.uptimeMs;
 return {scope:'Sampled rolling windows and retained slow frames; not render FPS or exhaustive session statistics.',
  from:samples[0].at,to:samples.at(-1).at,elapsedSeconds:(Date.parse(samples.at(-1).at)-Date.parse(samples[0].at))/1000,
  windows:samples.map(s=>({at:s.at,uptimeMs:s.data.uptimeMs,frames:s.data.frames,frame:s.data.frame,bridge:s.data.bridge})),
  slowFrames:summarize(rows),
  slowFramesDuringSampling:{afterUptimeMs:baseline,throughUptimeMs:end,...summarize(rows.filter(s=>s.atMs>baseline&&s.atMs<=end))},
  hitchesDuringSampling:samples.some(s=>Array.isArray(s.data.hitches))?{
   afterUptimeMs:baseline,throughUptimeMs:end,...summarize([...hitches.values()].filter(s=>s.atMs>baseline&&s.atMs<=end))}:null,
  caveats:['collect.* are children of collect; do not add both.',
   'perf.frame is absent before dev.2: unexplained time can include the recorder itself.',
   'max is lifetime; windowMax (dev.2+) is current ring maximum. Loading/background gaps are included.',
   'Spikes retain only the most recent 40; gaps between polls are not a complete slow-frame census.',
   'slowFrames includes retained pre-baseline events; slowFramesDuringSampling excludes them, but later loading/background gaps remain.']};
}
module.exports={analyze};
if(require.main===module){const dir=process.argv[2];if(!dir)throw Error('Usage: node tools/analyze-perf.cjs <private-sample-directory>');
 const samples=fs.readdirSync(dir).filter(n=>/^sample-\d+\.json$/.test(n)).map(n=>JSON.parse(fs.readFileSync(path.join(dir,n),'utf8')));
 console.log(JSON.stringify(analyze(samples),null,2));}
