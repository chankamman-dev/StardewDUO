const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(process.env.PREVIEW_ASSETS_ROOT||path.join(__dirname,'../android/assets')),port=Number(process.env.PREVIEW_PORT||23872);
const server=http.createServer((req,res)=>{
 // PREVIEW_BRIDGE=off (the test runner): never forward to a running game, so fixture pages only see
 // their own routed replies even when the PC test game is open.
 if(process.env.PREVIEW_BRIDGE==='off'&&req.url.startsWith('/bridge/')){res.writeHead(503,{'Cache-Control':'no-store'});res.end();return;}
 if(req.url==='/bridge/command'&&req.method==='POST'||/^\/bridge\/receipt\/[0-9a-f]{32}$/.test(req.url)&&req.method==='GET'){
  if(req.headers.origin&&req.headers.origin!==`http://127.0.0.1:${port}`){res.writeHead(403).end();return;}
  let key;try{key=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../sandbox/Mods/StardewThor.ReadOnly/control-key.json'),'utf8'));}catch{res.writeHead(403).end();return;}
  let data='';req.on('data',c=>{data+=c;if(data.length>2048)req.destroy();});req.on('end',()=>{const payload=Buffer.from(data);const upstream=http.request('http://127.0.0.1:23871/v2/'+req.url.slice(8),{method:req.method,timeout:1500,headers:{'X-Stardew-Key':key,'Content-Type':'application/json','Content-Length':payload.length}},r=>{res.writeHead(r.statusCode,{'Content-Type':'application/json'});r.pipe(res);});upstream.on('timeout',()=>upstream.destroy());upstream.on('error',()=>{if(!res.headersSent)res.writeHead(503);res.end();});upstream.end(payload);});return;
 }
 if(/^\/bridge\/mod-config\/[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/.test(req.url)&&req.method==='GET'&&req.url.length<=179){const up=http.get('http://127.0.0.1:23871/v1/'+req.url.slice(8),{timeout:1500},r=>{res.writeHead(r.statusCode,{'Content-Type':'application/json','Cache-Control':'no-store'});r.pipe(res);});up.on('timeout',()=>up.destroy());up.on('error',()=>{if(!res.headersSent)res.writeHead(503);res.end();});return;}
 if(req.method!=='GET'){res.writeHead(405).end();return;}
 if(/^\/bridge\/(mods|bundles|events|collections|progress|catalog\/)(\?|$)/.test(req.url)||req.url.startsWith('/bridge/catalog/')){
  const match=/^\/bridge\/(mods|bundles|events|collections|progress|catalog\/(?:items|people))(?:\?page=(0|[1-9][0-9]?))?$/.exec(req.url);
  if(!match||(!['events','catalog/items','catalog/people'].includes(match[1])&&match[2]!=null)||(match[2]!=null&&Number(match[2])>(match[1]==='catalog/people'?5:81))){res.writeHead(400).end();return;}
  const upstream=http.get('http://127.0.0.1:23871/v1/'+match[1]+(match[2]!=null?'?page='+match[2]:''),{timeout:1500},r=>{res.writeHead(r.statusCode,{'Content-Type':'application/json','Cache-Control':'no-store'});r.pipe(res);});
  upstream.on('timeout',()=>upstream.destroy());upstream.on('error',()=>{if(!res.headersSent)res.writeHead(503);res.end();});return;
 }
 if(/^\/bridge\/asset\/[0-9a-f]{64}$/.test(req.url)){const up=http.get('http://127.0.0.1:23871/v1/asset/'+req.url.slice(14),{timeout:1500},r=>{res.writeHead(r.statusCode,{'Content-Type':'image/png'});r.pipe(res);});up.on('timeout',()=>up.destroy());up.on('error',()=>{if(!res.headersSent)res.writeHead(503);res.end();});return;}
 // Local map: manifest JSON and immutable blobs, read-only, passed through unchanged.
 if(/^\/bridge\/localmap\/(blob\/[0-9a-f]{64}|[A-Za-z0-9_.%-]{1,160})$/.test(req.url)){const up=http.get('http://127.0.0.1:23871/v1/localmap/'+req.url.slice(17),{timeout:3000},r=>{res.writeHead(r.statusCode,{'Content-Type':r.headers['content-type']||'application/octet-stream','Cache-Control':r.headers['cache-control']||'no-store'});r.pipe(res);});up.on('timeout',()=>up.destroy());up.on('error',()=>{if(!res.headersSent)res.writeHead(503);res.end();});return;}
 // Architecture v2: the push stream, piped through unbuffered for as long as the page keeps it open.
 // Phase 4: which documents the open stream should hold and announce.
 if(process.env.PREVIEW_STREAM!=='off'&&/^\/bridge\/demand\?id=[0-9a-f]{32}&docs=[a-z%2C,-]{0,160}$/i.test(req.url)){const up=http.get('http://127.0.0.1:23871/v3/demand?'+req.url.split('?')[1],{timeout:1500},r=>{res.writeHead(r.statusCode,{'Content-Type':'application/json','Cache-Control':'no-store'});r.pipe(res);});up.on('error',()=>{if(!res.headersSent)res.writeHead(503);res.end();});return;}
 // PREVIEW_STREAM=off (the test runner) keeps fixture pages on polling, never on a live game.
 if(process.env.PREVIEW_STREAM!=='off'&&/^\/bridge\/stream\?topics=[a-z,]{1,80}$/.test(req.url)){const up=http.get('http://127.0.0.1:23871/v3/stream?'+req.url.split('?')[1],r=>{res.writeHead(r.statusCode,{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-store','X-Accel-Buffering':'no'});r.pipe(res);});up.on('error',()=>{if(!res.headersSent)res.writeHead(503);res.end();});req.on('close',()=>up.destroy());return;}
 if(req.url==='/bridge/farm'){const up=http.get('http://127.0.0.1:23871/v1/farm',{timeout:1500},r=>{res.writeHead(r.statusCode,{'Content-Type':'application/json','Cache-Control':'no-store'});r.pipe(res);});up.on('timeout',()=>up.destroy());up.on('error',()=>{if(!res.headersSent)res.writeHead(503);res.end();});return;}
 if(/^\/bridge\/tracking\/(map|profile|off)$/.test(req.url)){const upstream=http.get('http://127.0.0.1:23871'+req.url.replace('/bridge/','/v1/'),{timeout:1500},r=>{res.writeHead(r.statusCode,{'Content-Type':'application/json','Cache-Control':'no-store'});r.pipe(res);});upstream.on('timeout',()=>upstream.destroy());upstream.on('error',()=>{if(!res.headersSent)res.writeHead(503);res.end();});return;}
 if(['/bridge/target/on','/bridge/target/off'].includes(req.url)||req.url==='/bridge/state'){
  const upstream=http.get('http://127.0.0.1:23871'+(req.url==='/bridge/state'?'/v1/snapshot':'/v1/target/'+req.url.split('/').pop()),{timeout:1500},r=>{res.writeHead(r.statusCode,{'Content-Type':'application/json','Cache-Control':'no-store'});r.pipe(res);});
  upstream.on('timeout',()=>upstream.destroy());upstream.on('error',()=>{if(!res.headersSent)res.writeHead(503);res.end();});return;
 }
 let name;try{name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
 const prefix=name.startsWith('/__dev/')?'/__dev':name.startsWith('/__review/')?'/__review':'';
 const base=prefix==='/__dev'?path.resolve(__dirname,'../dev'):prefix==='/__review'?path.resolve(__dirname,'../artifacts/visual-0.5'):root;
 const relative=prefix?name.slice(prefix.length):name;
 const file=path.resolve(base,'.'+(relative==='/'?'/index.html':relative));if(!file.startsWith(base+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':{'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png'}[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);});
});server.listen(port,'127.0.0.1',()=>console.log('Preview http://127.0.0.1:'+server.address().port));
