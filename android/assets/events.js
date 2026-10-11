/* MH Events List's read-only directory. Conditions are descriptions, never a trigger check. */
(()=>{'use strict';
const T={zh:{events:'剧情事件',search:'搜索事件或地点…',all:'全部',seen:'已看过',unseen:'未看过',disabled:'已禁用',building:'正在读取剧情目录…',absent:'未安装 MH Events List',unsupported:'当前 MH Events List 版本暂不支持',unavailable:'暂时无法读取剧情事件',update:'更新配套模组后查看剧情事件',empty:'没有符合筛选的事件',count:'{n} 个事件',page:'{n} / {t}',prev:'上一页',next:'下一页',secret:'尚未看过的剧情已隐藏',reveal:'查看这个事件的资料',conditions:'事件条件',notice:'这里只显示模组记录的条件，不代表事件现在可以触发。',time:'时间',slots:'背包空位',items:'需要物品',people:'在场居民',hearts:'关系要求',when:'其他条件',raw:'原始条件',source:'来源',limited:'目录有部分读取限制',stale:'资料正在更新，暂显示上次结果'},
en:{events:'Story events',search:'Search events or locations…',all:'All',seen:'Seen',unseen:'Unseen',disabled:'Disabled',building:'Reading the event directory…',absent:'MH Events List is not installed',unsupported:'This MH Events List version is not supported',unavailable:'Events are unavailable right now',update:'Update the companion mod to view events',empty:'No matching events',count:'{n} events',page:'{n} / {t}',prev:'Previous',next:'Next',secret:'Unseen story details are hidden',reveal:'Show this event’s details',conditions:'Event conditions',notice:'These are recorded conditions, not confirmation that an event can trigger now.',time:'Time',slots:'Free inventory slots',items:'Required items',people:'NPCs present',hearts:'Relationship requirements',when:'Other conditions',raw:'Raw conditions',source:'Source',limited:'Some directory information is limited',stale:'Updating; showing the previous result'}};
const w=(k,v={})=>((T[lang]||T.en)[k]||k).replace(/\{(\w)\}/g,(_,x)=>v[x]??'');
Object.assign(T.zh,{candidate:'可触发候选',relationship:'关系事件',current:'当前地点',enabled:'未禁用',kind:'事件类型',allKinds:'全部类型',candidateNote:'候选只排除时间、日期、好感等已知条件不符的事件；婚姻、天气、在场人物及模组条件仍需游戏核对。',candidateTag:'可能触发（待核对）',checkedTag:'已知条件满足'});
Object.assign(T.en,{candidate:'Candidates',relationship:'Relationship events',current:'Current location',enabled:'Enabled',kind:'Event type',allKinds:'All event types',candidateNote:'Candidates exclude known time, date and friendship failures. Marriage, weather, NPC presence and mod conditions still need an in-game check.',candidateTag:'Maybe (check in game)',checkedTag:'Known conditions met'});
function isHere(e){const here=model.snapshot?.world?.location;return !!here&&(e.location===here||location(e)===here);}
function fresh(){return model.status(performance.now())==='ready';}
let eventSession=null;
const location=e=>window.MapNames?.location(e.location,lang)||e.location;
const labelCache=new WeakMap();
const labels=e=>{const people=db?.[lang]?.people||[],old=labelCache.get(e);if(old?.language===lang&&old.people===people)return old.value;const value=EventLabels.describe(e,lang,people,location(e));labelCache.set(e,{language:lang,people,value});return value;};
const hiddenTitle=()=>lang==='zh'?'未发现剧情':'Undiscovered event';
const conditionNames={Random:['概率','Chance'],HasItem:['持有物品','Has item'],LocalMail:['邮件','Mail'],HostMail:['邮件','Mail'],HostOrLocalMail:['邮件','Mail'],NotLocalMail:['邮件','Mail'],DayOfWeek:['星期','Day of week'],NotDayOfWeek:['星期','Day of week'],Tile:['所在位置','Position'],FestivalDay:['节日','Festival'],NotFestivalDay:['节日','Festival'],Shipped:['出货','Shipped'],HasMoney:['金钱','Money'],EarnedMoney:['累计收入','Earned'],DaysPlayed:['游戏天数','Days played'],Dating:['约会','Dating'],WorldState:['世界状态','World state'],Time:['时间','Time'],Friendship:['好感要求','Friendship'],Spouse:['婚姻要求','Spouse'],NotSpouse:['婚姻要求','Spouse'],NpcVisibleHere:['在场居民','NPC present'],Year:['年份','Year'],Weather:['天气','Weather'],Season:['季节','Season'],NotSeason:['季节','Season'],DayOfMonth:['日期','Day of month'],SawEvent:['前置事件','Previous events'],FreeInventorySlots:['背包空位','Free slots']};
const secret=(e,view)=>!!window.Spoiler?.enabled('events')&&!e.seen&&view.eventReveal!==e.id;
function art(id){return icons.get(id)||db?.[lang]?.items.find(i=>i.id===id)?.icon||'art/icon-manual.png';}
Object.assign(T.zh,{progress:'剧情收集',progressOf:'已看过 {n} / {t}',cast:'出场居民',details:'事件资料',id:'事件编号',current:'当前 {n} 心',hidden:'还没看过这段剧情'});
Object.assign(T.en,{progress:'Story collection',progressOf:'{n} / {t} seen',cast:'Cast',details:'Event details',id:'Event ID',current:'You: {n} hearts',hidden:'You have not seen this event yet'});
// Who appears: dialogue speakers first, then villagers named by the conditions. Villagers the
// spoiler setting hides stay a silhouette.
const personById=id=>{const low=String(id||'').toLowerCase();return low?(db?.[lang]?.people||[]).find(p=>String(p.id).toLowerCase()===low)||null:null;};
function cast(e){const list=[],add=id=>{const p=personById(id);if(p&&!list.includes(p))list.push(p);};
 for(const d of e.dialogue||[])add(d.npc);
 for(const t of EventFilter.parsed(e).tokens){if(t.kind==='Friendship')t.args.forEach((a,i)=>{if(i%2===0)add(a);});else if(['Spouse','NotSpouse','NpcVisibleHere'].includes(t.kind))add(t.args[0]);}
 for(const h of e.conditions?.hearts||[])add(h.npc);for(const id of e.conditions?.npcsPresent||[])add(id);return list;}
// The mod an event comes from: MH Events' own field, else the installed mod whose UniqueID prefixes the event ID.
const eventMod=e=>e.mod||window.RuntimeCatalog?.modOf?.(e.id)||null;
const modChip=(e,cls)=>{const id=eventMod(e);return id?window.RuntimeCatalog?.modChip?.(id,cls)||null:null;};
const unmet=p=>!!window.Spoiler?.hides?.(p.id);
function face(p,cls){const box=el('span',cls);if(p&&!unmet(p))box.append(window.PortraitImages?PortraitImages.person(p):img('art/portraits/'+p.id+'.png'));else{box.classList.add('is-unknown');box.append(el('small','','?'));}return box;}
// The first line of dialogue worth quoting (the same excerpt the title uses).
function excerpt(e){const lines=labels(e).dialogue;return lines.find(d=>Array.from(d.text).length>=12)||lines[0]||null;}
const clip=(s,max)=>{const a=Array.from(s);return a.length>max?a.slice(0,max).join('')+'…':s;};
// Required hearts per villager and the time window, read from the recorded conditions.
function needs(e){const hearts=[];let time=null;
 for(const t of EventFilter.parsed(e).tokens){if(t.negative)continue;if(t.kind==='Friendship'&&t.args.length>=2&&t.args.length%2===0)for(let i=0;i<t.args.length;i+=2){const n=Number(t.args[i+1]);if(Number.isFinite(n))hearts.push({id:t.args[i],points:n});}
  else if(t.kind==='Time'&&t.args.length===2&&t.args.every(v=>/^\d+$/.test(v)))time=[Number(t.args[0]),Number(t.args[1])];}
 if(!e.conditions?.raw)for(const h of e.conditions?.hearts||[])if(h.points>0)hearts.push({id:h.npc,points:h.points});
 if(!time&&(e.conditions?.startTime!=null||e.conditions?.endTime!=null))time=[e.conditions.startTime,e.conditions.endTime];return {hearts,time};}
const clock=n=>n==null?'—':String(Math.floor(n/100)).padStart(2,'0')+':'+String(n%100).padStart(2,'0');
function chip(icon,text,cls=''){const c=el('span','event-chip'+(cls?' '+cls:''));c.append(img(icon),el('small','',text));return c;}
const pointsOf=id=>model.snapshot?.social?.find(p=>String(p.id).toLowerCase()===String(id).toLowerCase())?.points;
// A row of hearts up to the requirement, filled as far as the farmer already is.
function heartRow(need){const box=el('span','event-hearts'),want=Math.min(14,Math.ceil(need.points/250)),p=personById(need.id),have=p&&!unmet(p)?pointsOf(p.id):undefined;
 for(let k=1;k<=want;k++){const h=img(have==null||have>=k*250?'art/heart-full.png':'art/heart-empty.png');box.append(h);}
 if(have!=null)box.append(el('small','',w('current',{n:Math.floor(have/250)})));return box;}
const conditionIcons={Time:'art/hud-clock.svg',Friendship:'art/heart-full.png',Spouse:'art/weather-wedding.png',NotSpouse:'art/weather-wedding.png',NpcVisibleHere:'art/icon-people.png',Year:'art/icon-calendar.png',Season:'art/icon-calendar.png',NotSeason:'art/icon-calendar.png',DayOfMonth:'art/icon-calendar.png',Weather:'art/weather-rain.png',SawEvent:'art/quest-normal.png',FreeInventorySlots:'art/icon-bag.png'};
function refresh(view,values){Object.assign(view,values);window.Journal?.render();}
// The game's own per-condition judgement (trigger, from the backend readers). Without it the page
// keeps the older snapshot-based candidates.
Object.assign(T.zh,{readyTag:'现在可触发',chanceTag:'可触发（看运气）',triggerNote:'按游戏自己的规则逐条判定；概率条件标「看运气」，无法判断的条件不算作可触发。',
 vReady:'现在去{l}就会触发',vChance:'条件都满足，还要看运气（概率条件）',vBlocked:'还差 {n} 个条件',vUnknown:'有无法判断的条件，请在游戏里核对',vGate:'暂时无法判断',gateEvent:'正在播放剧情，结束后再判断',gateHost:'联机时只有主机能判断',
 pass:'满足',fail:'未满足',chance:'看运气',unknownMark:'无法判断',judgedNotice:'游戏按自己的规则逐条判定：满足标绿，未满足标红。'});
Object.assign(T.en,{readyTag:'Can trigger now',chanceTag:'Can trigger (chance)',triggerNote:'Judged by the game’s own rules, condition by condition; chance conditions are marked, unknown ones never count as ready.',
 vReady:'Go to {l} now and it will trigger',vChance:'Everything is met; a chance condition still applies',vBlocked:'{n} conditions not met',vUnknown:'Some conditions cannot be judged; check in game',vGate:'Cannot judge right now',gateEvent:'A cutscene is playing; judged after it ends',gateHost:'Only the host can judge in multiplayer',
 pass:'Met',fail:'Not met',chance:'Chance',unknownMark:'Unknown',judgedNotice:'Judged by the game’s own rules: met in green, not met in red.'});
function verdict(e){const tr=e.trigger;if(!tr||tr.state==='seen')return null;
 const box=el('div','event-verdict is-'+tr.state+(tr.state==='ready'&&tr.chance.length?' is-chance':'')),where=location(e);
 const text=tr.state==='ready'?(tr.chance.length?w('vChance'):w('vReady',{l:where})):tr.state==='blocked'?w('vBlocked',{n:tr.failed.length}):tr.state==='gate'?(tr.gate==='event-active'?w('gateEvent'):tr.gate==='not-host'?w('gateHost'):w('vGate')):w('vUnknown');
 box.append(el('strong','',text));return box;}
// Condition rows with the position of the condition they describe, so the judgement can mark them.
function indexedRows(e,d){const raw=e.conditions?.raw;if(!raw||!e.trigger)return d.rows.map(r=>({...r,index:null}));const parts=EventLabels.parts(raw);if(!parts)return d.rows.map(r=>({...r,index:null}));
 const out=[];parts.forEach((part,index)=>{for(const r of EventLabels.describe({...e,conditions:{...e.conditions,raw:part}},lang,db?.[lang]?.people||[],location(e)).rows)out.push({...r,index});});return out;}
function mark(e,tileNode,index){const tr=e.trigger;if(!tr||['seen','gate'].includes(tr.state)||index==null)return;const has=list=>list.some(x=>x.index===index);
 const state=has(tr.failed)?'fail':has(tr.chance)?'chance':has(tr.unknown)?'unknown':'pass';tileNode.classList.add('is-'+state);tileNode.append(el('small','event-check',w(state==='unknown'?'unknownMark':state)));}
// A list row's judgement: the game's own when present, else the snapshot-based candidate.
function judge(e,ctx){const tr=e.trigger;if(tr&&!e.disabled)return {candidate:tr.state==='ready',tag:tr.state==='ready'?(tr.chance.length?'chanceTag':'readyTag'):'candidateTag'};
 const c=EventFilter.candidate(e,ctx);return {candidate:c.candidate,tag:c.unknown?'candidateTag':'checkedTag'};}
function detail(host,e,view,ui,data){
 const hidden=secret(e,view),people=hidden?[]:cast(e);
 // The stage: who is in it, where it happens, and whether you have seen it.
 const stage=el('div','event-stage');stage.dataset.state=hidden?'hidden':e.seen?'seen':'unseen';
 const faces=el('div','event-cast');if(people.length)for(const p of people.slice(0,3)){const f=el('span','event-actor');f.append(face(p,'event-portrait'),el('small','event-name',unmet(p)?'???':p.name));faces.append(f);}else faces.append(face(null,'event-portrait'));stage.append(faces);
 const copy=el('div','event-stage-copy'),sign=el('span','event-sign');sign.append(img('art/pin.svg'),el('span','event-location',location(e)));
 const tags=el('span','event-tags');const status=el('span','directory-tag event-status',w(e.seen?'seen':'unseen'));status.dataset.tone=e.seen?'seen':'unseen';tags.append(status);if(e.disabled)tags.append(el('span','directory-tag',w('disabled')));const from=modChip(e);if(from)tags.append(from);
 copy.append(sign,el('h2','journal-title',hidden?hiddenTitle():labels(e).title),tags);stage.append(copy);host.append(stage);
 if(hidden){host.append(el('p','journal-empty',w('secret')),ui.button(w('reveal'),()=>refresh(view,{eventReveal:e.id}),'directory-reveal'));return;}
 const description=labels(e),heading=(text,icon)=>{const h=el('h3','event-section');h.append(img(icon),el('span','',text));host.append(h);};
 const verdictBox=verdict(e);if(verdictBox)host.append(verdictBox);
 // Dialogue as the game's own dialogue box (words left, portrait and name right), folded until opened.
 if(description.dialogue.length){const fold=el('details','event-fold'),sum=el('summary','event-section');sum.append(img('art/chat.png'),el('span','',lang==='zh'?'剧情对白预览':'Dialogue preview'));fold.append(sum);fold.open=view.eventDialogue===e.id;fold.ontoggle=()=>{view.eventDialogue=fold.open?e.id:null;};host.append(fold);
  (e.dialogue||[]).forEach((d,i)=>{const line=description.dialogue[i];if(!line)return;const quote=el('blockquote','event-dialogue'),p=personById(d.npc);quote.dataset.narration=String(!d.npc);
   quote.append(el('p','',line.text));const who=el('span','event-speaker');if(d.npc)who.append(face(p,'event-portrait'));who.append(el('small','',p&&unmet(p)?'???':line.speaker));quote.append(who);fold.append(quote);});}
 // Conditions as tiles.
 const c=e.conditions;heading(w('conditions'),'art/icon-quests.png');const judged=!!e.trigger&&!['seen','gate'].includes(e.trigger.state);
 const grid=el('div','event-conditions');host.append(grid);
 function tile(icon,label,value,wide){const r=el('div','event-condition'+(wide?' is-wide':''));r.append(img(icon));const body=el('span','event-condition-copy');body.append(el('small','',label),el('span','',value));r.append(body);grid.append(r);return body;}
 if(!description.rows.some(r=>r.key==='Time')&&(c.startTime!=null||c.endTime!=null))tile('art/hud-clock.svg',w('time'),clock(c.startTime)+' – '+clock(c.endTime));
 if(!description.rows.some(r=>r.key==='FreeInventorySlots')&&c.freeSlots)tile('art/icon-bag.png',w('slots'),String(c.freeSlots));
 const {hearts}=needs(e);
 const rows=indexedRows(e,description);
 for(const row of [...rows].sort((a,b)=>(a.key==='Time'?-1:0)-(b.key==='Time'?-1:0))){const name=conditionNames[row.key],wide=['Friendship','SawEvent','NpcVisibleHere','Spouse','NotSpouse'].includes(row.key)||row.value.length>18;
  const body=tile(conditionIcons[row.key]||'art/icon-manual.png',name?.[lang==='zh'?0:1]||w('when'),row.value,wide);mark(e,body.parentElement,row.index);
  if(row.key==='Friendship'&&!row.value.startsWith(lang==='zh'?'不满足':'NOT'))for(const need of hearts)body.append(heartRow(need));
  // Earlier events this one follows: open them from here.
  if(row.key==='SawEvent'){const links=el('span','event-links');for(const t of EventFilter.parsed(e).tokens.filter(t=>t.kind==='SawEvent'))for(const id of t.args){const prior=data.entries.find(x=>x.id===id);if(!prior)continue;const b=ui.button('',()=>ui.go('events',prior.id),'event-link');b.append(img(prior.seen?'art/event-seen.svg':'art/event-new.svg'),el('small','',secret(prior,view)?hiddenTitle():clip(labels(prior).title,18)));links.append(b);}if(links.childElementCount)body.append(links);}}
 // Conditions the game judged that the labels above could not describe (mail, items, mod conditions…).
 const shown=new Set(rows.map(r=>r.index)),parts=EventLabels.parts(c.raw||'')||[],tr=e.trigger;
 if(tr&&!['seen','gate'].includes(tr.state))for(const x of [...tr.failed,...tr.chance,...tr.unknown].sort((a,b)=>a.index-b.index))if(!shown.has(x.index)){shown.add(x.index);const body=tile(conditionIcons[x.kind]||'art/icon-manual.png',conditionNames[x.kind]?.[lang==='zh'?0:1]||x.kind,clip((parts[x.index]||'').trim(),48),true);mark(e,body.parentElement,x.index);}
 
 if(c.requiredItems.length){heading(w('items'),'art/icon-bag.png');const list=el('div','bundle-items');for(const id of c.requiredItems){const item=db?.[lang]?.items.find(i=>i.id===id),b=ui.button('',()=>ui.openItem(id),'bundle-item'),copy=el('span','bundle-item-copy');copy.append(el('strong','',item?.name||id));b.append(img(art(id)),copy);b.disabled=!item;list.append(b);}host.append(list);}
 // The technical part last, quietly.
 const meta=el('div','event-meta');
 if(e.mod||e.source){const r=el('div','event-condition is-meta');r.append(el('small','',w('source')),el('span','',factRow([e.mod,e.source])));meta.append(r);}
 if(c.when.length){const more=el('details','event-raw');more.append(el('summary','',lang==='zh'?'模组附加条件（原始资料）':'Additional mod conditions (raw data)'),el('p','',JSON.stringify(c.when,null,2)));meta.append(more);}
 if(c.raw){const more=el('details','event-raw');more.append(el('summary','',w('raw')),el('p','',c.raw));meta.append(more);}
 host.append(meta);
}
Object.assign(T.zh,{readyNow:'现在可触发',person:'居民',allPeople:'全部居民',place:'地点',allPlaces:'全部地点',here:'当前所在地',story:'剧情',needHearts:'还差 {n} 心',blockedTag:'条件未满足',viewAll:'查看全部 {n} 段剧情'});
Object.assign(T.en,{readyNow:'Can trigger now',person:'Villager',allPeople:'All villagers',place:'Place',allPlaces:'All places',here:'Where I am',story:'Story',needHearts:'{n} more hearts',blockedTag:'Not met yet',viewAll:'All {n} events'});
// Who each event involves, cached per event (cast() parses the conditions).
const castCache=new WeakMap();
const castOf=e=>{let c=castCache.get(e);if(!c||c.people!==db?.[lang]?.people){c={people:db?.[lang]?.people,ids:new Set(cast(e).map(p=>p.id))};castCache.set(e,c);}return c.ids;};
const involves=(e,id)=>castOf(e).has(id);
// The friendship this event asks of one villager, in points (events without one sort last).
// The lowest friendship any villager must reach (events without one sort last).
const lowCache=new WeakMap();
const lowHearts=e=>{let v=lowCache.get(e);if(v===undefined){const h=needs(e).hearts;v=h.length?Math.min(...h.map(x=>x.points)):1e9;lowCache.set(e,v);}return v;};
const heartsFor=(e,id)=>{const low=String(id).toLowerCase(),h=needs(e).hearts.find(x=>String(x.npc).toLowerCase()===low);return h?h.points:1e9;};
// How close an event is to triggering: can trigger now first, then a chance, then fewest unmet
// conditions; unjudged and seen ones last.
// Without the game's verdict, the phone's own check (ctx) stands in, as on the status buttons.
const closeness=(e,ctx)=>{const tr=e.trigger;if(e.seen)return 90;if(e.disabled)return 95;if(!tr){if(!ctx)return 40;const c=EventFilter.candidate(e,ctx);return c.candidate?(c.unknown?3:0):40;}if(tr.state==='ready')return tr.chance.length?1:0;if(tr.state==='blocked')return 2+Math.min(20,tr.failed.length);if(tr.state==='unknown')return 30;return 35;};
// Villagers with events (the met ones; the spoiler setting keeps the others out of the picker),
// most friendly first; and places by how many events they hold.
const indexCache=new WeakMap();
function personIndex(data){const cached=indexCache.get(data);if(cached?.people&&cached.lang===lang&&cached.spoiler===window.Spoiler?.version?.())return cached.people;
 const map=new Map();for(const e of data.entries)for(const id of castOf(e)){const p=personById(id);if(!p||unmet(p))continue;const x=map.get(id)||{p,name:p.name,total:0,unseen:0};x.total++;if(!e.seen)x.unseen++;map.set(id,x);}
 const points=new Map((model.snapshot?.social||[]).map(s=>[s.id,s.points]));
 const people=new Map([...map].sort((a,b)=>(points.get(b[0])||0)-(points.get(a[0])||0)||b[1].total-a[1].total));
 indexCache.set(data,{...cached,people,lang,spoiler:window.Spoiler?.version?.()});return people;}
function placeIndex(data){const cached=indexCache.get(data);if(cached?.places)return cached.places;const counts=new Map();for(const e of data.entries)counts.set(e.location,(counts.get(e.location)||0)+1);
 const places=new Map([...counts].sort((a,b)=>b[1]-a[1]).slice(0,80));indexCache.set(data,{...cached,places});return places;}
// A pixel select like the others on the page: [value, label, disabled] options.
function picker(name,options,value,change){const s=el('select','directory-kind event-pick-'+name);s.setAttribute('aria-label',w(name==='kind'?'kind':name));for(const [v,label,off,count] of options){const o=el('option','',label);o.value=v;o.disabled=!!off;if(count!=null)o.dataset.count=count;s.append(o);}
 s.value=value;s.onchange=()=>change(s.value);const box=el('div','game-control select-control directory-kind-control event-pick'),picked=options.find(o=>o[0]===value)||options[0],label=el('span','control-label');label.append(picked[3]!=null?withCount(picked[1],picked[3]):el('span','',picked[1]));label.setAttribute('aria-hidden','true');box.append(s,label);return box;}
// On a villager's profile: their story in heart order, each with where it stands, a tap away from
// its details, and the whole list on the story page.
function personSection(id){const data=LiveData.need('events');if(!data||data.state!=='ready')return null;
 const p=personById(id);if(!p||unmet(p))return null;
 const own=fresh()&&!data.entries.some(e=>e.trigger)?EventFilter.context(model.snapshot,data.entries,true):null;
 const list=data.entries.filter(e=>involves(e,id)).sort((a,b)=>heartsFor(a,id)-heartsFor(b,id)||closeness(a,own)-closeness(b,own));if(!list.length)return null;
 const seen=list.filter(e=>e.seen).length,points=(model.snapshot?.social||[]).find(s=>s.id===id)?.points??null,view={eventReveal:null};
 const box=el('div','resident-events'),title=el('h3','section-title');title.append(withCount(w('story'),seen+' / '+list.length));box.append(title);
 for(const e of list.slice(0,8)){const hidden=secret(e,view),need=heartsFor(e,id),b=el('button','resident-event');b.type='button';b.dataset.event=e.id;
  const heart=el('span','resident-event-heart');heart.append(img(need<1e9?'art/heart-full.png':'art/chat.png'));if(need<1e9)heart.append(el('small','',String(Math.ceil(need/250))));b.append(heart);
  const d=labels(e),line=hidden?null:excerpt(e),name=hidden?location(e):!d.unnamed?d.title:line?(lang==='zh'?'「'+clip(line.text,16)+'」':'“'+clip(line.text,32)+'”'):location(e);const t=el('strong','resident-event-title',name);t.classList.toggle('is-hidden',hidden);b.append(t);
  const tr=e.trigger,mine=!tr&&own&&!e.seen&&!e.disabled?judge(e,own):null,state=e.seen?'seen':e.disabled?'disabled':tr?.state==='ready'?(tr.chance.length?'chanceTag':'readyTag'):mine?.candidate?(mine.tag==='checkedTag'?'readyTag':mine.tag):need<1e9&&points!=null&&points<need?'needHearts':tr?.state==='blocked'?'blockedTag':'unseen';
  const tag=el('span','directory-tag event-status',w(state,{n:Math.ceil((need-(points||0))/250)}));tag.dataset.tone=state;b.append(tag);
  b.onclick=()=>window.ThorNav.open('quests',{journal:{section:'events',detailId:e.id}});box.append(b);}
 const all=el('button','resident-events-all');all.type='button';all.append(el('span','',w('viewAll',{n:list.length})));all.onclick=()=>window.ThorNav.open('quests',{journal:{section:'events',detailId:null,eventPerson:id,eventFilter:'all',eventPlace:'all',query:'',eventPage:0}});box.append(all);
 return box;}
function render(host,view,ui){const data=LiveData.need('events'),status=LiveData.status('events');
 if(eventSession!==model.snapshot?.session){eventSession=model.snapshot?.session;view.eventReveal=null;}
 const connection=StateBox.connection('art/icon-quests.png');if(connection){host.append(connection);return;}
 if(!data||data.state!=='ready'){host.append(el('p','journal-empty',w(status==='ready'?'building':status||'update')));return;}
 if(status&&status!=='ready')host.append(el('p','directory-note',w(status)+(lang==='zh'?'，':'; ')+w('stale')));
 if(view.detailId){const e=data.entries.find(e=>e.id===view.detailId);if(e)detail(host,e,view,ui,data);else host.append(el('p','journal-empty',w('empty')));return;}
 const shown=data.entries,seenCount=shown.filter(e=>e.seen).length,bar=el('div','event-progress');bar.append(img('art/icon-quests.png'));const pc=el('span','event-progress-copy'),track=el('span','event-progress-track'),fill=el('span','event-progress-fill');fill.style.width=(shown.length?Math.round(seenCount/shown.length*100):0)+'%';track.append(fill);pc.append(el('small','',w('progress')),el('strong','',w('progressOf',{n:seenCount,t:shown.length})),track);bar.append(pc);host.append(bar);
 const search=el('input','journal-search');search.type='search';search.dataset.journalSearch='true';search.placeholder=w('search');search.setAttribute('aria-label',w('search'));search.value=view.query||'';search.oninput=()=>refresh(view,{query:search.value,eventPage:0});const tools=el('div','event-tools');tools.append(search);host.append(tools);
 // Who, where and what kind: three equal pickers under the search.
 const people=personIndex(data),person=people.has(view.eventPerson)?view.eventPerson:'',places=placeIndex(data),place=view.eventPlace==='here'||places.has(view.eventPlace)?view.eventPlace:'all';
 const picks=el('div','event-picks');
 picks.append(picker('person',[['',w('allPeople')],...[...people.values()].map(x=>[x.p.id,x.name,false,x.total])],person,v=>refresh(view,{eventPerson:v,eventPage:0})));
 picks.append(picker('place',[['all',w('allPlaces')],['here',w('here'),!fresh()],...[...places].map(([id,n])=>[id,window.MapNames?.location(id,lang)||id,false,n])],place,v=>refresh(view,{eventPlace:v,eventPage:0})));
 picks.append(picker('kind',['all','relationship','enabled','disabled'].map(f=>[f,w(f==='all'?'allKinds':f)]),view.eventKind==='current'?'all':view.eventKind||'all',v=>refresh(view,{eventKind:v,eventPage:0})));
 host.append(picks);
 // Status, with counts: everything, not seen yet, can trigger now (the game's own verdicts; without
 // them the snapshot candidates), seen.
 const judged=data.entries.some(e=>e.trigger);let snap=null;
 const ready=e=>!e.seen&&!e.disabled&&(judged?e.trigger?.state==='ready':fresh()&&judge(e,snap??=EventFilter.context(model.snapshot,data.entries,true)).candidate);
 const query=(view.query||'').trim().toLocaleLowerCase(),filter=view.eventFilter||'all';
 const kind=view.eventKind==='current'?'all':view.eventKind||'all';
 // The status buttons count what the villager, place, type and search leave in view.
 const scoped=data.entries.filter(e=>(kind==='all'||(kind==='relationship'?EventFilter.parsed(e).relationship:kind==='enabled'?!e.disabled:e.disabled))&&(!person||involves(e,person))&&(place==='all'||(place==='here'?fresh()&&isHere(e):e.location===place))&&(!query||[secret(e,view)?hiddenTitle():labels(e).title,location(e),e.id,secret(e,view)?'':e.mod||'',window.RuntimeCatalog?.modName?.(eventMod(e))||''].join(' ').toLocaleLowerCase().includes(query)));
 const filters=el('div','collection-filter event-filters');for(const f of ['all','unseen','candidate','seen']){const n=f==='all'?scoped.length:f==='seen'?scoped.filter(e=>e.seen).length:f==='unseen'?scoped.filter(e=>!e.seen).length:scoped.filter(ready).length,b=ui.button('',()=>refresh(view,{eventFilter:f,eventPage:0}));b.append(withCount(w(f==='candidate'?'readyNow':f),n));b.dataset.eventFilter=f;b.disabled=f==='candidate'&&!fresh();b.setAttribute('aria-pressed',String((view.eventFilter||'all')===f));filters.append(b);}host.append(filters);
 const ctx=filter==='candidate'?EventFilter.context(model.snapshot,data.entries,fresh()):null;
 const own=!judged&&fresh()?snap??=EventFilter.context(model.snapshot,data.entries,true):null;
 let entries=scoped.filter(e=>filter==='all'||(filter==='candidate'?ready(e):filter==='seen'?e.seen:!e.seen));
 // Heart order, lowest first (one villager: the hearts with them); then closest to triggering.
 // Each entry's standing is worked out once per render, not once per comparison (the phone's own check
 // reads the conditions; 1281 entries took tens of thousands of checks).
 const near=new Map(entries.map(e=>[e,closeness(e,own)])),hearts=new Map(entries.map(e=>[e,person?heartsFor(e,person):lowHearts(e)]));
 entries=entries.slice().sort((a,b)=>hearts.get(a)-hearts.get(b)||near.get(a)-near.get(b));
 if(!entries.length){host.append(el('p','journal-empty',w('empty')));return;}
 const pages=Math.ceil(entries.length/24),pageNo=Math.max(0,Math.min(pages-1,view.eventPage||0)),list=el('div','event-list');
 // A row: who (portrait, or a silhouette while hidden), who and where, the line they say, hearts and time.
 for(const e of entries.slice(pageNo*24,(pageNo+1)*24)){const hidden=secret(e,view),b=ui.button('',()=>ui.go('events',e.id),'journal-row event-row'),copy=el('span','journal-row-copy');b.dataset.event=e.id;b.dataset.state=hidden?'hidden':e.seen?'seen':'unseen';
  const who=hidden?null:cast(e)[0]||null,pic=face(who,'event-face'),badge=img(e.seen?'art/event-seen.svg':'art/event-new.svg');badge.className='event-badge';pic.append(badge);b.append(pic);
  const d=labels(e),line=hidden?null:excerpt(e),title=hidden?hiddenTitle():!d.unnamed?d.title:line?(lang==='zh'?'「'+clip(line.text,20)+'」':'“'+clip(line.text,40)+'”'):d.title;
  const kicker=[hidden||!who?null:unmet(who)?'???':who.name,!hidden&&!who&&title.includes(location(e))?null:location(e)].filter(Boolean);
  const {hearts,time}=needs(e),chips=el('span','event-chips');if(!hidden&&hearts.length)chips.append(chip('art/heart-full.png',hearts.map(h=>Math.ceil(h.points/250)).join(' / ')+(lang==='zh'?' 心':'')));if(time)chips.append(chip('art/hud-clock.svg',clock(time[0])+'–'+clock(time[1])));const from=modChip(e,'is-small');if(from)chips.append(from);
  if(kicker.length)copy.append(el('small','event-kicker',factRow(kicker)));copy.append(el('strong','',title));if(chips.childElementCount)copy.append(chips);
  const status=ctx?(e.trigger?judge(e,ctx).tag:(EventFilter.candidate(e,ctx).unknown||data.limited.length?'candidateTag':'checkedTag')):e.disabled?'disabled':!e.seen&&e.trigger?.state==='ready'?(e.trigger.chance.length?'chanceTag':'readyTag'):e.seen?'seen':'unseen',tag=el('span','directory-tag event-status',w(status));tag.dataset.tone=status;
  b.append(copy);if(ctx||e.disabled||status==='readyTag'||status==='chanceTag')b.append(tag);b.append(el('span','journal-arrow','›'));list.append(b);}host.append(list);
 if(pages>1){const bar=el('div','directory-pages'),prev=ui.button(w('prev'),()=>refresh(view,{eventPage:pageNo-1})),next=ui.button(w('next'),()=>refresh(view,{eventPage:pageNo+1}));prev.disabled=!pageNo;next.disabled=pageNo===pages-1;bar.append(prev,el('span','',w('page',{n:pageNo+1,t:pages})),next);host.append(bar);}
}
const base=window.render;window.render=function(){if(page==='quests'&&window.Journal?.getState().section==='events')LiveData.need('events');base();};
// The backend re-judges every event each game ten minutes and bumps the list version even when
// only checkedAt moved. Redraw on what the page shows instead: the entries minus the judgement time.
// The key carries a small number that only moves when that text changes.
const digests=new WeakMap();let lastText=null,lastId=0;
function digest(data){if(!data)return null;let id=digests.get(data);if(id==null){const pick=list=>list.map(x=>x.index).join(',');
 const text=data.language+'|'+JSON.stringify(data.entries||[],(k,v)=>k==='trigger'&&v?[v.state,pick(v.failed),pick(v.chance),pick(v.unknown),v.gate]:v)+'|'+(data.limited||[]).join(',');
 if(text!==lastText){lastText=text;lastId++;}id=lastId;digests.set(data,id);}return id;}
window.StoryEvents={render,personSection,stateKey:()=>{const view=window.Journal?.getState(),s=model.snapshot,data=LiveData.peek('events'),judged=!!data?.entries?.every(e=>e.trigger||e.disabled);return [digest(data),LiveData.peek('mods')?.version,LiveData.peek('mods')?.total,LiveData.peek('events')?.language,LiveData.status('events'),window.Spoiler?.enabled('events'),window.Spoiler?.version(),lang,view?.eventKind==='current'?[fresh(),s?.world?.location]:null,view?.eventFilter==='candidate'?judged?[fresh()]:[fresh(),s?.world?.time,s?.world?.day,s?.world?.season,s?.world?.year,s?.social?.map(p=>[p.id,p.points]),s?.bag?.capacity,s?.bag?.slots.filter(Boolean).length]:null];}};
})();
