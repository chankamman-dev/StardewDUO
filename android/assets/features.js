/* 0.6 functionality. The approved 0.5 frame, typography and sidebar stay in refinement.css. */
'use strict';
const featureWords={zh:{select:'拿在手上',split:'拆分',drop:'丢到地上',cancel:'取消',confirm:'确认',waiting:'处理中…',ok:'操作完成',unpaired:'尚未配对，下屏操作未启用',connection:'连接中断，正在查询回执',unknown:'回执未确认，请检查背包后再操作',ready:'','close-menu':'请先关闭上屏菜单','game-busy':'当前动作结束后可操作','inventory-changed':'背包已变化，请重试','source-changed':'该物品已变化','target-changed':'目标格已变化','stack-full':'目标堆叠已满','split-needs-empty':'拆分请放入空格或同类物品','protected-item':'此物品不能丢弃','session-changed':'已切换存档','expired':'操作超时，未执行','game-error':'游戏返回异常，请检查背包','snapshot-unavailable':'等待背包重新同步',noWorld:'等待进入存档',count:'数量',dragSplit:'已选拆分数量，拖到目标格',liveMap:'实时地图',offlineMap:'离线地图',player:'玩家',schedule:'今日行程',noSchedule:'暂无行程',location:'当前位置',special:'特殊',favorites:'礼物喜好',love:'最爱',like:'喜欢',neutral:'一般',dislike:'不喜',hate:'讨厌',energy:'体力',health:'生命',price:'售价',on:'开启',off:'关闭',soundNote:'点击、返回与操作反馈',more:'更多',less:'收起',pairing:'控制配对',paired:'已配对',notPaired:'尚未配对'},en:{select:'Hold',split:'Split',drop:'Drop',cancel:'Cancel',confirm:'Confirm',waiting:'Working…',ok:'Applied',unpaired:'Pair the companion with its mod',connection:'Connection lost; checking receipt',unknown:'Receipt unconfirmed; check your bag',ready:'','close-menu':'Close the upper-screen menu','game-busy':'Wait for the current action','inventory-changed':'Inventory changed; try again','source-changed':'Item changed','target-changed':'Target changed','stack-full':'Stack is full','split-needs-empty':'Use an empty or matching slot','protected-item':'This item cannot be discarded','session-changed':'Save changed',expired:'Expired; not applied','game-error':'Game error; check your bag','snapshot-unavailable':'Waiting for a fresh inventory',noWorld:'Waiting for a save',count:'Quantity',dragSplit:'Drag the chosen amount to a slot',liveMap:'Live map',offlineMap:'Offline map',player:'Player',schedule:'Today’s schedule',noSchedule:'No schedule',location:'Current location',special:'Special',favorites:'Gifts',love:'Love',like:'Like',neutral:'Neutral',dislike:'Dislike',hate:'Hate',energy:'Energy',health:'Health',price:'Price',on:'On',off:'Off',soundNote:'Clicks, navigation and operation feedback',more:'More',less:'Less',pairing:'Control pairing',paired:'Paired',notPaired:'Not paired'}};
const ft=k=>featureWords[lang][k]||k;
let commandPending=false,lastCommand='',messageUntil=0,splitAmount=0,splitKey=null,giftTaste=0,giftLimit=12,currentRegion='',mapSignature='',livePeopleSignature='',profileSignature='',guideSignature='';
const replies=new Map(),uid=()=>crypto.randomUUID().replaceAll('-','');
window.stardewCommandReply=(id,result)=>{const callback=replies.get(id);if(callback){replies.delete(id);callback(result);}};
function commandRequest(route,body=''){
 if(window.ThorCommands)return new Promise(resolve=>{const correlation=uid();replies.set(correlation,resolve);setTimeout(()=>{if(replies.delete(correlation))resolve({state:'unavailable',code:'connection'});},2400);ThorCommands.request(correlation,route,body);});
 return fetch('/bridge/'+route,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body||undefined,signal:AbortSignal.timeout(2400)}).then(r=>r.ok?r.json():{state:'unavailable',code:r.status===403?'unpaired':'connection'}).catch(()=>({state:'unavailable',code:'connection'}));
}
function message(text,ms=4500){lastCommand=text;messageUntil=performance.now()+ms;put('bag-mode',text);}
function controlReason(){const status=model.status(performance.now());if(status!=='ready')return status;if(window.ThorCommands?.paired&&!ThorCommands.paired())return 'unpaired';return commandPending?'waiting':model.snapshot?.control?.reason||'unpaired';}
function controlReady(){return controlReason()==='ready'&&model.snapshot?.control?.enabled;}
async function execute(action,from=selected,to=-1,amount=null,quiet=false,recipeId=null,extra={}){
 const presentation=action==='set-toolbar',status=model.status(performance.now());
 const chest=action==='chest-take'||action==='chest-put',paired=!window.ThorCommands?.paired||ThorCommands.paired();
 // Chest transfers run while the chest menu is open, so they have their own gate (control.chest).
 const ready=presentation?(['ready','title','multiplayer-unverified'].includes(status)&&!commandPending&&model.snapshot?.control?.toolbar===true&&paired):chest?(status==='ready'&&!commandPending&&paired&&model.snapshot?.control?.chest===true):controlReady();
 if(!ready){const code=chest&&status==='ready'&&paired&&!commandPending?'chest-closed':controlReason();if(!quiet)message(ft(code),1800);return {state:'rejected',code};}
 if(action==='accept-quest'&&(model.snapshot.control?.questBoard!==true||!model.snapshot.journal?.board?.canAccept||model.snapshot.journal.board.key!==extra.boardKey))return {state:'rejected',code:'board-changed'};
 if(action==='claim-quest'&&(model.snapshot.control?.questRewards!==true||!model.snapshot.journal?.quests.some(q=>q.claimKey===extra.questKey&&q.ready&&!q.archived)))return {state:'rejected',code:'quest-changed'};
 if(presentation&&typeof extra.toolbarHidden!=='boolean')return {state:'rejected',code:'toolbar-value'};
 if(action==='craft'&&(model.snapshot.control?.crafting!==true||typeof recipeId!=='string'||!recipeId||!Number.isInteger(amount)||amount<1||amount>99))return {state:'rejected',code:model.snapshot.control?.crafting!==true?'craft-unavailable':'amount'};
 const s=model.snapshot,v=s.bag?.slots[from],target=s.bag?.slots[to],c={id:uid(),order:Math.max(Date.now(),Number(localStorage.getItem('stardew.order')||0)+1),session:s.session,revision:s.revision,action,from,to,amount:amount??(splitKey===v?.key&&splitAmount?splitAmount:v?.stack||0),sourceKey:v?.key??null,targetKey:target?.key??null};
 if(action==='craft')c.recipeId=recipeId;
 if(action==='accept-quest')c.boardKey=extra.boardKey;
 if(action==='claim-quest')c.questKey=extra.questKey;
 if(presentation)c.toolbarHidden=extra.toolbarHidden;
 if(chest){c.to=-1;c.sourceKey=extra.sourceKey;c.targetKey=extra.sceneKey;c.amount=extra.amount;}
 localStorage.setItem('stardew.order',String(c.order));commandPending=true;splitAmount=0;if(!quiet)message(ft('waiting'),12000);render();let result;
 try{
  const body=JSON.stringify(c);result=await commandRequest('command',body);
  for(let i=0;i<7&&(!result||['queued','unavailable'].includes(result.state));i++){
   await new Promise(r=>setTimeout(r,[40,70,120,180,250,350,500][i]));result=await commandRequest('receipt/'+c.id);
   // Retry the identical request ID/body only; the server deduplicates before execution.
   if(!['craft','accept-quest','claim-quest','set-toolbar'].includes(action)&&result.state==='unavailable'&&i===2)result=await commandRequest('command',body);
  }
  if(result?.state==='applied'){
   for(let n=0;n<3&&model.snapshot?.session===c.session;n++){while(busy)await new Promise(r=>setTimeout(r,15));clearTimeout(timer);await poll();if(model.snapshot.revision>=result.revision&&(action!=='select'||model.snapshot.control?.activeSlot===from))break;}if(model.snapshot?.session===c.session){if(action==='move'&&selected===c.from)selected=c.to;else if(action==='sort'&&v?.key)selected=model.snapshot.bag.slots.findIndex(item=>item?.key===v.key);}if(!quiet){message('',0);window.BagInput?.confirm(selected);}window.ThorSound?.play('dwop');
  }else message(ft(result?.state==='queued'||result?.state==='unavailable'?'unknown':result?.code||'unknown'),result?.code==='game-busy'||result?.code==='close-menu'?1800:7000);
  if(action==='craft'&&result?.state==='applied'&&(model.snapshot?.session!==c.session||model.snapshot?.revision<result.revision||model.status(performance.now())!=='ready'))result={state:'unavailable',code:'snapshot-unavailable'};
 }finally{commandPending=false;render();window.BagInput?.drain();}
 return result;
}
Object.assign(featureWords.zh,{'chest-closed':'箱子已经关上了','cursor-item':'请先放下上屏鼠标拿着的物品','chest-changed':'打开的不是同一个箱子了','chest-full':'箱子已满','not-allowed':'这个箱子放不了这件物品','source-changed':'物品已变化，请重试'});
Object.assign(featureWords.en,{'chest-closed':'The chest is closed','cursor-item':'Put down the item held on the top screen first','chest-changed':'A different chest is open now','chest-full':'The chest is full','not-allowed':'This chest cannot hold that item','source-changed':'The item changed; try again'});
Object.assign(featureWords.zh,{'craft-unavailable':'更新配套模组后制作','recipe-unknown':'尚未学会此配方','recipe-unsupported':'此配方暂不支持','materials':'材料不足','inventory-full':'背包空间不足','amount':'制作数量无效','cooking-station':'料理需在厨房制作'});
Object.assign(featureWords.en,{'craft-unavailable':'Update the mod to craft','recipe-unknown':'Recipe not learned','recipe-unsupported':'Recipe not supported','materials':'Not enough materials','inventory-full':'Backpack is full','amount':'Invalid craft quantity','cooking-station':'Cook at a kitchen'});
window.Commands={chestTake:(slot,item,sceneKey)=>execute('chest-take',slot,-1,item.stack,true,null,{sourceKey:item.key,sceneKey,amount:item.stack}),chestPut:(slot,item,sceneKey)=>execute('chest-put',slot,-1,item.stack,true,null,{sourceKey:item.key,sceneKey,amount:item.stack}),claimQuest:key=>execute('claim-quest',-1,-1,0,true,null,{questKey:key}),acceptQuest:key=>execute('accept-quest',-1,-1,0,true,null,{boardKey:key}),setToolbar:hidden=>execute('set-toolbar',-1,-1,0,true,null,{toolbarHidden:hidden}),craft:(recipeId,amount)=>execute('craft',-1,-1,amount,true,recipeId),busy:()=>commandPending,reason:controlReason,label:ft};
const actions=el('div','item-actions');for(const action of ['split','drop']){const b=el('button');b.dataset.action=action;b.append(img('art/action-'+action+'.svg'),el('span'));actions.append(b);}
// Item details scroll independently; contextual actions share one bottom row.
const bagTools=document.querySelector('.bag-tools');
bagTools.before($('bag-mode'));
bagTools.prepend(actions);
bagTools.append($('bag-trash'),$('bag-organize'));
const relatedIcon=img('art/icon-manual.png');
const relatedLabel=el('span');$('related').removeAttribute('data-i');$('related').replaceChildren(relatedIcon,relatedLabel);
bagTools.insertBefore($('related'),$('bag-organize'));
const sale=el('span','item-sale'),saleValue=el('span');sale.id='item-sale';sale.hidden=true;sale.append(img('art/hud-coin.svg'),saleValue);$('detail-count').before(sale);
const metrics=el('small','item-metrics');$('description').after(metrics);const tooltipLines=el('div','item-lines');metrics.after(tooltipLines);const lineIcons=new Set(['damage','speed','defense','critChance','critPower','weight','immunity','duration','enchant','enchantSecondary',...Array.from({length:12},(_,k)=>'buff'+k)]);
const catalogMore=el('button','catalog-more');$('catalog').after(catalogMore);catalogMore.onclick=()=>{const scroll=$('manual').scrollTop;window.catalogLimit=(window.catalogLimit||90)+90;renderGuide();$('manual').scrollTop=scroll;};
const dialog=el('dialog','item-dialog'),dialogTitle=el('h2'),quantityLabel=el('div','quantity-row'),quantity=el('output','item-quantity'),minus=el('button','quantity-minus','−'),plus=el('button','quantity-plus','+'),maximum=el('button','quantity-max'),dialogButtons=el('div','dialog-buttons'),cancel=el('button'),confirm=el('button');
let quantityValue=1,quantityMax=1;
function setQuantity(value){quantityValue=Math.max(1,Math.min(quantityMax,value));quantity.textContent=String(quantityValue);minus.disabled=quantityValue<=1;plus.disabled=quantityValue>=quantityMax;maximum.disabled=quantityValue>=quantityMax;window.GameFont?.refresh();}
minus.onclick=()=>setQuantity(quantityValue-1);plus.onclick=()=>setQuantity(quantityValue+1);maximum.onclick=()=>setQuantity(quantityMax);
for(const b of [minus,plus,maximum,cancel,confirm])b.type='button';quantity.setAttribute('aria-live','polite');quantityLabel.append(el('span','quantity-label'),minus,quantity,plus,maximum);dialogButtons.append(cancel,confirm);dialog.append(dialogTitle,quantityLabel,dialogButtons);document.querySelector('.shell').append(dialog);
function askItem(action){const v=model.snapshot?.bag?.slots[selected];if(!v||!controlReady())return;const originalSession=session,key=v.key,index=selected;dialogTitle.textContent=(action==='trash'?words[lang].trash:ft(action))+(lang==='zh'?'：':': ')+v.name;quantityLabel.firstChild.textContent=ft('count');quantityMax=v.stack;maximum.textContent=lang==='zh'?'最大':'Max';minus.setAttribute('aria-label',lang==='zh'?'减少数量':'Decrease quantity');plus.setAttribute('aria-label',lang==='zh'?'增加数量':'Increase quantity');quantity.setAttribute('aria-label',ft('count'));setQuantity(action==='split'?Math.ceil(v.stack/2):v.stack);cancel.textContent=ft('cancel');confirm.textContent=ft('confirm');cancel.onclick=()=>dialog.close();confirm.onclick=()=>{const amount=quantityValue;if(!Number.isInteger(amount)||amount<1||amount>v.stack)return;if(session!==originalSession||model.snapshot?.bag?.slots[index]?.key!==key||amount>(model.snapshot?.bag?.slots[index]?.stack||0)){dialog.close();message(ft('source-changed'));return;}dialog.close();if(action==='split'){splitAmount=amount;splitKey=key;message(ft('dragSplit'));}else execute(action,index,-1,amount);};dialog.showModal();window.GameFont?.layout();}
actions.querySelector('[data-action=split]').onclick=()=>askItem('split');actions.querySelector('[data-action=drop]').onclick=()=>askItem('drop');$('bag-organize').onclick=()=>execute('sort');$('bag-trash').onclick=()=>askItem('trash');
// Existing layout and view model render first; new information occupies existing open paper.
const baseRender=render;render=function(){baseRender();const v=model.snapshot?.bag?.slots[selected],enabled=controlReady();$('bag-organize').disabled=!enabled;$('bag-trash').disabled=!enabled||!v?.canTrash;$('bag-trash').hidden=!v?.canTrash;$('related').title=words[lang].lookup;{const label=lang==='zh'?'查阅':'Guide';if(relatedLabel.textContent!==label)relatedLabel.textContent=label;}$('related').setAttribute('aria-label',words[lang].lookup);actions.hidden=!v;sale.hidden=!(Number.isFinite(v?.price)&&v.price>0);const priceText=sale.hidden?'':String(v.price);if(saleValue.textContent!==priceText)saleValue.textContent=priceText;sale.title=lang==='zh'?'单件售价':'Sell price per item';sale.setAttribute('aria-label',sale.title+' '+priceText+' g');const lineKey=JSON.stringify([v?.id,v?.stats,v?.energy,v?.health,lang]);if(tooltipLines.dataset.key!==lineKey){tooltipLines.dataset.key=lineKey;const vital=kind=>{const line=el('div','item-line item-line-'+kind),n=v[kind];line.append(img('art/'+(kind==='energy'?'hud-stamina.svg':'heart-full.png')),el('span','',(n>0?'+':'')+n));line.title=ft(kind);return line;};tooltipLines.replaceChildren(...(v?.stats?.length?['energy','health'].filter(k=>Number.isFinite(v[k])&&v[k]!==0).map(vital):[]),...(v?.stats||[]).map(s=>{const line=el('div','item-line');if(s.tone)line.dataset.tone=s.tone;if(s.text.length>14)line.classList.add('is-wide');if(lineIcons.has(s.icon))line.append(img('art/stat-'+s.icon+'.png'));else line.classList.add('no-icon');line.append(el('span','',s.text));return line;}));tooltipLines.hidden=!v?.stats?.length;}const statKey=JSON.stringify([lang,v?.energy,v?.health]);if(metrics.dataset.key!==statKey){metrics.dataset.key=statKey;metrics.hidden=!!v?.stats?.length;metrics.replaceChildren();for(const kind of ['energy','health'])if(Number.isFinite(v?.[kind])&&v[kind]!==0)metrics.append(itemStat(kind,v[kind],ft(kind),true));}for(const b of actions.children){const label=b.querySelector('span');if(label.textContent!==ft(b.dataset.action))label.textContent=ft(b.dataset.action);b.hidden=(b.dataset.action==='split'&&(!v||v.stack<2))||(b.dataset.action==='drop'&&v?.canDrop!==true);b.disabled=!enabled||!v||(b.dataset.action==='split'&&v.stack<2)||(b.dataset.action==='drop'&&v.canDrop!==true);}if(performance.now()>messageUntil)put('bag-mode','');else put('bag-mode',lastCommand);for(const b of $('slots').children)b.classList.toggle('equipped',Number(b.dataset.index)===model.snapshot?.control?.activeSlot);updateLivePeople();if(page==='map')renderLiveMap();if(page==='people')extendProfile();if(page==='manual')extendGuide();};
let livePeopleSession=null;
function updateLivePeople(){
 const fresh=model.status(performance.now())==='ready',live=fresh?model.snapshot?.tracking?.residents:null;
 const signature=JSON.stringify([session,fresh,live?.map(p=>[p.id,p.name,p.portrait,p.mapAvatar]),lang]);
 if(signature===livePeopleSignature||!db)return;livePeopleSignature=signature;
 // A paused/partial collection is not a change of appearance. Keep the last good
 // live image within this save; never fall back to vanilla while refreshing it.
 if(livePeopleSession!==session){livePeopleSession=session;for(const locale of ['zh','en']){
  db[locale].people=db[locale].people.filter(p=>!p.runtime);for(const p of db[locale].people){delete p.livePortrait;delete p.liveMapAvatar;delete p.catalogPortrait;}
 }}
 if(live)for(const p of live)for(const locale of ['zh','en']){
  let old=db[locale].people.find(v=>v.id===p.id);
  if(!old){old={id:p.id,name:p.name,day:p.day,season:p.season,romance:p.romance,region:'Other',runtime:true};db[locale].people.push(old);}
  if(p.portrait)old.livePortrait=p.portrait;if(p.mapAvatar)old.liveMapAvatar=p.mapAvatar;
 }
 renderPeople();
}
function runtimePerson(id){return model.status(performance.now())==='ready'?model.snapshot?.tracking?.residents?.find(p=>p.id===id):null;}
// The villager's story (events.js), apart from the block below: it follows the event list and the
// friendship, not the profile signature. Kept as the last block of the profile.
const storyIds=new WeakMap();let storyId=0;
function story(person){const host=$('person-detail'),old=host.querySelector('.resident-events'),data=LiveData.peek('events');if(data&&!storyIds.has(data))storyIds.set(data,++storyId);
 const key=JSON.stringify([person.id,lang,data?storyIds.get(data):0,(model.snapshot?.social||[]).find(s=>s.id===person.id)?.points,window.Spoiler?.version?.()]);
 if(old?.dataset.key===key){if(host.lastElementChild!==old)host.append(old);return;}const next=window.StoryEvents?.personSection?.(person.id);old?.remove();if(next){next.dataset.key=key;host.append(next);}}
