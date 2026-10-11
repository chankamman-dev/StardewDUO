// Short pixel presses confirm touch without changing layout or taking pointer capture.
(()=>{'use strict';
const selector='button,summary,select',timers=new Map(),completed=new Map();let press=null;
function control(target){const node=target instanceof Element?target.closest(selector):null;return node&&!node.matches(':disabled,[aria-disabled=true]')&&!node.closest('[inert]')?node:null;}
function clear(node){if(!node)return;clearTimeout(timers.get(node));timers.delete(node);node.classList.remove('thor-pressed','thor-tapped');}
const rows='.journal-row,.person,.catalog-item';
function kind(node){return node.matches(rows)?'row':node.matches('.slot')?'slot':node.closest('.tabs')?'tab':'control';}
function cancel(){if(!press)return;press.cancelled=true;clear(press.node);}
function finish(e,cancelled=false){if(!press||press.pointerId!==e.pointerId)return;const current=press;press=null;current.cancelled||=cancelled;completed.set(e.pointerId,{node:current.node,cancelled:current.cancelled});if(completed.size>8)completed.delete(completed.keys().next().value);clear(current.node);if(!current.cancelled&&!current.moved&&current.node.isConnected&&!current.node.matches(':disabled,[aria-disabled=true]')){current.node.classList.add('thor-tapped');timers.set(current.node,setTimeout(()=>clear(current.node),70));}}
document.addEventListener('pointerdown',e=>{completed.delete(e.pointerId);if(press){cancel();finish({pointerId:press.pointerId},true);}if(e.button!==0||e.isPrimary===false)return;const node=control(e.target);if(!node)return;clear(node);node.dataset.feedbackKind=kind(node);press={pointerId:e.pointerId,node,x:e.clientX,y:e.clientY,cancelled:false};node.classList.add('thor-pressed');},{capture:true,passive:true});
document.addEventListener('pointermove',e=>{if(press?.pointerId===e.pointerId&&Math.hypot(e.clientX-press.x,e.clientY-press.y)>8){press.moved=true;clear(press.node);}},{capture:true,passive:true});
document.addEventListener('pointerup',e=>finish(e),{capture:true,passive:true});
document.addEventListener('pointercancel',e=>finish(e,true),{capture:true,passive:true});
document.addEventListener('lostpointercapture',e=>{if(press?.pointerId===e.pointerId)finish(e,true);},{capture:true,passive:true});
document.addEventListener('scroll',e=>{document.querySelectorAll('.thor-tapped').forEach(clear);if(press&&(e.target===document||e.target?.contains?.(press.node)))cancel();},{capture:true,passive:true});
function reset(){if(press){cancel();finish({pointerId:press.pointerId},true);}for(const node of [...timers.keys()])clear(node);document.querySelectorAll('.thor-pressed,.thor-tapped').forEach(clear);}
addEventListener('blur',reset);document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();});
// Pointer results are consumed by the next click for that pointer, not a timer.
// This avoids click sounds after scrolling while allowing every new deliberate tap.
// A browser click is authoritative after small motion. Only an actual scroll or
// pointer cancellation invalidates it; stale results never suppress another control.
const decisions=new WeakMap();
function accepted(event,node){if(decisions.has(event))return decisions.get(event);let ok=true;
 if(event.detail!==0){const id=Number.isInteger(event.pointerId)?event.pointerId:[...completed.keys()].at(-1),previous=completed.get(id);completed.delete(id);ok=!previous||previous.node!==node||!previous.cancelled;}
 decisions.set(event,ok);return ok;
}
function shouldSound(event,node){return accepted(event,node);}
document.addEventListener('click',event=>{const node=control(event.target);if(!node||node.matches('.slot')||!accepted(event,node))return;clear(node);node.dataset.feedbackKind=kind(node);node.classList.add('thor-tapped');timers.set(node,setTimeout(()=>clear(node),70));},{capture:true});

window.ThorFeedback={control,shouldSound,reset};
})();
