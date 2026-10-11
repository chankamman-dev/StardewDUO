// Tap equips on release; drag and long press never also equip. The game owns items.
(()=>{'use strict';
const grid=$('slots');let gesture=null,hold=null,pagerTimer=null,pager=null,ignoreClick=0,queued=null,running=false,pendingKind=null;
const available=()=>model.status(performance.now())==='ready'&&model.snapshot?.control?.enabled&&(!window.ThorCommands?.paired||ThorCommands.paired());
function cancel(){clearTimeout(hold);clearTimeout(pagerTimer);pager=null;const g=gesture;gesture=null;if(g){g.ghost?.remove();g.node?.classList.remove('dragging');if(grid.hasPointerCapture(g.pointer))grid.releasePointerCapture(g.pointer);}document.querySelectorAll('.drop-target').forEach(n=>n.classList.remove('drop-target'));}
function enqueue(action,from,to=-1){const s=model.snapshot,v=s?.bag?.slots[from];if((!v&&(action!=='select'||!s?.control?.emptySelection))||!available()){message(ft(controlReason()),1800);return;}
 queued={action,from,to,key:v?.key??null,target:s.bag.slots[to]?.key??null,session:s.session,revision:s.revision};drain();}
async function drain(){if(running||commandPending||gesture||!queued)return;const c=queued;queued=null;
 const s=model.snapshot;if(!available()||page!=='bag'||s.session!==c.session||(s.bag.slots[c.from]?.key??null)!==c.key)return;
 if(c.action==='move'&&(s.revision!==c.revision||(s.bag.slots[c.to]?.key??null)!==c.target)){message(ft('inventory-changed'));return;}
 if(c.action==='select'&&s.control.activeSlot===c.from)return;
 running=true;pendingKind=c.action;grid.dataset.pending=String(c.from);try{const result=await execute(c.action,c.from,c.to,null,c.action==='select');if(result?.state!=='applied')queued=null;}finally{running=false;pendingKind=null;delete grid.dataset.pending;render();drain();}}
function pick(index,equip=true){window.ThorSound?.play('smallSelect');selected=index;render();if(equip&&(model.snapshot?.bag?.slots[index]||model.snapshot?.control?.emptySelection))enqueue('select',index);}
grid.addEventListener('contextmenu',e=>e.preventDefault());grid.addEventListener('dragstart',e=>e.preventDefault());
grid.addEventListener('pointerdown',e=>{
 const node=e.target.closest('.slot');if(!node||e.button!==0||e.isPrimary===false)return;
 const index=Number(node.dataset.index),item=model.snapshot?.bag?.slots[index];
 if(gesture)cancel();if(!item||!available()||(commandPending&&pendingKind!=='select'))return;
 queued=null;gesture={pointer:e.pointerId,index,key:item.key,session:model.snapshot.session,revision:model.snapshot.revision,x:e.clientX,y:e.clientY,node,moved:false,ghost:null};
 grid.setPointerCapture(e.pointerId);selected=index;render();
 hold=setTimeout(()=>{if(gesture&&!gesture.moved&&item.stack>1){cancel();ignoreClick=performance.now()+700;askItem('split');}},500);
});
document.addEventListener('pointermove',e=>{const g=gesture;if(!g||g.pointer!==e.pointerId)return;
 if(!g.moved&&Math.hypot(e.clientX-g.x,e.clientY-g.y)>8){g.moved=true;window.ThorSound?.play('smallSelect');clearTimeout(hold);g.ghost=img(model.snapshot.bag.slots[g.index]?.icon||'art/icon-bag.png');g.ghost.className='drag-ghost';document.body.append(g.ghost);g.node.classList.add('dragging');}
 if(!g.moved)return;e.preventDefault();g.ghost.style.left=e.clientX+'px';g.ghost.style.top=e.clientY+'px';
 const hit=document.elementFromPoint(e.clientX,e.clientY);document.querySelectorAll('.drop-target').forEach(n=>n.classList.remove('drop-target'));hit?.closest('.slot')?.classList.add('drop-target');
 const next=hit?.closest('#bag-prev,#bag-next,.bag-dot');if(next!==pager){clearTimeout(pagerTimer);pager=next;if(next&&!next.disabled)pagerTimer=setTimeout(()=>{if(gesture){bagPage=next.classList.contains('bag-dot')?Number(next.dataset.page):bagPage+(next.id==='bag-next'?1:-1);render();}},450);}
},{passive:false});
document.addEventListener('pointerup',e=>{const g=gesture;if(!g||g.pointer!==e.pointerId)return;const dest=document.elementFromPoint(e.clientX,e.clientY)?.closest('.slot');cancel();ignoreClick=performance.now()+450;
 if(g.session!==model.snapshot?.session||model.snapshot?.bag?.slots[g.index]?.key!==g.key)return;
 if(g.moved){if(dest&&Number(dest.dataset.index)!==g.index){if(g.revision!==model.snapshot.revision)message(ft('inventory-changed'));else enqueue('move',g.index,Number(dest.dataset.index));}}
 else pick(g.index);
});
for(const type of ['pointercancel','lostpointercapture'])grid.addEventListener(type,e=>{if(gesture?.pointer===e.pointerId){cancel();ignoreClick=performance.now()+450;}});
grid.addEventListener('click',e=>{const node=e.target.closest('.slot');if(!node)return;e.preventDefault();e.stopImmediatePropagation();if(performance.now()<ignoreClick)return;pick(Number(node.dataset.index));},true);
addEventListener('blur',()=>{cancel();queued=null;});document.addEventListener('visibilitychange',()=>{if(document.hidden){cancel();queued=null;}});
const prior=render;render=function(){prior();if(page!=='bag'||!available()){cancel();queued=null;}else if(gesture&&(gesture.session!==model.snapshot.session||gesture.revision!==model.snapshot.revision)){cancel();queued=null;}
 for(const b of grid.children)b.classList.toggle('pending-select',pendingKind==='select'&&Number(b.dataset.index)===Number(grid.dataset.pending));};
window.BagInput={drain,cancel,confirm:index=>{const n=[...grid.children].find(n=>Number(n.dataset.index)===index);if(n){n.classList.add('authority-confirmed');setTimeout(()=>n.classList.remove('authority-confirmed'),400);}},busy:()=>!!(gesture||queued||running||commandPending)};
})();
