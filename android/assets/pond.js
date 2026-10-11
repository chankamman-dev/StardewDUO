/* The fishing pond, one pixel picture (docs/motion.md): sky and water in dithered bands for the time
   of day and the weather, a far tree line, clouds or stars, a bamboo rod, the line drawn pixel by pixel
   from the rod tip to the bobber, the bobber riding the water, ripples, the fish's shadow (following
   the live minigame when the mod sends it, reel.js) and the leap when it is caught. Every part is
   placed on one grid - 1 art pixel = 2 CSS pixels, the same scale as the live minigame bar - so the line
   always meets the rod tip and the bobber. 24 frames a second; still under reduced motion. */
(()=>{'use strict';
const S=2,STEP=42;
function bayer(n){let m=[[0]];while(m.length<n){const s=m.length,r=[];for(let y=0;y<2*s;y++){r.push([]);for(let x=0;x<2*s;x++)r[y].push(4*m[y%s][x%s]+[[0,2],[3,1]][y/s|0][x/s|0]);}m=r;}return m;}
const B8=bayer(8),hex=c=>[parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)],css=c=>`rgb(${c[0]},${c[1]},${c[2]})`;
const PAL={
 day:{sky:['#5fb8ea','#80c9ef','#a6dcf5','#cdeefa'],water:['#55aee0','#4194cc','#337db6','#28679b'],shore:['#3f7a3a','#5b9a48'],glint:'#eaf7ff',cloud:'#ffffff',cloudShade:'#d7ecf8'},
 evening:{sky:['#4a3f86','#9a5a8f','#e58a6c','#ffc27a'],water:['#5a6aa6','#4a5690','#3b4678','#2e3862'],shore:['#2e3a34','#45503e'],glint:'#ffd9a0',cloud:'#f6b49a',cloudShade:'#c97f84'},
 night:{sky:['#14173e','#1b1f4c','#23285e','#2e3270'],water:['#22366a','#1c2e5c','#16254b','#111d3b'],shore:['#0f1a1d','#1a2a2a'],glint:'#9fb2ff',cloud:null,cloudShade:null},
 rain:{sky:['#71849a','#8496aa','#98a9ba','#acbbc9'],water:['#5f86a6','#527895','#466a84','#3a5b72'],shore:['#3a5a40','#4b6d4c'],glint:'#dbe6f0',cloud:'#c3ceda',cloudShade:'#9fadbc'}};
const ROD={dark:hex('#4a2a14'),cane:hex('#c8902e'),high:hex('#efc46a'),low:hex('#8a5a1c'),cork:hex('#9c5a2c'),corkDot:hex('#6b3a1a'),grip:hex('#7a3b1e'),reel:hex('#a8b2bd'),reelDark:hex('#5c6672')},LINE=hex('#f4f1e6');
const BOB={stem:hex('#3b2416'),line:hex('#4a1c14'),red:hex('#d8483a'),shine:hex('#ff8f78'),white:hex('#f4f1e6'),shade:hex('#c9c2b0')};
let state={phase:'wait',time:'day',weather:'clear',icon:null,fight:0,progress:0,since:0},version=0;
const images=new Map();
function image(src){if(!src)return null;let i=images.get(src);if(!i){i=new Image();i.src=src;images.set(src,i);}return i.complete&&i.naturalWidth?i:null;}
// A dark silhouette of the fish sprite for its shadow under the water.
const shadows=new Map();
function shadow(src,tint){const i=image(src);if(!i)return null;const k=src+tint;let c=shadows.get(k);if(c)return c;c=document.createElement('canvas');c.width=i.naturalWidth;c.height=i.naturalHeight;const g=c.getContext('2d');g.drawImage(i,0,0);g.globalCompositeOperation='source-in';g.fillStyle=tint;g.fillRect(0,0,c.width,c.height);shadows.set(k,c);return c;}
// The page tells the pond what to show; a new phase restarts that phase's motion.
function update(next){if(next.phase!==state.phase)next.since=performance.now();else next.since=state.since;const merged={...state,...next};if(JSON.stringify(merged)!==JSON.stringify(state)){state=merged;version++;}}
function canvas(){const c=document.createElement('canvas');c.className='pond-canvas';c.setAttribute('aria-hidden','true');let bg=null,key='',frame=-1,drawn=-1;
 const draw=now=>{if(!c.isConnected)return;requestAnimationFrame(draw);const w=Math.max(40,Math.round(c.clientWidth/S)),h=Math.max(40,Math.round(c.clientHeight/S));
  const still=matchMedia('(prefers-reduced-motion: reduce)').matches,step=still?0:Math.floor(now/STEP);
  const k=[w,h,state.time,state.weather].join();if(k!==key){key=k;c.width=w;c.height=h;bg=background(w,h);frame=-1;}
  if(step===frame&&drawn===version)return;frame=step;drawn=version;paint(c.getContext('2d'),w,h,bg,now,still);};
 requestAnimationFrame(draw);return c;}
function palette(){return PAL[state.weather!=='clear'?'rain':state.time]||PAL.day;}
// Sky, far trees and water: drawn once per size and light, kept as an image.
function background(w,h){const pal=palette(),sky=pal.sky.map(hex),water=pal.water.map(hex),shore=pal.shore.map(hex),c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d'),img=g.createImageData(w,h),d=img.data;
 const horizon=Math.round(h*.42),trees=[];let seed=7;const rand=()=>(seed=(seed*16807)%2147483647)/2147483647;
 for(let x=0;x<w;x++)trees.push(Math.round(3+2*Math.sin(x*.21)+2*Math.sin(x*.07+1)+(rand()<.18?2:0)));
 const put=(i,col)=>{d[i]=col[0];d[i+1]=col[1];d[i+2]=col[2];d[i+3]=255;};
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4,b=B8[y&7][x&7];
  if(y<horizon){const f=Math.min(2.999,y/horizon*3),k=f|0;put(i,sky[k+((f-k)*64>b?1:0)]);if(y>=horizon-trees[x])put(i,y===horizon-trees[x]?shore[1]:shore[0]);}
  else{const f=Math.min(2.999,(y-horizon)/(h-horizon)*3),k=f|0;put(i,water[k+((f-k)*64>b?1:0)]);}}
 // Evening: the sun sinking behind the trees, its reflection broken on the water. Night: a crescent.
 if(state.weather==='clear'&&state.time==='evening'){const sx=Math.round(w*.78),r=Math.max(6,Math.round(h*.07)),cy=horizon-Math.round(r*.6),sun=hex('#ffd58a'),core=hex('#fff1c4');
  for(let y=cy-r;y<horizon;y++)for(let x=sx-r;x<=sx+r;x++){const dd=(x-sx)**2+(y-cy)**2;if(dd<=r*r&&x>=0&&x<w&&y>=0&&y<horizon-trees[x])put((y*w+x)*4,dd<(r*.55)**2?core:sun);}
  // The reflection: a few broken dashes per row, narrower and dimmer with depth.
  for(let y=horizon+2;y<h;y+=2){const depth=(y-horizon)/(h-horizon),spread=Math.round(r*(1.1-depth*.5)),col=mix(water[0],sun,.6-depth*.45);
   for(let k=0;k<3;k++){const len=2+((y*3+k*5)%5),x0=sx-spread+((y*11+k*17)%Math.max(1,spread*2-len));if(((y+k)%3)===0&&k>0)continue;for(let x=x0;x<x0+len;x++)if(x>=0&&x<w)put((y*w+x)*4,col);}}}
 if(state.weather==='clear'&&state.time==='night'){const mx=Math.round(w*.8),my=Math.round(horizon*.3),r=5,moon=hex('#fff3c4');
  for(let y=my-r;y<=my+r;y++)for(let x=mx-r;x<=mx+r;x++){if((x-mx)**2+(y-my)**2<=r*r&&(x-mx-2)**2+(y-my+1)**2>r*r*.75&&x>=0&&x<w&&y>=0)put((y*w+x)*4,moon);}}
 // The waterline: a lighter row under the trees.
 for(let x=0;x<w;x++)put((horizon*w+x)*4,mix(water[0],hex(pal.glint),.35));
 g.putImageData(img,0,0);return {canvas:c,horizon};}