// The lower half in parts, each rebuilt only when what it shows changes: where the villager is and
// their day, family and friends, gift tastes. One signature for all used to rebuild the gift grid
// every time a villager walked into another location.
const EXTRA_ORDER=['where','kin','tastes'];
function extraPart(extra,name,sig,build){const node=extra.querySelector(':scope>[data-part="'+name+'"]');if(node?.dataset.sig===sig)return;const next=el('div','resident-part');next.dataset.part=name;next.dataset.sig=sig;build(next);
 if(!next.childNodes.length){node?.remove();return;}if(node){node.replaceWith(next);return;}const later=[...extra.children].find(c=>EXTRA_ORDER.indexOf(c.dataset.part)>EXTRA_ORDER.indexOf(name));extra.insertBefore(next,later||null);}
function extendProfile(){
 const live=runtimePerson(personId);for(const b of $('people-list').children){const p=runtimePerson(b.dataset.person);if(p?.portrait&&b.firstChild?.tagName==='IMG'&&b.firstChild.getAttribute('src')!==p.portrait)PortraitImages.attach(b.firstChild,PortraitImages.sources(db[lang].people.find(v=>v.id===p.id)));}
 if(!$('people').classList.contains('profile')||!db)return;
 if(page==='people')put('page-meta',model.status(performance.now())==='ready'?'':words[lang].offline);
 const person=db[lang].people.find(p=>p.id===personId);if(!person)return;
 // Not met yet: no whereabouts, schedule or tastes, only the game's own wording.
 if(window.Spoiler?.hides(personId)){$('person-detail').querySelector('.resident-extra')?.remove();if(!$('person-detail').querySelector('.spoiler-note'))$('person-detail').append(el('p','spoiler-note',Spoiler.text('notMet')));return;}
 story(person);
 const portrait=$('person-detail').querySelector('.portrait-large');if(live?.portrait&&portrait)PortraitImages.attach(portrait,PortraitImages.sources(person));
 const missing=$('person-detail').querySelector('.unknown');if(missing)missing.hidden=!!live;
 let extra=$('person-detail').querySelector('.resident-extra');if(extra&&extra.dataset.person!==personId+'|'+lang){extra.remove();extra=null;}
 if(!extra){extra=el('div','resident-extra');extra.dataset.person=personId+'|'+lang;$('person-detail').append(extra);}
 extraPart(extra,'where',JSON.stringify([live?.location,!!live?.position,live?.position?.region,live?.local?.location,live?.schedule]),extra=>{if(live){const loc=el('button','resident-location');loc.append(labelValue(ft('location'),live.local?.location&&window.MapNames?window.MapNames.location(live.local.location,lang,live.location):live.location));loc.disabled=!live.position&&!live.local;loc.onclick=()=>{const current=runtimePerson(personId);if(current?.position){window.LocalMap?.close();window.ThorNav.open('map',{region:current.position.region,focus:current.position});}else if(current?.local){window.ThorNav.open('map');window.LocalMap.focus(current.local.location,[Math.floor(current.local.x),Math.floor(current.local.y)],current.name);}};extra.append(loc,el('h3','section-title',ft('schedule')));if(live.schedule?.length){const schedule=el('div','schedule-list');for(const stop of live.schedule){const row=el('p');row.append(el('span','',`${Math.floor(stop.time/100)}:${String(stop.time%100).padStart(2,'0')}`),el('span','',stop.location));schedule.append(row);}extra.append(schedule);}else extra.append(el('small','',ft('noSchedule')));}});
 extraPart(extra,'kin',JSON.stringify([person.relations,window.Spoiler?.version()]),extra=>{const kin=relationsBlock(person);if(kin)extra.append(el('h3','section-title',lang==='zh'?'家人与朋友':'Family and friends'),kin);});
 extraPart(extra,'tastes',JSON.stringify([giftTaste,giftLimit,window.Spoiler?.version(),window.Spoiler?.tastesFolded('person:'+personId),person.catalog,!!person.tastes,!!person.revealed]),extra=>{if((person.tastes||person.revealed)&&window.Spoiler?.tastesFolded('person:'+personId)){extra.append(el('h3','section-title',ft('favorites')));const found=Spoiler.revealed(personId);if(found)extra.append(revealedTastes(found));if(person.tastes)extra.append(Spoiler.gate('person:'+personId,'reveal'));}
 else if(person.tastes){extra.append(el('h3','section-title',ft('favorites')));const tabs=el('div','taste-tabs');for(const [value,label] of [[0,'love'],[2,'like'],[8,'neutral'],[4,'dislike'],[6,'hate'],[7,'special']]){const button=el('button','',ft(label));button.setAttribute('aria-pressed',String(giftTaste===value));button.onclick=()=>{giftTaste=value;giftLimit=12;extendProfile();};tabs.append(button);}extra.append(tabs);const gifts=[],byName=new Map();for(const item of db[lang].items.filter(item=>person.tastes[item.id]===giftTaste)){const same=byName.get(item.name);if(same)same.push(item);else{const group=[item];byName.set(item.name,group);gifts.push(group);}}const grid=el('div','gift-grid');
// Items that share a name (white and brown eggs, milk colours) are one entry with both icons.
for(const group of gifts.slice(0,giftLimit)){const item=group[0],button=el('button');if(group.length>1){const pair=el('span','gift-variants');for(const v of group.slice(0,2))pair.append(img(icons.get(v.id)||v.icon));button.append(pair);}else button.append(img(icons.get(item.id)||item.icon));button.append(el('span','',item.name));button.onclick=()=>{window.ThorNav.open('manual',{guideId:item.id,profile:true});};grid.append(button);}extra.append(grid);if(gifts.length>12){const more=el('button','gift-more',ft(giftLimit<gifts.length?'more':'less')+` (${gifts.length})`);more.onclick=()=>{giftLimit=giftLimit<gifts.length?giftLimit+24:12;extendProfile();};extra.append(more);}}});
 story(person);
}
// Part of the Community relations on a villager's profile. Villagers the social tab never shows
// are left out; ones not met yet stay "???" while undiscovered info is hidden.
const KIN={zh:{parent:'父母',sibling:'兄弟姐妹',spouse:'配偶',child:'子女',grandparent:'祖父母',grandchild:'孙辈',halfSibling:'同父异母/同母异父',stepParent:'继父母',stepChild:'继子女',greatGrandparent:'曾祖父母',greatGrandchild:'曾孙辈',parentInLaw:'岳父母/公婆',siblingInLaw:'姻亲兄弟姐妹',childInLaw:'女婿/儿媳',aunt:'阿姨/姑姑',uncle:'叔伯/舅舅',niece:'侄女/外甥女',nephew:'侄子/外甥',godparent:'教父母',godchild:'教子女',cousin:'表亲',friend:'朋友',warTorn:'战争中相识'},
 en:{parent:'Parent',sibling:'Sibling',spouse:'Spouse',child:'Child',grandparent:'Grandparent',grandchild:'Grandchild',halfSibling:'Half-sibling',stepParent:'Step-parent',stepChild:'Step-child',greatGrandparent:'Great-grandparent',greatGrandchild:'Great-grandchild',parentInLaw:'Parent-in-law',siblingInLaw:'Sibling-in-law',childInLaw:'Child-in-law',aunt:'Aunt',uncle:'Uncle',niece:'Niece',nephew:'Nephew',godparent:'Godparent',godchild:'Godchild',cousin:'Cousin',friend:'Friend',warTorn:'Met in the war'}};
