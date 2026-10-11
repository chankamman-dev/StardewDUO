/* Context page scenes: what is open on the top screen right now. A chest shows its slots and the
   backpack side by side (tap moves the whole stack, confirmed by the game's receipt); a shop shows
   its stock with price, what bundles still need, who loves it and how many you already carry. */
(()=>{'use strict';
const T={zh:{chest:'箱子',bag:'背包',shop:'商店',stock:'库存 {n}',unlimited:'',carry:'背包 {n}',bundle:'收集包',loves:'{n} 人最爱',
  shopHint:'在上屏购买；这里显示价格、收集包需求和村民喜好',needBundle:'{n} 件收集包需要',trade:'换取：{name} × {n}',truncated:'物品太多，只显示前面的部分',
  moving:'移动中…',pairFirst:'配对后才能从下屏搬运物品',
  shops:{SeedShop:'皮埃尔的杂货店',Carpenter:'木匠的商店',Blacksmith:'铁匠铺',AnimalShop:'玛妮的牧场',Saloon:'星之果实餐吧',FishShop:'威利的鱼店',Traveler:'旅行货车',Hospital:'诊所',Joja:'Joja 超市',AdventureShop:'冒险家公会',Sandy:'沙漠商店',Dwarf:'矮人的商店',ShadowShop:'科罗布斯的商店',Krobus:'科罗布斯的商店',HatMouse:'帽子鼠',IceCreamStand:'冰淇淋摊',ResortBar:'度假村酒吧',VolcanoShop:'火山矮人',IslandTrade:'岛屿交易所',Bookseller:'书商',Casino:'赌场',QiGemShop:'齐先生的宝石商店',Raccoon:'浣熊商店'}},
 en:{chest:'Chest',bag:'Backpack',shop:'Shop',stock:'{n} left',unlimited:'',carry:'Carrying {n}',bundle:'Bundle',loves:'Loved by {n}',
  shopHint:'Buy on the top screen; prices, bundle needs and favourites are shown here',needBundle:'{n} needed for bundles',trade:'Costs {name} × {n}',truncated:'Too many items; showing the first ones',
  moving:'Moving…',pairFirst:'Pair with the game to move items from here',
  shops:{SeedShop:"Pierre's General Store",Carpenter:"Carpenter's Shop",Blacksmith:'Blacksmith',AnimalShop:"Marnie's Ranch",Saloon:'The Stardrop Saloon',FishShop:"Willy's Fish Shop",Traveler:'Traveling Cart',Hospital:'Clinic',Joja:'JojaMart',AdventureShop:"Adventurer's Guild",Sandy:'Oasis',Dwarf:"Dwarf's Shop",ShadowShop:"Krobus's Shop",Krobus:"Krobus's Shop",HatMouse:'Hat Mouse',IceCreamStand:'Ice Cream Stand',ResortBar:'Resort Bar',VolcanoShop:'Volcano Dwarf',IslandTrade:'Island Trader',Bookseller:'Bookseller',Casino:'Casino',QiGemShop:"Qi's Walnut Room",Raccoon:'Raccoon Shop'}}};
const t=(k,v={})=>{let s=k.split('.').reduce((o,p)=>o?.[p],T[lang]||T.en)??k;if(typeof s==='string')for(const [a,b] of Object.entries(v))s=s.replace('{'+a+'}',b);return s;};
// Names in the App's language when the item is known offline (the game may run in another language).
const nameOf=(id,fallback)=>db?.[lang]?.items.find(v=>v.id===id)?.name||fallback;
const iconOf=it=>it?.icon||icons.get(it?.id)||db?.[lang]?.items.find(v=>v.id===it?.id)?.icon||null;
let pending=null,note='',noteUntil=0;
function slot(it,index,onTap,busy){const b=el('button','slot scene-slot');b.type='button';b.dataset.index=index;
 if(it){const i=iconOf(it);if(i)b.append(img(i));if(it.quality>0){const q=img('art/quality-'+({1:'silver',2:'gold',4:'iridium'}[it.quality]||'silver')+'.png');q.className='scene-quality';b.append(q);}
  if(it.stack>1){const c=el('span','count scene-count',String(it.stack));b.append(c);}b.title=nameOf(it.id,it.name)+(it.stack>1?' × '+it.stack:'');b.setAttribute('aria-label',b.title);b.onclick=()=>onTap(index,it);}
 else{b.disabled=true;b.setAttribute('aria-label','—');}
 b.classList.toggle('is-pending',busy);return b;}
async function move(kind,index,it,sceneKey,refresh){
 if(pending||!window.Commands)return;pending=kind+index;refresh();
 const r=kind==='take'?await Commands.chestTake(index,it,sceneKey):await Commands.chestPut(index,it,sceneKey);pending=null;
 if(r?.state!=='applied'){note=Commands.label?.(r?.code||'unknown')||r?.code||'';noteUntil=performance.now()+3500;window.ThorSound?.play('cancel');}else{note='';noteUntil=0;}refresh();}
function head(src,title,sub){const h=el('div','scene-head');if(src)h.append(img(src));const c=el('div','scene-head-copy');c.append(el('h2','',title));if(sub)c.append(el('small','',sub));h.append(c);return h;}
Object.assign(T.zh,{kinds:'{n} 种',pieces:'{n} 件',worth:'约 {g} 金',space:'{u} / {c} 格'});
Object.assign(T.en,{kinds:'{n} kinds',pieces:'{n} items',worth:'≈ {g}g',space:'{u} / {c} slots'});
// A chest: the chest and the backpack as two framed boxes like the game's chest menu, how full the
// chest is and roughly what it holds, and a strip between them that says what tapping does.
function chest(host,sc,refresh){
 const bag=model.snapshot?.bag,items=sc.items.filter(Boolean),used=items.length,cap=Math.max(sc.capacity,sc.items.length),canMove=model.snapshot?.control?.chest===true&&(!window.ThorCommands?.paired||ThorCommands.paired());
 const price=id=>db?.[lang]?.items.find(v=>v.id===id)?.price||0,worth=items.reduce((a,i)=>a+price(i.id)*i.stack,0);
 const top=el('div','chest-head'),icon=icons.get('(BC)130')||db?.[lang]?.items.find(v=>v.id==='(BC)130')?.icon;if(icon)top.append(img(icon));
 const copy=el('div','chest-head-copy'),line=el('div','chest-title');line.append(el('h2','',sc.name||t('chest')),el('small','chest-space',t('space',{u:used,c:cap})));
 const meter=el('span','chest-meter'),fill=el('i');fill.style.width=(cap?Math.round(used/cap*100):0)+'%';meter.dataset.full=String(cap>0&&used>=cap);meter.append(fill);
 const facts=el('div','chest-facts');for(const text of [t('kinds',{n:new Set(items.map(i=>i.id)).size}),t('pieces',{n:items.reduce((a,i)=>a+i.stack,0)}),worth?t('worth',{g:worth.toLocaleString(lang)}):null])if(text)facts.append(el('small','',text));
 copy.append(line,meter,facts);top.append(copy);host.append(top);
 const box=el('div','chest-panel is-chest'),grid=el('div','scene-grid');for(let i=0;i<cap;i++)grid.append(slot(sc.items[i],i,(n,it)=>move('take',n,it,sc.key,refresh),pending==='take'+i));box.append(grid);host.append(box);
 if(sc.truncated)host.append(el('p','farm-none',t('truncated')));
 const error=noteUntil>performance.now(),strip=el('div','chest-transfer');strip.dataset.state=error?'error':pending?'moving':canMove?'ready':'locked';
 strip.append(el('span','chest-arrows'),el('p','scene-note'+(error?' is-error':''),error?note:pending?t('moving'):canMove?'':t('pairFirst')));host.append(strip);
 const pack=el('div','chest-panel is-bag'),label=el('div','chest-bag-title');label.append(img('art/icon-bag.png'),el('small','',t('bag')));if(bag)label.append(el('small','chest-space',`${bag.slots.filter(Boolean).length} / ${bag.capacity}`));pack.append(label);
 const bagGrid=el('div','scene-grid');if(bag)for(let i=0;i<bag.capacity;i++)bagGrid.append(slot(bag.slots[i],i,(n,it)=>move('put',n,it,sc.key,refresh),pending==='put'+i));pack.append(bagGrid);host.append(pack);
 host.classList.toggle('scene-locked',!canMove);}
function shop(host,sc){
 const bag=model.snapshot?.bag?.slots||[],carry=id=>bag.reduce((n,s)=>n+(s?.id===id?s.stack:0),0);
 const loves=id=>(db?.[lang]?.people||[]).filter(p=>p.tastes?.[id]===0).length;
 const name=(T[lang]||T.en).shops[sc.name]||sc.name||t('shop');
 const items=sc.items.filter(Boolean),needs=items.filter(i=>i.bundle).length;
 host.append(head('art/hud-coin.svg',name,needs?t('needBundle',{n:needs}):t('shopHint')));
 for(const it of items){const row=el('div','journal-row scene-shop-row'),box=el('span','plan-icon');const i=iconOf(it);if(i)box.append(img(i));row.append(box);
  const copy=el('span','journal-row-copy'),nameLine=el('span','plan-name');nameLine.append(el('strong','',nameOf(it.id,it.name)));if(it.bundle)nameLine.append(el('small','plan-tag is-warn',t('bundle')));const love=loves(it.id);if(love)nameLine.append(el('small','plan-tag is-good',t('loves',{n:love})));copy.append(nameLine);
  const facts=[];const have=carry(it.id);if(have)facts.push(t('carry',{n:have}));if(it.stock>=0)facts.push(t('stock',{n:it.stock}));if(it.tradeId){const tn=db?.[lang]?.items.find(v=>v.id===it.tradeId)?.name||it.tradeId;facts.push(t('trade',{name:tn,n:it.tradeCount}));}
  if(facts.length)copy.append(el('small','scene-facts',factRow(facts)));row.append(copy);
  const price=el('span','scene-price');if(it.price>0){price.append(img(sc.currency===0?'art/hud-coin.svg':'art/quest-coins.png'),el('strong','',it.price.toLocaleString(lang)));}row.append(price);host.append(row);}
 if(sc.truncated)host.append(el('p','farm-none',t('truncated')));}
// ---------- Fishing and mines ----------
const W={zh:{fishing:'钓鱼',phase:{cast:'抛竿中',wait:'等鱼上钩',bite:'咬钩了！快收线',reel:'正在搏斗',caught:'钓到了！'},noBait:'没有鱼饵',noTackle:'没有钓具',tackleLeft:'剩 {n} / {m} 次',
  difficulty:'难度 {n}',treasure:'宝箱',treasureGot:'宝箱已到手',perfect:'完美',boss:'传说之鱼',newFish:'第一次钓到',here:'{p}现在能钓到',newTag:'未钓到过',noneHere:'这个时间和天气没有可钓的鱼',
  mines:'矿井',skull:'骷髅洞穴',quarry:'采石场矿井',volcano:'火山地牢',floor:'第 {n} 层',lowest:'最深 {n} 层',elevator:'下一电梯 {n} 层',health:'生命',energy:'体力',
  ladder:'梯子已出现',shaft:'竖井已出现',mustKill:'需要击败所有怪物',monsters:'怪物 {n}',stones:'石头 {n}',resources:'这一层',noResources:'这一层没有矿脉或宝箱',
  luck:['大凶','小凶','平平','小吉','大吉']},
 en:{fishing:'Fishing',phase:{cast:'Casting',wait:'Waiting for a bite',bite:'A bite! Reel it in',reel:'Reeling',caught:'Caught!'},noBait:'No bait',noTackle:'No tackle',tackleLeft:'{n} / {m} uses left',
  difficulty:'Difficulty {n}',treasure:'Treasure',treasureGot:'Treasure caught',perfect:'Perfect',boss:'Legendary',newFish:'First catch',here:'{p}: catchable now',newTag:'Not caught yet',noneHere:'No fish at this time and weather',
  mines:'The Mines',skull:'Skull Cavern',quarry:'Quarry Mine',volcano:'Volcano Dungeon',floor:'Floor {n}',lowest:'Deepest {n}',elevator:'Next elevator {n}',health:'Health',energy:'Energy',
  ladder:'Ladder is out',shaft:'Shaft is out',mustKill:'Defeat every monster',monsters:'{n} monsters',stones:'{n} stones',resources:'On this floor',noResources:'No ore, gems or chests on this floor',
  luck:['Very bad luck','Bad luck','Neutral luck','Good luck','Very good luck']}};
const w=(k,v={})=>{let s=k.split('.').reduce((o,p)=>o?.[p],W[lang]||W.en)??k;if(typeof s==='string')for(const [a,b] of Object.entries(v))s=s.replace('{'+a+'}',b);return s;};
const dbIcon=id=>icons.get(id)||db?.[lang]?.items.find(v=>v.id===id)?.icon||null;
function gbar(value,max,label,fill){const b=el('div','game-bar scene-bar'),p=max>0?Math.min(1,Math.max(0,value/max)):0;b.setAttribute('role','progressbar');b.setAttribute('aria-label',label);b.setAttribute('aria-valuenow',String(value));b.setAttribute('aria-valuemax',String(max));b.style.setProperty('--p',p);if(fill){b.style.setProperty('--fill',fill[0]);b.style.setProperty('--edge',fill[1]);}b.append(el('span','game-bar-fill'));return b;}
function chip(icon,text,cls=''){const n=el('span','target-chip '+cls);if(icon)n.append(img(icon));n.append(el('small','',text));return n;}
// The pond: one stage from the cast to the catch, drawn by pond.js; the page keeps the banner and,
// while reeling, the live minigame (or the meter standing in for it).
function pond(fi,world){const st=el('div','fish-stage');st.dataset.part='pond';st.dataset.phase=fi.phase||'wait';
 const t=world?.time??1200,time=t>=2000?'night':t>=1700?'evening':'day',weather=['rain','storm','green-rain'].includes(world?.weather)?'rain':world?.weather==='snow'?'snow':'clear';
 // One pixel picture (pond.js): rod, line, bobber, ripples, the fish's shadow and the leap on one grid.
 const icon=fi.fishId?dbIcon(fi.fishId):null;st.style.setProperty('--p',Math.max(0,Math.min(1,fi.progress||0)).toFixed(3));
 if(window.Pond){Pond.update({phase:fi.phase||'wait',time,weather,icon,fight:Math.min(1,(fi.difficulty||0)/100),progress:fi.progress||0});st.append(Pond.canvas());}
 st.setAttribute('role','img');st.setAttribute('aria-label',w('phase.'+(fi.phase||'wait')));
 // The minigame itself, live, when the mod sends it (reel.js); the meter below stands in otherwise.
 if(fi.phase==='reel'&&window.Reel)st.append(Reel.canvas());
 if(fi.phase==='reel'){const meter=el('span','fish-meter');meter.append(el('i','fish-meter-fill'));
  if(icon){const f=img(icon);f.className='fish-meter-fish';meter.append(f);}
  if(fi.treasure){const chest=img(dbIcon('(BC)130')||'art/icon-bag.png');chest.className='fish-meter-chest'+(fi.treasureCaught?' is-got':'');meter.append(chest);}
  st.append(meter);}
 if(fi.phase==='caught')st.append(el('p','fish-banner',w('phase.caught')));
 return st;}
// Bait or tackle: one of two equal cards under the pond; tackle shows how much wear is left.
function gearCard(id,name,sub,empty,wear){const c=el('div','fish-gear-item'+(empty?' is-empty':''));const i=id?dbIcon(id):null;if(i)c.append(img(i));
 const copy=el('span','fish-gear-copy');copy.append(el('strong','',name),el('small','',sub));c.append(copy);
 if(wear!=null){const bar=el('span','fish-wear'+(wear<=.15?' is-low':''));const fill=el('i');fill.style.width=Math.round(wear*100)+'%';bar.append(fill);copy.append(bar);}return c;}
function fishing(host,sc){const fi=sc.fishing||{},world=model.snapshot?.world;
 const place=window.MapNames?MapNames.location(sc.name,lang,world?.location):(world?.location||sc.name);
 host.append(pond(fi,world));
 // The fish on the line, then the catch: its name and what makes it special.
 if(fi.fishId){const card=el('div','fish-card'+(fi.phase==='caught'?' is-caught':''));const box=el('span','plan-icon');const i=dbIcon(fi.fishId);if(i)box.append(img(i));card.append(box);
  const copy=el('div','scene-fish-copy'),tags=el('div','target-chips scene-fish-tags');copy.append(el('strong','',nameOf(fi.fishId,fi.fishName||fi.fishId)));
  if(!fi.fishKnown)tags.append(chip(null,w('newFish'),'is-first'));if(fi.boss)tags.append(chip(null,w('boss'),'is-warn'));
  if(fi.perfect&&(fi.phase==='reel'||fi.phase==='caught'))tags.append(chip(null,w('perfect'),'is-good'));
  if(fi.treasure)tags.append(chip(dbIcon('(BC)130'),w(fi.treasureCaught?'treasureGot':'treasure'),fi.treasureCaught?'is-good':''));
  if(fi.difficulty)tags.append(chip(null,w('difficulty',{n:fi.difficulty})));
  const price=dbItem(fi.fishId)?.price;if(fi.phase==='caught'&&price>0)tags.append(chip('art/hud-coin.svg',price.toLocaleString(lang)));
  copy.append(tags);card.append(copy);host.append(card);}
 const gear=el('div','fish-gear');
 gear.append(fi.baitId?gearCard(fi.baitId,nameOf(fi.baitId,fi.baitName),'× '+fi.baitCount,false,null):gearCard('(O)685',w('noBait'),'—',true,null));
 gear.append(fi.tackleId?gearCard(fi.tackleId,nameOf(fi.tackleId,fi.tackleName),w('tackleLeft',{n:fi.tackleUses,m:fi.tackleMax}),false,fi.tackleMax>0?fi.tackleUses/fi.tackleMax:null):gearCard('(O)686',w('noTackle'),'—',true,null));
 host.append(gear);
 const fish=sc.items.filter(Boolean).sort((a,b)=>(a.known-b.known)||a.slot-b.slot);
 const title=el('h3','section-title farm-info-title');title.append(img('art/icon-map.png'),withCount(w('here',{p:place}),fish.length));host.append(title);
 if(!fish.length)host.append(el('p','farm-none',w('noneHere')));
 const grid=el('div','scene-cards');for(const it of fish){const c=el('div','scene-card'+(it.known?'':' is-new'));c.dataset.key=it.id;const i=dbIcon(it.id);if(i)c.append(img(i));const copy=el('span','scene-card-copy');copy.append(el('strong','',nameOf(it.id,it.name)));copy.append(el('small','',it.known?(it.price?it.price.toLocaleString(lang)+(lang==='zh'?' 金':'g'):''):w('newTag')));c.append(copy);grid.append(c);}host.append(grid);}
Object.assign(W.zh,{lift:'电梯',elevatorOf:'已解锁到 {n} 层 / 120',supplies:'背包补给',food:'食物 {n} 件，可回复体力 +{e}、生命 +{h}',noFood:'背包里没有能吃的东西',
 slayer:'冒险家公会讨伐目标',claim:'{n} 个奖励可以去公会领',slayerDone:'讨伐目标都完成了'});
Object.assign(W.en,{lift:'Elevator',elevatorOf:'Unlocked to {n} / 120',supplies:'Backpack supplies',food:'{n} food: energy +{e}, health +{h}',noFood:'Nothing to eat in the backpack',
 slayer:"Adventurer's Guild slayer goals",claim:'{n} rewards to claim at the Guild',slayerDone:'All slayer goals done'});
const dbItem=id=>db?.[lang]?.items.find(v=>v.id===id)||null;
// The elevator: one cell per five floors, lit up to the deepest reached, the current floor marked.
function mineTrack(mi){if(mi.area!=='mines')return null;const box=el('div','mine-track'),cells=el('div','mine-cells'),unlocked=Math.min(120,Math.floor(mi.lowest/5)*5);
 for(let k=1;k<=24;k++){const c=el('span','mine-cell'+(k*5<=unlocked?' is-open':'')+(Math.ceil(Math.max(1,mi.level)/5)===k?' is-here':'')+(k%4===0?' is-mark':''));cells.append(c);}
 const label=el('div','mine-track-label');label.append(img('art/icon-map.png'),el('small','',w('lift')),el('small','mine-track-count',w('elevatorOf',{n:unlocked})));box.append(label,cells);return box;}
// What the backpack holds for the trip down: food (and what it restores), bombs and staircases.
function supplies(){const slots=(model.snapshot?.bag?.slots||[]).filter(Boolean),food=[],tools=new Map();
 for(const s of slots){const it=dbItem(s.id);if(['(O)286','(O)287','(O)288','(BC)71'].includes(s.id)){tools.set(s.id,(tools.get(s.id)||0)+s.stack);continue;}if(it&&it.energy>0)food.push({s,it});}
 const box=el('div','mine-supplies'),title=el('h3','section-title farm-info-title');title.append(img(dbIcon('(O)196')||'art/icon-bag.png'),el('span','',w('supplies')));
 const n=food.reduce((a,f)=>a+f.s.stack,0),e=food.reduce((a,f)=>a+f.it.energy*f.s.stack,0),h=food.reduce((a,f)=>a+(f.it.health||0)*f.s.stack,0);
 box.append(el('p','mine-food',n?w('food',{n,e:e.toLocaleString(lang),h:h.toLocaleString(lang)}):w('noFood')));
 const row=el('div','target-chips mine-kit');for(const f of food.sort((a,b)=>b.it.energy-a.it.energy).slice(0,4))row.append(chip(dbIcon(f.s.id),`${nameOf(f.s.id,f.s.name)} × ${f.s.stack}`));
 for(const [id,count] of tools)row.append(chip(dbIcon(id),`${nameOf(id,id)} × ${count}`,'is-good'));if(row.childElementCount)box.append(row);return [title,box];}
// The Guild's slayer goals (from the farm report): the ones closest to done, and rewards waiting.
function slayer(){const x=window.Farm?.current?.()?.extras;if(x?.state!=='ready'||!Array.isArray(x.slayer)||!x.slayer.length)return [];
 const title=el('h3','section-title farm-info-title');title.append(img('art/stat-damage.png'),el('span','',w('slayer')));const out=[title];
 const ready=x.slayer.filter(g=>!g.claimed&&g.killed>=g.goal);if(ready.length)out.push(el('p','mine-claim',w('claim',{n:ready.length})));
 const open=x.slayer.filter(g=>g.killed<g.goal).sort((a,b)=>b.killed/b.goal-a.killed/a.goal).slice(0,4);if(!open.length&&!ready.length)out.push(el('p','farm-none',w('slayerDone')));
 const list=el('div','mine-goals');for(const g of open){const r=el('div','mine-goal'),top=el('div','mine-goal-top');top.append(el('small','',g.name),el('small','mine-goal-count',`${g.killed.toLocaleString(lang)} / ${g.goal.toLocaleString(lang)}`));
  const bar=el('span','mine-goal-bar'),fill=el('i');fill.style.width=Math.min(100,Math.round(g.killed/g.goal*100))+'%';bar.append(fill);r.append(top,bar);if(g.reward){const i=dbIcon(g.reward);if(i){const rw=img(i);rw.className='mine-goal-reward';r.prepend(rw);}}list.append(r);}
 if(list.childElementCount)out.push(list);return out;}
Object.assign(W.zh,{monstersHere:'这一层的怪物',hp:'生命 {n}',drops:'可能掉落',slayerOf:'讨伐 {k} / {g}',floors:{infested:'怪物层',treasure:'宝藏层',dino:'恐龙层',mushroom:'蘑菇层'}});
Object.assign(W.en,{monstersHere:'Monsters on this floor',hp:'HP {n}',drops:'May drop',slayerOf:'Slayer {k} / {g}',floors:{infested:'Infested floor',treasure:'Treasure floor',dino:'Dino floor',mushroom:'Mushroom floor'}});
// The floor's monsters (backend readers): kind, count, health, what they may drop (the game's drop
// table, not a roll) and the Guild slayer goal they count towards.
function monsterList(mi){if(!Array.isArray(mi.monsterTypes)||!mi.monsterTypes.length)return [];
 const goals=window.Farm?.current?.()?.extras?.slayer||[],title=el('h3','section-title farm-info-title');title.append(img('art/stat-damage.png'),withCount(w('monstersHere'),mi.monsters));
 const grid=el('div','scene-cards mine-monsters');
 for(const m of mi.monsterTypes){const c=el('div','scene-card mine-monster'),face=img(m.icon||'art/stat-damage.png');face.className='mine-monster-icon';c.append(face);
  const copy=el('span','scene-card-copy');copy.append(el('strong','',m.name),el('small','',factRow(['× '+m.count,m.health!=null?w('hp',{n:m.health}):null])));
  const goal=m.slayer&&goals.find(g=>g.id===m.slayer);if(goal){c.classList.add('is-slayer');copy.append(el('small','mine-slayer',w('slayerOf',{k:Math.min(goal.killed,goal.goal),g:goal.goal})));}
  const drops=m.drops.map(id=>dbIcon(id)).filter(Boolean).slice(0,4);if(drops.length){const row=el('span','mine-drops');row.setAttribute('aria-label',w('drops'));for(const i of drops)row.append(img(i));copy.append(row);}
  c.append(copy);grid.append(c);}
 return [title,grid];}
function mine(host,sc){const mi=sc.mine||{},world=model.snapshot?.world;
 const title=mi.area==='quarry'?w('quarry'):w('floor',{n:mi.floor});
 const sub=mi.area==='mines'&&mi.level<120?factRow([w('lowest',{n:mi.lowest}),w('elevator',{n:Math.min(120,(Math.floor(mi.level/5)+1)*5)})]):mi.area==='skull'?w('lowest',{n:Math.max(0,mi.lowest-120)}):null;
 host.append(head(dbIcon('(T)Pickaxe')||'art/icon-map.png',title,sub));
 if(world&&Number.isFinite(world.health)&&Number.isFinite(world.stamina)){const v=el('div','scene-vitals');for(const [key,now,max,fill] of [['health',world.health,world.maxHealth,['#ff0000','#8b0000']],['energy',Math.round(world.stamina),world.maxStamina,['#32cd32','#008000']]]){const m=el('div','scene-vital'),h=el('div','target-growth-head');h.append(el('small','',w(key)),el('small','target-growth-count',`${Math.max(0,Math.floor(now))} / ${max}`));m.append(h,gbar(now,max,w(key),fill));v.append(m);}host.append(v);}
 const chips=el('div','target-chips');const floor=(W[lang]||W.en).floors[mi.floorKind];if(floor)chips.append(chip(null,floor,'is-warn'));if(mi.ladder)chips.append(chip(null,w('ladder'),'is-good'));if(mi.shaft)chips.append(chip(null,w('shaft'),'is-good'));if(mi.mustKill)chips.append(chip(null,w('mustKill'),'is-warn'));
 chips.append(chip(null,w('monsters',{n:mi.monsters}),mi.mustKill&&mi.monsters>0?'is-warn':''));if(mi.stones)chips.append(chip(null,w('stones',{n:mi.stones})));
 const level=mi.luck>0.07?2:mi.luck>0.02?1:mi.luck>=-0.02?0:mi.luck>=-0.07?-1:-2;chips.append(chip('art/farm-dice.png',w('luck')[level+2],level>0?'is-good':level<0?'is-warn':''));host.append(chips);const track=mineTrack(mi);if(track)host.append(track);
 host.append(...monsterList(mi));const t=el('h3','section-title farm-info-title');t.append(img(dbIcon('(O)378')||'art/icon-map.png'),el('span','',w('resources')));host.append(t);
 const items=sc.items.filter(Boolean);if(!items.length)host.append(el('p','farm-none',w('noResources')));
 const grid=el('div','scene-cards');for(const it of items){const c=el('div','scene-card');const i=it.icon||dbIcon(it.id);if(i)c.append(img(i));const copy=el('span','scene-card-copy');copy.append(el('strong','',nameOf(it.id,it.name)),el('small','','× '+it.stack));c.append(copy);grid.append(c);}host.append(grid);
 host.append(...supplies(),...slayer());window.Farm?.ensure?.();}
// Entrance: plays once when a scene opens (not on every refresh of it); a re-render mid-way resumes
// it at the same point. Cards and slots step in one after another.
let entered=null,enteredAt=0;
function enter(host,sc){const key=sc.kind+'|'+(sc.kind==='night'?'':sc.key),now=performance.now();if(entered!==key){entered=key;enteredAt=now;}
 const t=now-enteredAt,playing=t<(sc.kind==='night'?2200:1400);host.classList.toggle('scene-enter',playing);host.style.setProperty('--scene-t',playing?-t/1000+'s':'0s');
 for(const group of host.querySelectorAll('.scene-grid,.scene-cards'))[...group.children].forEach((c,i)=>c.style.setProperty('--i',Math.min(i,30)));
 host.querySelectorAll('.scene-shop-row').forEach((c,i)=>c.style.setProperty('--i',Math.min(i,20)));
}
// The page heading names the context (the first line of the page then says which one: the place,
// the shop, the floor).
Object.assign(T.zh,{night:'晚安'});Object.assign(T.en,{night:'Good night'});
function title(sc){return sc.kind==='fishing'?w('fishing'):sc.kind==='mine'?w(sc.mine?.area==='quarry'?'mines':sc.mine?.area||'mines'):sc.kind==='night'?t('night'):sc.kind==='chest'?t('chest'):t('shop');}
window.Scene={title,render(host,sc,refresh){host.dataset.scene=sc.kind;if(sc.kind==='chest')chest(host,sc,refresh);else if(sc.kind==='fishing')fishing(host,sc);else if(sc.kind==='mine')mine(host,sc);else if(sc.kind==='night')window.Briefing?.renderNight(host,sc);else shop(host,sc);enter(host,sc);},
 leave(){entered=null;},key:()=>[pending,noteUntil>performance.now()?note:'',window.Farm?.report?.()?.version,model.busy],pending:()=>!!pending};
})();
