// Resident order and pins are a local reading preference, like the view switch; they never change
// social or game data. Pinned villagers lead the list in the chosen order.
(()=>{'use strict';
const sortKey='stardew.peopleSort',pinKey='stardew.peoplePins',modes=['default','hearts','birthday','name'],seasonOrder=['spring','summer','fall','winter'];
const panel=$('people'),list=$('people-list'),tools=panel.querySelector('.section-tools');
const words={zh:{default:'默认',hearts:'好感度',birthday:'生日临近',name:'名字',sort:'排序居民',pin:'置顶',pinned:'已置顶'},en:{default:'Default',hearts:'Friendship',birthday:'Birthday',name:'Name',sort:'Sort villagers',pin:'Pin',pinned:'Pinned'}};
const w=k=>(words[lang]||words.en)[k];
let mode='default',pins=new Set();
try{const saved=localStorage.getItem(sortKey);if(modes.includes(saved))mode=saved;const stored=JSON.parse(localStorage.getItem(pinKey)||'[]');if(Array.isArray(stored))pins=new Set(stored.filter(x=>typeof x==='string'));}catch{}
const save=()=>{try{localStorage.setItem(sortKey,mode);localStorage.setItem(pinKey,JSON.stringify([...pins]));}catch{}};

// The sort picker sits beside the filter, wrapped like the page's other selects.
const select=el('select','people-sort'),wrap=el('div','game-control select-control people-sort-control'),label=el('span','control-label');
select.id='people-sort';label.setAttribute('aria-hidden','true');wrap.append(select,label);tools.insertBefore(wrap,tools.querySelector('.people-view-switch'));
controls.push({input:select,label});for(const name of ['input','change','blur'])select.addEventListener(name,syncControls);
select.onchange=()=>{mode=modes.includes(select.value)?select.value:'default';save();panel.scrollTop=0;renderPeople();};
let labelled=null;
function labels(){if(labelled===lang)return;labelled=lang;options(select,modes.map(m=>[m,w(m)]));select.value=mode;select.setAttribute('aria-label',w('sort'));syncControls();}

// Days from today to a birthday in the 112-day year; without a game date, the calendar order.
function order(people,hidden){
 const live=model.status(performance.now())==='ready',points=new Map((live&&model.snapshot?.social||[]).map(s=>[s.id,s.points||0])),world=live?model.snapshot?.world:null;
 const today=world&&seasonOrder.includes(world.season)?seasonOrder.indexOf(world.season)*28+(world.day||1):null;
 const until=p=>{const i=seasonOrder.indexOf(p.season);if(i<0||!p.day)return 999;const d=i*28+p.day;return today==null?d:(d-today+112)%112;};
 const names=new Intl.Collator(lang==='zh'?'zh-Hans-CN-u-co-pinyin':'en');
 const by={hearts:(a,b)=>(points.get(b.id)??-1)-(points.get(a.id)??-1),birthday:(a,b)=>until(a)-until(b),name:(a,b)=>names.compare(a.name,b.name)}[mode];
 return people.map((p,i)=>[p,i]).sort(([a,i],[b,j])=>(pins.has(b.id)-pins.has(a.id))||(hidden(a.id)-hidden(b.id))||(by&&!hidden(a.id)&&!hidden(b.id)?by(a,b):0)||i-j).map(x=>x[0]);}

// A pin on the profile header; the list marks pinned rows.
function pinButton(){const detail=$('person-detail'),head=detail.querySelector('.person-header');if(!head||detail.hidden||detail.dataset.spoiler==='hidden'){head?.querySelector('.person-pin')?.remove();return;}
 const id=personId;let b=head.querySelector('.person-pin');if(!b||b.dataset.pin!==id){b?.remove();b=el('button','person-pin');b.type='button';b.dataset.pin=id;b.append(img('art/pin.svg'),el('span',''));b.onclick=()=>{if(pins.has(id))pins.delete(id);else pins.add(id);save();paint(b);renderPeople();};head.append(b);}
 paint(b);}
function paint(b){const on=pins.has(b.dataset.pin),text=w(on?'pinned':'pin');b.setAttribute('aria-pressed',String(on));const span=b.querySelector('span');if(span.dataset.text!==text){span.dataset.text=text;span.textContent=text;window.GameFont?.refresh?.();}}
function mark(){for(const row of list.children){const on=pins.has(row.dataset.person);if((row.dataset.pinned==='true')!==on)row.dataset.pinned=String(on);}}

const previous=renderPeople;renderPeople=function(...args){labels();previous(...args);mark();pinButton();};
for(const [id,event] of [['people-search','oninput'],['season-filter','onchange']])$(id)[event]=()=>{panel.scrollTop=0;renderPeople();};
window.PeopleOrder={order,getState:()=>({mode,pins:[...pins]})};
labels();
})();