function relationsBlock(person){const rows=(person.relations||[]).filter(r=>window.Spoiler?.visible(r.id)!==false);if(!rows.length)return null;const list=el('div','gift-people gift-faces kin-list');
 for(const r of rows){const other=db[lang].people.find(p=>p.id===r.id),secret=!!window.Spoiler?.hides(r.id),b=el('button');b.type='button';b.dataset.kin=r.id;
  const copy=el('span','kin-copy');copy.append(el('strong','',secret?Spoiler.text('unknown'):other?.name||r.id),el('small','kin-kind',(KIN[lang]||KIN.en)[r.kind]||r.kind));b.append(secret?Spoiler.portrait('kin-face'):PortraitImages.person(other||{id:r.id,runtime:true}),copy);
  b.disabled=!other;b.onclick=()=>visitResident(r.id);list.append(b);}
 return list;}
// Gift tastes the game has revealed (spoiler mode), grouped like the in-game profile.
function revealedTastes(found){const box=el('div','revealed-tastes'),kinds=['love','like','neutral','dislike','hate'].filter(k=>found[k]?.length);
 if(!kinds.length){box.append(el('p','revealed-none',Spoiler.text('noneRevealed')));return box;}
 for(const kind of kinds){const row=el('div','revealed-row'),grid=el('div','gift-grid revealed-grid');row.append(el('small','revealed-kind',(lang==='zh'?{love:'最爱',like:'喜欢',neutral:'一般',dislike:'不喜欢',hate:'讨厌'}:{love:'Loves',like:'Likes',neutral:'Neutral',dislike:'Dislikes',hate:'Hates'})[kind]));
  for(const id of found[kind]){const item=db[lang].items.find(i=>i.id===id),b=el('button');b.type='button';b.append(img(icons.get(id)||item?.icon||'art/tab-manual.png'),el('span','',item?.name||id));b.onclick=()=>window.ThorNav.open('manual',{guideId:id,profile:true});grid.append(b);}
  row.append(grid);box.append(row);}
 return box;}
