// Inventory partition: InventoryPage.drawHorizontalPartition joins a beam into both
// frame edges, which the bag page's own overflow would clip. Draw it on the book
// instead and keep it level with the top of the item detail. Visual only.
(()=>{'use strict';
 const book=document.querySelector('.book'),bag=document.getElementById('bag'),detail=document.getElementById('detail');
 if(!book||!bag||!detail)return;
 const beam=document.createElement('div');beam.className='ui-partition';beam.hidden=true;book.append(beam);
 let queued=false;
 function place(){queued=false;const show=!bag.hidden&&detail.offsetParent!==null&&getComputedStyle(detail).display!=='none';beam.hidden=!show;if(!show)return;
  // Beam rows are 10..22 logical px inside the 32px tile; the detail keeps that band clear.
  beam.style.top=(bag.offsetTop+detail.offsetTop-bag.scrollTop-10)+'px';}
 function schedule(){if(!queued){queued=true;requestAnimationFrame(place);}}
 new ResizeObserver(schedule).observe(book);new ResizeObserver(schedule).observe(bag);
 const slots=document.getElementById('slots');if(slots)new ResizeObserver(schedule).observe(slots);
 new MutationObserver(schedule).observe(document.body,{attributes:true,attributeFilter:['data-current-page']});
 new MutationObserver(schedule).observe(bag,{attributes:true,attributeFilter:['hidden']});
 schedule();
})();


// Dropdowns: the native <select> stays as the source of truth (value, change events,
// tests, accessibility) but never opens Android's system picker. A tap opens a game
// style list under the box, like OptionsDropDown; choosing writes the value back and
// fires input/change so every existing handler and label sync runs unchanged.
(()=>{'use strict';
 const book=document.querySelector('.book');if(!book)return;
 let open=null;
 const play=cue=>window.ThorSound?.play(cue);
 function close(focus=true){if(!open)return;const {select,layer}=open;open=null;layer.remove();if(focus)select.focus({preventScroll:true});}
 function choose(select,value){close();if(select.value===value)return;select.value=value;select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}));}
 // The layer is fixed inside the transformed .shell, so it spans the whole canvas and
 // is the origin for placement; measure in its unscaled pixels.
 function place(control,layer,menu){
  const L=layer.getBoundingClientRect(),r=control.getBoundingClientRect(),B=book.getBoundingClientRect(),scale=L.width/layer.offsetWidth||1,px=v=>v/scale;
  const left=px(r.left-L.left),top=px(r.top-L.top),bottom=px(r.bottom-L.top),width=px(r.width),minX=px(B.left-L.left)+book.clientLeft,maxX=px(B.right-L.left)-book.clientLeft,minY=px(B.top-L.top)+book.clientTop,maxY=px(B.bottom-L.top)-book.clientTop;
  const room=maxY-bottom-4,above=top-minY-4,upward=room<Math.min(menu.scrollHeight,220)&&above>room;
  menu.style.minWidth=width+'px';menu.style.maxWidth=(maxX-minX)+'px';menu.style.maxHeight=Math.max(120,upward?above:room)+'px';
  menu.style.left=Math.max(minX,Math.min(left,maxX-menu.offsetWidth))+'px';
  if(upward){menu.style.top='';menu.style.bottom=(layer.offsetHeight-top+2)+'px';}else{menu.style.bottom='';menu.style.top=(bottom+2)+'px';}
 }
 function show(select){
  if(select.disabled||!select.options.length)return;close(false);
  const control=select.closest('.select-control')||select,layer=document.createElement('div'),menu=document.createElement('div');
  layer.className='ui-menu-layer';menu.className='ui-menu';menu.setAttribute('role','listbox');menu.setAttribute('aria-label',select.getAttribute('aria-label')||'');
  for(const o of select.options){const b=document.createElement('button'),s=document.createElement('span');b.type='button';b.className='ui-menu-option';b.setAttribute('role','option');b.dataset.value=o.value;b.setAttribute('aria-selected',String(o.selected));b.disabled=o.disabled;s.textContent=o.textContent;b.append(s);if(o.dataset.count!=null)b.append(countBadge(o.dataset.count));b.addEventListener('click',()=>choose(select,o.value));menu.append(b);}
  layer.addEventListener('pointerdown',e=>{if(e.target===layer){e.preventDefault();close();play('cancel');}});
  layer.append(menu);book.append(layer);open={select,layer};place(control,layer,menu);
  const current=menu.querySelector('[aria-selected=true]')||menu.firstElementChild;current.scrollIntoView({block:'nearest'});current.focus({preventScroll:true});
  play('smallSelect');
 }
 document.addEventListener('click',e=>{const control=e.target.closest?.('.select-control');if(!control||open?.layer.contains(e.target))return;const select=control.querySelector('select');if(!select)return;e.preventDefault();show(select);},true);
 document.addEventListener('keydown',e=>{
  if(open){const items=[...open.layer.querySelectorAll('.ui-menu-option:not(:disabled)')],i=items.indexOf(document.activeElement);
   if(e.key==='Escape'||e.key==='Backspace'){e.preventDefault();close();play('cancel');}
   else if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const n=items[(i+(e.key==='ArrowDown'?1:-1)+items.length)%items.length];n?.focus();n?.scrollIntoView({block:'nearest'});}
   else if(e.key==='Tab')close(false);
   return;}
  const select=e.target.closest?.('.select-control select');
  if(select&&['Enter',' ','ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();show(select);}
 },true);
 // Leaving the page, resizing or a re-render that detaches the select closes the list.
 new MutationObserver(()=>{if(open&&(!open.select.isConnected||open.select.closest('[hidden]')))close(false);}).observe(document.body,{attributes:true,childList:true,subtree:true,attributeFilter:['hidden','data-current-page']});
 addEventListener('resize',()=>close(false));
})();
