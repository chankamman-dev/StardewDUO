/* Settings → 隐藏未知信息 (on by default): what the player has not met or discovered stays
   hidden, the way the game's own menus hide it.
   - Villagers follow their social-tab rule from the live catalogue: hiddenAlways never appear;
     hiddenUntilMet appear once met; unknownUntilMet (the game's default, also used when the rule
     is not known yet) are "???" with a "?" portrait until met; alwaysShown always appear.
   - Items outside the save's known set (shipped, caught, found, cooked, recipes, owned) are "???".
   - World-map areas whose unlock condition is not met are not shown.
   - Gift tastes: only what the game has revealed; the rest folds behind an explicit button.
   Calendar birthdays stay visible, as on the in-game calendar. Who was met and what is known
   come from the live progress (friendship list as a fallback); the last connected save's copy is
   kept for offline use only, never as a save identity. With no knowledge nothing is hidden. */
(()=>{'use strict';
const KEY='stardew.spoiler.v1',PREFS='stardew.spoiler.v2',LAST='stardew.known.last.v1';
const CATEGORIES=['residents','items','tastes','maps','collections','events'];
let prefs={},old=true,saved=null;try{old=localStorage.getItem(KEY)!=='off';}catch{}
try{saved=JSON.parse(localStorage.getItem(PREFS)||'null');}catch{}
for(const k of CATEGORIES)prefs[k]=typeof saved?.[k]==='boolean'?saved[k]:old;
const enabled=kind=>kind?prefs[kind]===true:CATEGORIES.some(k=>prefs[k]);
let last=null;try{const v=JSON.parse(localStorage.getItem(LAST)||'null');if(v&&Array.isArray(v.met)&&Array.isArray(v.items))last=v;}catch{}
try{localStorage.removeItem('stardew.known.v1');}catch{}
const opened=new Set();let version=0,lastKey='';
const T={zh:{title:'隐藏未知信息',on:'开启',off:'关闭',all:'全部隐藏',mixed:'部分开启',
 residents:'未结识居民',items:'未发现物品',
 tastes:'未发现送礼喜好',maps:'未解锁地图',collections:'未收集图鉴',events:'未看过剧情',
  unknown:'???',notMet:'还没见过这位居民',notFound:'还没有发现这件物品',reveal:'显示未发现的喜好（剧透）',revealWho:'显示未发现的喜好者（剧透）',revealed:'已发现的喜好',noneRevealed:'还没有发现任何喜好'},
 en:{title:'Hide undiscovered info',on:'On',off:'Off',all:'Hide all categories',mixed:'Some on',
 residents:'Unmet villagers',items:'Undiscovered items',
 tastes:'Undiscovered gift tastes',maps:'Locked map areas',collections:'Missing collections',events:'Unseen stories',
  unknown:'???',notMet:'You have not met this villager yet',notFound:'You have not found this item yet',reveal:'Show undiscovered tastes (spoilers)',revealWho:'Show undiscovered fans (spoilers)',revealed:'Tastes you have found',noneRevealed:'No tastes found yet'}};
const t=k=>(T[lang]||T.en)[k]||k;
function live(){return model.status(performance.now())==='ready'&&model.snapshot?.state==='ready'?model.snapshot:null;}
function progress(){return live()?LiveData.peek('progress'):null;}
// Remember the last connected save for offline use.
function learn(){const s=live();if(!s)return;const p=progress(),met=new Set(Array.isArray(s.social)?s.social.map(r=>r.id):[]);for(const id of p?.metNpcs||[])met.add(id);
 const items=p?.knownItems||last?.items||[],key=JSON.stringify([met.size,items.length,p?.version]);if(key===lastKey)return;lastKey=key;
 last={met:[...met].slice(0,1024),items:items.slice(0,8192),maps:p?.mapAreas||last?.maps||null};try{localStorage.setItem(LAST,JSON.stringify(last));}catch{}version++;}
function metSet(){const s=live();if(s){const set=new Set(Array.isArray(s.social)?s.social.map(r=>r.id):[]);for(const id of progress()?.metNpcs||[])set.add(id);return set;}return last?new Set(last.met):null;}
function knownItems(){const p=progress();if(p)return new Set(p.knownItems);return live()||!last?null:new Set(last.items);}
function rule(id){return db?.[lang]?.people.find(p=>p.id===id)?.socialTab||null;}
/** False when this villager must not be listed at all. */
function visible(id){const r=rule(id);if(r==='hiddenAlways')return false;if(!enabled('residents')||r!=='hiddenUntilMet')return true;const met=metSet();return !met||met.has(id);}
/** True when this villager is listed as "???". */
function hides(id){if(!enabled('residents'))return false;const r=rule(id);if(r==='alwaysShown'||r==='hiddenAlways')return false;const met=metSet();return !!met&&!met.has(id);}
function itemKnown(id){if(!enabled('items'))return true;const known=knownItems();return !known||known.has(id);}
function mapOpen(id){if(!enabled('maps'))return true;const maps=progress()?.mapAreas||(!live()&&last?.maps);return !maps||maps[id]!==false;}
/** Gift tastes the game has revealed for this villager ({love,like,...}), or null if unknown. */
function revealed(id){return enabled('tastes')?db?.[lang]?.people.find(p=>p.id===id)?.revealed||null:null;}
function tastesFolded(key){return enabled('tastes')&&!opened.has(key);}
function gate(key,label){const b=el('button','spoiler-gate');b.type='button';b.append(el('span','',t(label||'reveal')));b.onclick=()=>{opened.add(key);b.closest('.guide-extra')?.remove();window.ThorSound?.play?.('smallSelect');window.render?.();};return b;}
function silhouette(image){image?.classList.add('spoiler-silhouette');return image;}
/** Portraits have an opaque backdrop, so a silhouette would be a dark square: show "?" instead,
    and never load the real picture. */
function portrait(className){const box=el('span','spoiler-portrait'+(className?' '+className:''));box.setAttribute('aria-hidden','true');box.append(el('strong','','?'));return box;}
// ---- Collapsible settings group. Older all-on/all-off choices seed every category. ----
const group=el('details','spoiler-settings'),heading=el('summary','section-title spoiler-title'),headingLabel=el('span'),count=el('small','spoiler-count');heading.append(headingLabel,count);
const row=el('div','settings-row spoiler-row'),copy=el('div'),label=el('h3'),toggle=el('button','spoiler-toggle');
toggle.type='button';copy.append(label);row.append(copy,toggle);
function update(){try{localStorage.setItem(PREFS,JSON.stringify(prefs));localStorage.setItem(KEY,enabled()?'on':'off');}catch{}
 opened.clear();version++;document.querySelectorAll('.guide-extra').forEach(n=>n.remove());window.ThorSound?.play?.('smallSelect');paint();window.render?.();window.renderPeople?.();window.renderGuide?.();}
toggle.onclick=()=>{const all=CATEGORIES.every(k=>prefs[k]);for(const k of CATEGORIES)prefs[k]=!all;update();};
const rows={};for(const k of CATEGORIES){const r=el('div','settings-row spoiler-option-row'),c=el('div'),name=el('h3'),button=el('button','spoiler-toggle');button.type='button';button.dataset.spoiler=k;
 c.append(name);r.append(c,button);button.onclick=()=>{prefs[k]=!prefs[k];update();};rows[k]={r,name,button};}
group.append(heading,row,...Object.values(rows).map(r=>r.r));
($('text-size')?.closest('.settings-row')||$('setting-language').closest('.settings-row')).after(group);
group.addEventListener('toggle',paint);
function paint(){const set=(n,v)=>{if(n.textContent!==v)n.textContent=v;},n=CATEGORIES.filter(k=>prefs[k]).length;
 set(headingLabel,(group.open?'▼ ':'▶ ')+t('title'));set(count,n+' / '+CATEGORIES.length);set(label,t('all'));
 set(toggle,t(n===CATEGORIES.length?'on':n===0?'off':'mixed'));toggle.dataset.checked=String(n===CATEGORIES.length);toggle.setAttribute('aria-pressed',n===0?'false':n===CATEGORIES.length?'true':'mixed');toggle.setAttribute('aria-label',t('all')+' · '+toggle.textContent);
 for(const [k,r] of Object.entries(rows)){set(r.name,t(k));set(r.button,t(prefs[k]?'on':'off'));r.button.dataset.checked=String(prefs[k]);r.button.setAttribute('aria-pressed',String(prefs[k]));r.button.setAttribute('aria-label',t(k)+' · '+t(prefs[k]?'on':'off'));}}
let drawn=-1;const base=window.render;window.render=function(){learn();base();if(page==='settings')paint();if(drawn!==version){drawn=version;if(page==='people')window.renderPeople?.();if(page==='manual')window.renderGuide?.();}};paint();learn();
window.Spoiler={enabled,prefs:()=>({...prefs}),visible,hides,itemKnown,mapOpen,revealed,tastesFolded,gate,silhouette,portrait,text:t,version:()=>version,known:()=>metSet()};
})();
