// The original game's stack counter is a 5x7 texture, not its normal text font.
// DrawMenuIcons uses scale 3, advancing 5*scale - 1. Keep its baked pixel edges.
(()=>{'use strict';
 const base=new URL('.',document.currentScript.src),image=new Image(),scale=3,backing=2,advance=5*scale-1;
 const automatic='.slot .count,#detail-count',explicit='[data-stack-value]',options=new WeakMap(),keys=new WeakMap();let ready=false,queued=false;
 const valid=v=>Number.isSafeInteger(Number(v))&&Number(v)>=0&&Number(v)<=2147483647;
 function set(node,value,opts={}){
  if(!node||!valid(value))return node;
  value=Number(value);options.set(node,opts);node.dataset.stackValue=String(value);
  const visible=(opts.showOne||value>1)&&value!==2147483647,shown=visible?String(value):'',prefix=visible?(opts.prefix||''):'';
  // Keep readable text until the local texture is ready, including asset-load failure.
  if(!ready){const text=(prefix?prefix+' ':'')+shown;if(node.textContent!==text)node.textContent=text;return node;}
  const key=[shown,prefix,ready].join('|');if(keys.get(node)===key&&node.querySelector(':scope > .stack-digits'))return node;
  keys.set(node,key);node.classList.add('stack-quantity');
  const copy=document.createElement('span');copy.className='raster-copy';copy.textContent=shown;
  const canvas=document.createElement('canvas');canvas.className='stack-digits';canvas.dataset.font='stardew-tiny-digits';canvas.dataset.lines='1';canvas.dataset.quantity=String(value);canvas.dataset.pixelScale=String(scale*backing);canvas.setAttribute('aria-hidden','true');
  const width=shown?5*scale+(shown.length-1)*advance:0,height=shown?7*scale:0;
  canvas.width=width*backing;canvas.height=height*backing;canvas.style.width=width+'px';canvas.style.height=height+'px';
  if(ready&&shown){const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;for(let i=0;i<shown.length;i++)ctx.drawImage(image,Number(shown[i])*5,0,5,7,i*advance*backing,0,5*scale*backing,7*scale*backing);}
  const children=[];if(prefix){const p=document.createElement('small');p.className='stack-prefix';p.textContent=prefix;children.push(p);}
  children.push(copy,canvas);node.replaceChildren(...children);return node;
 }
 function refresh(){queued=false;
  document.querySelectorAll(automatic).forEach(node=>{const text=node.textContent.trim(),match=text.match(/^(?:[×x]\s*)?(\d+)$/);if(match)set(node,Number(match[1]),{showOne:node.id==='detail-count',prefix:node.id==='detail-count'?'×':''});else if(!text){delete node.dataset.stackValue;keys.delete(node);}});
  document.querySelectorAll(explicit).forEach(node=>{if(!node.matches(automatic))set(node,Number(node.dataset.stackValue),options.get(node)||{showOne:node.dataset.stackShowOne==='true'});});
 }
 function schedule(){if(!queued){queued=true;requestAnimationFrame(refresh);}}
 // Touch capture remains on the existing inventory grid; only a counter's children change.
 new MutationObserver(records=>{if(records.some(r=>r.type==='characterData'||r.target.nodeType===1&&(r.target.matches(automatic)||r.target.matches(explicit))||[...r.addedNodes].some(n=>n.nodeType===1&&(n.matches(automatic+','+explicit)||n.querySelector(automatic+','+explicit)))))schedule();}).observe(document.body,{childList:true,subtree:true,characterData:true});
 const promise=image.decode?new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=new URL('art/stack-digits.png',base);}):Promise.reject(Error('Texture decoding unavailable'));
 promise.then(()=>{ready=true;document.body.dataset.stackFont='stardew-tiny-digits';refresh();}).catch(()=>{document.body.dataset.stackFont='load-failed';});
 window.StackDigits={set,create:(value,opts={})=>set(document.createElement('span'),value,opts),refresh:schedule,ready:()=>ready};
 schedule();
})();
