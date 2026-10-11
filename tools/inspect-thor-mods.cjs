// Read-only inventory. Collect public manifests and a private SMAPI log, never configs or keys.
const cp=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const field=(o,key)=>o?.[Object.keys(o).find(k=>k.toLowerCase()===key.toLowerCase())];
function manifestJson(text){
 text=text.replace(/^\uFEFF/,'');let clean='',quoted=false,escape=false;
 for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];
  if(quoted){clean+=c;if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')quoted=false;continue;}
  if(c==='"'){quoted=true;clean+=c;continue;}
  if(c==='/'&&n==='/'){while(i<text.length&&!/[\r\n]/.test(text[i]))i++;clean+='\n';continue;}
  if(c==='/'&&n==='*'){i+=2;while(i<text.length&&!(text[i]==='*'&&text[i+1]==='/'))i++;i++;clean+=' ';continue;}
  clean+=c;
 }
 let strict='';quoted=false;escape=false;
 for(let i=0;i<clean.length;i++){const c=clean[i];if(quoted){strict+=c;if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')quoted=false;continue;}if(c==='"')quoted=true;
  if(c===','){let j=i+1;while(j<clean.length&&/\s/.test(clean[j]))j++;if(clean[j]==='}'||clean[j]===']')continue;}strict+=c;}
 return JSON.parse(strict);
}
if(require.main===module){
 const [adb,serial,outArg]=process.argv.slice(2);if(!adb||!serial||!outArg)throw Error('Usage: node tools/inspect-thor-mods.cjs <adb> <serial> <private-evidence-directory>');
 const root='/sdcard/StardewValley/desktop/Mods',out=path.resolve(outArg);fs.mkdirSync(out,{recursive:true});
 const q=s=>"'"+s.replaceAll("'","'\\''")+"'";
 const shell=s=>cp.execFileSync(adb,['-s',serial,'shell',s],{encoding:'utf8',maxBuffer:8*1024*1024});
 const files=shell('find '+q(root)+' -iname manifest.json -type f').trim().split(/\r?\n/).filter(p=>p.startsWith(root+'/'));
 const mods=[],errors=[];
 for(const file of files)try{const m=manifestJson(shell('cat '+q(file)));mods.push({path:file,name:field(m,'Name'),id:field(m,'UniqueID'),version:field(m,'Version'),entry:field(m,'EntryDll')||null,pack:field(field(m,'ContentPackFor'),'UniqueID')||null,dependencies:field(m,'Dependencies')||[],description:field(m,'Description'),disabledByFolder:file.slice(root.length+1).split('/').slice(0,-1).some(p=>p.startsWith('.'))});}catch(e){errors.push({path:file,error:e.message});}
 fs.writeFileSync(path.join(out,'installed-mods.json'),JSON.stringify({at:new Date().toISOString(),root,mods,errors},null,2));
 const log=shell('cat '+q('/sdcard/StardewValley/desktop/ErrorLogs/SMAPI-latest.txt'));fs.writeFileSync(path.join(out,'SMAPI-latest.txt'),log);
 console.log(JSON.stringify({count:mods.length,errors,mods:mods.map(({name,id,version,pack})=>({name,id,version,pack}))},null,2));
}
module.exports={manifestJson,field};
