// Fusion Pixel Font 12px proportional: render whole lines on a fixed 2x backing,
// at integer PHYSICAL multiples of its pixel grid on the 1240x1080 target.
// The canvas is always 2x game space. Device DPR never changes glyph geometry.
(()=>{'use strict';
const assetBase=new URL('.',document.currentScript.src);
const selector='h1,h2,h3,p,small,strong,dt,dd,summary,button,button>span,#date,#money,#clock,#page-meta,#status,#location,#bag-page,#detail-count,#detail-label,.count,.quality,.tag,.control-label,#source-mark,.map-pin-label,.sample-label,.daily-state,.social-facts span,.schedule-list span,.map-cluster-count,.hud-vital>span';
const keys=new WeakMap();
// Pages rebuild their DOM often, so the same label is drawn again and again. Finished rasters are
// kept by everything that decides their pixels (text, size, font, wrap width, colours, alignment)
// and copied with one drawImage instead of redrawn glyph by glyph. Least recently used first out,
// bounded by total backing pixels (about 16 MB).
const rasters=new Map(),budget=4e6,stats={drawn:0,reused:0,ms:0};let cached=0,useCache=true;
function remember(key,canvas){const px=canvas.width*canvas.height;if(px>budget/8)return;rasters.set(key,canvas);cached+=px;for(const [k,c] of rasters){if(cached<=budget)break;rasters.delete(k);cached-=c.width*c.height;}}
function reuse(key){const src=rasters.get(key);if(!src)return null;rasters.delete(key);rasters.set(key,src);const c=document.createElement('canvas');c.className='raster';c.setAttribute('aria-hidden','true');Object.assign(c.dataset,src.dataset);c.width=src.width;c.height=src.height;c.style.width=src.style.width;c.style.height=src.style.height;c.getContext('2d').drawImage(src,0,0);return c;}let atlas,atlasPages=[],ready=false,queued=false,fullRefresh=false;const dirty=new Set();
const glyph=c=>atlas.glyphs[c.codePointAt(0)]||atlas.glyphs[-1];
const measure={measureText:s=>({width:[...s].reduce((v,c)=>v+glyph(c)[7],0)})};
function layout(){const width=window.visualViewport?.width||document.documentElement.clientWidth,height=window.visualViewport?.height||document.documentElement.clientHeight,scale=Math.min(width/620,height/540),shell=document.querySelector('.shell');if(!shell)return;shell.style.transform=`scale(${scale})`;shell.style.left=Math.floor((width-620*scale)/2)+'px';shell.style.top=Math.floor((height-540*scale)/2)+'px';shell.dataset.physicalScale=(scale*devicePixelRatio).toFixed(3);schedule();}
layout();addEventListener('resize',layout);window.visualViewport?.addEventListener('resize',layout);
function wrap(text,width,nowrap){const lines=[];let line='';
 const tokens=text.match(/[A-Za-z0-9][A-Za-z0-9'.,!?;:\/-]*|\n|[^\S\n]+|[^\x00-\x7F]|./gu)||[];
 for(const token of tokens){if(token==='\n'){lines.push(line.trimEnd());line='';continue;}if(!line&&/^\s+$/.test(token))continue;
  if(!nowrap&&measure.measureText(line+token).width>width&&line){
   // Keep closing CJK punctuation with its preceding character, never on a line alone.
   if(/^[。，！？；：、）》」』】]$/u.test(token)&&[...line].length>1){const chars=[...line];const last=chars.pop();lines.push(chars.join('').trimEnd());line=last;}else{lines.push(line.trimEnd());line='';if(/^\s+$/.test(token))continue;}
  }
  // Long words can break; ordinary words and short labels never split needlessly.
  if(!nowrap&&measure.measureText(token).width>width){for(const c of token){if(line&&measure.measureText(line+c).width>width){lines.push(line);line='';}line+=c;}}else line+=token;
 }
 lines.push(line.trimEnd());return lines;
}
// Two phases: prepare() only reads layout and style, paint() only writes. A refresh prepares every
// candidate before painting any, so layout is computed once instead of once per label (a long
// collection grid used to force a full layout for each of its hundreds of names).
function prepare(node){if(node.closest('.raster-copy')||!node.getClientRects().length||node.closest('[hidden]')||node.matches('input,select,option')||[...node.children].some(c=>!c.matches('.raster,.raster-copy')))return null;const str=node.textContent;if(!str.trim())return null;
 const style=getComputedStyle(node),size=parseFloat(style.getPropertyValue('--pixel-size'))||18,scale=size/12,english=document.documentElement.lang==='en'&&!/[\u3400-\u9fff]/u.test(str),family=english?'FusionLatin':'FusionHans',width=Math.max(12,node.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)-Math.ceil(scale+2)),nowrap=style.whiteSpace==='nowrap',line=Math.max(parseFloat(style.lineHeight)||30,16*scale+2),color=style.color,shadow=style.getPropertyValue('--text-shadow').trim()||'#ce9c5f';
 // A no-wrap label has the same pixels regardless of its container width. Its own
 // raster can change that width; treating it as a wrap input would redraw it again
 // whenever a sibling expanded, even though its text and appearance were unchanged.
 const center=style.textAlign==='center';const key=[str,size,family,nowrap?0:width,nowrap,line,color,shadow,center].join('|');if(keys.get(node)===key&&node.querySelector(":scope > .raster"))return null;
 return {node,str,size,scale,family,width,nowrap,line,color,shadow,center,key};}
function draw(node){const p=prepare(node);if(p)paint(p);}
function paint({node,str,size,scale,family,width,nowrap,line,color,shadow,center,key}){keys.set(node,key);const t0=performance.now();
 const hit=useCache&&reuse(key);if(hit){const copy=document.createElement('span');copy.className='raster-copy';copy.textContent=str;node.replaceChildren(copy,hit);stats.reused++;stats.ms+=performance.now()-t0;return;}measure.font=`12px ${family}`;measure.fontKerning='normal';
 const lines=wrap(str,width/scale,nowrap),lengths=lines.map(s=>Math.ceil(measure.measureText(s).width)+1),cw=Math.ceil(Math.max(...lengths)*scale+2),ch=Math.ceil(lines.length*line);
 const canvas=document.createElement('canvas');canvas.className='raster';canvas.setAttribute('aria-hidden','true');canvas.dataset.lines=lines.length;canvas.dataset.font=family;canvas.dataset.pixelScale=scale*2;canvas.width=cw*2;canvas.height=ch*2;canvas.style.width=cw+'px';canvas.style.height=ch+'px';
 const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
 for(let i=0;i<lines.length;i++){
  // Wrapped lines follow a centred container, like the native text would.
  const ox=center&&lines.length>1?Math.floor((canvas.width-lengths[i]*scale*2)/2):0;
  const strip=document.createElement('canvas');strip.width=lengths[i];strip.height=16;const sc=strip.getContext('2d'),fallback=[];let x=0;
  for(const c of lines[i]){const [p,gx,gy,w,h,bx,by,advance]=glyph(c);if(!atlas.glyphs[c.codePointAt(0)])fallback.push({c,x});else if(w&&h)sc.drawImage(atlasPages[p],gx,gy,w,h,x+bx,13-by-h,w,h);x+=advance;}
  sc.globalCompositeOperation='source-in';sc.fillStyle=shadow;sc.fillRect(0,0,strip.width,16);ctx.drawImage(strip,ox+2,i*line*2+2,strip.width*scale*2,16*scale*2);
  sc.fillStyle=color;sc.fillRect(0,0,strip.width,16);ctx.drawImage(strip,ox,i*line*2,strip.width*scale*2,16*scale*2);
  // Upstream BDF intentionally lacks some characters (e.g. 鹕). Never show .notdef boxes.
  // Native fallback is used only for those codepoints, at the same em and baseline.
  ctx.font=`${size*2}px FusionHans, monospace`;for(const f of fallback){const px=ox+f.x*scale*2,py=i*line*2+13*scale*2;ctx.fillStyle=shadow;ctx.fillText(f.c,px+2,py+2);ctx.fillStyle=color;ctx.fillText(f.c,px,py);}
  if(fallback.length)canvas.dataset.fallback=(canvas.dataset.fallback||'')+fallback.map(f=>f.c).join('');
 }
 const copy=document.createElement('span');copy.className='raster-copy';copy.textContent=str;node.replaceChildren(copy,canvas);if(useCache)remember(key,canvas);stats.drawn++;stats.ms+=performance.now()-t0;
}
function refresh(){queued=false;if(!ready){dirty.clear();fullRefresh=false;return;}
 const roots=fullRefresh?[document.body]:[...dirty];dirty.clear();fullRefresh=false;
 const candidates=new Set();for(const root of roots){if(!root.isConnected||root.closest('[hidden]'))continue;if(root.matches(selector))candidates.add(root);root.querySelectorAll(selector).forEach(n=>candidates.add(n));}
 const jobs=[];for(const n of candidates){const p=prepare(n);if(p)jobs.push(p);}jobs.forEach(paint);
}
function schedule(root){if(root instanceof Element)dirty.add(root);else fullRefresh=true;if(!queued){queued=true;requestAnimationFrame(refresh);}}
new MutationObserver(records=>{for(const r of records){const target=r.target.nodeType===1?r.target:r.target.parentElement;if(!target||target.closest('.raster-copy,.raster,.stack-digits'))continue;
 if(r.type==='attributes'){if(r.oldValue===target.getAttribute(r.attributeName))continue;schedule(target);}
 else if(r.type==='characterData')schedule(target);
 else if([...r.addedNodes].some(n=>n.nodeType!==1||!n.matches('.raster,.raster-copy,.stack-digits')))schedule(target);
}}).observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeOldValue:true,attributeFilter:['hidden','lang','class']});
Promise.all([fetch(new URL('fonts/fusion-bitmap.json',assetBase)).then(r=>r.json()),document.fonts.load('12px FusionHans'),document.fonts.load('12px FusionLatin')]).then(async ([data])=>{atlas=data;atlasPages=await Promise.all(Array.from({length:data.pages},async(_,i)=>{const im=new Image();im.src=new URL('fonts/fusion-bitmap-'+i+'.png',assetBase);await im.decode();return im;}));ready=true;document.body.dataset.gameFont='fusion-pixel';schedule();}).catch(()=>{document.body.dataset.gameFont='load-failed';});
window.GameFont={refresh:schedule,layout,stats:()=>({...stats,cached:rasters.size}),cache:on=>{useCache=!!on;if(!on){rasters.clear();cached=0;}}};})();
