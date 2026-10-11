// A brief same-location display bridge across PROFILE → MAP demand. Never mutate
// the snapshot or use cached positions for game commands / player following.
(()=>{'use strict';let cached=null,session=null,location=null,pending=false;
function remember(){const s=model.snapshot;if(model.status(performance.now())!=='ready'){cached=null;pending=false;return;}
 if(s.session!==session||s.world?.location!==location){cached=null;session=s.session;location=s.world?.location;}
 if(s.tracking?.player&&s.tracking.maps?.length)cached=s.tracking;
}
function read(){remember();const t=model.status(performance.now())==='ready'?model.snapshot?.tracking:null;
 pending=!!(t&&!t.player&&cached&&page==='map'&&Date.now()-window.TrackingDemand.enteredAt()<2000);
 return pending?{...t,player:cached.player,playerLocal:cached.playerLocal,residents:cached.residents}:t;
}
const previous=render;render=function(){remember();return previous();};
window.TrackingDisplay={read,pending:()=>pending};})();
