// Display demand only; no gameplay command. Serialized requests prevent a late MAP
// response from leaving collection enabled after leaving the page.
(()=>{'use strict';
 let wanted='off',inFlight=false,pending=false,heartbeat=null,enteredAt=0;
 function desired(){if(stopped||document.hidden)return 'off';if(page==='map')return 'map';if(page==='people'||page==='manual'&&document.querySelector('#manual')?.dataset.journal==='equipment')return 'profile';return 'off';}
 async function send(){
  // Architecture v2 phase 5: the push stream holds the map / profile lease while it is up.
  const stream=window.StardewStream;
  if(stream?.live?.()){stream.setWant('tracking-map',wanted==='map');stream.setWant('tracking-profile',wanted==='profile');clearTimeout(heartbeat);if(wanted!=='off')heartbeat=setTimeout(send,1000);return;}
  stream?.setWant?.('tracking-map',false);stream?.setWant?.('tracking-profile',false);
  if(inFlight){pending=true;return;}inFlight=true;pending=false;const mode=wanted;
  try{const response=await fetch('/bridge/tracking/'+mode,{cache:'no-store',signal:AbortSignal.timeout(1000)});if(response.ok&&mode===wanted&&mode==='map'&&pending===false&&Date.now()-enteredAt<1000)window.poll?.();}catch{}
  finally{inFlight=false;if(pending||mode!==wanted)send();else if(wanted!=='off')heartbeat=setTimeout(send,1000);}}
 function update(){const next=desired();if(next===wanted)return;wanted=next;clearTimeout(heartbeat);send();}
 const original=showPage;showPage=function(next){if(next==='map'&&page!=='map')enteredAt=Date.now();const result=original(next);update();return result;};
 const lifecycle=window.stardewLifecycle;window.stardewLifecycle=active=>{lifecycle(active);update();};
 document.addEventListener('visibilitychange',update);
 const manual=document.querySelector('#manual');if(manual)new MutationObserver(update).observe(manual,{attributes:true,attributeFilter:['data-journal']});
 window.TrackingDemand={enteredAt:()=>enteredAt};send();update();
})();
