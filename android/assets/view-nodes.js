// Keep decoded images, focus and font canvases when a keyed view updates.
(()=>{'use strict';const views=new WeakMap();
function sync(host,rows,{id,key,create,update}){let cache=views.get(host);if(!cache){cache=new Map();views.set(host,cache);}const keep=new Set();let before=host.firstChild;
 for(const row of rows){const identity=id(row),signature=key(row);keep.add(identity);let entry=cache.get(identity);
  if(!entry||entry.key!==signature){entry={key:signature,node:create(row)};cache.set(identity,entry);}
  update?.(entry.node,row);if(entry.node===before)before=before.nextSibling;else host.insertBefore(entry.node,before);
 }
 while(before){const next=before.nextSibling;before.remove();before=next;}for(const identity of cache.keys())if(!keep.has(identity))cache.delete(identity);
}
// Morph: bring a live element in line with a freshly built copy, touching only what differs. A page
// can then rebuild its whole view on any change and the screen still only changes where the content
// did: kept nodes keep decoded images, focus, scroll, running CSS animations and pixel-text canvases.
// Nodes match in order by tag and identity (id or data-id/part/person/resident/key/tab); a node marked
// data-morph="replace" is always swapped. Handlers set as properties (onclick…) move to the kept node.
const HANDLERS=['onclick','oninput','onchange','onerror','onload','onpointerdown','onpointerup','onkeydown','onscroll'];
// What a row stands for: an id, or the record it shows (event, item, skill, slot, day, filter tab).
// A list sorted differently then moves its rows instead of rewriting each one in place.
function identity(n){if(n.nodeType!==1)return '#'+n.nodeType;const d=n.dataset;return n.tagName+'|'+(n.id||d.id||d.part||d.person||d.resident||d.key||d.tab||d.event||d.item||d.skill||d.slot||d.day||d.filter||'');}
function same(a,b){return a.nodeType===b.nodeType&&identity(a)===identity(b)&&!(a.nodeType===1&&(a.dataset.morph==='replace'||b.dataset.morph==='replace'||b.tagName==='CANVAS'));}
// Inline styles go through the CSSOM: the App's Content-Security-Policy (style-src 'self') silently
// ignores setAttribute('style'), which would leave bar widths and positions at their old values.
function attributes(old,next){
 for(const a of [...old.attributes])if(a.name!=='style'&&!next.hasAttribute(a.name))old.removeAttribute(a.name);
 for(const a of next.attributes)if(a.name!=='style'&&old.getAttribute(a.name)!==a.value)old.setAttribute(a.name,a.value);
 if(old.style&&old.style.cssText!==(next.style?.cssText||''))old.style.cssText=next.style?.cssText||'';
 for(const h of HANDLERS)if(old[h]!==next[h])old[h]=next[h];
}
// Form controls are taken from the new build (their handlers read the control they were built with),
// carrying over what the player typed, the caret and focus.
const FORM=new Set(['INPUT','SELECT','TEXTAREA']);
function adopt(old,next){const focused=document.activeElement===old;if(focused&&old.tagName!=='SELECT')next.value=old.value;
 let start=null,end=null;try{start=old.selectionStart;end=old.selectionEnd;}catch{}old.replaceWith(next);if(focused){next.focus({preventScroll:true});try{if(start!=null)next.setSelectionRange(start,end);}catch{}}return next;}
// Pixel text and digits (game-font.js, quantity-font.js) replaced the words with a canvas of them:
// the same words keep it.
function sameWords(old,next){return !next.firstElementChild&&!!old.querySelector(':scope > .raster-copy')&&old.textContent===next.textContent;}
function patch(old,next){if(old.nodeType!==1){if(old.nodeValue!==next.nodeValue)old.nodeValue=next.nodeValue;return;}
 attributes(old,next);if(!sameWords(old,next))children(old,next);}
function children(live,next){const want=[...next.childNodes];let cur=live.firstChild;
 for(const n of want){
  if(cur&&same(cur,n)&&FORM.has(n.tagName)){cur=adopt(cur,n).nextSibling;continue;}
  if(cur&&same(cur,n)){patch(cur,n);cur=cur.nextSibling;continue;}
  // A node further on (a row inserted or removed above it, a list sorted again) is moved, not rebuilt.
  let found=null;for(let s=cur?.nextSibling,i=0;s&&i<32;s=s.nextSibling,i++)if(same(s,n)){found=s;break;}
  if(found){live.insertBefore(found,cur);patch(found,n);continue;}
  live.insertBefore(n,cur);}
 while(cur){const after=cur.nextSibling;cur.remove();cur=after;}}
// morph(live, built): built is a detached element of the same kind holding the new view.
function morph(live,built){attributes(live,built);children(live,built);}
window.ViewNodes={sync,morph};})();
