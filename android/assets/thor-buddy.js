/* Thor buddy: a small pixel-art Thor for full-page states. Its upper screen is a face, its
   lower screen shows the page's own icon, like the real handheld showing this page. Moods:
   idle, loading, sleep, saving, update, confused. Drawn as code-generated SVG rects
   (no inline styles, CSP-safe); motion lives in thor-buddy.css and uses stepped timing so
   the pixels stay crisp. prefers-reduced-motion stops everything. */
(()=>{'use strict';
const NS='http://www.w3.org/2000/svg';
const C={o:'#502916',L:'#f6ecd9',M:'#ddcdb2',h:'#c9b391',d:'#3b2619',k:'#5f4a3c',p:'#ffcf87',r:'#d9473c',y:'#e9b53b',b:'#4a70d2',g:'#3f9b4b'};
// 24 x 25 body, both halves the same width; '.' is transparent. Upper screen x3..20 y2..8; the lower screen (x7..16 y15..21)
// is lit in the page's own parchment, x8..15 y16..20.
const BODY=[
'.oooooooooooooooooooooo.',
'oLLLLLLLLLLLLLLLLLLLLLLo',
'oLLddddddddddddddddddLLo',
'oLLddddddddddddddddddLLo',
'oLLddddddddddddddddddLLo',
'oLLddddddddddddddddddLLo',
'oLLddddddddddddddddddLLo',
'oLLddddddddddddddddddLLo',
'oLLddddddddddddddddddLLo',
'oLLLLLLLLLLLLLLLLLLLLLLo',
'oMMMMMMMMMMMMMMMMMMMMMMo',
'.oooooooooooooooooooooo.',
'....ohhhhhhhhhhhhhho....',
'.oooooooooooooooooooooo.',
'oLLLLLLLLLLLLLLLLLLLLLLo',
'oLLkkkLddddddddddLLbLLLo',
'oLLkkkLdppppppppdLgLrLLo',
'oLLkkkLdppppppppdLLyLLLo',
'oLLLLLLdppppppppdLLLLLLo',
'oLLLkLLdppppppppdLLkkkLo',
'oLLkkkLdppppppppdLLkkkLo',
'oLLLkLLddddddddddLLkkkLo',
'oLLLLLLLLLLLLLLLLLLLLLLo',
'oMMMMMMMMMMMMMMMMMMMMMMo',
'.oooooooooooooooooooooo.'];
function node(tag,attrs,cls){const n=document.createElementNS(NS,tag);for(const k in attrs)n.setAttribute(k,attrs[k]);if(cls)n.setAttribute('class',cls);return n;}
function rect(g,x,y,w,h,fill,cls){g.append(node('rect',{x,y,width:w,height:h,fill},cls));}
// Rows of the pixel map merged into horizontal runs: a few dozen rects instead of hundreds.
function paint(g,rows,x0,y0){rows.forEach((row,y)=>{let x=0;while(x<row.length){const c=row[x];if(c==='.'){x++;continue;}let end=x;while(end<row.length&&row[end]===c)end++;rect(g,x0+x,y0+y,end-x,1,C[c]);x=end;}});}
const FACE='#ffe0a0';
// Face parts per mood, in upper-screen coordinates.
function face(g,mood){
 const eyes=node('g',{},'tb-eyes');
 // Asleep: flat closed eyes, no hooks (hooked ends read as a scowl).
 if(mood==='sleep'||mood==='saving'){rect(eyes,7,5,4,1,FACE);rect(eyes,13,5,4,1,FACE);}
 else if(mood==='confused'){rect(eyes,8,4,2,2,FACE);rect(eyes,14,5,1,1,FACE);}
 else{
  const open=node('g',{},'tb-open');rect(open,8,4,2,2,FACE);rect(open,14,4,2,2,FACE);
  const shut=node('g',{},'tb-shut');rect(shut,8,5,2,1,FACE);rect(shut,14,5,2,1,FACE);
  eyes.append(open,shut);
 }
 g.append(eyes);
 const mouth=node('g',{},'tb-mouth');
 if(mood==='update'||mood==='confused')rect(mouth,11,7,3,1,FACE);
 else if(mood==='sleep'||mood==='saving'){rect(mouth,11,7,2,1,FACE);}
 else{rect(mouth,10,6,1,1,FACE);rect(mouth,11,7,2,1,FACE);rect(mouth,13,6,1,1,FACE);}
 g.append(mouth);
}
// Extras around the head.
function extras(g,mood){
 if(mood==='sleep'||mood==='saving'){
  const z=node('g',{},'tb-zzz');
  // A small z by the head and a bigger Z above it: top bar, stepped diagonal, bottom bar.
  [[21,-4,4],[25,-12,5]].forEach(([x,y,n],i)=>{const one=node('g',{},'tb-z tb-z'+i);
   rect(one,x,y,n,1,C.o);for(let k=1;k<n-1;k++)rect(one,x+n-1-k,y+k,1,1,C.o);rect(one,x,y+n-1,n,1,C.o);z.append(one);});
  g.append(z);
 }
 if(mood==='saving'){const moon=node('g',{},'tb-moon');rect(moon,-3,-4,2,1,C.y);rect(moon,-4,-3,1,3,C.y);rect(moon,-3,0,2,1,C.y);g.append(moon);}
 if(mood==='update'){const drop=node('g',{},'tb-drop');rect(drop,25,3,1,1,'#7fb3e8');rect(drop,24,4,3,2,'#7fb3e8');rect(drop,25,6,1,1,'#7fb3e8');g.append(drop);}
 if(mood==='confused'){const q=node('g',{},'tb-question');
  rect(q,10,-7,4,1,C.o);rect(q,14,-6,1,2,C.o);rect(q,12,-4,2,1,C.o);rect(q,12,-3,1,1,C.o);rect(q,12,-1,1,1,C.o);g.append(q);}
}
// Pages rebuild their state box whenever their data changes, so a buddy can be replaced while it
// is on screen. Motion runs on one clock (--tb-t is a negative delay) that starts when a mood
// appears: a rebuild continues the same frame instead of replaying the entrance. A once-a-second
// check notes while the latest buddy is visible; only a new mood, or one coming back after it was
// gone, drops in again.
let shown='',since=0,seen=0,last=null,beat=0;
function clock(mood,node){const now=performance.now();if(mood!==shown||now-seen>2500){shown=mood;since=now;}seen=now;last=node;
 if(!beat)beat=setInterval(()=>{if(!last.isConnected){clearInterval(beat);beat=0;}else if(last.offsetParent)seen=performance.now();},1000);
 return now-since;}
/** A buddy element for a state box. `icon` goes on the lower screen; `mood` picks face and motion. */
function make(icon,mood){
 mood=mood||'idle';
 const wrap=document.createElement('div');wrap.className='thor-buddy tb-'+mood;wrap.setAttribute('aria-hidden','true');
 wrap.style.setProperty('--tb-t',-clock(mood,wrap)/1000+'s');
 const svg=node('svg',{viewBox:'-6 -12 36 40',width:'144',height:'160','shape-rendering':'crispEdges'});
 const shadow=node('g',{},'tb-shadow');rect(shadow,3,26,18,1,'#502916');svg.append(shadow);
 // body: the entrance drop; inside it the lid (upper half) moves on its own, like a nod.
 const body=node('g',{},'tb-body');
 const lid=node('g',{},'tb-lid');paint(lid,BODY.slice(0,12),0,0);face(lid,mood);
 const base=node('g',{},'tb-base');paint(base,BODY.slice(12),0,12);
 // The page's own icon on the lower screen, 5 units (20px) square.
 if(icon)base.append(node('image',{href:icon,x:9.5,y:16,width:5,height:5,preserveAspectRatio:'xMidYMid meet'},'tb-screen'));
 body.append(base,lid);extras(body,mood);svg.append(body);
 wrap.append(svg);
 return wrap;
}
window.ThorBuddy={make};
})();
