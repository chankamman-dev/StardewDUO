/* Morning briefing on the context page: today's date and weather, tomorrow's forecast and luck on
   the original TV screens, what is special today (birthdays, festivals, cart, cooking show, tool
   pickup, quests due, season change) and the farm to-do counts. Built only from data the App
   already has (snapshot journal + the on-demand farm report). Shows while the context page has
   nothing else to show before noon, until dismissed for the day; can be reopened any time. */
(()=>{'use strict';
const T={zh:{morning:'早安',afternoon:'今日简报',date:'{s}{d}日 {w}',year:'第{y}年，本季还剩 {n} 天',weekdays:['星期一','星期二','星期三','星期四','星期五','星期六','星期日'],
  todayWeather:'今天',tomorrow:'明天',luck:'今日运势',special:'今天',chores:'农务待办',openFarm:'打开农务',dismiss:'收起简报',open:'今日简报',
  birthday:'{n} 今天生日',loves:'最爱：{i}',carry:'背包里有',festival:'今天是{n}',merchant:'旅行货车今天在森林营业',merchantBundle:'有 {n} 件收集包需要的东西',
  sauce:'酱料女王今天{r}：{n}',sauceToday:'播出',sauceRerun:'重播',known:'已学会',unknown:'还没学会',bookseller:'书商来了',tool:'{n}升级好了，可以去取',
  questDue:'「{n}」今天到期',questTomorrow:'「{n}」明天到期',seasonTomorrow:'明天换季（{s}），{n} 株作物会枯萎',seasonSoon:'还有 {d} 天换季（{s}）',seasonTomorrowSafe:'明天换季（{s}）',
  nothing:'今天没有特别的事',noChores:'今天的农务都完成了',loading:'正在读取农场…',hint:'情境页空闲时显示，午后自动收起；随时可以重新打开',
  cats:{harvest:'收获',water:'浇水',machine:'机器',animal:'动物',care:'喂养',tree:'果树'},seasons:{spring:'春季',summer:'夏季',fall:'秋季',winter:'冬季'}},
 en:{morning:'Good morning',afternoon:'Daily briefing',date:'{w}, {s} {d}',year:'Year {y}, {n} days left this season',weekdays:['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],
  todayWeather:'Today',tomorrow:'Tomorrow',luck:'Luck',special:'Today',chores:'Farm chores',openFarm:'Open farm',dismiss:'Dismiss',open:'Daily briefing',
  birthday:"{n}'s birthday",loves:'Loves: {i}',carry:'in your backpack',festival:'{n} today',merchant:'The Traveling Cart is in the forest',merchantBundle:'{n} things for bundles',
  sauce:'Queen of Sauce {r}: {n}',sauceToday:'today',sauceRerun:'rerun',known:'learned',unknown:'not learned',bookseller:'The Bookseller is in town',tool:'Your {n} is ready to pick up',
  questDue:'"{n}" is due today',questTomorrow:'"{n}" is due tomorrow',seasonTomorrow:'{s} starts tomorrow; {n} crops will wither',seasonSoon:'{s} starts in {d} days',seasonTomorrowSafe:'{s} starts tomorrow',
  nothing:'Nothing special today',noChores:'All farm chores are done',loading:'Reading the farm…',hint:'Shows while the context page is idle, until noon; reopen any time',
  cats:{harvest:'Harvest',water:'Water',machine:'Machines',animal:'Animals',care:'Feeding',tree:'Fruit trees'},seasons:{spring:'Spring',summer:'Summer',fall:'Fall',winter:'Winter'}}};
const t=(k,v={})=>{let s=k.split('.').reduce((o,p)=>o?.[p],T[lang]||T.en)??k;if(typeof s==='string')for(const [a,b] of Object.entries(v))s=s.replace('{'+a+'}',b);return s;};
const STORE='stardew.briefing.dismissed';let forced=false;
const dayKey=s=>{const w=s?.world;return w?`${w.farmer}|${w.year}|${w.season}|${w.day}`:null;};
function dismissed(s){try{return localStorage.getItem(STORE)===dayKey(s);}catch{return false;}}
const dbIcon=id=>icons.get(id)||db?.[lang]?.items.find(v=>v.id===id)?.icon||null;
const cats=[['harvest',['cropReady'],'(O)24'],['water',['cropDry'],'(T)WateringCan'],['machine',['machine','grabber'],'(BC)12'],['animal',['animalPet','animalHarvest','animalProduct'],'(T)MilkPail'],['care',['hay','petBowl'],'(O)178'],['tree',['fruitTree'],'(O)613']];
// A portrait that failed to load, or is a blank placeholder (all near-white), falls back to the
// generic villager icon instead of showing an empty white square.
function portrait(src){const i=img(src||'art/icon-people.png');i.onerror=()=>{i.onerror=null;i.src='art/icon-people.png';};
 i.onload=()=>{if(i.src.endsWith('icon-people.png'))return;try{const c=document.createElement('canvas');c.width=c.height=8;const g=c.getContext('2d');g.drawImage(i,0,0,8,8);const d=g.getImageData(0,0,8,8).data;let blank=true;for(let k=0;k<d.length;k+=4)if(d[k+3]>16&&(d[k]<235||d[k+1]<235||d[k+2]<235)){blank=false;break;}if(blank)i.src='art/icon-people.png';}catch{}};return i;}
function row(icon,text,sub,cls=''){const r=el('div','brief-row '+cls),tile=el('span','brief-icon');if(icon){tile.append(cls.includes('is-birthday')?portrait(icon):img(icon));if(cls.includes('is-birthday')){const g=img('art/gift.png');g.className='brief-badge';tile.append(g);}}r.append(tile);const c=el('div','brief-row-copy');c.append(el('p','',text));if(sub)c.append(el('small','',sub));r.append(c);return r;}
// ---------- Hero: a little scene of today (the game's own day/night backdrop, tinted by season,
// the TV weather animation, rain or snow), a tear-off calendar page and a greeting. ----------
const H={zh:{hello:{morning:'早安',day:'午安',evening:'晚上好'},mark:'，{f}！',you:'今天是你的生日，生日快乐！',festival:'今天是{n}，别错过了！',
  weather:{storm:'雷雨天，待在屋里也不错',rain:'下雨了，今天不用浇水啦',snow:'下雪了，农场一片安静',greenRain:'绿雨来了，杂草疯长'},
  one:'{n} 今天生日，带份礼物去吧',many:'今天有 {n} 位居民过生日',lucky:'运势大吉，去矿井碰碰运气吧',unlucky:'运势不佳，今天小心行事',
  first:'新的季节开始了，看看能种些什么',last:'本季最后一天，别让作物枯萎',idle:['新的一天，农场在等你','今天也要元气满满','空气真清新，出门走走吧','记得和镇上的居民打个招呼'],
  year:'第 {y} 年',left:'本季还剩 {n} 天',lastDay:'本季最后一天'},
 en:{hello:{morning:'Good morning',day:'Good afternoon',evening:'Good evening'},mark:', {f}!',you:'Happy birthday to you!',festival:'{n} today, don’t miss it!',
  weather:{storm:'Stormy out: a good day to stay in',rain:'Rain today: no watering needed',snow:'Snow is falling on the farm',greenRain:'Green rain: the weeds are growing wild'},
  one:'{n} has a birthday: bring a gift',many:'{n} villagers have birthdays today',lucky:'Great luck: try your fortune in the mines',unlucky:'Bad luck today: tread carefully',
  first:'A new season starts: what will you plant?',last:'Last day of the season: harvest before it ends',idle:['A new day on the farm','Make today a good one','Fresh air: go for a walk','Say hello to the villagers'],
  year:'Year {y}',left:'{n} days left',lastDay:'Last day of the season'}};
const h=(k,v={})=>{let s=k.split('.').reduce((o,p)=>o?.[p],H[lang]||H.en)??k;if(typeof s==='string')for(const [a,b] of Object.entries(v))s=s.replace('{'+a+'}',b);return s;};
const WX={sun:'sun',rain:'rain',storm:'storm',snow:'snow',wind:'wind',festival:'festival','green-rain':'greenrain',wedding:'sun'};
function flavor(w,j,o,x){const today=(j?.calendar||[]).filter(e=>e.season===w.season&&e.day===w.day),births=today.filter(e=>e.kind==='birthday'),fest=today.find(e=>e.kind==='festival');
 if(x?.playerBirthday?.state==='ready'&&x.playerBirthday.today)return h('you');if(fest)return h('festival',{n:fest.name});
 if(w.weather==='storm')return h('weather.storm');if(w.weather==='rain')return h('weather.rain');if(w.weather==='snow')return h('weather.snow');if(w.weather==='green-rain')return h('weather.greenRain');
 if(births.length===1)return h('one',{n:births[0].name});if(births.length>1)return h('many',{n:births.length});
 if(o?.luckLevel===2)return h('lucky');if(o?.luckLevel===-2)return h('unlucky');if(w.day===1)return h('first');if(w.day===28)return h('last');
 const idle=h('idle');return idle[(w.day+w.year)%idle.length];}
// Pixel scene of today, painted pixel by pixel at 126x34 and shown at exactly 4x like the game's
// own art. The text sits on the left, so the picture is composed for the right and the bottom:
// the farmhouse with its chimney smoke and a big tree, a fenced crop plot in front, the sun or
// moon above, far mountains and hills behind. Rain, snow, petals and leaves fall over it as a
// small repeating pattern. Same day, same picture (seeded by the date).
const SW=126,SH=34,sceneCache=new Map();
const hex=c=>[parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)];
const mix=(a,b,t)=>a.map((v,i)=>Math.round(v+(b[i]-v)*t));
const PAL={
 spring:{sky:['#5fb8ea','#80c9ef','#a6dcf5','#cdeefa'],mount:['#9bb8da','#7d9dc6','#e4edf7'],hill:['#8ccf72','#6db55a','#559c47'],meadow:['#72c258','#5dab4a','#46903b'],tree:['#4c9a42','#357a34','#25592a'],canopy:['#fbd6e4','#f2a6c4','#d9799f'],flowers:['#f7a8c8','#fff17a','#ffffff'],crop:'spring'},
 summer:{sky:['#43a9e8','#69beef','#93d3f4','#c4ebfa'],mount:['#86a8d0','#6b8dbc','#dce7f3'],hill:['#72b953','#56a043','#3f8736'],meadow:['#5db046','#4a9a3c','#377e31'],tree:['#3f8f3a','#2d7430','#1f5626'],canopy:null,flowers:['#ffd23a','#ff9a3a','#ffffff'],crop:'summer'},
 fall:{sky:['#6fb3dc','#95c6e0','#d6d8c2','#f1d3a2'],mount:['#a0a8c1','#848ca9','#e6e8f1'],hill:['#d8913e','#bd722f','#9c5828'],meadow:['#c4953f','#a87a30','#875e26'],tree:['#6f9050','#557640','#3c5a30'],canopy:['#eaa53a','#e0662a','#b8402a'],flowers:['#c9462a','#eaa53a'],crop:'fall'},
 winter:{sky:['#8fbadd','#a9cbe7','#c6dcef','#e3f0fa'],mount:['#bccadd','#a1b3cb','#ffffff'],hill:['#f1f6fa','#dce7f0','#c4d4e2'],meadow:['#f7fafd','#e5edf4','#cbd8e4'],tree:['#44705f','#33594b','#244238'],canopy:null,flowers:[],crop:'winter'}};
function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const BAYER=[[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]];
function paint(w,time){
 const key=[w.season,w.weather,time,w.year,w.day].join('|');if(sceneCache.has(key))return sceneCache.get(key);
 const c=document.createElement('canvas');c.width=SW;c.height=SH;const g=c.getContext('2d'),data=g.createImageData(SW,SH),d=data.data,rand=rng(w.year*997+w.day*31+['spring','summer','fall','winter'].indexOf(w.season)*7);
 const base=PAL[w.season]||PAL.spring,wet=['rain','storm','green-rain'].includes(w.weather),night=time==='evening',snow=w.weather==='snow',winter=w.season==='winter';
 // Weather and time of day shift the whole palette.
 const shade=col=>{let v=typeof col==='string'?hex(col):col;if(wet){const grey=Math.round((v[0]+v[1]+v[2])/3);v=mix(v,[grey,grey,grey+8],.4);v=mix(v,[40,48,64],w.weather==='storm'?.42:.16);}if(w.weather==='green-rain')v=mix(v,[70,150,90],.25);if(night)v=mix(v,[34,30,70],.4);return v;};
 const P=list=>list.map(shade),sky=night?['#1f2458','#373476','#6a4a88','#d98260'].map(hex):P(base.sky),mount=P(base.mount),hill=P(base.hill),meadow=P(base.meadow),tree=P(base.tree),canopy=base.canopy?P(base.canopy):null;
 const set=(x,y,col)=>{x=Math.round(x);y=Math.round(y);if(x<0||y<0||x>=SW||y>=SH)return;const i=(y*SW+x)*4;d[i]=col[0];d[i+1]=col[1];d[i+2]=col[2];d[i+3]=255;};
 const get=(x,y)=>{const i=(y*SW+x)*4;return[d[i],d[i+1],d[i+2]];};
 const white=shade('#fbfdff');
 // Sky: flat bands with a short ordered dither only where two bands meet.
 for(let y=0;y<SH;y++){const f=y/20*3,band=Math.min(2,Math.floor(f)),t=Math.max(0,Math.min(1,(f-band-.55)/.45));for(let x=0;x<SW;x++)set(x,y,t*16>BAYER[y%4][x%4]?sky[Math.min(3,band+1)]:sky[band]);}
 // Stars and moon at night, or the sun with a soft ring.
 const sx=112,sy=6;
 if(night){for(let k=0;k<26;k++){const x=rand()*SW,y=rand()*12;set(x,y,k%4?[236,232,255]:[255,240,170]);}
  for(let y=-4;y<=4;y++)for(let x=-4;x<=4;x++){const r=x*x+y*y;if(r<=16&&(x+2)**2+(y-1)**2>10)set(sx+x,sy+y,r>=12?[214,206,170]:[250,244,206]);}set(sx-1,sy-2,[214,206,170]);set(sx,sy+1,[226,218,180]);}
 else if(!wet&&!snow){for(let y=-6;y<=6;y++)for(let x=-6;x<=6;x++){const r=x*x+y*y;if(r<=12)set(sx+x,sy+y,r<=3?[255,252,214]:x+y<-1?[255,236,140]:[255,210,72]);else if(r<=22)set(sx+x,sy+y,mix(get(sx+x,sy+y),[255,240,170],.45));else if(r<=30&&(x+y)%2===0)set(sx+x,sy+y,mix(get(sx+x,sy+y),[255,240,170],.25));}}
 // Clouds: puffs with a lit top and a shaded base.
 const clouds=wet?6:snow?5:2;for(let k=0;k<clouds;k++){const cx=wet||snow?-4+k*24+rand()*8:20+k*54+rand()*14,cy=wet||snow?2+rand()*4:3+rand()*5,len=wet||snow?16+rand()*8:10+rand()*6;
  const body=wet?shade(w.weather==='storm'?'#707789':'#b0bac8'):night?[112,108,160]:snow?[236,240,248]:[255,255,255],under=mix(body,[128,138,160],.35),top=mix(body,[255,255,255],.55);
  for(let x=0;x<len;x++){const h=Math.round(2+1.6*Math.sin(x/len*Math.PI)+(rand()<.3?1:0));for(let y=0;y<h;y++)set(cx+x,cy+1-y,y===h-1?top:body);set(cx+x,cy+2,under);}}
 // Far mountains with a lit and a shaded face; snow caps in winter.
 const peaks=[];for(let k=0;k<5;k++)peaks.push([k*30+rand()*16-4,8+rand()*4]);const mh=x=>Math.min(...peaks.map(([px,py])=>py+Math.abs(x-px)*.55));
 for(let x=0;x<SW;x++){const top=Math.round(mh(x)),near=peaks.reduce((a,p)=>Math.abs(p[0]-x)<Math.abs(a[0]-x)?p:a);for(let y=top;y<22;y++)set(x,y,y<top+2&&(winter||y<top+1)?mount[2]:x<near[0]?mount[0]:mount[1]);}
 // Rolling hills that level out where the farmhouse stands.
 const G=21,phase=rand()*6,raw=x=>17+2.2*Math.sin(x/13+phase)+1.2*Math.sin(x/6+phase*2),hy=x=>Math.round(x>=96?G:x>=86?raw(x)+(G-raw(x))*(x-86)/10:raw(x));
 for(let x=0;x<SW;x++){const top=hy(x);for(let y=top;y<SH;y++)set(x,y,y===top?hill[0]:y<top+3?hill[1]:hill[2]);}
 // Small pines along the far hills.
 const pine=(x,y,hgt)=>{for(let dy=0;dy<hgt;dy++){const half=Math.floor((dy+1)/2);for(let dx=-half;dx<=half;dx++)set(x+dx,y-hgt+dy,winter&&dy%3===0&&dx<=0?white:dx<0?tree[0]:dx===half?tree[2]:tree[1]);}set(x,y,tree[2]);};
 for(let k=0;k<9;k++){const x=Math.round(2+rand()*84);pine(x,hy(x),5+Math.round(rand()*2));}
 // Meadow: the foreground band with grass tufts and the season's flowers.
 for(let x=0;x<SW;x++){for(let y=26;y<SH;y++)set(x,y,y===26?meadow[0]:y<30?meadow[1]:meadow[2]);if(rand()<.4)set(x,25,meadow[1]);}
 for(let k=0;k<44;k++){const x=rand()*SW,y=27+rand()*6;set(x,y,meadow[2]);set(x+1,y-1,meadow[0]);}
 const flowers=P(base.flowers.length?base.flowers:['#ffffff']);
 if(base.flowers.length)for(let k=0;k<30;k++){const x=rand()*SW,y=27+rand()*6;if(x>70&&x<100)continue;const col=flowers[k%flowers.length];set(x,y,col);if(k%3===0){set(x,y+1,meadow[2]);if(w.season==='summer')set(x,y-1,col);}}
 if(winter)for(let k=0;k<30;k++)set(rand()*SW,26+rand()*8,shade('#d4e0ea'));
 // Crop plot in front of the house, fenced, darker soil when it rained.
 const soil=shade(wet?'#5c3b25':'#8a5a34'),soilD=shade(wet?'#45291a':'#6b4226'),soilL=shade(wet?'#6d4730':'#a26d42');
 for(let r=0;r<3;r++){const y=27+r*2;for(let x=73;x<98;x++){if(winter){set(x,y,white);set(x,y+1,x%5===0?soilD:shade('#c6d3df'));continue;}set(x,y,x%2?soil:soilL);set(x,y+1,soilD);}
  for(let x=74+(r%2);x<97;x+=3){const kind=base.crop;
   if(kind==='spring'){set(x,y-1,shade('#6cc24a'));set(x+1,y-1,shade('#8fd862'));if((x+r)%2)set(x,y-2,shade('#f2f0c0'));}
   else if(kind==='summer'){const leaf=shade('#4f9c3a');set(x,y-1,leaf);set(x,y-2,leaf);set(x+1,y-2,shade('#6cb44f'));set(x,y-3,(x+r)%2?shade('#e2463a'):shade('#ffd23a'));}
   else if(kind==='fall'){if((x+r)%2){set(x,y-1,shade('#e07a22'));set(x+1,y-1,shade('#c75e18'));set(x,y-2,shade('#f09a3a'));set(x+1,y-2,shade('#e07a22'));set(x,y-3,shade('#4a7a2a'));}else set(x,y-1,shade('#6c9a3a'));}
   }}
 const post=shade('#7a4a24'),postL=shade('#a8723e'),rail=shade('#b98a52');
 for(let x=71;x<100;x++){if((x-71)%7===0){for(let y=22;y<27;y++)set(x,y,y===22?postL:post);}else{set(x,23,rail);set(x,25,rail);}}
 // Farmhouse: shingled roof, planked walls, two windows, a door and a chimney.
 const hx=100,wy=G-6,wall=shade('#ecca92'),wallD=shade('#d0a86f'),roof=shade('#bf4a3a'),roofD=shade('#94342a'),roofL=shade('#d8685a'),edge=shade('#55291b'),stone=shade('#9a948c'),stoneD=shade('#6f6a64');
 const glass=night?[255,216,110]:shade('#86c4e4'),glassL=night?[255,244,190]:shade('#d4eefa');
 for(let r=0;r<5;r++){const y=wy-5+r;for(let x=2-r;x<=14+r;x++){const rim=x===2-r||x===14+r;set(hx+x,y,rim||r===4?edge:r===0?roofL:(x+(r%2)*2)%4===0?roofD:roof);}}
 if(winter||snow)for(let x=1;x<=15;x++)set(hx+x,wy-5+(x<3||x>13?1:0),white);
 for(let y=0;y<6;y++)for(let x=0;x<=16;x++)set(hx+x,wy+y,x===0||x===16?edge:y===5?stoneD:y===4?stone:y%2?wallD:wall);
 for(const wx of [2,12]){for(let y=1;y<4;y++)for(let x=0;x<3;x++)set(hx+wx+x,wy+y,y===1&&x===0?glassL:glass);for(let x=-1;x<=3;x++)set(hx+wx+x,wy+4,edge);}
 const door=shade('#7a4424');for(let y=1;y<6;y++)for(let x=7;x<10;x++)set(hx+x,wy+y,y===1?edge:door);set(hx+9,wy+3,shade('#f2c14e'));
 for(let y=wy-8;y<wy-3;y++){set(hx+3,y,y===wy-8?stoneD:stone);set(hx+4,y,stoneD);}
 // Window light on the grass at night; chimney smoke by day.
 if(night){for(const wx of [2,12])for(let x=0;x<3;x++)set(hx+wx+x,G,[168,150,86]);}
 else if(!wet){const puff=snow||winter?[244,246,250]:[236,236,240];const puffD=mix(puff,[150,156,172],.35);[[3,-9,1],[2,-11,2],[0,-13,2],[-3,-15,3]].forEach(([dx,dy,r])=>{for(let y=0;y<r;y++)for(let x=0;x<r;x++)set(hx+dx+x,wy+dy+y,y===r-1&&r>1?puffD:puff);});}
 // Path from the door down to the meadow.
 const dirt=shade(winter?'#d9e2ea':'#c8a06a'),dirtD=shade(winter?'#bccad8':'#a67e4c');for(let y=G;y<SH;y++){const x=hx+8+Math.round(Math.sin((y-G)/3)*1.5);set(x-1,y,dirt);set(x,y,dirt);set(x+1,y,y%2?dirtD:dirt);}
 // The big tree beside the house: blossom in spring, green in summer, orange in fall, snow in winter.
 const tx=121,ty=G;for(let y=ty-6;y<=ty;y++){set(tx,y,shade('#6b4428'));set(tx+1,y,shade('#4e301c'));}
 if(winter)pine(tx,ty,13);
 else{const leaves=canopy||tree;for(let dy=-7;dy<=7;dy++)for(let dx=-7;dx<=7;dx++){const r=dx*dx/49+dy*dy/36;if(r>1)continue;const lit=dx+dy<-3,dark=dx+dy>4;const bump=r>.8&&(dx*3+dy*5)%4===0;if(bump)continue;
   set(tx+dx,ty-10+dy,dark?leaves[2]:lit?leaves[0]:leaves[1]);}
  if(w.season==='spring')for(let k=0;k<10;k++)set(tx-5+rand()*11,ty-15+rand()*10,shade('#ffffff'));
  if(w.season==='fall')for(let k=0;k<6;k++)set(tx-8+rand()*16,ty-2+rand()*5,canopy[k%3]);}
 // Summer fireflies at night.
 if(night&&w.season==='summer'&&!wet)for(let k=0;k<7;k++)set(rand()*SW,22+rand()*10,[236,255,140]);
 // Festival bunting on a sagging string.
 if(w.weather==='festival'){const colors=[[226,87,76],[242,193,78],[90,165,224],[108,191,90]];for(let x=0;x<SW;x++){const y=1+Math.round(1.5*Math.sin(x/SW*Math.PI*3));set(x,y,[122,74,36]);if(x%5===0)for(let t=0;t<3;t++)for(let dx=0;dx<3-t;dx++)set(x+dx+Math.floor(t/2),y+1+t,colors[(x/5)%4]);}}
 g.putImageData(data,0,0);const url=c.toDataURL();if(sceneCache.size>24)sceneCache.clear();sceneCache.set(key,url);return url;}
// Falling weather as a small repeating pixel pattern (drawn once per kind).
const fxCache=new Map();
function pattern(kind,season){const key=kind+season;if(fxCache.has(key))return fxCache.get(key);const S=32,c=document.createElement('canvas');c.width=S;c.height=S;const g=c.getContext('2d'),rand=rng(kind.length*17+season.length);
 if(kind==='rain'){g.fillStyle='rgba(222,236,255,.75)';for(let k=0;k<14;k++){const x=Math.floor(rand()*S),y=Math.floor(rand()*S);g.fillRect(x,y,1,3);g.fillRect((x+1)%S,(y+3)%S,1,1);}}
 else if(kind==='snow'){for(let k=0;k<12;k++){g.fillStyle=k%3?'#ffffff':'rgba(255,255,255,.7)';g.fillRect(Math.floor(rand()*S),Math.floor(rand()*S),1,1);}}
 else{const cols=season==='fall'?['#e0662a','#c9462a','#eaa53a']:['#f7a8c8','#ffffff','#f39ac0'];for(let k=0;k<7;k++){g.fillStyle=cols[k%cols.length];const x=Math.floor(rand()*S),y=Math.floor(rand()*S);g.fillRect(x,y,1,1);if(k%2)g.fillRect(x+1,y,1,1);}}
 const url=c.toDataURL();fxCache.set(key,url);return url;}
function scene(w,time){const s=el('span','hero-scene'),pic=img(paint(w,time));pic.className='hero-picture';pic.style.width=SW*4+'px';pic.style.height=SH*4+'px';s.append(pic);
 const kind=['rain','storm','green-rain'].includes(w.weather)?'rain':w.weather==='snow'?'snow':w.weather==='wind'?'wind':null;
 if(kind){const fx=el('span','hero-fx is-'+kind);fx.style.backgroundImage=`url(${pattern(kind,w.season)})`;s.append(fx);}
 return s;}
function hero(w,j,o,x,wake){const time=w.time<1200?'morning':w.time<1800?'day':'evening',weekday=(w.day-1)%7,box=el('div','brief-hero');
 Object.assign(box.dataset,{weather:w.weather||'sun',season:w.season,time});
 box.append(scene(w,time));
 const cal=el('div','hero-calendar'),band=el('span','hero-cal-band');band.append(el('small','',t('seasons.'+w.season)));cal.dataset.season=w.season;cal.append(band,el('strong','',String(w.day)),el('small','hero-cal-week',t('weekdays')[weekday]));
 // Waking up: yesterday's page is still on the calendar and gets torn off.
 if(wake){const y=prevDay(w),sheet=el('div','hero-cal-sheet'),yb=el('span','hero-cal-band');sheet.dataset.season=y.season;yb.append(el('small','',t('seasons.'+y.season)));sheet.append(yb,el('strong','',String(y.day)),el('small','hero-cal-week',t('weekdays')[(y.day-1)%7]));cal.append(sheet);}
 box.append(cal);
 const copy=el('div','hero-copy'),chips=el('div','hero-chips');copy.append(el('h2','',h('hello.'+time)+h('mark',{f:w.farmer||''})),el('p','',flavor(w,j,o,x)));
 if(w.year>1)chips.append(el('small','',h('year',{y:w.year})));if(o)chips.append(el('small','',o.daysLeft<=1?h('lastDay'):h('left',{n:o.daysLeft})));box.append(copy,chips);return box;}
// The night sky in the head: dithered bands (as the daybreak) with scattered pixel stars, drawn once.
let starTile=null;
function stars(){if(starTile)return starTile;const c=document.createElement('canvas');c.width=160;c.height=220;const g=c.getContext('2d'),rand=rng(4242),im=g.createImageData(160,220);
 for(let y=0;y<220;y++)for(let x=0;x<160;x++){const f=Math.min(6.999,y/220*6),k=f|0,col=NIGHT[Math.min(6,k+((f-k)*64>B8[y&7][x&7]?1:0))],i=(y*160+x)*4;im.data[i]=col[0];im.data[i+1]=col[1];im.data[i+2]=col[2];im.data[i+3]=255;}
 g.putImageData(im,0,0);
 for(let k=0;k<70;k++){const x=Math.floor(rand()*160),y=Math.floor(rand()*200),big=k%9===0;g.fillStyle=k%4?'#e8e4ff':'#fff0b0';g.fillRect(x,y,1,1);if(big){g.fillStyle='rgba(232,228,255,.55)';g.fillRect(x-1,y,1,1);g.fillRect(x+1,y,1,1);g.fillRect(x,y-1,1,1);g.fillRect(x,y+1,1,1);}}
 return starTile=c.toDataURL();}
const prevDay=w=>{const seasons=['spring','summer','fall','winter'],i=seasons.indexOf(w.season);return w.day<=1?{season:seasons[(i+3)%4],day:28}:{season:w.season,day:w.day-1};};
// The entrance plays once per day. Waking up from the night page plays the longer sunrise; a
// re-render in the middle (the farm report arriving) resumes the animation where it was.
let entered=null,enteredAt=0,waking=false,nightDay=null;
function render(host){
 const s=model.snapshot,w=s.world,j=s.journal,farm=window.Farm,r=farm?.current?.(),o=r?.outlook;farm?.ensure?.();
 host.dataset.briefing='true';
 const key=dayKey(s),now=performance.now();if(entered!==key){waking=!!nightDay;nightDay=null;entered=key;enteredAt=Math.max(now,wakeAt);}
 const elapsed=now-enteredAt,playing=elapsed<(waking?2800:900);host.classList.toggle('brief-animate',playing);host.classList.toggle('brief-wake-up',playing&&waking);host.style.setProperty('--brief-t',playing?-elapsed/1000+'s':'0s');
 host.append(hero(w,j,o,r?.extras?.state==='ready'?r.extras:null,playing&&waking));
 // Tomorrow's forecast and today's luck on the TV, as the game shows them.
 if(o&&farm.weatherTv){const tvs=el('div','brief-tvs');
  const a=el('div','brief-tv'),ac=el('div','brief-tv-copy');a.append(farm.weatherTv(o.weatherTomorrow,false));ac.append(el('small','',t('tomorrow')),el('strong','',farm.weatherText(o.weatherTomorrow)));a.append(ac);
  const b=el('div','brief-tv'),bc=el('div','brief-tv-copy');b.append(farm.luckTv(o));bc.append(el('small','',t('luck')),el('strong','',farm.luckText(o.luckLevel)));b.dataset.level=o.luckLevel;b.append(bc);
  tvs.append(a,b);host.append(tvs);if(o.luckText){const bubble=el('div','brief-bubble');bubble.append(el('p','brief-quote',lang==='zh'?'「'+o.luckText+'」':'“'+o.luckText+'”'));host.append(bubble);};}
 else if(!r)host.append(el('p','farm-none',t('loading')));
 // What is special today.
 const title=el('h3','section-title farm-info-title');title.append(img('art/icon-calendar.png'),el('span','',t('special')));host.append(title);
 const list=el('div','brief-list'),today=(j?.calendar||[]).filter(e=>e.season===w.season&&e.day===w.day),bag=s.bag?.slots||[];
 for(const e of today.filter(e=>e.kind==='birthday')){const p=db?.[lang]?.people.find(p=>p.id===e.npcId),loves=!p?[]:window.Spoiler?.tastesFolded('person:'+e.npcId)?(Spoiler.revealed(e.npcId)?.love||[]):Object.entries(p.tastes||{}).filter(([,v])=>v===0).map(([id])=>id),have=loves.find(id=>bag.some(x=>x?.id===id)),pick=have||loves[0],name=pick&&db[lang].items.find(i=>i.id===pick)?.name;
  list.append(row(p?.livePortrait||('art/portraits/'+e.npcId+'.png'),t('birthday',{n:e.name}),name?factRow([t('loves',{i:name}),have?t('carry'):null]):null,'is-birthday'));}
 for(const e of today.filter(e=>e.kind==='festival'||e.kind==='passive'))list.append(row(e.kind==='festival'?'art/cal-festival-1.png':'art/cal-passive.png',t('festival',{n:e.name})));
 if(today.some(e=>e.kind==='bookseller'))list.append(row('art/cal-bookseller.png',t('bookseller')));
 if(o?.merchant?.today){const n=o.merchant.stock.filter(i=>i.bundle).length;list.append(row('art/farm-merchant.png',t('merchant'),n?t('merchantBundle',{n}):null));}
 if(o?.sauce?.today)list.append(row(dbIcon(o.sauce.outputId)||'art/farm-sauce.png',t('sauce',{r:t(o.sauce.rerun?'sauceRerun':'sauceToday'),n:o.sauce.name}),t(o.sauce.known?'known':'unknown')));
 if(o?.tool&&o.tool.daysLeft===0)list.append(row(dbIcon(o.tool.id)||'art/icon-bag.png',t('tool',{n:o.tool.name})));
 for(const q of (j?.quests||[]).filter(q=>!q.archived&&!q.ready&&(q.daysLeft===0||q.daysLeft===1)))list.append(row('art/quest-timed.png',t(q.daysLeft===0?'questDue':'questTomorrow',{n:q.title}),null,'is-warn'));
 if(o&&o.daysLeft<=3){const next=t('seasons.'+o.nextSeason),wither=(r.places||[]).flatMap(p=>p.tasks).filter(x=>x.kind==='cropWither').reduce((n,x)=>n+x.count,0);
  list.append(row('art/icon-calendar.png',o.daysLeft<=1?(wither?t('seasonTomorrow',{s:next,n:wither}):t('seasonTomorrowSafe',{s:next})):t('seasonSoon',{s:next,d:o.daysLeft}),null,o.daysLeft<=1&&wither?'is-warn':''));}
 // Farm report extras: your birthday, Junimo wages, a child growing up, guild rewards waiting.
 const x=r?.extras?.state==='ready'?r.extras:null,XB={zh:{you:'今天是你的生日！',junimo:'朱尼莫今天还没付工资',grows:'{n} 明天就长大了',slayer:'冒险家公会有 {n} 个奖励可领'},en:{you:'It is your birthday today!',junimo:'Junimos have not been paid today',grows:'{n} grows up tomorrow',slayer:'{n} guild rewards to claim'}},xb=(k,v={})=>((XB[lang]||XB.en)[k]).replace(/\{(\w)\}/g,(_,z)=>v[z]??'');
 if(x?.playerBirthday?.state==='ready'&&x.playerBirthday.today)list.append(row('art/gift.png',xb('you'),null,'is-birthday'));
 if(x?.junimos?.state==='ready'&&x.junimos.huts>0&&x.junimos.paidToday===false)list.append(row('art/icon-farm.png',xb('junimo'),null,'is-warn'));
 for(const c of x?.family?.state==='ready'?x.family.children:[])if(c.daysToGrow===1)list.append(row('art/icon-people.png',xb('grows',{n:c.name})));
 const rewards=(x?.slayer||[]).filter(g=>!g.claimed&&g.killed>=g.goal);if(rewards.length)list.append(row('art/stat-damage.png',xb('slayer',{n:rewards.length}),rewards.map(g=>g.name).join(lang==='zh'?'、':', ')));
 if(!list.childElementCount)list.append(el('p','farm-none',t('nothing')));host.append(list);
 // Farm to-dos (the farm page's own categories).
 if(r){const ct=el('h3','section-title farm-info-title');ct.append(img('art/icon-farm.png'),el('span','',t('chores')));host.append(ct);
  const totals=cats.map(([k,kinds,icon])=>[k,icon,(r.places||[]).flatMap(p=>p.tasks).filter(x=>kinds.includes(x.kind)).reduce((n,x)=>n+x.count,0)]).filter(([k,,n])=>n>0&&!(k==='water'&&['rain','storm','green-rain'].includes(w.weather)));
  if(totals.length){const grid=el('div','brief-chores');for(const [k,icon,n] of totals){const c=el('div','brief-chore');const i=dbIcon(icon);if(i)c.append(img(i));c.append(el('small','',t('cats.'+k)),el('strong','',String(n)));grid.append(c);}host.append(grid);}
  else host.append(el('p','farm-none',t('noChores')));}
 const actions=el('div','brief-actions');
 if(r&&window.ThorNav){const f=el('button','brief-button');f.type='button';f.append(el('span','',t('openFarm')));f.onclick=()=>{window.ThorNav.open('farm');window.Farm?.home?.();};actions.append(f);}
 const d=el('button','brief-button is-primary');d.type='button';d.append(el('span','',t('dismiss')));d.onclick=()=>{try{localStorage.setItem(STORE,dayKey(model.snapshot));}catch{}forced=false;window.ThorSound?.play?.('smallSelect');render.after?.();};actions.append(d);host.append(actions);
 
}
// ---------- Night: from falling asleep until the new day starts ----------
const N={zh:{night:'{s}{d}日结束',phase:{sleeping:'正在进入梦乡…',shipping:'正在结算出货',levelup:'升级了！',saving:'正在保存游戏…',waking:'天亮了'},
  shipped:'今日出货 {n} 件',none:'今天没有出货'},
 en:{night:'End of {s} {d}',phase:{sleeping:'Drifting off to sleep…',shipping:'Counting the shipment',levelup:'Level up!',saving:'Saving the game…',waking:'Good morning'},
  shipped:'Shipped today: {n}',none:'Nothing shipped today'}};
const n=(k,v={})=>{let s=k.split('.').reduce((o,p)=>o?.[p],N[lang]||N.en)??k;if(typeof s==='string')for(const [a,b] of Object.entries(v))s=s.replace('{'+a+'}',b);return s;};
const nameOf=(id,fallback)=>db?.[lang]?.items.find(v=>v.id===id)?.name||fallback;
const nextDay=w=>{const seasons=['spring','summer','fall','winter'],i=seasons.indexOf(w.season);return w.day>=28?{season:seasons[(i+1)%4],day:1}:{season:w.season,day:w.day+1};};
Object.assign(N.zh,{today:'今天的收获',skills:['耕种','钓鱼','采集','采矿','战斗'],levelTo:'升到 {l} 级',profession:'可以选职业',friendsToday:'聊天 {t} 人，送礼 {g} 人'});
Object.assign(N.en,{today:'Today',skills:['Farming','Fishing','Foraging','Mining','Combat'],levelTo:'level {l}',profession:'choose a profession',friendsToday:'Talked to {t}, gifts to {g}'});
Object.assign(N.zh,{steps:{sleeping:'入睡',shipping:'出货结算',levelup:'升级',saving:'保存'},ledger:'今日出货',cats:{farming:'农耕',foraging:'采集',fishing:'钓鱼',mining:'采矿',other:'其他'},sum:'共 {g}',best:'最值钱'});
Object.assign(N.en,{steps:{sleeping:'Sleep',shipping:'Shipping',levelup:'Level up',saving:'Save'},ledger:'Shipped today',cats:{farming:'Farming',foraging:'Foraging',fishing:'Fishing',mining:'Mining',other:'Other'},sum:'{g} total',best:'Top earner'});
const gold=v=>v.toLocaleString(lang)+(lang==='zh'?' 金':'g');
const itemIcon=id=>icons.get(id)||db?.[lang]?.items.find(v=>v.id===id)?.icon||null;
// The game's shipping summary groups: its own category rules when the live catalogue gives the
// category number, otherwise the offline category name.
const SHIP=[['farming','(O)24'],['foraging','(O)16'],['fishing','(O)145'],['mining','(O)378'],['other','(O)388']];
function shipGroup(id){if(id==='(O)296'||id==='(O)410')return 'foraging';
 const cid=window.RuntimeCatalog?.item?.(id)?.categoryId;
 if(Number.isInteger(cid))return [-80,-79,-75,-26,-14,-6,-5].includes(cid)?'farming':[-20,-4].includes(cid)?'fishing':[-81,-27,-23].includes(cid)?'foraging':[-15,-12,-2].includes(cid)?'mining':'other';
 const c=db?.en?.items.find(v=>v.id===id)?.category;
 if(['Vegetable','Fruit','Flower','Artisan Goods','Animal Product'].includes(c))return 'farming';if(c==='Forage')return 'foraging';if(c==='Fish'||c==='Trash')return 'fishing';if(c==='Mineral')return 'mining';
 if(c==='Resource')return ['(O)388','(O)390','(O)709','(O)771','(O)330'].includes(id)?'other':'mining';return 'other';}
// The night page is one stage for the whole night: built once, after that a part is only replaced
// when what it shows has changed, so the sky keeps turning and nothing replays. The shipment is
// revealed when the game moves past sleep (its own summary). It recaps the day only; what the new day
// holds is the morning briefing's. At daybreak a full-screen pixel sunrise covers the screen, the
// morning briefing is built under it and uncovered (see daybreak and dawn below).
// The morning's entrance (calendar tear-off included) waits until the daybreak picture has gone.
let wakeAt=0;
const NIGHT_ORDER=['head','total','items','today'],IN_MS=450,RISE_MS=1500,OUT_MS=600,DAWN_MS=IN_MS+RISE_MS+100,WAIT_MS=4000;
let stage=null,stageFresh=false;
const still=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
function nightPart(host,name,sig,build){let node=host.querySelector(':scope>[data-part="'+name+'"]');if(node&&node.dataset.sig===sig)return node;
 const next=build();if(!next){node?.remove();return null;}next.dataset.part=name;next.dataset.sig=sig;if(!stageFresh)next.classList.add('night-in');
 if(node){node.replaceWith(next);return next;}
 const later=[...host.children].find(c=>NIGHT_ORDER.indexOf(c.dataset.part)>NIGHT_ORDER.indexOf(name));host.insertBefore(next,later||null);return next;}
// The sky: stars, the moon, Zzz while asleep, dots while saving, and the dawn glow and sun for waking.
function nightHead(){const head=el('div','brief-head night-head');head.style.backgroundImage='url('+stars()+')';
 const moon=img('art/portrait-night.png');moon.className='night-moon';head.append(el('span','night-twinkle'),el('span','night-dawn'),el('span','night-sun'),moon);
 const hc=el('div','brief-head-copy'),dots=el('span','night-dots');dots.setAttribute('aria-hidden','true');for(let k=0;k<3;k++)dots.append(el('i'));hc.append(el('h2'),el('small','night-phase'),dots);
 const z=el('span','night-zzz');z.setAttribute('aria-hidden','true');for(let k=0;k<3;k++)z.append(el('i'));head.append(hc,z,el('div','night-steps'));return head;}
function paintHead(head,phase){const {date,levelup}=stage;head.dataset.phase=phase;
 const h2=head.querySelector('h2'),title=n('night',{s:t('seasons.'+date.season),d:date.day});if(h2.textContent!==title)h2.textContent=title;
 const line=head.querySelector('.night-phase'),text=n('phase.'+phase);if(line.textContent!==text)line.textContent=text;line.className='night-phase is-'+phase;
 // Where the night is: sleep, shipping, (level up), save; all done once it is morning.
 const order=levelup?['sleeping','shipping','levelup','saving']:['sleeping','shipping','saving'],at=phase==='waking'?order.length:order.indexOf(phase),steps=head.querySelector('.night-steps');
 if(steps.dataset.sig!==order.join()+lang){steps.dataset.sig=order.join()+lang;steps.replaceChildren(...order.map(k=>{const step=el('span','night-step');step.append(el('i'),el('small','',n('steps.'+k)));return step;}));}
 [...steps.children].forEach((step,i)=>{step.classList.toggle('is-done',i<at);step.classList.toggle('is-now',i===at);});}
// Shipping, as the game's summary: total, then farming / foraging / fishing / mining / other.
function nightTotal(ni,items){const card=el('div','night-total');card.dataset.revealed=String(stage.revealed);card.append(img('art/hud-coin.svg'));
 if(ni.total>0){const burst=el('span','night-coins');burst.setAttribute('aria-hidden','true');for(let k=0;k<4;k++)burst.append(img('art/hud-coin.svg'));card.append(burst);}
 const cc=el('div','brief-tv-copy');cc.append(el('small','',ni.count?n('shipped',{n:ni.count}):n('none')),el('strong','night-sum',stage.revealed?gold(ni.total):'…'));card.append(cc);
 if(items.length){const groups=SHIP.map(([k,icon])=>{const list=items.filter(it=>it.group===k);return {k,icon,value:list.reduce((a,it)=>a+it.value,0),count:list.reduce((a,it)=>a+it.stack,0)};}),top=Math.max(1,...groups.map(g=>g.value));
  const ledger=el('div','night-ledger');for(const g of groups){const line=el('div','night-cat');line.dataset.group=g.k;line.dataset.empty=String(!g.count);const i=itemIcon(g.icon);if(i)line.append(img(i));
   const bar=el('span','night-cat-bar'),fill=el('i');fill.style.width=Math.round(g.value/top*100)+'%';bar.append(fill);line.append(el('small','night-cat-name',n('cats.'+g.k)),el('small','night-cat-count',g.count?'× '+g.count:'—'),bar,el('strong','',g.count?gold(g.value):'—'));ledger.append(line);}
  card.append(ledger);}
 if(stage.revealed)card.classList.add('is-settled');return card;}
// The reveal: coins fly, the bars grow and the total counts up in twelve steps.
function reveal(card,total){card.dataset.revealed='true';const sum=card.querySelector('.night-sum');if(!sum)return;
 if(still()||!total){sum.textContent=gold(total);return;}const t0=performance.now();
 const tick=now=>{if(!sum.isConnected)return;const p=Math.min(1,(now-t0)/800),text=gold(Math.round(total*Math.floor(p*12)/12));if(sum.textContent!==text)sum.textContent=text;if(p<1)requestAnimationFrame(tick);};requestAnimationFrame(tick);}
function nightItems(items){const grid=el('div','scene-cards night-items');items.forEach((it,k)=>{const c=el('div','scene-card'+(k===0&&items.length>1?' is-best':''));c.style.setProperty('--i',Math.min(k,20));const i=itemIcon(it.id);if(i)c.append(img(i));const copy=el('span','scene-card-copy');
  copy.append(el('strong','',nameOf(it.id,it.name)),el('small','',factRow(['× '+it.stack,n('sum',{g:gold(it.value)})])));c.append(copy);if(k===0&&items.length>1)c.title=n('best');grid.append(c);});return grid;}
// Today in numbers (backend readers): experience per skill, level ups and professions waiting,
// villagers talked to and given gifts. Missing when the mod had no start-of-day baseline.
function nightToday(ni,gains){if(!gains.length&&!ni.friends)return null;const box=el('div','night-today');box.append(el('small','night-today-title',n('today')));const list=el('div','night-gains');
 for(const k of gains){const g=el('span','night-gain'+(k.level>k.startLevel?' is-up':'')),icon=/^[0-4]$/.test(k.id)?'art/skill-'+k.id+'.png':'art/skill-full.png';g.append(img(icon));
  const name=/^[0-4]$/.test(k.id)?n('skills')[Number(k.id)]:k.id;g.append(el('small','',factRow([name+' +'+k.experience.toLocaleString(lang),k.level>k.startLevel?n('levelTo',{l:k.level}):null,k.pendingProfession?n('profession'):null])));list.append(g);}
 if(ni.friends){const g=el('span','night-gain');g.append(img('art/chat.png'));g.append(el('small','',n('friendsToday',{t:ni.friends.talked,g:ni.friends.gifted})));list.append(g);}
 box.append(list);return box;}
// Tomorrow: weather, the calendar, what ripens, and what is due or opens.
function renderNight(host,sc){
 const s=model.snapshot,w=s.world,ni=sc.night||{},farm=window.Farm,r=farm?.current?.(),o=r?.outlook,j=s.journal;farm?.ensure?.();nightDay=dayKey(s);
 const phase=ni.phase==='waking'?'waking':model.busy==='saving'?'saving':ni.phase||'sleeping';
 // The day being ended: sent by the mod (the game's own date moves on early in the night).
 const date=ni.day?{season:ni.season,day:ni.day}:{season:w.season,day:w.day},key=(s.session||'')+'|'+date.season+date.day;
 stageFresh=!stage||stage.host!==host||stage.key!==key||!host.querySelector(':scope>[data-part=head]');
 if(stageFresh){clearTimeout(stage?.timer);host.replaceChildren();delete host.dataset.dawn;stage={host,key,date,revealed:false,levelup:false,dawnAt:0,hold:0,timer:0};
  host.classList.add('scene-enter');host.style.setProperty('--scene-t','0s');setTimeout(()=>{if(stage?.host===host&&stage.key===key)host.classList.remove('scene-enter');},2200);}
 stage.date=date;stage.levelup||=phase==='levelup'||(ni.skills||[]).some(k=>k.level>k.startLevel);
 paintHead(nightPart(host,'head','head',nightHead),phase);
 const items=sc.items.filter(Boolean).map(it=>({...it,value:it.price*it.stack,group:shipGroup(it.id)})).sort((a,b)=>b.value-a.value);
 const card=nightPart(host,'total',JSON.stringify([lang,ni.total,ni.count,items.map(i=>[i.id,i.stack,i.value])]),()=>nightTotal(ni,items));
 if(phase!=='sleeping'&&!stage.revealed){stage.revealed=true;if(stageFresh)setTimeout(()=>{if(card.isConnected)reveal(card,ni.total);},450);else reveal(card,ni.total);}
 nightPart(host,'items',stage.revealed?JSON.stringify([lang,items.map(i=>[i.id,i.stack,i.value])]):'hidden',()=>stage.revealed&&items.length?nightItems(items):null);
 const gains=Array.isArray(ni.skills)?ni.skills.filter(k=>k.experience>0||k.level>k.startLevel||k.pendingProfession):[];
 nightPart(host,'today',JSON.stringify([lang,gains,ni.friends]),()=>nightToday(ni,gains));
 if(phase==='waking')dawnStart(host);stageFresh=false;}
// ---------- Daybreak: a full-screen pixel sunrise between the night and the morning ----------
// Drawn on a quarter-resolution canvas scaled up without smoothing, over the whole bottom screen: the
// night sky dissolves in (8x8 ordered dither), the sky warms band by band while the moon sets, the
// stars go out and the sun clears the hills; the morning page is put in place underneath, then the
// picture dissolves away the same way. A tap skips it.
function bayer(n){let m=[[0]];while(m.length<n){const s=m.length,r=[];for(let y=0;y<2*s;y++){r.push([]);for(let x=0;x<2*s;x++)r[y].push(4*m[y%s][x%s]+[[0,2],[3,1]][y/s|0][x/s|0]);}m=r;}return m;}
const B8=bayer(8);
const NIGHT=['#14173e','#1b1f4c','#23285e','#2c2f6e','#363579','#423d84','#4d448e'].map(hex);
const DAWN=['#2e2c6a','#433a80','#6a4a8c','#a45a88','#d8727e','#f29a6c','#ffc27a'].map(hex);
const spread=(cols,n)=>Array.from({length:n},(_,i)=>{const f=i/(n-1)*(cols.length-1),k=Math.min(cols.length-2,f|0);return mix(cols[k],cols[k+1],f-k);});
// The sky at progress p (0 night, .5 dawn, 1 morning), stepped so it changes like frames, not a fade.
const skyAt=(morning,p)=>{const q=Math.round(p*12)/12;return q<.5?NIGHT.map((c,i)=>mix(c,DAWN[i],q*2)):DAWN.map((c,i)=>mix(c,morning[i],(q-.5)*2));};
const toward=(night,day,p)=>mix(hex(night),hex(day),Math.min(1,Math.max(0,(p-.25)/.6)));
// Colours used every frame, parsed once rather than per pixel.
const DB={glow:hex('#ffd39a'),star:hex('#fff0b0'),starDim:hex('#c9c4ff'),starRim:hex('#8f8acb'),moon:hex('#fff3c4'),sunRim:hex('#ffc94a'),sun:hex('#ffe27a'),sunCore:hex('#fff6c8'),cloudNight:hex('#3b3a7e'),cloudDawn:hex('#f2a6a0'),cloudDay:hex('#ffffff')};
const smooth=x=>x<=0?0:x>=1?1:x*x*(3-2*x);
function daybreak(date){
 const pal=PAL[date.season]||PAL.spring,morning=spread(pal.sky.map(hex),7),rand=rng(date.day*31+date.season.length);
 const cover=el('div','daybreak'),c=document.createElement('canvas'),copy=el('div','daybreak-copy');cover.setAttribute('aria-hidden','true');
 copy.append(el('h2','',t('morning')),el('small','',t('date',{s:t('seasons.'+date.season),d:date.day,w:t('weekdays')[(date.day-1)%7]})));
 cover.append(c,copy);document.body.append(cover);
 const W=Math.ceil(innerWidth/4),H=Math.ceil(innerHeight/4);c.width=W;c.height=H;c.style.width=W*4+'px';c.style.height=H*4+'px';const g=c.getContext('2d'),img=g.createImageData(W,H),px=img.data;
 const horizon=Math.round(H*.7),stars=Array.from({length:Math.round(W*H/70)},()=>({x:rand()*W|0,y:rand()*horizon*.85|0,k:rand(),big:rand()<.12,ph:rand()*3|0}));
 // Far ridge, near hills with pines, and two clouds; all fixed for the picture.
 const ridge=[],hill=[],pines=[];for(let x=0;x<W;x++){ridge.push(Math.round(horizon-7-5*Math.sin(x*.045+1.1)-3*Math.sin(x*.13+.4)));hill.push(Math.round(horizon+3-3*Math.sin(x*.07+2)-2*Math.sin(x*.19)));}
 for(let x=4;x<W-4;x+=6+(rand()*9|0))if(rand()<.55)pines.push(x);
 const tufts=Array.from({length:Math.round(W*(H-horizon)/55)},()=>({x:rand()*W|0,y:horizon+6+rand()*(H-horizon-6)|0,flower:rand()<.35?(rand()*Math.max(1,pal.flowers.length)|0):-1}));
 const clouds=[[W*.18,H*.22,14],[W*.62,H*.34,10]];
 let start=performance.now(),released=0,frame=-1,raf=0,gone=false;
 // A safety net only: dawn() lifts it once the morning page is in place (the game can stay
 // in its waking phase for several seconds).
 const life=setTimeout(()=>release(),15000);
 function put(i,col){px[i]=col[0];px[i+1]=col[1];px[i+2]=col[2];px[i+3]=255;}
 function draw(now){
  const t=now-start,step=Math.floor(t/42);raf=requestAnimationFrame(draw);if(step===frame)return;frame=step;
  const p=smooth((t-IN_MS)/RISE_MS),sky=skyAt(morning,p),inK=Math.min(1,t/IN_MS)*64,outK=released?Math.min(1,(now-released)/OUT_MS)*64:0;
  if(released&&now-released>=OUT_MS){finish();return;}
  const sunR=Math.max(6,Math.round(W*.06)),sx=Math.round(W*.68),sy=Math.round(horizon+sunR+2-(horizon*.55+sunR)*smooth((p-.12)/.88));
  const moonX=Math.round(W*.22),moonY=Math.round(H*.18+p*H*.5),moonR=Math.max(4,Math.round(W*.035)),glowP=Math.sin(Math.min(1,p)*Math.PI)*.7+.15*p;
  const mount=toward('#1c1e4a',pal.mount[1],p),mountLit=toward('#26285a',pal.mount[2],p),near=toward('#151a3a',pal.hill[1],p),nearLit=toward('#1d2347',pal.hill[0],p),meadow=pal.meadow.map((m,i)=>toward(['#181d40','#141936','#10142e'][i],m,p)),pine=toward('#0f1330',pal.tree[2],p),tuft=toward('#0d1128',pal.tree[1],p);
  const cloud=p<.5?mix(DB.cloudNight,DB.cloudDawn,p*2):mix(DB.cloudDawn,DB.cloudDay,(p-.5)*2),cloudShade=mix(cloud,sky[3],.35);
  const twinkle=step/7|0,glowSky=sky.map(c=>mix(c,DB.glow,.55));
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4,b=B8[y&7][x&7];
   if(b>=inK||(released&&b<outK)){px[i+3]=0;continue;}
   // Sky: seven bands, each blending into the next by ordered dither.
   const f=Math.min(6.999,y/horizon*6),k=f|0;let col=sky[Math.min(6,k+((f-k)*64>b?1:0))];
   // Sun glow, strongest at dawn.
   const dx=x-sx,dy=y-sy,d=Math.sqrt(dx*dx+dy*dy);
   if(d<sunR*2.4&&d>=sunR&&(1-(d-sunR)/(sunR*1.4))*glowP*64>b)col=glowSky[Math.min(6,k+((f-k)*64>b?1:0))];
   put(i,col);}
  // Stars go out as the sky warms; the bright ones twinkle.
  for(const s of stars){if(s.k<p*1.5)continue;const i=(s.y*W+s.x)*4;if(px[i+3]===0)continue;const on=(twinkle+s.ph)%3!==0;put(i,on?DB.star:DB.starDim);
   if(s.big&&on)for(const [ox,oy] of [[1,0],[-1,0],[0,1],[0,-1]]){const xx=s.x+ox,yy=s.y+oy;if(xx>=0&&yy>=0&&xx<W&&yy<H&&px[(yy*W+xx)*4+3])put((yy*W+xx)*4,DB.starRim);}}
  // The moon sets: a crescent, thinning out by dither.
  for(let y=moonY-moonR;y<=moonY+moonR;y++)for(let x=moonX-moonR;x<=moonX+moonR;x++){if(x<0||y<0||x>=W||y>=H)continue;const i=(y*W+x)*4;if(!px[i+3])continue;
   const a=(x-moonX)**2+(y-moonY)**2<=moonR*moonR,cut=(x-moonX-moonR*.55)**2+(y-moonY+moonR*.35)**2<=moonR*moonR;if(a&&!cut&&B8[y&7][x&7]>=p*2.2*64)put(i,DB.moon);}
  // Clouds drift and take the dawn's colour.
  for(const [cx0,cy,len] of clouds){const cx=Math.round(cx0+t*.004)%(W+len*2)-len;for(let r=0;r<4;r++){const w=len-Math.abs(r-1.5)*4|0,x0=cx+(len-w>>1);for(let x=x0;x<x0+w;x++){const y=Math.round(cy)+r;if(x<0||x>=W||y<0||y>=H)continue;const i=(y*W+x)*4;if(px[i+3])put(i,r===3?cloudShade:cloud);}}}
  // The sun, behind the hills: a pale core and a warm rim.
  for(let y=sy-sunR;y<=sy+sunR;y++)for(let x=sx-sunR;x<=sx+sunR;x++){if(x<0||y<0||x>=W||y>=H)continue;const i=(y*W+x)*4;if(!px[i+3])continue;const d=Math.sqrt((x-sx)**2+(y-sy)**2);if(d<=sunR)put(i,d>sunR-1.2?DB.sunRim:d>sunR*.55?DB.sun:DB.sunCore);}
  // Ridge, hills with a lit edge, pines, ground.
  for(let x=0;x<W;x++)for(let y=ridge[x];y<H;y++){const i=(y*W+x)*4;if(!px[i+3])continue;let col;if(y<hill[x])col=y===ridge[x]?mountLit:mount;else if(y===hill[x])col=nearLit;else{const f=Math.min(1.999,(y-hill[x])/(H-hill[x])*2),k=f|0;col=meadow[Math.min(2,k+((f-k)*64>B8[y&7][x&7]?1:0))];}put(i,col);}
  // Grass tufts and, in daylight, flowers across the meadow.
  for(const u of tufts){const i=(u.y*W+u.x)*4;if(!px[i+3])continue;if(u.flower>=0&&p>.55&&pal.flowers.length){put(i,hex(pal.flowers[u.flower%pal.flowers.length]));continue;}put(i,tuft);for(const ox of [-1,1]){const x=u.x+ox,y=u.y+1;if(x>=0&&x<W&&y<H&&px[(y*W+x)*4+3])put((y*W+x)*4,tuft);}}
  for(const x0 of pines){const base=hill[x0];for(let r=0;r<7;r++){const half=r>>1;for(let x=x0-half;x<=x0+half;x++){const y=base-7+r;if(x<0||x>=W||y<0)continue;const i=(y*W+x)*4;if(px[i+3])put(i,pine);}}}
  g.putImageData(img,0,0);
  cover.classList.toggle('is-day',p>=.75&&!released);}
 function finish(){if(gone)return;gone=true;cancelAnimationFrame(raf);clearTimeout(life);cover.remove();}
 function release(){if(!released&&!gone){released=performance.now();cover.classList.remove('is-day');}}
 cover.addEventListener('pointerdown',release);
 raf=requestAnimationFrame(draw);
 return {release,finish,covered:()=>!released&&performance.now()-start>=IN_MS+RISE_MS};}
function dawnStart(host){if(!stage||stage.host!==host||stage.dawnAt)return;stage.dawnAt=performance.now();host.dataset.dawn='true';
 const head=host.querySelector(':scope>[data-part=head]');if(head&&head.dataset.phase!=='waking')paintHead(head,'waking');
 if(!still())stage.cover=daybreak(nextDay(stage.date));}
// Called by the context page when the night scene has ended: holds the page while the sunrise
// plays (and a little longer while the day's data arrives), then lets it move on.
function dawn(host,done,ready){if(!stage||stage.host!==host||!host.querySelector(':scope>[data-part=head]'))return false;
 if(still()){stage=null;return false;}
 dawnStart(host);const now=performance.now();if(!stage.hold)stage.hold=now;
 const wait=Math.max(stage.dawnAt+DAWN_MS-now,ready()?0:stage.hold+WAIT_MS-now);
 // The morning page is built while the sunrise still covers the screen, then the picture lifts.
 if(wait<=0){const cover=stage.cover;clearTimeout(stage.timer);stage=null;if(cover){wakeAt=now+OUT_MS+80;requestAnimationFrame(()=>requestAnimationFrame(()=>cover.release()));}return false;}
 clearTimeout(stage.timer);stage.timer=setTimeout(done,wait+16);return true;}
window.Briefing={renderNight,night:renderNight,dawn,daybreak,
 // Idle context page before noon (or opened by hand), not yet dismissed today.
 shouldShow(s,hasCard){const w=s?.world;if(!w||!s.journal)return false;if(forced)return true;return !hasCard&&w.time<1200&&!dismissed(s);},
 render(host,refresh){render.after=refresh;render(host);},
 open(){forced=true;try{localStorage.removeItem(STORE);}catch{}},
 dayKey,
 // The morning is complete: the new day's journal and the farm report for it (the mod rebuilds both).
 morningReady(s){const j=s?.journal,r=window.Farm?.report?.();return !!j&&(!('farmVersion' in j)||j.farmVersion!=null&&!!r&&r.version>=j.farmVersion);},
 key:s=>[dayKey(s),forced,dismissed(s),window.Farm?.report?.()?.version,s?.world?.time>=1200,s?.bag?.slots?.map(x=>x?.id).join()],
 label:()=>t('open'),
 // The context page heading while the briefing shows.
 title:()=>lang==='zh'?'早报':'Morning'};
})();
