// Offline dependency reconciliation; no configs, credentials, saves or game API.
const fs=require('node:fs'),{field}=require('./inspect-thor-mods.cjs');
function audit(inventory,log){
 const mods=inventory.mods,active=mods.filter(m=>!m.disabledByFolder),key=s=>String(s||'').toLowerCase();
 const byId=new Map(active.map(m=>[key(m.id),m]));
 const traceIds=new Set([...log.matchAll(/ID: ([^,)]+)/g)].map(m=>key(m[1])));
 const missing=[];
 const rows=mods.map(m=>{
  const dependencies=[...(m.dependencies||[]),...(m.pack?[{UniqueID:m.pack}]:[])];
  const absent=m.disabledByFolder?[]:dependencies.filter(d=>field(d,'IsRequired')!==false&&!byId.has(key(field(d,'UniqueID')))).map(d=>field(d,'UniqueID'));
  for(const id of absent)missing.push({mod:m.id,dependency:id});
  return {name:m.name,id:m.id,version:m.version,kind:m.pack?'content pack':'code',state:m.disabledByFolder?'disabled by folder':traceIds.has(key(m.id))?'loader trace present':'not found in loader trace',missingRequired:absent};
 });
 return {manifests:mods.length,active:active.length,disabled:mods.length-active.length,traceIds:traceIds.size,parseErrors:inventory.errors,missingRequired:missing,unmatchedTraceIds:[...traceIds].filter(id=>!byId.has(id)),rows};
}
if(require.main===module){const [inventory,log,out]=process.argv.slice(2);if(!inventory||!log||!out)throw Error('Usage: node tools/audit-mod-inventory.cjs <inventory.json> <SMAPI-log> <output.json>');const result=audit(JSON.parse(fs.readFileSync(inventory)),fs.readFileSync(log,'utf8'));fs.writeFileSync(out,JSON.stringify(result,null,2));console.log(JSON.stringify({...result,rows:undefined}));}
module.exports={audit};