function giftFaces(people){const list=el('div','gift-people gift-faces');for(const person of people){const b=el('button');b.append(PortraitImages.person(person),el('span','',person.name));b.onclick=()=>visitResident(person.id);list.append(b);}return list;}
function extendGuide(){const v=db?.[lang].items.find(i=>i.id===guideId);if(!v||!$('manual').classList.contains('profile')||window.Spoiler?.itemKnown(v.id)===false)return;if($('guide-detail').querySelector('.guide-extra'))return;const extra=el('div','guide-extra');if(v.energy||v.health){const recovery=el('div','guide-recovery');for(const kind of ['energy','health'])if(Number.isFinite(v[kind]))recovery.append(itemStat(kind,v[kind],ft(kind),true));extra.append(recovery);}guideQuality(v);
 // Who loves / likes it: a compact three-column face list with a head count.
 if(window.Spoiler?.tastesFolded('item:'+v.id)){for(const label of ['love','like']){const fans=db[lang].people.filter(p=>p.revealed?.[label]?.includes(v.id)&&Spoiler.visible(p.id)&&!Spoiler.hides(p.id));if(fans.length)extra.append((h=>(h.append(withCount(ft(label),fans.length)),h))(el('h3','section-title')),giftFaces(fans));}
  if(db[lang].people.some(p=>[0,2,7].includes(p.tastes?.[v.id])))extra.append(Spoiler.gate('item:'+v.id,'revealWho'));}
 else for(const [taste,label] of [[0,'love'],[2,'like'],[7,'special']]){const people=db[lang].people.filter(p=>p.tastes?.[v.id]===taste&&!window.Spoiler?.hides(p.id));if(!people.length)continue;extra.append((h=>(h.append(withCount(ft(label),people.length)),h))(el('h3','section-title')));const list=el('div','gift-people gift-faces');for(const person of people){const button=el('button');button.append(PortraitImages.person(person),el('span','',person.name));button.onclick=()=>visitResident(person.id);list.append(button);}extra.append(list);}
 if(window.StardewWiki){const wiki=el('button','guide-wiki');wiki.type='button';wiki.append(img(icons.get('(O)SkillBook_0')||db[lang].items.find(i=>i.id==='(O)SkillBook_0')?.icon||'art/icon-manual.png'),el('span','',lang==='zh'?'在 Wiki 查看':'Open in the wiki'));wiki.onclick=()=>StardewWiki.openSearch(v.name);extra.append(wiki);}
 $('guide-detail').append(extra);}
