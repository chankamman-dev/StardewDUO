// Facing-object cards are read-only. Pinned cards are explicitly frozen snapshots.
(()=>{'use strict';
 const copy={
  zh:{target:'情境',npc:'居民',crop:'作物',machine:'机器',animal:'动物',object:'物品',empty:'面向村民、作物或机器',busy:'返回游戏后查看',unavailable:'等待进入存档',disconnected:'未连接游戏',stale:'连接已断开',error:'暂时无法读取',upgrade:'请更新游戏端模组',known:'已知喜好',unknown:'尚未发现喜好',limited:'仅显示前 64 项已知记录',notMet:'尚未结识',friendship:'好感',talk:'今日聊天',gifts:'今日送礼',week:'本周',done:'已完成',notYet:'未完成',cropState:'生长状态',harvest:'可以收取',growing:'生长中',dead:'已枯死',outOfSeason:'不在生长季',growthDays:'距成熟',regrowDays:'再次收获',water:'浇水',watered:'已浇水',dry:'未浇水',notNeeded:'无需浇水',seasonRisk:'季节',seasonEnds:'成熟前会换季',machineState:'加工状态',working:'加工中',idle:'等待原料',minutes:'剩余时间',output:'产物',pet:'今日抚摸',fullness:'饱食',happiness:'心情',age:'年龄',adultDays:'距成年',produce:'可采产物',description:'说明',days:'天',minuteUnit:'分钟',hourUnit:'小时',taste0:'最爱',taste2:'喜欢',taste4:'不喜欢',taste6:'讨厌',taste7:'特殊礼物',taste8:'一般',pin:'固定查看',follow:'继续跟随',pinned:'已固定',profile:'居民档案',guide:'查阅手册'},
  en:{target:'Now',npc:'Villager',crop:'Crop',machine:'Machine',animal:'Animal',object:'Object',empty:'Face a villager, crop or machine',busy:'Return to the game to inspect',unavailable:'Waiting for a save',disconnected:'Game disconnected',stale:'Connection lost',error:'Unable to read target',upgrade:'Update the game mod',known:'Known tastes',unknown:'No tastes discovered',limited:'First 64 known gifts shown',notMet:'Not met',friendship:'Friendship',talk:'Talked today',gifts:'Gift today',week:'This week',done:'Done',notYet:'Not yet',cropState:'Growth',harvest:'Ready to collect',growing:'Growing',dead:'Dead',outOfSeason:'Out of season',growthDays:'Until mature',regrowDays:'Regrows in',water:'Water',watered:'Watered',dry:'Not watered',notNeeded:'No watering needed',seasonRisk:'Season',seasonEnds:'Season ends before harvest',machineState:'Status',working:'Processing',idle:'Awaiting input',minutes:'Time left',output:'Output',pet:'Pet today',fullness:'Fullness',happiness:'Happiness',age:'Age',adultDays:'Until adult',produce:'Produce ready',description:'Description',days:'days',minuteUnit:'min',hourUnit:'hr',taste0:'Love',taste2:'Like',taste4:'Dislike',taste6:'Hate',taste7:'Special',taste8:'Neutral',pin:'Pin card',follow:'Follow',pinned:'Pinned',profile:'Profile',guide:'Open guide'}
 };
 Object.assign(copy.zh,{busyBrief:'游戏里正在播放剧情或开着菜单，结束后回到情境'});Object.assign(copy.en,{busyBrief:'A cutscene or game menu is open; back to the context page when it ends'});
 Object.assign(copy.zh,{petted:'今天已抚摸',unpetted:'今天未抚摸'});Object.assign(copy.en,{petted:'Petted today',unpetted:'Not petted today',talk:'Talked'});
 Object.assign(copy.zh,{emptyHint:'走到村民、作物、机器或动物旁边并面向它',busyHint:'关掉游戏里的菜单后继续显示',paused:'游戏里打开了菜单，先显示之前的对象',
  growth:'生长',growthOf:'{a} / {b} 天',harvestOn:'预计收获',today:'今天',price:'售价',priceUnit:'{n} 金',regrowEvery:'每 {n} 天再生',
  finishAt:'约 {t} 完成',finishTomorrow:'明天完成',finishDays:'约 {n} 天后完成',nextDay:'次日 ',hearts:'好感'});
 Object.assign(copy.en,{emptyHint:'Stand next to one and face it',busyHint:'Shows again once the game menu is closed',paused:'A game menu is open; showing the last target',
  growth:'Growth',growthOf:'{a} / {b} days',harvestOn:'Harvest',today:'Today',price:'Sells for',priceUnit:'{n}g',regrowEvery:'Regrows every {n} days',
  finishAt:'Ready about {t}',finishTomorrow:'Ready tomorrow',finishDays:'Ready in about {n} days',nextDay:'next day ',hearts:'Friendship'});
 words.zh.target=copy.zh.target;words.en.target=copy.en.target;
 const tr=(k,v={})=>{let s=copy[lang][k]||k;for(const [a,b] of Object.entries(v))s=s.replace('{'+a+'}',b);return s;};
 let last='',lastId='',pin=null,pinSession=null,pinWorld=null,current=null,lastLive=null;
 const seasonKeys=['spring','summer','fall','winter'];
 // Item art from the bag first, then the offline item list.
 const itemIcon=id=>id?(icons.get(id)||db?.[lang]?.items.find(i=>i.id===id)?.icon||null):null;
 // QuestLog-style framed bar (journal.css .game-bar); colour per meter.
 function bar(value,max,label,fill){const b=el('div','game-bar target-bar'),p=max>0?Math.min(1,Math.max(0,value/max)):0;b.setAttribute('role','progressbar');b.setAttribute('aria-valuemin','0');b.setAttribute('aria-valuemax',String(max));b.setAttribute('aria-valuenow',String(value));b.setAttribute('aria-label',label);
  b.style.setProperty('--p',p);if(fill){b.style.setProperty('--fill',fill[0]);b.style.setProperty('--edge',fill[1]);}b.append(el('span','game-bar-fill'));return b;}
 function chip(icon,text,cls=''){const n=el('span','target-chip '+cls);if(icon)n.append(smallIcon(icon));n.append(el('small','',text));return n;}
 // Calendar date N days after the shown world date (28-day seasons).
 function dateAfter(world,days){if(!world||!seasonKeys.includes(world.season))return null;if(days<=0)return tr('today');const abs=seasonKeys.indexOf(world.season)*28+world.day-1+days,season=seasonKeys[Math.floor(abs/28)%4],day=abs%28+1,name=words[lang][season]||season;return lang==='zh'?`${name}${day}日`:`${name} ${day}`;}
 // Machines keep working overnight; past 2am only a day count is honest.
 function finishText(world,minutes){if(!world||!Number.isFinite(world.time))return null;const now=Math.floor(world.time/100)*60+world.time%100,end=now+minutes;
  if(end<26*60){const h=Math.floor(end/60),m=String(end%60).padStart(2,'0');return tr('finishAt',{t:(h>=24?tr('nextDay')+(h-24):h)+':'+m});}
  const days=Math.ceil((end-26*60)/1440);return days<=1?tr('finishTomorrow'):tr('finishDays',{n:days});}
 let panel=$('target-content');
 function openGuide(id){
  if(!db?.[lang].items.some(i=>i.id===id))return;
  if(window.ThorNav?.open){ThorNav.open('manual',{guideId:id,profile:true});return;}
  guideId=id;$('item-search').value='';$('category-filter').value='';showPage('manual');renderGuide();showProfile('manual',true);extendGuide();
 }
 function openResident(id){if(window.ThorNav?.open)ThorNav.open('people',{personId:id,profile:true});else visitResident(id);}
 function knownItem(id){return typeof id==='string'&&db?.[lang].items.some(i=>i.id===id);}
 function smallIcon(source,cls=''){const n=img(source);n.className=cls;return n;}
 function value(field){
  if(['growthDays','regrowDays','age','adultDays'].includes(field.key))return field.value+' '+tr('days');
  if(field.key==='minutes'){const m=Number(field.value);return m>=60?`${Math.floor(m/60)} ${tr('hourUnit')}${m%60?' '+m%60+' '+tr('minuteUnit'):''}`:`${m} ${tr('minuteUnit')}`;}
  return tr(field.value);
 }
 function row(key,text,icon){const n=el('div','target-row');const label=el('div','target-row-label');if(icon)label.append(smallIcon(icon));label.append(el('small','',tr(key)));n.append(label,el('p','',text));return n;}
 function status(key,complete){const n=el('div','target-care');n.append(smallIcon('art/check-'+(complete?'on':'off')+'.png'),el('p','',tr(key)));return n;}
 function metric(key,text){const n=el('div','target-metric');n.append(el('small','',tr(key)),el('p','',text));return n;}
 function ratio(key,text){const n=metric(key,text),match=/^(\d+)\s*\/\s*(\d+)$/.exec(text);if(match&&Number(match[2])>0&&Number(match[1])<=Number(match[2])){const bar=el('span','target-meter');bar.setAttribute('role','meter');bar.setAttribute('aria-label',tr(key));bar.setAttribute('aria-valuemin','0');bar.setAttribute('aria-valuemax',match[2]);bar.setAttribute('aria-valuenow',match[1]);const fill=el('span');fill.style.width=(Number(match[1])/Number(match[2])*100)+'%';bar.append(fill);n.append(bar);}return n;}
 function snapshotTime(){if(!pinWorld)return tr('pinned');const w=pinWorld,season=words[lang][w.season]||w.season,time=`${Math.floor(w.time/100)}:${String(w.time%100).padStart(2,'0')}`;return lang==='zh'?`${tr('pinned')}于 ${season}${w.day}日 ${time}`:`${tr('pinned')} at ${season} ${w.day}, ${time}`;}
 function headline(t,fields){
  if(t.kind==='crop'){const state=fields.get('cropState'),days=fields.get('growthDays');if(state==='growing'&&Number(days)>0)return lang==='zh'?`${days} 天后成熟`:`Ready in ${days} ${tr('days')}`;return tr(state||'crop');}
  if(t.kind==='machine')return tr(fields.get('machineState')||'machine');
  return tr(t.kind);
 }
 function guideLink(id,label=tr('guide')){if(!knownItem(id))return null;const b=el('button','target-guide');b.append(smallIcon('art/icon-manual.png'),el('span','',label));b.onclick=()=>openGuide(id);return b;}
 function appendIdentity(t,fields){
  const top=el('div','target-top '+t.kind),secret=t.kind==='npc'&&!t.social&&!!window.Spoiler?.enabled('residents');if(t.icon){const face=smallIcon(t.icon,'target-portrait');if(t.kind==='npc')PortraitImages.attach(face,[t.icon,...PortraitImages.sources(db?.[lang]?.people.find(p=>p.id===(t.social?.id||t.id.split('/').pop()))),'art/icon-people.png']);if(secret)Spoiler.silhouette(face);top.append(face);}
  const identity=el('div','target-identity'),nameRow=el('div','target-name-row'),name=el('h2','',secret?Spoiler.text('unknown'):t.name),toggle=el('button','',tr(pin?'follow':'pin'));
  toggle.id='target-pin';toggle.setAttribute('aria-pressed',String(!!pin));toggle.onclick=()=>{pin=pin?null:current?structuredClone(current):null;pinWorld=pin&&model.snapshot?.world?structuredClone(model.snapshot.world):null;pinSession=model.snapshot?.session;last='';inspect();};
  nameRow.append(name,toggle);identity.append(nameRow);
  if(t.kind==='animal'&&fields.has('pet')){const done=fields.get('pet')==='done',care=el('div','target-primary target-primary-care');care.append(smallIcon('art/check-'+(done?'on':'off')+'.png'),el('p','',tr(done?'petted':'unpetted')));identity.append(care);}
  else if(t.kind!=='npc')identity.append(el('p','target-primary',headline(t,fields)));
  // Where, and (when pinned) the moment it was pinned, share one line.
  const meta=el('div','target-meta');meta.append(el('small','target-location',window.MapNames?.location(t.location,lang)||t.location));
  if(pin)meta.append(el('small','target-snapshot',snapshotTime()));identity.append(meta);
  if(t.kind==='npc'){
   const f=t.social;if(f){const hearts=el('div','target-hearts');hearts.setAttribute('aria-label',`${tr('friendship')} ${f.hearts} / ${f.maxHearts}`);for(let i=0;i<f.maxHearts;i++)hearts.append(smallIcon('art/heart-'+(i<f.hearts?'full':'empty')+'.png'));
    const points=el('div','target-friend-line');points.append(el('small','target-friendship',`${tr('friendship')} ${f.points} / ${f.maxHearts*250}`));if(f.hearts<f.maxHearts)points.append(el('small','target-next-heart',nt('nextHeart',{n:250-f.points%250})));identity.append(hearts,points);}
   else identity.append(el('small','target-note',tr('notMet')));
  }
  top.append(identity);panel.append(top);
 }
 // Facing a villager: their birthday, what in the backpack they would like (and what to keep
 // away from them), how far the next heart is, and the next heart event if the story directory is
 // already loaded. Tastes follow the spoiler setting: only revealed ones while tastes are hidden.
 const NT={zh:{birthdayToday:'今天是{n}的生日！礼物好感 ×8',birthday:'{s}{d}日生日，还有 {k} 天',bagGifts:'背包里可以送的',giftedToday:'今天已经送过礼了',weekFull:'本周两次礼物已送完',avoid:'别送',nextHeart:'下一颗心还差 {n}',nextEvent:'下一段心事件：{h} 心，{l}',noBagGifts:'背包里没有已知{n}喜欢的东西'},
  en:{birthdayToday:"It's {n}'s birthday! Gifts count ×8",birthday:'Birthday {s} {d}, in {k} days',bagGifts:'In your backpack',giftedToday:'Already gave a gift today',weekFull:'Both gifts given this week',avoid:'Avoid',nextHeart:'{n} to the next heart',nextEvent:'Next heart event: {h} hearts, {l}',noBagGifts:'Nothing in the backpack {n} is known to like'}};
 const nt=(k,v={})=>((NT[lang]||NT.en)[k]||k).replace(/\{(\w)\}/g,(_,x)=>v[x]??'');
 const SEASONS=['spring','summer','fall','winter'],seasonName=s=>({zh:{spring:'春季',summer:'夏季',fall:'秋季',winter:'冬季'},en:{spring:'Spring',summer:'Summer',fall:'Fall',winter:'Winter'}}[lang]||{})[s]||s;
 function villagerExtras(t){const f=t.social,id=f?.id||t.id.split('/').pop(),p=db?.[lang]?.people.find(v=>v.id===id),w=model.snapshot?.world;if(!f||!p||window.Spoiler?.hides?.(id))return;
  // Birthday: a banner today, otherwise how many days away.
  if(p.season&&p.day&&w){const today=SEASONS.indexOf(w.season)*28+w.day,day=SEASONS.indexOf(p.season)*28+p.day,k=(day-today+112)%112;
   if(k===0){const b=el('div','target-birthday is-today');b.append(smallIcon('art/gift.png'),el('p','',nt('birthdayToday',{n:t.name})));panel.append(b);}
   else if(k<=28){const b=el('div','target-birthday');b.append(smallIcon('art/icon-calendar.png'),el('small','',nt('birthday',{s:seasonName(p.season),d:p.day,k})));panel.append(b);}}
  // What the backpack holds that they like, best first; what they dislike, to keep away.
  const folded=!!window.Spoiler?.tastesFolded?.('person:'+id),known=new Map(t.gifts.map(g=>[g.id,g.taste]));
  const taste=itemId=>known.has(itemId)?known.get(itemId):folded?undefined:p.tastes?.[itemId];
  const bag=new Map();for(const s of model.snapshot?.bag?.slots||[])if(s)bag.set(s.id,(bag.get(s.id)||0)+s.stack);
  const good=[],bad=[];for(const [itemId,count] of bag){const v=taste(itemId);if(v===0||v===2)good.push({itemId,count,v});else if(v===4||v===6)bad.push({itemId,count,v});}
  good.sort((a,b)=>a.v-b.v);const box=el('div','target-bag-gifts'),head=el('div','target-bag-head');head.append(smallIcon('art/icon-bag.png'),el('small','',nt('bagGifts')));
  const limit=f.giftsToday>0?nt('giftedToday'):f.relationship!=='Married'&&f.giftsThisWeek>=2&&!(p.season===w?.season&&p.day===w?.day)?nt('weekFull'):'';if(limit)head.append(el('small','target-bag-limit',limit));box.append(head);
  if(good.length){const list=el('div','target-bag-list');for(const g of good.slice(0,6)){const b=el('button','target-bag-item is-'+(g.v===0?'love':'like'));b.onclick=()=>openGuide(g.itemId);if(icons.has(g.itemId))b.append(smallIcon(icons.get(g.itemId)));b.append(el('span','',db?.[lang]?.items.find(i=>i.id===g.itemId)?.name||g.itemId),el('small','',factRow([tr('taste'+g.v),'×'+g.count])));list.append(b);}box.append(list);}
  else box.append(el('small','target-note',nt('noBagGifts',{n:t.name})));
  if(bad.length){const warn=el('div','target-bag-avoid');warn.append(el('small','',nt('avoid')));for(const g of bad.slice(0,4)){const c=el('span','target-bag-bad');if(icons.has(g.itemId))c.append(smallIcon(icons.get(g.itemId)));c.append(el('small','',db?.[lang]?.items.find(i=>i.id===g.itemId)?.name||g.itemId));warn.append(c);}box.append(warn);}
  panel.append(box);
  // The next heart event for them, only from an already-loaded story directory (never fetched here).
  const events=window.LiveData?.peek?.('events')?.entries;if(events&&window.EventFilter){let best=null;
   for(const e of events){if(e.seen||e.disabled)continue;for(const tk of EventFilter.parsed(e).tokens)if(tk.kind==='Friendship'&&!tk.negative)for(let i=0;i+1<tk.args.length;i+=2){const pts=Number(tk.args[i+1]);if(tk.args[i].toLowerCase()===id.toLowerCase()&&pts>f.points&&(!best||pts<best.pts))best={pts,e};}}
   if(best){const b=el('div','target-next-event');b.append(smallIcon('art/quest-normal.png'),el('small','',nt('nextEvent',{h:Math.ceil(best.pts/250),l:window.MapNames?.location(best.e.location,lang)||best.e.location})));panel.append(b);}}}
 function appendSocial(t){
  const f=t.social;if(f){const daily=el('div','target-daily');for(const [icon,key,done] of [['chat','talk',f.talkedToday],['gift','gifts',f.giftsToday>0]]){const n=el('div','target-daily-entry');n.setAttribute('aria-label',`${tr(key)}: ${tr(done?'done':'notYet')}`);n.append(smallIcon('art/'+icon+'.png'),el('small','',tr(key)),smallIcon('art/check-'+(done?'on':'off')+'.png','target-check'));daily.append(n);}daily.append(el('small','target-week',`${tr('week')} ${f.giftsThisWeek}${f.relationship==='Married'?'':' / 2'}`));panel.append(daily);villagerExtras(t);}
  const id=t.social?.id||t.id.split('/').pop();if(db?.[lang].people.some(p=>p.id===id)&&!window.Spoiler?.hides(id)){const b=el('button','target-profile');b.append(smallIcon('art/icon-people.png'),el('span','',tr('profile')));b.onclick=()=>openResident(id);panel.append(b);}
  panel.append(el('h3','target-section',tr('known')));
  if(!t.gifts.length)panel.append(el('p','target-note',tr('unknown')));
  for(const taste of [0,2,8,4,6,7]){const gifts=t.gifts.filter(g=>g.taste===taste);if(!gifts.length)continue;const group=el('div','target-gifts');group.append(el('small','target-taste',tr('taste'+taste)));const list=el('div','target-gift-list');for(const g of gifts){const entry=el('button','target-gift');entry.disabled=!knownItem(g.id);entry.onclick=()=>openGuide(g.id);if(icons.has(g.id))entry.append(smallIcon(icons.get(g.id)));entry.append(el('p','',g.name));list.append(entry);}group.append(list);panel.append(group);}
  
 }
 function appendProduct(t,fields){
  const output=fields.get('output')||fields.get('produce');if(!output)return;
  const box=el('div','target-product');box.append(el('small','',tr(t.kind==='animal'?'produce':'output')));
  const content=el(knownItem(t.outputId)?'button':'div','target-product-content');if(knownItem(t.outputId)){content.onclick=()=>openGuide(t.outputId);content.setAttribute('aria-label',output+' · '+tr('guide'));}
  if(itemIcon(t.outputId))content.append(smallIcon(itemIcon(t.outputId)));
  content.append(el('p','',output));if(knownItem(t.outputId))content.append(smallIcon('art/icon-manual.png','target-product-guide'));box.append(content);panel.append(box);
 }
 function appendDetails(t,fields){
  const world=pin?pinWorld:model.snapshot?.world;
  if(t.kind==='crop'){
   const days=Number(fields.get('growthDays')),total=Number(fields.get('growthTotal'));
   // Growth: days done out of the planted total, on the game's framed bar.
   if(fields.get('cropState')==='growing'&&total>0&&days>=0&&days<=total){const g=el('div','target-growth');const head=el('div','target-growth-head');head.append(el('small','',tr('growth')),el('small','target-growth-count',tr('growthOf',{a:total-days,b:total})));g.append(head,bar(total-days,total,tr('growth'),['#32cd32','#008000']));panel.append(g);}
   // State chips: watering (orange when dry), fertilizer, regrowth.
   const chips=el('div','target-chips'),water=fields.get('water');
   if(water)chips.append(chip(itemIcon('(T)WateringCan')||'art/farm-wx-rain.png',tr(water),water==='dry'?'is-warn':water==='watered'?'is-good':''));
   if(fields.has('fertilizer'))chips.append(chip(itemIcon(fields.get('fertilizerId')),fields.get('fertilizer')));
   if(fields.has('regrowDays'))chips.append(chip(null,tr('regrowEvery',{n:fields.get('regrowDays')}),'is-good'));
   if(chips.childElementCount)panel.append(chips);
   const metrics=el('div','target-metrics'),date=Number.isFinite(days)&&fields.get('cropState')==='growing'?dateAfter(world,days):null;
   if(date)metrics.append(metric('harvestOn',date));
   if(fields.has('price')){const m=metric('price',tr('priceUnit',{n:Number(fields.get('price')).toLocaleString(lang)}));m.querySelector('p').prepend(smallIcon('art/hud-coin.svg','target-coin'));metrics.append(m);}
   if(metrics.childElementCount)panel.append(metrics);
   if(fields.has('seasonRisk'))panel.append(el('p','target-warning',tr(fields.get('seasonRisk'))));
   
  }else if(t.kind==='machine'){
   if(fields.has('minutes')){const minutes=Number(fields.get('minutes')),r=row('minutes',value({key:'minutes',value:fields.get('minutes')}),'art/hud-clock.svg'),finish=finishText(world,minutes);if(finish)r.append(el('small','target-finish',finish));panel.append(r);}
   appendProduct(t,fields);
  }else if(t.kind==='animal'){
   const meters=el('div','target-metrics');for(const [key,fill] of [['fullness',['#e9a33a','#9c5a14']],['happiness',['#32cd32','#008000']]])if(fields.has(key)){const match=/^(\d+)\s*\/\s*(\d+)$/.exec(fields.get(key)),m=metric(key,fields.get(key));if(match)m.append(bar(Number(match[1]),Number(match[2]),tr(key),fill));meters.append(m);}if(meters.childElementCount)panel.append(meters);
   // Animal friendship as the game's five hearts (200 points each).
   if(fields.has('friendship')){const f=Number(/^(\d+)/.exec(fields.get('friendship'))?.[1]||0),r=el('div','target-animal-hearts'),hearts=el('div','target-hearts');for(let i=0;i<5;i++)hearts.append(smallIcon('art/heart-'+(f>=(i+1)*200?'full':'empty')+'.png'));hearts.setAttribute('aria-label',tr('hearts')+' '+fields.get('friendship'));r.append(el('small','',tr('hearts')),hearts,el('small','target-friendship',fields.get('friendship')));panel.append(r);}
   const age=el('div','target-metrics');for(const key of ['age','adultDays'])if(fields.has(key))age.append(metric(key,value({key,value:fields.get(key)})));if(age.childElementCount)panel.append(age);
   appendProduct(t,fields);
  }else for(const f of t.fields)panel.append(row(f.key,value(f)));
  const guide=guideLink(t.itemId,t.name?(lang==='zh'?`${tr('guide')}：${t.name}`:`${tr('guide')}: ${t.name}`):undefined);if(guide)panel.append(guide);
 }
 // Updates within one kind of view are morphed (only what changed is touched); a different kind of
 // view (a chest after the briefing, a card after a chest) replaces the page.
 // The page heading names what the page shows (钓鱼, 商店, 晚安, a villager…), not "情境".
 function heading(text){put('heading',text||tr('target'));}
 function swap(mode,built){built.dataset.view=mode;if(panel.dataset.view!==mode)panel.replaceChildren();ViewNodes.morph(panel,built);}
 function inspect(){
  const s=model.snapshot,status=model.status(performance.now()),live=['ready','multiplayer-unverified'].includes(status);let state=live?(s?.targetState||'upgrade'):status==='title'||status==='transition'?'unavailable':status;
  // Session/freshness invalidation must run on every page, including hidden cards.
  if(!live||pinSession!==s?.session){pin=null;pinWorld=null;pinSession=s?.session;last='';}
  current=live&&state==='ready'?s.target:null;
  if(current)lastLive={card:current,session:s.session};else if(!live||lastLive?.session!==s?.session||state==='empty')lastLive=null;
  // A game menu (shop, chest, cutscene) keeps the card that was showing, marked as such.
  const paused=!current&&state==='busy'&&!!lastLive;if(paused)current=lastLive.card;
  if(page!=='target'){pin=null;pinWorld=null;last='';if(panel.dataset.scene==='night'&&s?.scene?.kind!=='night'){panel.replaceChildren();delete panel.dataset.scene;delete panel.dataset.dawn;}return;}
  if(window.TargetDemand&&!window.TargetDemand.canDisplay(s)){current=null;pin=null;state='unavailable';}
  // An open chest or shop takes the page over (unless a card is pinned); it ends with the menu.
  // Saving after sleep stalls the game thread, so snapshots stop for a while: keep the night page
  // up (as "saving") instead of reporting a lost connection.
  const saving=!live&&window.StateBox?.saving?.();
  const scene=saving?{...s.scene,night:{...s.scene.night,phase:'saving'}}:live&&!pin&&window.Scene&&s?.scene?s.scene:null;
  // Daybreak: when the night ends, the night page first turns into morning (briefing.js holds the
  // page for the sunrise and while the new day's journal arrives), then the page moves on.
  if(panel.dataset.scene==='night'&&scene?.kind!=='night'&&live&&window.Briefing?.dawn?.(panel,()=>{last='';inspect();},()=>window.Briefing.morningReady(model.snapshot)))return;
  // The night is one stage updated in place, never rebuilt, so its animations run through.
  if(scene)heading(window.Scene?.title?.(scene));
  if(scene?.kind==='night'&&window.Briefing?.night){const key=JSON.stringify([lang,'night',scene,model.busy,window.Farm?.report?.()?.version,s.journal?.calendar,s.journal?.quests,!!db]);if(key===last)return;last=key;
   if(panel.dataset.scene!=='night'){if(panel.dataset.scene)window.Scene?.leave?.();panel.replaceChildren();delete panel.dataset.briefing;panel.classList.remove('scene-locked','scene-enter','brief-animate','brief-wake-up');panel.scrollTop=0;}
   panel.dataset.scene='night';panel.dataset.view='night';window.Briefing.night(panel,scene);lastId='scene:night';return;}
  if(scene){const key=JSON.stringify([lang,'scene',scene,s.bag,s.control?.chest,window.Scene.key(),!!db,scene.kind==='mine'?[s.world?.health,s.world?.stamina]:null]);if(key===last)return;last=key;const scroll=panel.scrollTop,built=panel.cloneNode(false);delete built.dataset.scene;delete built.dataset.briefing;built.classList.remove('brief-animate','brief-wake-up');
   window.Scene.render(built,scene,()=>{last='';inspect();});swap('scene:'+scene.kind,built);const same=lastId==='scene:'+scene.key;lastId='scene:'+scene.key;panel.scrollTop=same?scroll:0;return;}
  if(panel.dataset.scene)window.Scene?.leave?.();delete panel.dataset.scene;delete panel.dataset.dawn;panel.classList.remove('scene-locked','scene-enter');
  // Morning briefing: the idle context page before noon (or reopened by hand), until dismissed.
  // During a cutscene or an open game menu with no card to keep showing, the day's briefing
  // fills the page instead of an empty notice (the game does not say which event is playing).
  const busyIdle=live&&!pin&&state==='busy'&&!paused&&!!s?.journal&&!!window.Briefing;
  if(live&&!pin&&(busyIdle||window.Briefing?.shouldShow(s,!!current&&!paused))){heading(window.Briefing.title?.());window.Farm?.ensure?.();const key=JSON.stringify([lang,'brief',busyIdle,window.Briefing.key(s),!!db,s.journal?.calendar,s.journal?.quests]);if(key===last)return;last=key;
   const scroll=panel.scrollTop,built=panel.cloneNode(false);delete built.dataset.scene;built.classList.remove('scene-locked','scene-enter');window.Briefing.render(built,()=>{last='';inspect();});if(busyIdle){const note=el('div','target-busy-note');note.append(smallIcon('art/map-zoom.svg'),el('small','',tr('busyBrief')));built.prepend(note);}swap('brief',built);const same=lastId==='brief';lastId='brief';panel.scrollTop=same?scroll:0;return;}
  delete panel.dataset.briefing;
  heading((pin||current)?tr((pin||current).kind):null);
  const t=pin||current,key=JSON.stringify([lang,pin?'pinned':state,t,pinWorld,!!db,paused,t?.kind==='machine'||t?.kind==='crop'?s?.world:null]);if(key===last)return;
  last=key;const scroll=panel.scrollTop,livePanel=panel;panel=livePanel.cloneNode(false);delete panel.dataset.briefing;panel.classList.remove('brief-animate','brief-wake-up');let empty=false;
  try{
  if(!t){const icon='art/map-zoom.svg',box=state==='empty'?StateBox.box(icon,tr('empty'),tr('emptyHint')):state==='busy'?StateBox.box(icon,tr('busy'),tr('busyHint')):state==='upgrade'?StateBox.update(icon,tr('upgrade')):state==='error'?StateBox.box(icon,tr('error')):(StateBox.connection(icon)||StateBox.box(icon,tr(state)));
   if(live&&window.Briefing&&s?.journal&&['empty','busy'].includes(state)){const b=el('button','brief-open');b.type='button';b.append(img('art/icon-calendar.png'),el('span','',window.Briefing.label()));b.onclick=()=>{window.Briefing.open();last='';inspect();};box.append(b);}
   panel.append(box);empty=true;}
  else{const fields=new Map(t.fields.map(f=>[f.key,f.value]));appendIdentity(t,fields);if(paused&&!pin)panel.querySelector('.target-identity')?.append(el('small','target-snapshot target-paused',tr('paused')));if(t.kind==='npc')appendSocial(t);else appendDetails(t,fields);}
  }finally{const built=panel;panel=livePanel;swap(t?'card:'+t.kind:'state',built);}
  if(empty){lastId='';panel.scrollTop=0;return;}
  const nextScroll=lastId===t.id?scroll:0;lastId=t.id;panel.scrollTop=nextScroll;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{if(last===key)panel.scrollTop=nextScroll;}));
 }
 const previous=render;render=function(){previous();inspect();};
 translate();
})();
