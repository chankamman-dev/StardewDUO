/* Farm tab: today's chores, tomorrow's outlook and daily info (UI Info Suite style).
   Renews the mod's on-demand /bridge/farm lease while this tab is visible, even when
   farmVersion is stable. Read-only: rows open the local map. */
(()=>{'use strict';
const panel=$('farm');let host=el('div','farm-host');panel.append(host);
let view={tab:'todo',filter:'',place:null},report=null,reportSession=null,fetching=false,retryAt=0,readAt=-Infinity,signature='';
const L={
 zh:{todo:'待办',tomorrow:'明天',info:'资讯',plan:'利润',harvestCalendar:'收获',connect:'连接游戏后查看',enterSave:'进入存档后查看',update:'更新配套模组后可查看完整农务、明日预告和资讯',loading:'正在读取农场…',scanning:'正在巡视',collected:'巡视于',limited:'部分内容过多，已截断',allDone:'今天的农务都完成了',
  harvest:'收获',water:'浇水',machine:'机器',animal:'动物',care:'喂养',tree:'果树',
  cropReady:'可收获',cropDry:'需要浇水',machineDone:'加工完成',grabber:'采集器里有 {n} 件',animalPet:'今天还没抚摸',animalHarvest:'可以挤奶或剪毛',animalProduct:'地上的动物产品',hay:'饲料槽缺干草，住着 {n} 只',petBowl:'水碗是空的',fruitTree:'树上有 {n} 个果子',
  onMap:'在地图上查看',weather:'明日天气',island:'姜岛',season:'本季剩余',seasonDays:'{n} 天',seasonTomorrow:'明天换季',nextSeason:'下一季：{s}',ripe:'明天成熟',ripeDry:'其中 {n} 株还没浇水',wither:'换季后会枯萎',late:'{n} 株来不及成熟',processing:'加工中',noRipe:'明天没有要成熟的作物',noWither:'换季不会有作物枯萎',noMachines:'没有正在加工的机器',
  today:'今天',tomorrowAt:'明天',daysLater:'{n} 天后',plants:'{n} 株',units:'{n} 台',
  luck:'今日运势',luckLevels:['大凶','小凶','平平','小吉','大吉'],sauce:'酱料女王',sauceToday:'今天播出',sauceRerun:'今天重播',sauceNext:'{n} 天后的周日播出',known:'已学会',unknown:'未学会',merchant:'旅行货车',merchantToday:'今天在森林营业',merchantNext:'{n} 天后再来',bundle:'收集包需要',stock:'剩 {n}',birthday:'今天生日',silo:'筒仓干草',tool:'克林的工具升级',toolReady:'可以去取了',toolDays:'还需 {n} 天',noInfo:'暂无资讯',more:'其他',
  weathers:{Sun:'晴天',Rain:'雨天',Storm:'雷雨',Snow:'下雪',Wind:'有风',Festival:'节日',Wedding:'婚礼',GreenRain:'绿雨'},seasons:{spring:'春季',summer:'夏季',fall:'秋季',winter:'冬季'},rainNote:'作物会自动浇水'},
 en:{todo:'To do',tomorrow:'Tomorrow',info:'Info',plan:'Profit',harvestCalendar:'Harvest',connect:'Connect to the game to view',enterSave:'Load a save to view',update:'Update the companion mod for the full farm list, forecast and info',loading:'Reading the farm…',scanning:'Checking',collected:'Checked at',limited:'Some lists were too long and are shortened',allDone:'All farm chores are done for today',
  harvest:'Harvest',water:'Water',machine:'Machines',animal:'Animals',care:'Feeding',tree:'Fruit trees',
  cropReady:'Ready to harvest',cropDry:'Needs watering',machineDone:'Ready to collect',grabber:'{n} items in the grabber',animalPet:'Not petted today',animalHarvest:'Ready to milk or shear',animalProduct:'Animal products on the ground',hay:'Troughs short of hay, {n} residents',petBowl:'Water bowl is empty',fruitTree:'{n} fruit on the tree',
  onMap:'Show on map',weather:'Tomorrow',island:'Ginger Island',season:'Season left',seasonDays:'{n} days',seasonTomorrow:'Season changes tomorrow',nextSeason:'Next: {s}',ripe:'Ripe tomorrow',ripeDry:'{n} not watered yet',wither:'Will wither when the season changes',late:'{n} won’t ripen in time',processing:'Processing',noRipe:'No crops ripen tomorrow',noWither:'No crops will wither',noMachines:'No machines are working',
  today:'Today',tomorrowAt:'Tomorrow',daysLater:'in {n} days',plants:'{n} plants',units:'{n} machines',
  luck:'Daily luck',luckLevels:['Very bad','Bad','Neutral','Good','Very good'],sauce:'The Queen of Sauce',sauceToday:'On today',sauceRerun:'Rerun today',sauceNext:'Sunday, in {n} days',known:'Learned',unknown:'Not learned',merchant:'Traveling Cart',merchantToday:'In the forest today',merchantNext:'Back in {n} days',bundle:'Bundle',stock:'{n} left',birthday:'Birthday today',silo:'Silo hay',tool:'Clint’s tool upgrade',toolReady:'Ready to pick up',toolDays:'{n} days left',noInfo:'No info yet',more:'Other',
  weathers:{Sun:'Sunny',Rain:'Rain',Storm:'Storm',Snow:'Snow',Wind:'Windy',Festival:'Festival',Wedding:'Wedding',GreenRain:'Green rain'},seasons:{spring:'Spring',summer:'Summer',fall:'Fall',winter:'Winter'},rainNote:'Crops will be watered'}};
const tr=(k,n)=>{const v=(L[lang]||L.en)[k]??k;return typeof v==='string'&&n!==undefined?v.replace('{n}',n).replace('{s}',n):v;};
// Category cards: kinds that belong to each, and the icon shown.
const cats=[['harvest',['cropReady'],'(O)24'],['water',['cropDry'],'(T)WateringCan'],['machine',['machine','grabber'],'(BC)12'],['animal',['animalPet','animalHarvest','animalProduct'],'(T)MilkPail'],['care',['hay','petBowl'],'(O)178'],['tree',['fruitTree'],'(O)613']];
const todoKinds=cats.flatMap(c=>c[1]),catOf=kind=>cats.find(c=>c[1].includes(kind));
const icon=(id,fallback='art/icon-farm.png')=>icons.get(id)||db?.[lang]?.items.find(v=>v.id===id)?.icon||fallback;
// Vanilla farm animals have their own first-frame sprite (tools/extract-farm-art.cjs).
const animals=new Set(['white chicken','brown chicken','blue chicken','void chicken','golden chicken','duck','rabbit','dinosaur','white cow','brown cow','goat','sheep','pig','ostrich']);
function taskIcon(task){const id=task.id.toLowerCase();if(task.kind==='animalPet'&&animals.has(id))return 'art/animals/'+id.replace(/ /g,'-')+'.png';
 return icon(task.icon||task.id,task.kind==='petBowl'?icon('(T)WateringCan'):task.kind==='animalPet'?'art/heart-full.png':'art/icon-farm.png');}
const button=(cls,click)=>{const b=el('button',cls);b.type='button';b.onclick=click;return b;};
function fresh(){return model.status(performance.now())==='ready'&&model.snapshot?.state==='ready';}
function journal(){return fresh()?model.snapshot?.journal:null;}

// Old mods only send per-location counts and up to 12 sample tiles: show those, no forecast.
function legacy(j){return {version:0,legacy:true,state:j.scan?.state==='limited'?'limited':'ready',limited:[],outlook:null,places:j.chores.map(c=>({locationId:c.locationId,location:c.location,
 tasks:[['cropsReady','cropReady'],['cropsDry','cropDry'],['machinesReady','machine'],['animalsUnpetted','animalPet']].filter(([k])=>c[k]>0).map(([k,kind])=>{const d=c.details.filter(d=>d.kind===(kind==='animalPet'?'animal':kind));
  return {kind,id:d[0]?.id||'',name:kind==='animalPet'?tr('animal'):d[0]?.name||tr(catOf(kind)[0]),count:c[k],tiles:d.flatMap(v=>[v.x,v.y]),icon:kind==='animalPet'?'(O)176':null};})})).filter(p=>p.tasks.length)};}
function sync(force=false){
 const s=model.snapshot;if(s?.session!==reportSession){reportSession=s?.session;report=null;retryAt=0;readAt=-Infinity;}
 if(stopped||document.hidden||!fresh())return;
 const version=journal()?.farmVersion;
 // Architecture v2 phase 5: with the push stream up it holds the farm lease; read only on a new version.
 const stream=window.StardewStream,streamed=!!stream?.live?.();stream?.setWant?.('farm',streamed&&(page==='farm'||!!force));
 const now=performance.now(),renew=!streamed&&page==='farm'&&now-readAt>=2500;
 if(streamed&&version==null)return;
 // The mod scans the farm only once /bridge/farm has been asked for (the lease), so farmVersion stays
 // null until then: ask anyway, or the tab and the mod wait for each other forever.
 if((page!=='farm'&&!force)||fetching||now<retryAt||(version==null&&now-readAt<2500)||(report&&version!=null&&report.version>=version&&!renew))return;
 fetching=true;readAt=now;const session=reportSession;
 fetch('/bridge/farm',{cache:'no-store',signal:AbortSignal.timeout(3000)}).then(r=>r.ok?r.json():Promise.reject(Error('HTTP '+r.status)))
  .then(j=>{if(!StardewModel.validFarm(j))throw Error('farm');if(session===reportSession&&session===model.snapshot?.session&&(!report||j.version>report.version))report=j;})
  .catch(()=>{if(session===reportSession&&session===model.snapshot?.session)retryAt=performance.now()+3000;}).finally(()=>{fetching=false;draw();});
}
// A current mod also reports null while it rescans (the clock moved): keep the last report meanwhile.
function current(){const j=journal();if(!j)return null;if(!('farmVersion' in j))return legacy(j);return report;}

function openOnMap(place,task,label){
 if(!window.LocalMap||!task.tiles.length)return;
 window.ThorNav?window.ThorNav.open('map'):showPage('map');
 window.LocalMap.focus(place.locationId,task.tiles,`${label}${lang==='zh'?'：':': '}${place.location} ×${task.count}`);
}
function taskRow(place,task,sub,right){
 const b=button('journal-row farm-task',()=>openOnMap(place,task,task.name)),copy=el('span','journal-row-copy');
 b.dataset.kind=task.kind;b.disabled=!task.tiles.length||!window.LocalMap;b.title=tr('onMap');
 b.append(img(taskIcon(task)));
 copy.append(el('strong','',task.name));if(sub)copy.append(el('small','',sub));b.append(copy);
 const end=el('span','farm-task-end');if(right)end.append(right);b.append(end,el('span','journal-arrow','›'));return b;
}
function count(n,cls='farm-count'){const s=el('strong',cls,String(n));return s;}
function sub(task){const k=task.kind;
 if(k==='machine')return tr('machineDone');if(k==='grabber')return tr('grabber',task.extra||0);if(k==='hay')return tr('hay',task.extra||0);if(k==='fruitTree')return tr('fruitTree',task.extra||0);
 return tr(k);}
function placeHeading(place,total){const h=el('h3','section-title farm-place');h.append(total==null?el('span','',place.location):withCount(place.location,total));return h;}
function scanLine(j,r){
 // Only while a scan runs or when it was cut short; a finished scan needs no time stamp.
 const scan=j.scan,running=scan?.state==='scanning'&&!scan.completedAt,line=el('div','farm-scan');if(!(running&&!r)&&!(r?.state==='limited'||r?.limited?.length))return;
 line.append(img(running?'art/icon-map.png':'art/hud-clock.svg'));
 const at=new Date(r?.collectedAt||scan?.completedAt||j.collectedAt),time=Number.isFinite(at.getTime())?`${String(at.getHours()).padStart(2,'0')}:${String(at.getMinutes()).padStart(2,'0')}`:'—';
 line.append(el('small','',running&&!r?`${tr('scanning')} ${scan.completed} / ${scan.total}`:`${tr('collected')} ${time}`));
 if(r?.state==='limited'||r?.limited?.length)
 host.append(line);
}

// Harvest calendar: the Billboard board (as on the quest page) with crop icons and the game's
// stack digits on each ripening day; the chosen day lists crops in reward boxes.
let harvestMonth=null,harvestDay=null,harvestSession=null;
const H={zh:{update:'更新配套模组后查看收获日历',title:'第{n}年{s}',today:'今天',prev:'上一季',next:'下一季',none:'这个季节没有预计收获',pick:'点日期查看当天收获',
  day:'{s}{n}日',expected:'预计收获',noDay:'当天没有预计收获',blocked:'换季前无法成熟',dry:'{n}株未浇水',regrow:'每{n}天再生',
  inDays:'{n}天后',todayAt:'今天',summary:'本季待收 {plants} 株，共 {days} 个收获日',drySummary:'今天有 {n} 株未浇水，不浇水收获会推迟',empty:'已巡视地点没有正在生长的普通作物',
  },
 en:{update:'Update the companion mod to see harvest dates',title:'{s}, Year {n}',today:'Today',prev:'Previous season',next:'Next season',none:'No harvest expected this season',pick:'Tap a day to see its harvest',
  day:'{s} {n}',expected:'Expected harvest',noDay:'No harvest expected on this day',blocked:'Cannot ripen before the season changes',dry:'{n} unwatered',regrow:'Regrows every {n} days',
  inDays:'in {n} days',todayAt:'Today',summary:'{plants} plants to harvest over {days} days',drySummary:'{n} unwatered today; skipping water delays the harvest',empty:'No growing crops in the checked places',
  }};
const ht=(k,v={})=>{let s=(H[lang]||H.en)[k]??k;for(const [a,b] of Object.entries(v))s=s.replace('{'+a+'}',b);return s;};
const seasonKeys=['spring','summer','fall','winter'];
function stackCount(n){const s=el('span','harvest-count');if(window.StackDigits)window.StackDigits.set(s,n);else if(n>1)s.textContent=n;return s;}
function harvestBox(id,n){const box=el('span','plan-icon harvest-box');box.append(img(icon(id)));if(n>1)box.append(stackCount(n));return box;}
function renderHarvest(r){
 const h=r.harvest;if(!h){host.append(StateBox.update('art/icon-calendar.png',ht('update')));return;}
 const base=(h.year-1)*112+h.season*28+h.day-1,currentMonth=Math.floor(base/28);
 if(harvestSession!==reportSession){harvestSession=reportSession;harvestMonth=null;harvestDay=null;}
 if(harvestMonth==null)harvestMonth=currentMonth;
 const month=harvestMonth,season=seasonKeys[month%4],groups=h.crops.filter(c=>c.days>=0).map(c=>({...c,date:base+c.days})),inMonth=groups.filter(c=>Math.floor(c.date/28)===month);
 const go=m=>{harvestMonth=m;harvestDay=null;signature='';draw();};
 // Month bar: the game's arrows around the season, like the quest-page calendar.
 const nav=el('div','journal-month harvest-nav'),prev=button('',()=>go(month-1)),next=button('',()=>go(month+1));
 prev.append(el('span','','‹'));next.append(el('span','','›'));prev.setAttribute('aria-label',ht('prev'));next.setAttribute('aria-label',ht('next'));
 prev.disabled=month<=currentMonth;next.disabled=month>=currentMonth+36;
 const mark=el('span','plan-season-mark');mark.style.setProperty('--season',month%4);mark.setAttribute('aria-hidden','true');
 const today=button('journal-today',()=>go(currentMonth));today.append(el('span','',ht('today')));today.disabled=month===currentMonth;
 nav.append(prev,mark,el('h2','',ht('title',{s:tr('seasons')[season],n:Math.floor(month/4)+1})),next,today);host.append(nav);
 // Board: 28 day buttons positioned over the Billboard art (original-art.css).
 const board=el('div','journal-calendar harvest-board');board.setAttribute('role','group');
 for(let d=0;d<28;d++){
  const date=month*28+d,entries=inMonth.filter(c=>c.date===date),b=button('journal-day harvest-day',()=>{harvestDay=date;signature='';draw();});
  b.dataset.date=date;b.setAttribute('aria-pressed',String(harvestDay===date));b.classList.toggle('today',date===base);b.classList.toggle('past',date<base);b.classList.toggle('has-harvest',entries.length>0);
  const counts=new Map();for(const c of entries)counts.set(c.id,(counts.get(c.id)||0)+c.count);
  // One icon per cell (the largest planting, with its count); other crops that day as +N.
  if(counts.size){const [id,n]=[...counts].sort((a,b)=>b[1]-a[1])[0],marks=el('span','harvest-marks'),m=el('span','harvest-mark');m.append(img(icon(id)));if(n>1)m.append(stackCount(n));marks.append(m);
   if(counts.size>1)marks.append(el('small','harvest-more','+'+(counts.size-1)));b.append(marks);}
  if(entries.some(c=>c.dry>0)){const w=img(icon('(T)WateringCan'));w.className='harvest-dry';b.append(w);}
  b.setAttribute('aria-label',`${ht('day',{s:tr('seasons')[season],n:d+1})}: ${entries.map(c=>c.name+' × '+c.count).join(', ')||ht('noDay')}`);board.append(b);}
 host.append(board);
 const plants=inMonth.reduce((a,c)=>a+c.count,0),days=new Set(inMonth.map(c=>c.date)).size,dry=groups.reduce((a,c)=>a+c.dry,0);
 host.append(el('p','harvest-summary',inMonth.length?ht('summary',{plants,days}):ht('none')));
 if(dry&&month===currentMonth)host.append(el('p','harvest-summary is-dry',ht('drySummary',{n:dry})));
 // The chosen day (or the first harvest of the month).
 const chosen=harvestDay??inMonth.map(c=>c.date).sort((a,b)=>a-b)[0];
 if(chosen!=null){const shown=groups.filter(c=>c.date===chosen);
  const title=el('h3','section-title farm-info-title harvest-title');title.append(img('art/icon-calendar.png'),el('span','',factRow([ht('day',{s:tr('seasons')[seasonKeys[Math.floor(chosen/28)%4]],n:chosen%28+1}),ht('expected')])));host.append(title);
  for(const c of shown)host.append(harvestRow(c,chosen-base));if(!shown.length)host.append(el('p','farm-none',ht('noDay')));}
 const blocked=h.crops.filter(c=>c.days<0);
 if(blocked.length&&month===currentMonth){host.append(el('h3','section-title harvest-blocked-title',ht('blocked')));for(const c of blocked)host.append(harvestRow(c,null));}
 if(!h.crops.length)host.append(el('p','farm-none',ht('empty')));
 
}
function harvestRow(c,away){
 const row=el('div','journal-row harvest-crop');row.classList.toggle('is-blocked',away==null);row.append(harvestBox(c.id,c.count));
 const copy=el('span','journal-row-copy'),name=el('span','plan-name');name.append(el('strong','',c.name+' × '+c.count));copy.append(name);
 const facts=el('span','plan-facts');facts.append(el('small','harvest-place',c.location));
 if(c.dry)facts.append(el('small','plan-tag is-warn',ht('dry',{n:c.dry})));if(c.regrow)facts.append(el('small','plan-tag is-good',ht('regrow',{n:c.regrow})));
 copy.append(facts);row.append(copy);
 if(away!=null)row.append(el('strong','harvest-when'+(away===0?' is-today':''),away===0?ht('todayAt'):ht('inDays',{n:away})));
 return row;}
function renderTodo(r,j){
 scanLine(j,r);
 const totals=Object.fromEntries(cats.map(c=>[c[0],0]));for(const p of r.places)for(const t of p.tasks)if(todoKinds.includes(t.kind))totals[catOf(t.kind)[0]]+=t.count;
 const grid=el('div','farm-cats');
 for(const [key,,id] of cats){const b=button('farm-cat',()=>{view.filter=view.filter===key?'':key;signature='';draw();window.ThorNav?.refresh();}),copy=el('span','farm-cat-copy');
  b.dataset.cat=key;b.setAttribute('aria-pressed',String(view.filter===key));b.classList.toggle('is-clear',!totals[key]);
  b.append(img(icon(id)));copy.append(el('small','',tr(key)),el('strong','',String(totals[key])));b.append(copy);grid.append(b);}
 host.append(grid);
 const kinds=cats.find(c=>c[0]===view.filter)?.[1]||todoKinds;let shown=0;
 for(const place of r.places){
  const tasks=place.tasks.filter(t=>kinds.includes(t.kind)).sort((a,b)=>todoKinds.indexOf(a.kind)-todoKinds.indexOf(b.kind)||b.count-a.count);if(!tasks.length)continue;
  host.append(placeHeading(place,tasks.reduce((n,t)=>n+t.count,0)));
  for(const task of tasks){host.append(taskRow(place,task,sub(task),count(task.count)));shown++;}
 }
 if(!shown){const done=el('p','farm-empty');done.append(img('art/check-on.png'),el('span','',tr('allDone')));host.append(done);}
}

function clock(minutes){
 const w=model.snapshot?.world;if(!w)return '';const now=Math.floor(w.time/100)*60+w.time%100,at=now+minutes,day=Math.floor(at/1440),m=at%1440;
 const hm=`${Math.floor(m/60)}:${String(m%60).padStart(2,'0')}`;return day===0?`${tr('today')} ${hm}`:day===1?`${tr('tomorrowAt')} ${hm}`:tr('daysLater',day);
}
function card(cls,art,title,value,note){const c=el('div','farm-card '+cls),copy=el('div','farm-card-copy');if(art)c.append(typeof art==='string'?img(art):art);copy.append(el('small','',title),el('strong','',value));if(note)copy.append(el('span','farm-card-note',note));c.append(copy);return c;}
// Original TV: a 42x28 screen with an animated 13x13 overlay strip, as TV.setWeatherOverlay/setFortuneOverlay draw it.
function tv(screen,overlay,frames,x,y,label){const box=el('span','farm-tv'),o=el('span','farm-tv-overlay');box.setAttribute('role','img');box.setAttribute('aria-label',label||'');box.append(img('art/'+screen+'.png'));
 o.style.backgroundImage=`url(art/${overlay}.png)`;o.style.setProperty('--frames',frames);o.style.setProperty('--x',x);o.style.setProperty('--y',y);box.append(o);return box;}
function luckTv(o){return tv(o.luck>=.1?'farm-tv-fortune-good':o.luck<=-.1?'farm-tv-fortune-bad':'farm-tv-fortune','farm-luck-'+String(o.luckLevel).replace('-','m'),4,15,1,tr('luckLevels')[o.luckLevel+2]);}
function weatherTv(weather,island){if(island)return tv('farm-tv-island','farm-wx-'+({Rain:'rain',Storm:'storm'}[weather]||'sun'),4,3,3,weather);
 if(weather==='GreenRain')return tv('farm-tv-greenrain','farm-wx-greenrain',6,3,3,weather);
 const wind=model.snapshot?.world?.season==='spring'?'wind-spring':'wind';
 return tv('farm-tv-weather','farm-wx-'+({Rain:'rain',Storm:'storm',Snow:'snow',Festival:'festival',Wind:wind}[weather]||'sun'),4,3,3,weather);}
function renderTomorrow(r){
 const o=r.outlook,cards=el('div','farm-cards');
 const weather=o.weatherTomorrow,wet=['Rain','Storm','GreenRain'].includes(weather);
 cards.append(card('farm-weather',weatherTv(weather),tr('weather'),tr('weathers')[weather]||weather||'—',wet?tr('rainNote'):o.islandWeatherTomorrow?labelValue(tr('island'),tr('weathers')[o.islandWeatherTomorrow]||o.islandWeatherTomorrow):''));
 const next=el('span','farm-season-icon');next.style.setProperty('--season',Math.max(0,['spring','summer','fall','winter'].indexOf(o.nextSeason)));next.setAttribute('role','img');next.setAttribute('aria-label',tr('seasons')[o.nextSeason]||o.nextSeason);
 cards.append(card('farm-season',next,tr('season'),o.daysLeft===0?tr('seasonTomorrow'):tr('seasonDays',o.daysLeft),tr('nextSeason',tr('seasons')[o.nextSeason]||o.nextSeason)));
 host.append(cards);
 const section=(title,kind,empty,describe,right,order)=>{
  const rows=[];for(const p of r.places)for(const t of p.tasks)if(t.kind===kind)rows.push([p,t]);
  host.append(el('h3','section-title farm-section',title));
  if(!rows.length){host.append(el('p','farm-none',empty));return;}
  rows.sort(order||((a,b)=>b[1].count-a[1].count));for(const [p,t] of rows)host.append(taskRow(p,t,describe(p,t),right(t)));
 };
 section(tr('ripe'),'cropTomorrow',tr('noRipe'),(p,t)=>factRow([p.location,tr('plants',t.count),t.extra?tr('ripeDry',t.extra):null]),t=>count(t.count));
 section(tr('processing'),'machineSoon',tr('noMachines'),(p,t)=>factRow([p.location,tr('units',t.count)]),t=>el('strong','farm-time',clock(t.minutes||0)),(a,b)=>(a[1].minutes||0)-(b[1].minutes||0));
 section(factRow([tr('wither'),o.daysLeft===0?tr('seasonTomorrow'):tr('seasonDays',o.daysLeft)]),'cropWither',tr('noWither'),(p,t)=>factRow([p.location,tr('plants',t.count),t.extra?tr('late',t.extra):null]),t=>count(t.count,'farm-count'+(t.extra?' is-late':'')));
}

function infoSection(cls,icon,title,body){const h=el('h3','section-title farm-info-title '+cls);if(icon)h.append(img(icon));h.append(el('span','',title));host.append(h);for(const n of body)if(n)host.append(n);}
function infoRow(iconSrc,name,note,tag,tagClass=''){const r=el('div','farm-info-row'),copy=el('div','farm-info-copy');r.append(img(iconSrc));copy.append(el('strong','',name));if(note)copy.append(el('small','',note));r.append(copy);if(tag)r.append(el('span','farm-tag '+tagClass,tag));return r;}
// Farm report extras (T5): your birthday, family, Junimo huts and the Adventurer's Guild goals.
// Only what is available is shown; nothing is claimed or changed from here.
const XT={zh:{you:'你的生日',youToday:'今天是你的生日！',youOn:'{d}',family:'家庭',spouse:'配偶',child:'孩子',grows:'{n} 天后长大',tomorrow:'明天长大',grown:'已长大',junimo:'朱尼莫小屋',huts:'{n} 座小屋',paid:'今天已付工资',unpaid:'今天还没付工资',abilities:'能力',slayer:'冒险家公会',claim:'可领取奖励',claimed:'已领取',more:'还有 {n} 个目标'},
 en:{you:'Your birthday',youToday:'It is your birthday today!',youOn:'{d}',family:'Family',spouse:'Spouse',child:'Child',grows:'Grows up in {n} days',tomorrow:'Grows up tomorrow',grown:'Grown up',junimo:'Junimo huts',huts:'{n} huts',paid:'Paid today',unpaid:'Not paid today',abilities:'Abilities',slayer:"Adventurer's Guild",claim:'Reward ready',claimed:'Claimed',more:'{n} more goals'}};
const xt=(k,v={})=>((XT[lang]||XT.en)[k]||k).replace(/\{(\w)\}/g,(_,x)=>v[x]??'');
let slayerAll=false;
function renderExtras(x){if(!x||x.state!=='ready')return;
 const b=x.playerBirthday;if(b?.state==='ready'&&b.season){const when=(lang==='zh'?{spring:'春',summer:'夏',fall:'秋',winter:'冬'}[b.season]+b.day+'日':({spring:'Spring',summer:'Summer',fall:'Fall',winter:'Winter'}[b.season]+' '+b.day));
  infoSection('farm-info-you','art/gift.png',xt('you'),[infoRow('art/gift.png',b.today?xt('youToday'):when,null,b.today?when:null,b.today?'is-known':'')]);}
 const f=x.family;if(f?.state==='ready'&&(f.spouse||f.children.length)){const rows=[];
  if(f.spouse){const person=db?.[lang]?.people.find(p=>p.id===f.spouse);rows.push(infoRow(person?.livePortrait||'art/portraits/'+f.spouse+'.png',person?.name||f.spouse,xt('spouse'),null));}
  for(const c of f.children)rows.push(infoRow('art/icon-people.png',c.name,factRow([xt('child'),c.birthday]),c.daysToGrow===1?xt('tomorrow'):c.daysToGrow>0?xt('grows',{n:c.daysToGrow}):c.daysToGrow===0?xt('grown'):null,c.daysToGrow===1?'is-known':''));
  infoSection('farm-info-family','art/heart-full.png',xt('family'),rows);}
 const jn=x.junimos;if(jn?.state==='ready'&&jn.huts>0){const rows=[infoRow('art/icon-farm.png',xt('huts',{n:jn.huts}),jn.abilities?.length?labelValue(xt('abilities'),jn.abilities.join('、')):null,xt(jn.paidToday?'paid':'unpaid'),jn.paidToday?'is-known':'is-empty')];infoSection('farm-info-junimo','art/icon-farm.png',xt('junimo'),rows);}
 const goals=(x.slayer||[]).filter(g=>!g.claimed).sort((a,b)=>(b.killed>=b.goal)-(a.killed>=a.goal)||b.killed/b.goal-a.killed/a.goal);
 if(goals.length){const shown=slayerAll?goals:goals.slice(0,5),rows=shown.map(g=>{const done=g.killed>=g.goal,row=infoRow(g.reward?icon(g.reward,'art/stat-damage.png'):'art/stat-damage.png',g.name,null,done?xt('claim'):`${Math.min(g.killed,g.goal)} / ${g.goal}`,done?'is-known':'');
   const bar=el('span','farm-slayer-bar'),fill=el('span','farm-slayer-fill');fill.style.width=Math.min(100,Math.round(100*g.killed/Math.max(1,g.goal)))+'%';bar.append(fill);row.querySelector('.farm-info-copy').append(bar);row.dataset.slayer=g.id;return row;});
  if(goals.length>5&&!slayerAll){const more=button('farm-more',()=>{slayerAll=true;signature='';draw();});more.textContent=xt('more',{n:goals.length-5});rows.push(more);}
  infoSection('farm-info-slayer','art/stat-damage.png',xt('slayer'),rows);}
}
function renderInfo(r,j){
 const o=r.outlook,world=model.snapshot?.world;
 // Luck: the TV fortune teller, with the same screen and overlay the TV shows for this luck.
 const luck=el('div','farm-luck');luck.dataset.level=o.luckLevel;const copy=el('div','farm-luck-copy');
 luck.append(luckTv(o));
 copy.append(el('strong','',tr('luckLevels')[o.luckLevel+2]));if(o.luckText)copy.append(el('p','farm-quote',o.luckText));luck.append(copy);
 infoSection('farm-info-luck','art/farm-dice.png',tr('luck'),[luck]);
 if(o.sauce){const s=o.sauce;infoSection('farm-info-sauce','art/farm-sauce.png',tr('sauce'),[infoRow(icon(s.outputId,'art/icon-manual.png'),s.name,s.today?tr(s.rerun?'sauceRerun':'sauceToday'):tr('sauceNext',s.inDays),tr(s.known?'known':'unknown'),s.known?'is-known':'')]);}
 const m=o.merchant,stock=el('div','farm-stock');
 for(const item of m.stock){const b=button('farm-stock-item',()=>window.Journal?.openItem(item.id)),copy=el('span','farm-stock-copy');b.disabled=!db?.[lang]?.items.some(v=>v.id===item.id);b.classList.toggle('is-bundle',item.bundle);
  b.append(img(icon(item.id)));copy.append(el('strong','',item.name));const price=el('small','farm-price');price.append(img('art/hud-coin.svg'),el('span','',item.price.toLocaleString(lang)));copy.append(price);b.append(copy);
  if(item.bundle){const bag=img('art/farm-bundle.png');bag.className='farm-bundle';bag.title=tr('bundle');b.append(bag);b.setAttribute('aria-label',item.name+' · '+tr('bundle'));}
  if(item.stock>=0&&item.stock<5)b.append(el('small','farm-stock-left',tr('stock',item.stock)));stock.append(b);}
 infoSection('farm-info-merchant','art/farm-merchant.png',tr('merchant'),[el('p','farm-info-when',m.today?tr('merchantToday'):tr('merchantNext',m.nextInDays)),m.stock.length?stock:null]);
 const births=world?(j.calendar||[]).filter(e=>e.kind==='birthday'&&e.season===world.season&&e.day===world.day):[];
 if(births.length)infoSection('farm-info-birthday','art/gift.png',tr('birthday'),births.map(e=>{const person=db?.[lang]?.people.find(p=>p.id===e.npcId),b=button('journal-row farm-birthday',()=>window.ThorNav?.open('people',{personId:e.npcId,profile:true})),copy=el('span','journal-row-copy');b.disabled=!person;b.append(img(person?.livePortrait||(person?'art/portraits/'+person.id+'.png':'art/icon-people.png')));copy.append(el('strong','',e.name));b.append(copy,el('span','journal-arrow','›'));return b;}));
 renderExtras(r.extras);
 const more=[];
 if(o.tool)more.push(infoRow(icon(o.tool.id,'art/icon-bag.png'),o.tool.name,tr('tool'),o.tool.daysLeft?tr('toolDays',o.tool.daysLeft):tr('toolReady'),o.tool.daysLeft?'':'is-known'));
 if(o.hayCapacity>0)more.push(infoRow(icon('(O)178'),tr('silo'),null,`${o.hay} / ${o.hayCapacity}`,o.hay===0?'is-empty':''));
 if(more.length)infoSection('farm-info-more',null,tr('more'),more);
}

function draw(){
 if(page!=='farm')return;sync();
 const j=journal(),r=current(),w=model.snapshot?.world;
 const key=JSON.stringify([view,lang,!!db,model.status(performance.now()),model.snapshot?.session,j?.farmVersion,r?.version,r?.legacy&&j?.chores,r?.legacy&&j?.scan?.state,!r&&fetching,view.tab==='plan'?[window.CropPlanner?.stateKey(),w?.season,w?.day]:0,view.tab==='info'?[w?.day,w?.season]:0]);
 put('heading',words[lang].farm);
 const todo=r?r.places.reduce((n,p)=>n+p.tasks.reduce((m,t)=>m+(todoKinds.includes(t.kind)?t.count:0),0),0):null;put('page-meta',todo==null?'':String(todo));
 if(key===signature)return;signature=key;
 // The view is built into a detached copy and morphed into the page: only what changed is touched.
 const top=panel.scrollTop,live=host;host=live.cloneNode(false);host.dataset.tab=view.tab;
 try{
 const tabs=el('div','farm-tabs');
 for(const tab of ['todo','tomorrow','harvestCalendar','info','plan']){const b=button('',()=>{if(view.tab===tab)return;view={...view,tab,place:null};signature='';panel.scrollTop=0;draw();window.ThorNav?.refresh();});b.setAttribute('aria-pressed',String(view.tab===tab));b.dataset.tab=tab;b.textContent=tr(tab);tabs.append(b);}
 host.append(tabs);
 if(!j){host.append(StateBox.connection('art/icon-farm.png')||StateBox.update('art/icon-farm.png',tr('update')));return;}
 if(!r){host.append(StateBox.loading('art/icon-farm.png'));return;}
 if(view.tab==='plan'){window.CropPlanner?.render(host,r.planner,()=>{signature='';draw();window.ThorNav?.refresh();});panel.scrollTop=top;return;}
 if(view.tab==='harvestCalendar')renderHarvest(r);
 else if(view.tab==='todo')renderTodo(r,j);
 else if(!r.outlook)host.append(r.legacy?StateBox.update('art/icon-farm.png',tr('update')):el('p','journal-empty',tr('noInfo')));
 else if(view.tab==='tomorrow')renderTomorrow(r);else renderInfo(r,j);
 if(r.legacy&&view.tab==='todo')host.append(el('p','farm-note',tr('update')));
 }finally{const built=host;host=live;ViewNodes.morph(live,built);}
 panel.scrollTop=top;
}
function getState(){return {...view,scroll:panel.scrollTop};}
function restore(next){view={tab:['todo','tomorrow','harvestCalendar','info','plan'].includes(next?.tab)?next.tab:'todo',filter:cats.some(c=>c[0]===next?.filter)?next.filter:'',place:null};signature='';draw();requestAnimationFrame(()=>{panel.scrollTop=Number(next?.scroll)||0;});}
// Filters are the only nested state; back clears them before leaving the tab.
function canBack(){return !!view.filter||(view.tab==='plan'&&!!window.CropPlanner?.canBack());}
function back(){if(view.tab==='plan'&&window.CropPlanner?.back())return true;if(!view.filter)return false;view.filter='';signature='';draw();return true;}
function home(){view={...view,filter:'',place:null};window.CropPlanner?.reset();signature='';}
const previous=render;render=function(){previous();draw();};
// The morning briefing (briefing.js) reads the same report and reuses the TV art.
window.Farm={render:draw,getState,restore,back,canBack,home,report:()=>report,current:()=>current(),ensure:()=>sync(true),weatherTv,luckTv,luckText:level=>tr('luckLevels')[level+2],weatherText:w=>tr('weathers')[w]||w};
})();