// Silver / gold / iridium sell prices (Object.sellToStorePrice: ×1.25, ×1.5, ×2, floored) for
// things that come in qualities; appended to the base price row.
const qualityCategories=new Set(['Forage','Vegetable','Fruit','Fish','Flower','Animal Product']),qualityIds=new Set(['(O)430','(O)348','(O)424','(O)426','(O)346','(O)303','(O)459']);
function guideQuality(v){const row=$('guide-detail').querySelector('.guide-price'),en=db.en?.items.find(i=>i.id===v.id);if(!row||!(v.price>0)||!(qualityIds.has(v.id)||qualityCategories.has(en?.category)))return;
 for(const [q,m,zh,enName] of [['silver',1.25,'银星','Silver'],['gold',1.5,'金星','Gold'],['iridium',2,'铱星','Iridium']]){const n=el('span','item-stat item-stat-quality'),price=Math.floor(v.price*m);n.title=(lang==='zh'?zh:enName)+' '+price;n.setAttribute('aria-label',n.title);n.append(img('art/quality-'+q+'.png'),el('strong','',String(price)));row.append(n);}row.classList.add('has-quality');}
const originalPeople=renderPeople;renderPeople=function(...args){originalPeople(...args);extendProfile();};const originalGuide=renderGuide;renderGuide=function(...args){originalGuide(...args);const q=$('item-search').value.trim().toLowerCase(),category=$('category-filter').value,total=db?.[lang].items.filter(i=>(!q||(i.name+' '+i.id).toLowerCase().includes(q))&&(!category||catalogCategory(i)===category)).length||0;catalogMore.hidden=$('manual').classList.contains('profile')||total<=(window.catalogLimit||90);catalogMore.textContent=ft('more')+` (${Math.min(total,window.catalogLimit||90)} / ${total})`;extendGuide();};
const originalMap=renderMap;renderMap=function(){originalMap();renderLiveMap(true);};
const mapState=el('small','map-state');mapState.id='map-state';$('map-fit').before(mapState);
// Mod regions only report an id (e.g. Custom_CrimsonBadlands); show it as words, not a code.
// A map pin follows its group in place: who shares it, its picture and the count change without
// rebuilding it (residents walking in and out of clusters used to rebuild pins many times a second).
function syncPin(b,group,left,top){const p=group[0];b._group=group;b.style.left=left;b.style.top=top;
 const title=group.map(q=>q.name).join(' · ');if(b.title!==title){b.title=title;b.setAttribute('aria-label',title);}
 const face=b.querySelector(':scope>img,:scope>.map-avatar-pending');
 if(p.image){if(face?.tagName==='IMG'){if(face.getAttribute('src')!==p.image)face.src=p.image;}else{const i=img(p.image);if(face)face.replaceWith(i);else b.prepend(i);}}
 else if(!face||face.tagName==='IMG'){const dot=el('span','map-avatar-pending');dot.setAttribute('aria-hidden','true');if(face)face.replaceWith(dot);else b.prepend(dot);}
 const count=group.length>1?String(group.length):'';if(b.dataset.count!==count){b.dataset.count=count;b.querySelector(':scope>.map-cluster-digits')?.remove();if(count){const n=window.StackDigits?.create?window.StackDigits.create(group.length):el('span','',count);n.classList.add('map-cluster-digits');n.setAttribute('aria-hidden','true');b.append(n);}}}
