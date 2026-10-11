// One serialized lease stream: a delayed ON can never arrive after the final OFF.
(()=>{'use strict';
 let wanted=false,inFlight=false,pending=false,heartbeat=null,supported=null,ack=false,floor=-1,entrySession=null;
 function desired(){return page==='target'&&!document.hidden&&!stopped;}
 async function send(){
  // Architecture v2 phase 5: while the push stream is up it holds the lease (and releases it when the
  // page is left); ack once the mod has the demand. HTTP on/off is the fallback without a stream.
  const stream=window.StardewStream;
  if(stream?.live?.()){stream.setWant('target',wanted);clearTimeout(heartbeat);
   if(wanted){if(stream.acked('target')){supported=true;if(!ack||entrySession!==model.snapshot?.session){floor=model.snapshot?.seq??-1;entrySession=model.snapshot?.session;ack=true;}}heartbeat=setTimeout(send,200);}
   return;}
  stream?.setWant?.('target',false);
  if(inFlight){pending=true;return;}inFlight=true;pending=false;const on=wanted;
  try{const r=await fetch('/bridge/target/'+(on?'on':'off'),{cache:'no-store',signal:AbortSignal.timeout(1000)});
   if(r.status===404){supported=false;ack=false;}
   else if(r.ok){const value=await r.json();if(value.enabled!==on)throw Error('lease');supported=true;
    if(on&&wanted&&(!ack||entrySession!==model.snapshot?.session)){floor=model.snapshot?.seq??-1;entrySession=model.snapshot?.session;ack=true;}
   }else throw Error('lease');
  }catch{ack=false;}finally{inFlight=false;if(pending||on!==wanted)send();else if(wanted)heartbeat=setTimeout(send,500);}
 }
 function update(){const next=desired();if(next===wanted)return;wanted=next;ack=false;floor=model.snapshot?.seq??-1;entrySession=model.snapshot?.session;clearTimeout(heartbeat);send();}
 const oldPage=showPage;showPage=function(next){const result=oldPage(next);update();return result;};
 const lifecycle=window.stardewLifecycle;window.stardewLifecycle=active=>{lifecycle(active);update();};
 document.addEventListener('visibilitychange',update);
 window.TargetDemand={canDisplay:s=>supported===false||(wanted&&ack&&s&&s.session===entrySession&&s.seq>floor),supported:()=>supported};
 // Explicit OFF also cleans up a lease left by a previous WebView instance.
 send();update();
})();
