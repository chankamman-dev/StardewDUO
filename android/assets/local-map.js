// Local map (docs/LOCAL-MAP-PLAN.md). The mod sends a draw list (tile indices, sprite
// rectangles, texture sheets); this module composites it into 512px canvases in short
// frame slices. The world map stays the default; collection and WebView frame budgets
// still need measurement on the device, especially for first-time texture loading.
(()=>{'use strict';
 const CHUNK=512,FRAME_MS=8,FETCHES=2,REFRESH_MS=60000;
 const text={zh:{button:'地点',worldButton:'全图',title:'查看玩家所在地点的局部地图',world:'返回世界地图',drawing:'正在绘制',waiting:'正在准备',unloaded:'该地点尚未加载',unknown:'找不到该地点','too-large':'地图过大，暂不支持',error:'局部地图出错',offline:'需要实时连接',view:'查看所在地点'},
  en:{button:'Place',worldButton:'World',title:'Local map of the player\'s location',world:'Back to world map',drawing:'Drawing',waiting:'Preparing',unloaded:'This location is not loaded',unknown:'Location not found','too-large':'Map too large',error:'Local map error',offline:'Needs a live connection',view:'View this location'}};
 const tr=k=>(text[lang]||text.en)[k]||k;
 const view=$('map-viewport'),canvasHost=$('map-canvas'),pinHost=$('map-pins');
 let active=false,name=null,map=null,dataUrl='',token=0,timer=0,refreshAt=0,renderQueue=[],rendering=false;
 let following=false,worldView=null,localSession=null,wasOffline=false,focus=null;
 const dispose=m=>m?.sheets?.forEach(sheet=>sheet?.close());
 function setFollowing(value){following=value;document.querySelector('.map-follow')?.setAttribute('aria-pressed',String(value));}
 function centerPlayer(){const p=playerPoint();if(p&&map)window.MapView?.center(p.x*16,p.y*16);}

 // A two-part switch, place | world, so the view in use is always the pressed half. Hidden until the
 // mod reports local positions (older mods do not).
 const modes=el('div','map-modes'),button=el('button','map-local'),world=el('button','map-world');modes.setAttribute('role','group');
 for(const [b,k] of [[button,'button'],[world,'worldButton']]){b.type='button';b.append(el('span','',tr(k)));modes.append(b);}$('map-fit').before(modes);
 button.onclick=()=>{if(active)return;const p=model.snapshot?.tracking?.playerLocal;if(p)open(p.location);};world.onclick=()=>{if(active)close();};
 function syncButton(){const live=model.status(performance.now())==='ready',p=model.snapshot?.tracking?.playerLocal;modes.hidden=!p&&!active;button.disabled=!live&&!active;button.setAttribute('aria-pressed',String(active));world.setAttribute('aria-pressed',String(!active));button.title=tr('title');world.title=tr('world');for(const [b,k] of [[button,'button'],[world,'worldButton']]){b.setAttribute('aria-label',b.title);if(b.firstChild.textContent!==tr(k))b.firstChild.textContent=tr(k);}}

 const note=el('span','local-map-state');note.hidden=true;note.setAttribute('role','status');view.append(note);
 // The place shown is named at the toolbar's top-left (#map-area); nothing covers the map itself.
 function setScroll(){}
 function status(message){note.hidden=!message;note.textContent=message||'';}
 // Farm-page focus: highlighted tiles drawn once on a low-resolution overlay (8 px a tile,
 // scaled with the map), plus a label chip that clears it. Never redrawn per frame.
 const chip=el('div','local-map-focus-chip'),chipText=el('span'),chipClear=el('button','','×');chip.hidden=true;chipClear.type='button';chip.append(chipText,chipClear);view.append(chip);
 chipClear.onclick=e=>{e.stopPropagation();focus=null;drawFocus();};
 function drawFocus(){canvasHost.querySelector('.local-map-focus')?.remove();chip.hidden=!focus;if(!focus)return;chipText.textContent=focus.label;chipClear.setAttribute('aria-label',lang==='zh'?'清除标记':'Clear highlight');if(!map)return;
  const S=8,c=document.createElement('canvas'),x=c.getContext('2d');c.className='local-map-focus';c.width=map.width*S;c.height=map.height*S;x.fillStyle='rgba(255,232,96,.55)';x.strokeStyle='#d24a1a';x.lineWidth=1.5;
  for(let i=0;i+1<focus.tiles.length;i+=2){const tx=focus.tiles[i],ty=focus.tiles[i+1];if(tx<0||ty<0||tx>=map.width||ty>=map.height)continue;x.fillRect(tx*S,ty*S,S,S);x.strokeRect(tx*S+.75,ty*S+.75,S-1.5,S-1.5);}
  canvasHost.insertBefore(c,pinHost);}
 function fitFocus(){if(!focus||!map)return;let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(let i=0;i+1<focus.tiles.length;i+=2){const x=focus.tiles[i],y=focus.tiles[i+1];x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}if(x0>x1)return;
  const s=window.MapView?.getState(),base=window.MapView?.baseScale()||1,[vw,vh]=s?.viewport||[600,400],scale=Math.max(1,Math.min(2,vw/((x1-x0+1)*16+96),vh/((y1-y0+1)*16+96)));
  window.MapView?.zoomTo(scale/base,(x0+x1+1)*8,(y0+y1+1)*8);}
 function focusOn(location,tiles,label){if(!location||!Array.isArray(tiles))return;const next={location,tiles:tiles.filter(Number.isInteger).slice(0,4800),label:String(label||'').slice(0,80)};
  if(active&&name===location&&map){focus=next;setFollowing(false);drawFocus();fitFocus();return;}open(location,false,next);}
 function clearLayers(){for(const c of canvasHost.querySelectorAll('.local-map-layer'))c.remove();}

 function open(location,keepFollowing=false,nextFocus=null){
  if(!location)return;focus=nextFocus?.location===location?nextFocus:null;if(!active)worldView=window.MapView?.getState();
  active=true;name=location;dispose(map);map=null;dataUrl='';token++;clearTimeout(timer);refreshAt=0;renderQueue=[];wasOffline=false;
  localSession=model.snapshot?.session;setFollowing(keepFollowing);
  for(const n of canvasHost.querySelectorAll('.map-live-layer'))n.hidden=true;$('map-image').hidden=true;clearLayers();pinHost.replaceChildren();delete pinHost.dataset.liveKey;
  if(typeof clusterPicker!=='undefined')clusterPicker.hidden=true;
  $('map').dataset.local='true';put('map-area',MapNames.location(location,lang));setScroll(MapNames.location(location,lang));if(typeof regionWrap!=='undefined')regionWrap.hidden=true;$('map-area').hidden=false;
  status(tr('waiting'));drawFocus();syncButton();poll(token,0);
 }
 function close(){
  active=false;name=null;focus=null;drawFocus();setScroll('');dispose(map);map=null;token++;clearTimeout(timer);refreshAt=0;renderQueue=[];clearLayers();delete $('map').dataset.local;setFollowing(false);
  for(const n of canvasHost.querySelectorAll('.map-live-layer'))n.hidden=false;delete pinHost.dataset.liveKey;
  if(typeof mapSignature!=='undefined')mapSignature='';status('');syncButton();worldRender(true);
  if(worldView)window.MapView?.restore(worldView);worldView=null;
 }

 // Manifest: pending while the mod collects (sliced over game ticks), then ready.
 async function poll(t,attempt){
  let m=null;try{const r=await fetch('/bridge/localmap/'+encodeURIComponent(name),{cache:'no-store'});m=r.ok?await r.json():{state:r.status===404?'unknown':'error'};}catch{m={state:'offline'};}
  if(t!==token)return;
  if(m.state==='pending'){status(tr('waiting')+(m.progress?' '+m.progress:''));timer=setTimeout(()=>poll(t,attempt+1),Math.min(1500,250+attempt*150));return;}
  if(m.state!=='ready'){status(tr(m.state));timer=setTimeout(()=>poll(t,0),m.state==='offline'?3000:15000);return;}
  if(m.name){put('map-area',MapNames.location(name,lang,m.name));setScroll(MapNames.location(name,lang,m.name));}
  if(m.data+JSON.stringify(m.spriteTints||{})!==dataUrl){try{await load(m,t);}catch(e){if(t===token){status(tr('error'));timer=setTimeout(()=>poll(t,0),5000);}return;}}
  if(t!==token)return;refreshAt=performance.now()+REFRESH_MS;timer=setTimeout(()=>{if(!document.hidden&&$('map').hidden===false)poll(t,0);else refreshAt=0;},REFRESH_MS);
 }

 async function load(m,t){
  status(tr('drawing'));
  const [buffer,sheets]=await Promise.all([fetch(m.data).then(r=>{if(!r.ok)throw Error('data');return new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();}),images(m.textures,t)]);
  if(t!==token){sheets.forEach(s=>s?.close());return;}
  let next;try{next=parse(buffer,sheets);}catch(e){sheets.forEach(s=>s?.close());throw e;}
  next.name=m.name;next.tints=m.spriteTints||{};next.tinted=new Map();const first=!map;dispose(map);map=next;dataUrl=m.data+JSON.stringify(m.spriteTints||{});
  if(first&&focus){window.MapView?.setSize(map.width*16,map.height*16,2);fitFocus();}
  else if(first){window.MapView?.setSize(map.width*16,map.height*16,2);const p=playerPoint();const base=window.MapView?.baseScale()||1;window.MapView?.zoomTo(Math.max(1,1/base),p?p.x*16:map.width*8,p?p.y*16:map.height*8);}
  if(first)drawFocus();schedule();renderPins(true);
 }
 // At most FETCHES texture sheets in flight: the bridge serves one connection at a time.
 async function images(urls,t){const out=new Array(urls.length).fill(null);let next=0;
  async function worker(){while(next<urls.length&&t===token){const i=next++;if(!urls[i])continue;
   for(let tries=0;tries<3&&!out[i];tries++){try{const r=await fetch(urls[i]);if(r.ok)out[i]=await createImageBitmap(await r.blob());}catch{}}}}
  await Promise.all(Array.from({length:FETCHES},worker));
  if(t===token&&urls.some((url,i)=>url&&!out[i])){out.forEach(s=>s?.close());throw Error('missing texture');}
  return out;}

 function parse(buffer,sheets){
  const dv=new DataView(buffer);let o=0;const u8=()=>dv.getUint8(o++),u16=()=>{const v=dv.getUint16(o,true);o+=2;return v;},u32=()=>{const v=dv.getUint32(o,true);o+=4;return v;},i32=()=>{const v=dv.getInt32(o,true);o+=4;return v;};
  if(String.fromCharCode(u8(),u8(),u8(),u8())!=='STLM'||u8()!==1)throw Error('format');
  const width=u16(),height=u16(),count=u8(),cells=width*height,layers=[];
  for(let i=0;i<count;i++){const group=u8();const sheet=new Uint16Array(buffer.slice(o,o+cells*2));o+=cells*2;const index=new Uint16Array(buffer.slice(o,o+cells*2));o+=cells*2;layers.push({group,sheet,index});}
  let water=null;if(u8()===1){const tex=u16(),r=u8(),g=u8(),b=u8(),a=u8();const mask=new Uint8Array(buffer.slice(o,o+cells));o+=cells;water={tiles:waterTiles(sheets[tex],[r,g,b,a]),mask};}
  const n=u32(),sprites=new Array(n);
  for(let i=0;i<n;i++)sprites[i]={id:i,tex:u16(),sx:u16(),sy:u16(),sw:u16(),sh:u16(),x:i32()/4,y:i32()/4,flip:u8()&1,sort:i32()};
  return {width,height,layers,water,sprites,sheets};
 }
 // drawWater tints Cursors water with the location's premultiplied waterColor.
 function waterTiles(image,[r,g,b,a]){if(!image||!a)return null;return [0,128].map(oy=>{const c=new OffscreenCanvas(16,16),x=c.getContext('2d');x.imageSmoothingEnabled=false;x.drawImage(image,0,oy,64,64,0,0,16,16);
  const d=x.getImageData(0,0,16,16),p=d.data;for(let i=0;i<p.length;i+=4){p[i]=Math.min(255,p[i]*r/a);p[i+1]=Math.min(255,p[i+1]*g/a);p[i+2]=Math.min(255,p[i+2]*b/a);p[i+3]=p[i+3]*a/255;}x.putImageData(d,0,0);return c;});}

 // Chunks nearest the viewport centre first, a few milliseconds per frame. A refresh
 // swaps each chunk only once it is drawn, so the map never flashes blank.
 function schedule(){
  const old=new Map([...canvasHost.querySelectorAll('.local-map-layer')].map(c=>[c.dataset.chunk,c]));const W=map.width*16,H=map.height*16,s=window.MapView?.getState(),cx=s?(s.viewport[0]/2-s.x)/s.w*W:W/2,cy=s?(s.viewport[1]/2-s.y)/s.h*H:H/2;
  renderQueue=[];for(let y=0;y<H;y+=CHUNK)for(let x=0;x<W;x+=CHUNK){const c=document.createElement('canvas');c.className='local-map-layer';c.dataset.chunk=x+','+y;c.width=Math.min(CHUNK,W-x);c.height=Math.min(CHUNK,H-y);
   Object.assign(c.style,{left:x/W*100+'%',top:y/H*100+'%',width:c.width/W*100+'%',height:c.height/H*100+'%'});renderQueue.push({c,x,y,old:old.get(c.dataset.chunk),d:Math.hypot(x+c.width/2-cx,y+c.height/2-cy)});}
  renderQueue.sort((a,b)=>a.d-b.d);if(!rendering){rendering=true;requestAnimationFrame(pump);}
 }
 function pump(){const until=performance.now()+FRAME_MS,m=map;while(renderQueue.length&&performance.now()<until&&m===map){const job=renderQueue.shift();draw(job,m);if(job.old)job.old.replaceWith(job.c);else canvasHost.insertBefore(job.c,pinHost);}
  if(renderQueue.length&&active)requestAnimationFrame(pump);else{rendering=false;if(active&&map)status('');}}

 function draw({c,x:px,y:py},m){
  const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;const W=m.width,x0=Math.floor(px/16),y0=Math.floor(py/16),x1=Math.min(W,Math.ceil((px+c.width)/16)),y1=Math.min(m.height,Math.ceil((py+c.height)/16));
  const tiles=group=>{for(const l of m.layers){if(l.group!==group)continue;for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const i=y*W+x,v=l.sheet[i];if(!v)continue;const img=m.sheets[(v&0xFFF)-1];if(!img)continue;
   const cols=img.width>>4,t=l.index[i],sx=(t%cols)*16,sy=((t/cols)|0)*16,dx=x*16-px,dy=y*16-py;
   if(v<0x1000)ctx.drawImage(img,sx,sy,16,16,dx,dy,16,16);else transformed(ctx,img,sx,sy,dx,dy,(v>>12)&3,(v>>14)&3);}}};
  tiles(0);
  if(m.water?.tiles)for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(m.water.mask[y*W+x])ctx.drawImage(m.water.tiles[(x+y)%2],x*16-px,y*16-py);
  const sprites=ground=>{for(const s of m.sprites){if((s.sort < -100000)!==ground)continue;if(s.x>px+c.width||s.y>py+c.height||s.x+s.sw<px||s.y+s.sh<py)continue;let img=m.sheets[s.tex];if(!img)continue;
   let sx=s.sx,sy=s.sy;const tint=m.tints[s.id];
   if(tint!==undefined&&tint!==4294967295){img=tintedSprite(m,s,img,tint);sx=sy=0;}
   if(s.flip){ctx.save();ctx.translate(s.x-px+s.sw,s.y-py);ctx.scale(-1,1);ctx.drawImage(img,sx,sy,s.sw,s.sh,0,0,s.sw,s.sh);ctx.restore();}
   else ctx.drawImage(img,sx,sy,s.sw,s.sh,s.x-px,s.y-py,s.sw,s.sh);}};
  sprites(true);tiles(1);sprites(false);
  tiles(2);tiles(3);
 }
 // XNA Color.PackedValue is little-endian RGBA. Tint small source rectangles once,
 // never whole sheets; keep the STLM1 binary stream compatible with previous readers.
 function tintedSprite(m,s,img,value){
  const key=[s.tex,s.sx,s.sy,s.sw,s.sh,value].join(':');if(m.tinted.has(key))return m.tinted.get(key);
  const c=new OffscreenCanvas(s.sw,s.sh),ctx=c.getContext('2d');ctx.drawImage(img,s.sx,s.sy,s.sw,s.sh,0,0,s.sw,s.sh);
  const d=ctx.getImageData(0,0,s.sw,s.sh),p=d.data,r=value&255,g=(value>>>8)&255,b=(value>>>16)&255,a=value>>>24;
  for(let i=0;i<p.length;i+=4){p[i]=a?Math.min(255,p[i]*r/a):0;p[i+1]=a?Math.min(255,p[i+1]*g/a):0;p[i+2]=a?Math.min(255,p[i+2]*b/a):0;p[i+3]=p[i+3]*a/255;}
  ctx.putImageData(d,0,0);m.tinted.set(key,c);return c;
 }
 // SMAPI @Flip (1 horizontal, 2 vertical) and @Rotation (quarter turns) tile properties.
 function transformed(ctx,img,sx,sy,dx,dy,flip,rot){ctx.save();ctx.translate(dx+8,dy+8);ctx.rotate(rot*Math.PI/2);ctx.scale(flip&1?-1:1,flip&2?-1:1);ctx.drawImage(img,sx,sy,16,16,-8,-8,16,16);ctx.restore();}

 function playerPoint(){const p=model.snapshot?.tracking?.playerLocal;return p&&p.location===name?p:null;}
 // Portraits in this location, clustered like the world map; tile coordinates × 16 px.
 function renderPins(force=false){
  if(!map)return;const tracking=window.TrackingDisplay?TrackingDisplay.read():(model.status(performance.now())==='ready'?model.snapshot?.tracking:null);const W=map.width*16,H=map.height*16;
  const markers=(tracking?.residents||[]).filter(p=>!window.Spoiler?.hides(p.id)).filter(p=>p.local?.location===name).sort((a,b)=>a.id.localeCompare(b.id)).map(p=>({id:p.id,name:p.name,image:p.mapAvatar,x:p.local.x*16,y:p.local.y*16}));
  const me=tracking?.playerLocal?.location===name?tracking.playerLocal:null;if(me)markers.push({id:'__player',name:ft('player'),image:tracking.playerAvatar,x:me.x*16,y:me.y*16});
  const scale=(window.MapView?.getState().w||W)/W,radius=24/Math.max(.05,scale),key=JSON.stringify([name,markers,Math.round(scale*20)]);
  if(pinHost.dataset.liveKey===key&&!force)return;pinHost.dataset.liveKey=key;
  const groups=[];for(const p of markers){const g=p.id==='__player'?null:groups.find(g=>g[0].id!=='__player'&&Math.hypot(g[0].x-p.x,g[0].y-p.y)<radius);if(g)g.push(p);else groups.push([p]);}
  const place=(b,group)=>syncPin(b,group,group[0].x/W*100+'%',group[0].y/H*100+'%');
  ViewNodes.sync(pinHost,groups,{id:group=>group[0].id,key:group=>lang,update:place,create:group=>{const b=el('button','map-pin live-pin'+(group[0].id==='__player'?' player-pin':''));b.dataset.resident=group[0].id;place(b,group);
   b.onclick=()=>{const group=b._group,p=group[0];if(p.id==='__player')return;if(group.length===1){visitResident(p.id);return;}clusterPicker.replaceChildren(...group.map(q=>{const r=el('button');if(q.image)r.append(img(q.image));r.append(el('span','',q.name));r.onclick=()=>visitResident(q.id);return r;}));const x=el('button','',ft('cancel'));x.onclick=()=>clusterPicker.hidden=true;clusterPicker.append(x);clusterPicker.hidden=false;};return b;}});
  if(me&&following)centerPlayer();
 }

 // World-map hooks: keep every world code path, divert only while the local view is open.
 const worldRender=renderLiveMap;
 renderLiveMap=function(force){syncButton();if(!active)return worldRender(force);const displayName=MapNames.location(name,lang,map?.name);put('map-area',displayName);setScroll(displayName);
  if(model.status(performance.now())!=='ready'){wasOffline=true;status(tr('offline'));pinHost.replaceChildren();delete pinHost.dataset.liveKey;return;}
  if(model.snapshot?.session!==localSession){close();return;}
  if(wasOffline){wasOffline=false;if(map)status('');}
  const p=model.snapshot?.tracking?.playerLocal;
  if(following&&p&&p.location!==name){open(p.location,true);return;}
  if(refreshAt&&performance.now()>refreshAt){refreshAt=0;poll(token,0);}renderPins(force);};
 const follow=document.querySelector('.map-follow');
 follow?.addEventListener('click',e=>{if(!active)return;e.stopImmediatePropagation();if(model.status(performance.now())!=='ready')return;
  const me=playerPoint();if(!me){const p=model.snapshot?.tracking?.playerLocal;if(p)open(p.location,true);return;}
  setFollowing(!following);if(following)centerPlayer();},true);
 view.addEventListener('mapgesture',()=>{if(active)setFollowing(false);});
 for(const id of ['map-fit','map-zoom'])$(id).addEventListener('click',()=>{if(active)setFollowing(false);});
 regions.addEventListener('change',()=>{if(active)close();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&active&&!refreshAt)poll(token,0);});

 window.LocalMap={open:location=>open(location),close,focus:focusOn,focused:()=>focus&&{location:focus.location,count:focus.tiles.length/2,label:focus.label},active:()=>active,following:()=>following,
  // Cluster picker on the world map: one row to open the residents' shared location.
  decoratePicker(picker,group){const places=[...new Set(group.map(p=>model.snapshot?.tracking?.residents?.find(r=>r.id===p.id)?.local?.location).filter(Boolean))];
   if(places.length!==1)return;const b=el('button','map-local-open');b.append(el('span','',tr('view')));b.onclick=()=>{picker.hidden=true;open(places[0]);};picker.prepend(b);}};
 syncButton();
})();