function regionName(id){return window.MapNames.region(id,lang);}
const regions=el('select','map-regions');regions.setAttribute('aria-label','Map region');$('map-area').after(regions);regions.onchange=()=>{currentRegion=regions.value;mapSignature='';renderLiveMap(true);};
const regionWrap=el('div','game-control select-control map-region-control'),regionLabel=el('span','control-label');regionLabel.setAttribute('aria-hidden','true');regions.before(regionWrap);regionWrap.append(regions,regionLabel);controls.push({input:regions,label:regionLabel});
$('map-viewport').addEventListener('mapscalechange',()=>renderLiveMap());
const clusterPicker=el('div','map-cluster-picker');clusterPicker.hidden=true;$('map-viewport').append(clusterPicker);
function visitResident(id){clusterPicker.hidden=true;window.ThorNav.open('people',{personId:id,profile:true});}
function renderLiveMap(force=false){
 const tracking=window.TrackingDisplay?TrackingDisplay.read():(model.status(performance.now())==='ready'?model.snapshot?.tracking:null);
 if(!tracking?.maps?.length){regionWrap.hidden=true;$('map-area').hidden=false;mapState.hidden=false;put('map-state',words[lang].offline);if(mapSignature!=='offline'){mapSignature='offline';delete $('map-pins').dataset.liveKey;clusterPicker.hidden=true;document.querySelectorAll('.map-live-layer').forEach(n=>n.remove());$('map-image').hidden=false;originalMap();window.MapView?.setSize(300,180);}return;}
 regionWrap.hidden=tracking.maps.length<2;$('map-area').hidden=!regionWrap.hidden;mapState.hidden=!window.TrackingDisplay?.pending();if(!mapState.hidden)put('map-state',lang==='zh'?'正在更新位置…':'Updating positions…');const open=tracking.maps.filter(m=>window.Spoiler?.mapOpen(m.id)!==false),maps=open.length?open:tracking.maps,map=maps.find(m=>m.id===currentRegion)||maps.find(m=>m.id===tracking.player?.region)||maps[0];currentRegion=map.id;const key=JSON.stringify([map,lang,maps.map(m=>m.id)]);
 if(mapSignature!==key||force){mapSignature=key;options(regions,maps.map(m=>[m.id,regionName(m.id)]));regions.value=map.id;syncControls();document.querySelectorAll('.map-live-layer').forEach(n=>n.remove());$('map-image').hidden=true;for(const l of map.layers){const layer=img(l.image);layer.className='map-live-layer';layer.style.left=l.x/map.width*100+'%';layer.style.top=l.y/map.height*100+'%';layer.style.width=l.width/map.width*100+'%';layer.style.height=l.height/map.height*100+'%';$('map-canvas').insertBefore(layer,$('map-pins'));}window.MapView?.setSize(map.width,map.height);}
 put('map-area',regionName(map.id));$('map').querySelector('.detail').hidden=true;
 // Updating positions does not reset the viewport or reload textures.
 const markers=tracking.residents.slice().sort((a,b)=>a.id.localeCompare(b.id)).filter(p=>p.position?.region===map.id&&!window.Spoiler?.hides(p.id)&&window.Spoiler?.visible(p.id)!==false).map(p=>({id:p.id,name:p.name,image:p.mapAvatar,position:p.position}));if(tracking.player?.region===map.id)markers.push({id:'__player',name:ft('player'),image:tracking.playerAvatar,position:tracking.player});
 const mapScale=(window.MapView?.getState().w||map.width)/map.width;const radius=24/Math.max(.1,mapScale);const markerKey=JSON.stringify([markers,Math.round(mapScale*20)]);if($('map-pins').dataset.liveKey!==markerKey||force){$('map-pins').dataset.liveKey=markerKey;const groups=[];for(const p of markers){let g=p.id==='__player'?null:groups.find(g=>g[0].id!=='__player'&&Math.hypot(g[0].position.x-p.position.x,g[0].position.y-p.position.y)<radius);if(g)g.push(p);else groups.push([p]);}const place=(b,group)=>syncPin(b,group,group[0].position.x/map.width*100+'%',group[0].position.y/map.height*100+'%');ViewNodes.sync($('map-pins'),groups,{id:group=>group[0].id,key:group=>lang,update:place,create:group=>{const b=el('button','map-pin live-pin'+(group[0].id==='__player'?' player-pin':''));b.dataset.resident=group[0].id;place(b,group);b.onclick=()=>{const group=b._group,p=group[0];if(p.id==='__player')return;if(group.length===1){visitResident(p.id);return;}clusterPicker.replaceChildren(...group.map(person=>{const button=el('button');if(person.image)button.append(img(person.image));button.append(el('span','',person.name));button.onclick=()=>visitResident(person.id);return button;}));const close=el('button','',ft('cancel'));close.onclick=()=>clusterPicker.hidden=true;clusterPicker.append(close);window.LocalMap?.decoratePicker(clusterPicker,group);clusterPicker.hidden=false;};return b;}});}
}
Object.assign(words.zh,{readonly:'',bagHint:'',detailNote:'',about:'独立下屏伴侣，本地连接',connectHelp:'游戏中加载配套模组后自动连接。物品操作由游戏确认。'});Object.assign(words.en,{readonly:'',bagHint:'',detailNote:'',about:'Independent companion, local connection',connectHelp:'Connects to the paired mod. The game confirms every inventory operation.'});
translate();
Object.assign(featureWords.zh,{'no-world':'等待进入存档',stale:'连接过期，操作已暂停',disconnected:'等待连接游戏',transition:'正在切换存档',amount:'数量已变化，请重试',busy:'正在处理上一项操作',replay:'请求已处理，请重试',invalid:'操作参数无效',multiplayer:'联机控制尚未开放',title:'等待进入存档',error:'游戏读取异常'});Object.assign(featureWords.en,{'no-world':'Waiting for a save',stale:'Stale connection; controls paused',disconnected:'Waiting for the game',transition:'Changing save',amount:'Quantity changed; try again',busy:'Another operation is pending',replay:'Request already processed; retry',invalid:'Invalid operation',multiplayer:'Multiplayer controls unavailable',title:'Waiting for a save',error:'Game read error'});