const mix=(a,b,t)=>a.map((v,i)=>Math.round(v+(b[i]-v)*t));
function px(g,x,y,col,w=1,h=1){g.fillStyle=css(col);g.fillRect(Math.round(x),Math.round(y),w,h);}
// A 1-pixel line, Bresenham, between two points.
function line(g,x0,y0,x1,y1,col){x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);const dx=Math.abs(x1-x0),dy=-Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1;let e=dx+dy;g.fillStyle=css(col);
 for(let n=0;n<4096;n++){g.fillRect(x0,y0,1,1);if(x0===x1&&y0===y1)break;const e2=2*e;if(e2>=dy){e+=dy;x0+=sx;}if(e2<=dx){e+=dx;y0+=sy;}}}
function paint(g,w,h,bg,now,still){g.imageSmoothingEnabled=false;g.clearRect(0,0,w,h);g.drawImage(bg.canvas,0,0);const pal=palette(),hz=bg.horizon,t=(now-state.since)/1000,tick=still?0:now/1000,phase=state.phase;
 // Clouds drift; stars twinkle at night.
 if(pal.cloud){const top=mix(hex(pal.cloud),hex('#ffffff'),.5);for(const [cx0,cy,len] of [[.1,.14,26],[.5,.24,18],[.78,.08,14],[.32,.05,10]]){const cx=Math.round((cx0*w+tick*1.5)%(w+len*2))-len,y=Math.round(cy*hz);
  // Bumps on top, a flat shaded base: rows narrower towards the crown.
  [.42,.7,.92,1,.96].forEach((q,r)=>{const wd=Math.round(len*q),x0=cx+Math.round((len-wd)/2)+(r===1?Math.round(len*.12):0);px(g,x0,y+r,r===4?hex(pal.cloudShade):r===0?top:hex(pal.cloud),r===1?Math.round(wd*.7):wd,1);});
  px(g,cx+Math.round(len*.18),y+1,top,Math.round(len*.28),1);}}
 else for(let k=0;k<Math.round(w*hz/90);k++){const x=(k*97)%w,y=(k*53)%Math.max(1,hz-8);if(((k+Math.floor(tick*3))%5)!==0)px(g,x,y,hex(k%3?'#e8e4ff':'#fff0b0'));}
 // Glints on the water: long thin highlights drifting with the swell, winking in turn.
 const glint=mix(hex(pal.water[0]),hex(pal.glint),.6),glintDim=mix(hex(pal.water[1]),hex(pal.glint),.3);
 for(let k=0;k<Math.round(w*(h-hz)/260);k++){const row=(k*37)%Math.max(1,h-hz-6),y=hz+4+row,len=3+(k%4)+Math.round(row/12),x=Math.round(((k*71)%w)+Math.sin(tick*.6+k*.7)*4),on=(k+Math.floor(tick*1.5))%5;if(on)px(g,x,y,on===1?glint:glintDim,len,1);}
 // The rod from the lower left: a cane tapering to the tip, lit from the upper left, with nodes, a cork
 // grip and a reel. The line starts at the tip pixel.
 const base={x:-3,y:Math.round(h*.62)},tip={x:Math.round(Math.min(w*.22,58)),y:Math.round(h*.1)};
 const reel=phase==='reel',bite=phase==='bite',caught=phase==='caught',cast=phase==='cast';
 const bend=reel?Math.round(2+Math.sin(tick*18)*1):0;tip.y+=bend;tip.x-=bend>>1;
 const len=Math.hypot(tip.x-base.x,tip.y-base.y),ux=(tip.x-base.x)/len,uy=(tip.y-base.y)/len;
 for(let s=0;s<=len;s++){const f=s/len,x=Math.round(base.x+ux*s),y=Math.round(base.y+uy*s+(reel?Math.sin(f*Math.PI)*bend*.6:0)),thick=f<.45?3:f<.8?2:1,grip=f<.2,node=!grip&&Math.round(s)%9===0;
  px(g,x+1,y+1,ROD.dark,thick,thick);px(g,x,y,grip?(Math.round(s)%3===0?ROD.corkDot:ROD.cork):node?ROD.low:ROD.cane,thick,thick);if(thick>1)px(g,x,y,grip?ROD.cork:ROD.high);}
 const rs=len*.14,rx=Math.round(base.x+ux*rs),ry=Math.round(base.y+uy*rs)+4;px(g,rx-2,ry-1,ROD.reelDark,6,5);px(g,rx-1,ry-2,ROD.reelDark,4,7);px(g,rx-1,ry,ROD.reel,4,3);px(g,rx,ry-1,ROD.reel,2,5);px(g,rx,ry+1,ROD.reelDark,2,1);px(g,rx+3,ry+3,ROD.dark,2,1);px(g,rx+4,ry+2,ROD.grip);
 // The bobber: flies out on the cast, bobs, dips at a bite, tugs while reeling.
 const bx=Math.round(w*.55),wy=hz+Math.round((h-hz)*.28);let by=wy,bobX=bx;
 if(cast){const f=Math.min(1,t/.6);bobX=Math.round(tip.x+(bx-tip.x)*f);by=Math.round(tip.y+(wy-tip.y)*f-Math.sin(f*Math.PI)*h*.25);}
 else if(bite)by=wy+2+(Math.floor(tick*8)%2);else if(reel){bobX=bx+(Math.floor(tick*20)%2?1:-1);by=wy+1;}else by=wy+(Math.floor(tick*2.2)%2);
 // Ripples around the bobber once it is in the water.
 if(!cast||t>.6){const n=bite||reel?3:2;for(let r=0;r<n;r++){const f=((tick*(bite||reel?1.6:.7))+r/n)%1,rw=Math.round(4+f*16),rh=Math.max(1,Math.round(rw/4));const col=mix(hex(pal.glint),hex(pal.water[1]),f);
  for(let a=0;a<rw*2;a++){const ang=a/(rw*2)*Math.PI*2,x=bobX+Math.cos(ang)*rw,y=wy+3+Math.sin(ang)*rh;if(((a+r)&1)===0)px(g,x,y,col);}}}
 // The fish under the water: follows the live minigame when there is one.
 const icon=state.icon;if((bite||reel)&&icon){const sh=shadow(icon,'rgba(14,34,58,.55)');if(sh){const live=window.Reel?.peek?.();const off=live?((live.fish/532)-.5)*w*.28:Math.sin(tick*(1.2+state.fight*2.5))*w*.08;
  g.drawImage(sh,Math.round(bobX-8+off),Math.round(wy+8+Math.sin(tick*3)*1.5));}}
 // The line: sags on the water while waiting, pulls straight while a fish is on it.
 const sag=reel||bite?0:Math.round((wy-tip.y)*.22),mx=(tip.x+bobX)/2,my=(tip.y+by)/2+sag;let lx=tip.x,ly=tip.y;
 if(!caught)for(let s=1;s<=24;s++){const f=s/24,x=(1-f)*(1-f)*tip.x+2*(1-f)*f*mx+f*f*bobX,y=(1-f)*(1-f)*tip.y+2*(1-f)*f*my+f*f*(by-9)+(reel?Math.sin(f*Math.PI)*(Math.floor(tick*20)%2):0);line(g,lx,ly,x,y,LINE);lx=x;ly=y;}
 // The bobber: outlined red cap and white body, its lower edge cut by the waterline once it floats.
 if(!caught){const afloat=!cast||t>.6;px(g,bobX,by-10,BOB.stem,1,3);px(g,bobX-2,by-8,BOB.line,5,1);px(g,bobX-4,by-7,BOB.line,9,6);
  px(g,bobX-1,by-8,BOB.red,3,1);px(g,bobX-3,by-7,BOB.red,7,3);px(g,bobX-2,by-7,BOB.shine,2,1);px(g,bobX-3,by-4,BOB.white,7,2);px(g,bobX+2,by-4,BOB.shade,1,2);
  px(g,bobX-3,by-2,afloat?mix(hex(pal.water[0]),BOB.white,.35):BOB.white,7,1);}
 // A bite: the exclamation over the bobber.
 if(bite){const ey=by-17-(Math.floor(tick*6)%2);px(g,bobX-1,ey-1,hex('#5b2b1a'),4,10);px(g,bobX,ey,hex('#fff1b0'),2,6);px(g,bobX,ey+7,hex('#fff1b0'),2,2);}
 // Caught: the fish leaps out of the water at 2x, sparkles around it.
 if(caught&&icon){const i=image(icon);const f=Math.min(1,t/.9),x=Math.round(bx-16),y=Math.round(wy-14-Math.sin(Math.min(1,f)*Math.PI*.5)*h*.16);
  if(i)g.drawImage(i,x,y,32,32);
  for(let k=0;k<4;k++){if((Math.floor(tick*6)+k)%3===0)continue;const sx=bx+[-26,22,24,-22][k],sy=y+[4,0,26,28][k];const col=hex('#fff6c8');px(g,sx,sy-2,col,1,5);px(g,sx-2,sy,col,5,1);}
  if(t<.8)for(let k=0;k<7;k++){const a=k/6*Math.PI,spd=10+(k%3)*5,dx=Math.cos(a)*spd*t*2.2,dy=-Math.sin(a)*spd*t*3+t*t*40;px(g,bx+dx,wy+2+dy,hex(pal.glint));}
  for(let r=0;r<2;r++){const f2=((tick*1.2)+r/2)%1,rw=Math.round(6+f2*22);for(let a=0;a<rw*2;a+=2){const ang=a/(rw*2)*Math.PI*2;px(g,bx+Math.cos(ang)*rw,wy+3+Math.sin(ang)*rw/4,hex(pal.glint));}}}
 // Rain or snow over everything.
 if(state.weather==='rain'){const drop=mix(hex(pal.sky[3]),hex('#ffffff'),.45);for(let k=0;k<Math.round(w*h/480);k++){const x=(k*53+Math.floor(tick*60))%w,y=(k*29+Math.floor(tick*150))%h;px(g,x,y,drop,1,3);}
  for(let k=0;k<Math.round(w/14);k++){if((k+Math.floor(tick*8))%4)continue;const x=(k*61)%w,y=hz+4+((k*17)%Math.max(1,h-hz-6));px(g,x-1,y,glintDim);px(g,x+1,y,glintDim);px(g,x,y-1,glint);}}
 else if(state.weather==='snow')for(let k=0;k<Math.round(w*h/260);k++){const x=(k*53+Math.floor(Math.sin(tick+k)*6))%w,y=(k*29+Math.floor(tick*20))%h;px(g,x,y,hex('#ffffff'));}}
window.Pond={update,canvas};
})();
