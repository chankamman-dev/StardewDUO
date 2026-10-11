/* The fishing minigame, live on the fishing page. The mod sends where the green bar, the fish and the
   treasure are and the catch progress about 20 times a second while the minigame is open (stream topic
   "reel", mod FishingLive), with the game's own sprites cut from the player's Cursors sheet. Drawn on a
   37x150 canvas - the bar sprite's own pixels - shown at 2x; positions ease from one frame to the next,
   every animation frame while the canvas is on the page. The mod's numbers are the game's track pixels
   at 4x; the sprite sits 4 px left of the game's drawing origin, hence the offsets below. */
(()=>{'use strict';
let last=null,prev=null,at=0,prevAt=0,session=null;const sprites=new Map();
function sprite(url){if(!url)return null;let i=sprites.get(url);if(!i){i=new Image();i.src=url;sprites.set(url,i);}return i.complete&&i.naturalWidth?i:null;}
// A frame from the stream (null: the minigame closed).
function frame(d,s){if(s!==session){session=s;last=null;}prev=last;prevAt=at;last=d&&typeof d==='object'?d:null;at=performance.now();
 if(last)for(const u of Object.values(last.art||{}))sprite(u);
 for(const c of document.querySelectorAll('.reel-live'))c.hidden=!last;}
const live=()=>!!last&&performance.now()-at<1500;
function canvas(){const c=document.createElement('canvas');c.className='reel-live';c.width=37;c.height=150;c.setAttribute('aria-hidden','true');c.hidden=!live();
 const draw=()=>{if(!c.isConnected)return;if(!c.hidden)paint(c);requestAnimationFrame(draw);};requestAnimationFrame(draw);return c;}
const lerp=(a,b,t)=>a+(b-a)*t;
function paint(c){const g=c.getContext('2d');g.imageSmoothingEnabled=false;g.clearRect(0,0,37,150);const d=last;if(!d)return;const a=d.art||{};
 const t=prev?Math.min(1,(performance.now()-at)/Math.max(16,at-prevAt)):1,from=prev||d,v=k=>lerp(Number(from[k])||0,Number(d[k])||0,t);
 const box=sprite(a.frame);if(box)g.drawImage(box,0,0);
 // Catch progress in the right-hand channel, red through yellow to green as in the game.
 const p=Math.max(0,Math.min(1,v('progress'))),h=Math.round(144*p);g.fillStyle=p<.5?`rgb(255,${Math.round(510*p)},0)`:`rgb(${Math.round(510*(1-p))},255,0)`;if(h>0)g.fillRect(32,146-h,4,h);
 // The green bar; dim and pulsing while the fish is outside it.
 const y=3+Math.round(v('bar')/4),bh=Math.max(4,Math.round((Number(d.barHeight)||0)/4)),top=sprite(a.barTop),mid=sprite(a.barMid),bot=sprite(a.barBottom);
 g.globalAlpha=d.inBar?1:.25*(Math.sin(performance.now()/100)+2);
 if(top&&mid&&bot){g.drawImage(top,17,y);g.drawImage(mid,17,y+2,9,bh-4);g.drawImage(bot,17,y+bh-2);}else{g.fillStyle='#6bd34a';g.fillRect(17,y,9,bh);}
 g.globalAlpha=1;
 // The treasure and the meter that fills while the bar is over it.
 if(d.treasure&&!d.treasureCaught){const ty=Math.round(v('treasurePos')/4),chest=sprite(a.treasure);if(chest)g.drawImage(chest,11,ty-1);
  if(d.treasureCatch>0){g.fillStyle='rgba(105,105,105,.5)';g.fillRect(17,3+ty,10,2);g.fillStyle='#ffa500';g.fillRect(17,3+ty,Math.round(10*Math.min(1,d.treasureCatch)),2);}}
 const fish=sprite(d.boss?a.boss:a.fish);if(fish)g.drawImage(fish,11,Math.round(v('fish')/4)-1);else{g.fillStyle='#3fa9d6';g.fillRect(17,Math.round(v('fish')/4)+5,9,8);}}
window.Reel={frame,canvas,live,peek:()=>live()?last:null};
})();