// Bag pages: a row of original level pips under the grid (tap one, or hover a dragged item
// over one); no swipe, since pressing an item and dragging moves it. The title bar keeps
// only the title and count.
// Single items show no "× 1", as the game never draws a 1.
(()=>{const slotsEl=$('slots'),bottom=document.querySelector('#bag .inventory-bottom');if(!slotsEl||!bottom)return;
 const dots=el('div','bag-dots');dots.setAttribute('role','group');slotsEl.after(dots);
 const pages=()=>Math.max(1,Math.ceil((model.snapshot?.bag?.slots?.length||0)/12));
 function go(p){const n=pages(),next=Math.max(0,Math.min(n-1,p));if(next===bagPage)return;bagPage=next;window.ThorSound?.play?.('smallSelect');render();}
 function sync(){const n=pages(),show=page==='bag'&&!bottom.hidden&&n>1;dots.hidden=!show;
  const key=show?n+'/'+bagPage+'/'+lang:'';if(dots.dataset.key!==key){dots.dataset.key=key;dots.replaceChildren(...(show?Array.from({length:n},(_,i)=>{const b=el('button','bag-dot');b.type='button';b.setAttribute('aria-label',(lang==='zh'?'第 ':'Page ')+(i+1)+(lang==='zh'?' 页':'')+' / '+n);b.setAttribute('aria-current',String(i===bagPage));b.append(img('art/skill-'+(i===bagPage?'full':'empty')+'.png'));b.dataset.page=i;b.onclick=()=>go(i);return b;}):[]));}
  const v=model.snapshot?.bag?.slots?.[selected];$('detail-count').hidden=!(v&&v.stack>1);}
 const previous=render;render=function(){previous();sync();};sync();})();
// The item category rides on the name row (like a tag) instead of taking a line of its own.
(()=>{const name=$('name'),category=$('item-category');if(name&&category&&category.previousElementSibling!==name)name.after(category);})();
