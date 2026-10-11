(function(root){
 'use strict';
 const protocol='stardew-thor.readonly.v1';
 class Model {
  constructor(){this.modVersion=null;this.busy=null;this.dropped=[];this.snapshot=null;this.received=0;this.age=Infinity;this.online=false;this.retired=new Set();this.error='';this.failureKind=null;}
  accept(e,now){
   if(!e||e.protocol!==protocol||!e.snapshot||!Number.isSafeInteger(e.gameAgeMs)||e.gameAgeMs<0)throw Error('protocol');
   const s=e.snapshot;
   const asset=v=>typeof v==='string'&&/^\/bridge\/asset\/[0-9a-f]{64}$/.test(v);
   const text=(v,n)=>typeof v==='string'&&v.length<=n;
   const integer=(v,min=0,max=2147483647)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
   const optionalId=v=>v==null||text(v,160);
   const list=(v,max,check)=>Array.isArray(v)&&v.length<=max&&v.every(x=>x&&check(x));
   const png=(v,n=32768)=>typeof v==='string'&&v.length<=n&&/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(v);
   // Core: the envelope and the world. If these are wrong the whole reply cannot be trusted.
   if(typeof s.session!=='string'||!s.session||s.session.length>64||!Number.isSafeInteger(s.seq)||s.seq<1||!Number.isSafeInteger(s.revision)||s.revision<0||!['title','transition','ready','multiplayer-unverified','error'].includes(s.state))throw Error('envelope');
   if(s.world!=null){const w=s.world;if(!w||!['money','day','year','time'].every(k=>Number.isSafeInteger(w[k])&&w[k]>=0)||w.day<1||w.day>28||w.time>2800||w.time%100>59||!['spring','summer','fall','winter'].includes(w.season)||typeof w.location!=='string'||w.location.length>240||typeof w.farmer!=='string'||w.farmer.length>120)throw Error('world');}
   // Every other part stands alone: a malformed part is removed (and noted in `dropped`) and the
   // rest of the snapshot is still shown. Nothing that failed a check is ever kept.
   const dropped=[],part=(name,ok,remove)=>{let good=false;try{good=!!ok();}catch{good=false;}if(!good){remove();dropped.push(name);}return good;};
   const busy=e.busy==null?null:e.busy==='saving'?'saving':(dropped.push('busy'),null);
   if(s.world!=null){const w=s.world;
    part('world-vitals',()=>['health','maxHealth','maxStamina'].every(k=>w[k]==null||integer(w[k],0,1000000))&&(w.stamina==null||Number.isFinite(w.stamina)&&w.stamina>=-1000000&&w.stamina<=1000000),()=>{for(const k of ['health','maxHealth','stamina','maxStamina'])delete w[k];});
    part('world-weather',()=>w.weather==null||['wedding','festival','sun','wind','rain','storm','snow','green-rain'].includes(w.weather),()=>{delete w.weather;});}
   if(s.journal!=null&&part('journal',()=>{const j=s.journal,season=v=>['spring','summer','fall','winter'].includes(v),coords=v=>integer(v.x,-10000,10000)&&integer(v.y,-10000,10000);
     return integer(j.collectedAt,0,Number.MAX_SAFE_INTEGER)&&list(j.calendar,256,c=>text(c.id,160)&&['birthday','festival','bookseller'].includes(c.kind)&&season(c.season)&&integer(c.day,1,28)&&text(c.name,240)&&optionalId(c.npcId))&&
      list(j.quests,64,q=>text(q.id,160)&&['quest','order'].includes(q.kind)&&text(q.title,240)&&text(q.description,4000)&&typeof q.ready==='boolean'&&(q.moneyReward==null||integer(q.moneyReward,0,2147483647))&&(q.rewardText==null||text(q.rewardText,400))&&(q.targetNpc==null||text(q.targetNpc,120))&&(q.daysLeft==null||integer(q.daysLeft,0,9999))&&list(q.objectives,16,o=>text(o.text,1000)&&(o.current==null||integer(o.current))&&(o.required==null||integer(o.required))))&&
      list(j.recipes,256,r=>text(r.id,160)&&['cooking','crafting'].includes(r.kind)&&text(r.name,240)&&text(r.outputId,160)&&integer(r.quantity,1)&&integer(r.craftable)&&(r.description==null||text(r.description,1200))&&list(r.ingredients,12,i=>text(i.id,160)&&text(i.name,240)&&integer(i.needed,1)&&integer(i.owned)))&&
      list(j.equipment,8,e=>text(e.slot,40)&&text(e.id,160)&&text(e.name,240)&&text(e.description,4000)&&list(e.fields,16,f=>text(f.key,40)&&text(f.value,1000)))&&
      list(j.chores,64,c=>text(c.locationId,160)&&text(c.location,240)&&['cropsReady','cropsDry','machinesReady','animalsUnpetted'].every(k=>integer(c[k]))&&list(c.details,12,d=>text(d.kind,40)&&text(d.id,160)&&text(d.name,240)&&coords(d)))&&
      j.scan&&['scanning','ready','limited'].includes(j.scan.state)&&integer(j.scan.completed)&&integer(j.scan.total)&&j.scan.completed<=j.scan.total&&integer(j.scan.startedAt,0,Number.MAX_SAFE_INTEGER)&&(j.scan.completedAt==null||integer(j.scan.completedAt,0,Number.MAX_SAFE_INTEGER))&&list(j.limited,16,k=>text(k,80));},()=>{s.journal=null;})){
    const j=s.journal;
    const claim=q=>(q.claimKey==null||(typeof q.claimKey==='string'&&/^[a-f0-9]{64}$/.test(q.claimKey)&&q.ready&&!q.archived&&q.moneyReward>0))&&(q.archived==null||typeof q.archived==='boolean');
    // Without a trustworthy claim key a quest reward simply cannot be claimed from here.
    part('quest-claim',()=>j.quests.every(claim),()=>{for(const q of j.quests){delete q.claimKey;if(typeof q.archived!=='boolean')delete q.archived;}});
    if(j.completedQuests!=null)part('quest-history',()=>list(j.completedQuests,48,q=>claim(q)&&q.archived===true&&q.ready===true&&q.claimKey==null&&text(q.id,160)&&['quest','order'].includes(q.kind)&&text(q.title,240)&&text(q.description,4000)&&list(q.objectives,16,o=>text(o.text,1000))&&(q.moneyReward==null||integer(q.moneyReward))&&(q.rewardText==null||text(q.rewardText,400))&&(q.targetNpc==null||text(q.targetNpc,120))),()=>{j.completedQuests=null;});
    if(j.farmVersion!=null)part('farm-version',()=>integer(j.farmVersion,0,Number.MAX_SAFE_INTEGER),()=>{j.farmVersion=null;});
    if(j.character!=null&&part('character',()=>{const c=j.character;return list(c.skills,5,k=>integer(k.id,0,4)&&integer(k.level,0,10)&&integer(k.effectiveLevel,0,1000)&&integer(k.experience)&&(k.effect==null||text(k.effect,1200))&&(integer(k.levelStart)||(k.level===0&&k.levelStart===-1))&&(k.nextLevel==null||integer(k.nextLevel,k.levelStart+1))&&list(k.professions,2,p=>integer(p.id,0,29)&&[5,10].includes(p.level)&&text(p.name,240)&&text(p.description,1200)))&&c.skills.length===5&&new Set(c.skills.map(k=>k.id)).size===5&&integer(c.masteryLevel,0,5)&&integer(c.masteryExperience,0,4294967295);},()=>{j.character=null;})){
     const c=j.character;
     if(c.customSkills!=null)part('custom-skills',()=>list(c.customSkills,8,k=>text(k.id,160)&&k.id.length>0&&text(k.name,240)&&integer(k.level,0,1000)&&integer(k.totalLevel,-1000,1000)&&integer(k.experience)&&(k.icon==null||asset(k.icon))&&list(k.professions,32,p=>text(p,160)&&p.length>0))&&new Set(c.customSkills.map(k=>k.id.toLowerCase())).size===c.customSkills.length,()=>{c.customSkills=null;});
     // Vanilla uses -1 for level zero; expose a zero-based XP interval to the UI.
     for(const skill of c.skills)if(skill.level===0&&skill.levelStart===-1)skill.levelStart=0;}
    if(j.board!=null)part('quest-board',()=>{const b=j.board;return ['empty','available','accepted','unavailable'].includes(b.status)&&(b.key==null||typeof b.key==='string'&&/^[a-f0-9]{64}$/.test(b.key))&&text(b.title,240)&&text(b.description,4000)&&text(b.objective,1000)&&optionalId(b.targetNpc)&&integer(b.moneyReward)&&text(b.rewardText,1000)&&(b.daysLeft==null||integer(b.daysLeft,0,9999))&&typeof b.canAccept==='boolean'&&['ready','board-empty','board-accepted','board-unavailable'].includes(b.reason)&&(!b.canAccept||b.status==='available'&&!!b.key&&b.reason==='ready');},()=>{j.board=null;});
    // Without trustworthy craft counts, recipes are still listed but cannot be crafted from here.
    part('crafting',()=>!j.recipes.some(r=>(r.maxCrafts!=null&&!integer(r.maxCrafts,0,99))||(r.craftReason!=null&&!['ready','materials','inventory-full','recipe-unknown','recipe-unsupported','cooking-station'].includes(r.craftReason))||(r.maxCrafts>0&&(r.kind!=='crafting'||r.craftReason!=='ready'))),()=>{for(const r of j.recipes){delete r.maxCrafts;delete r.craftReason;}});
   }
   // Control: without it (or one capability) the matching commands are simply unavailable.
   if(s.control!=null&&part('control',()=>typeof s.control.enabled==='boolean'&&typeof s.control.reason==='string'&&Number.isInteger(s.control.activeSlot)&&s.control.activeSlot>=-1&&s.control.activeSlot<144,()=>{s.control=null;}))
    for(const k of ['emptySelection','crafting','questBoard','toolbar','toolbarHidden','questRewards','chest','modConfig'])if(s.control[k]!=null)part('control-capability',()=>typeof s.control[k]==='boolean',()=>{delete s.control[k];});
   // The open chest / shop / fishing / mine / night scene; optional mine and night extras on their own.
   if(s.scene!=null&&part('scene',()=>{const sc=s.scene,iconOk=v=>v==null||(typeof v==='string'&&v.length<=32768&&v.startsWith('data:image/png;base64,')),num=v=>typeof v==='number'&&Number.isFinite(v),fi=sc.fishing,mi=sc.mine,ni=sc.night;
     return ['chest','shop','fishing','mine','night'].includes(sc.kind)&&text(sc.key,80)&&text(sc.name,160)&&integer(sc.capacity,0,144)&&typeof sc.truncated==='boolean'&&integer(sc.currency,0,16)&&Array.isArray(sc.items)&&sc.items.length<=144&&
      sc.items.every(it=>it==null||integer(it.slot,0,143)&&text(it.id,160)&&text(it.name,160)&&integer(it.stack,1,999999)&&integer(it.quality,0,4)&&iconOk(it.icon)&&text(it.key,64)&&integer(it.price,0)&&integer(it.stock,-1,99999)&&optionalId(it.tradeId)&&integer(it.tradeCount,0,9999)&&typeof it.bundle==='boolean'&&typeof it.known==='boolean')&&
      (fi==null||['cast','wait','bite','reel','caught'].includes(fi.phase)&&optionalId(fi.baitId)&&(fi.baitName==null||text(fi.baitName,160))&&integer(fi.baitCount,0,9999)&&optionalId(fi.tackleId)&&(fi.tackleName==null||text(fi.tackleName,160))&&integer(fi.tackleUses,0,999)&&integer(fi.tackleMax,0,999)&&optionalId(fi.fishId)&&(fi.fishName==null||text(fi.fishName,160))&&integer(fi.difficulty,0,1000)&&num(fi.progress)&&fi.progress>=0&&fi.progress<=1&&['treasure','treasureCaught','perfect','boss','fishKnown'].every(k=>typeof fi[k]==='boolean'))&&
      (mi==null||['mines','skull','quarry','volcano'].includes(mi.area)&&integer(mi.level,0,100000)&&integer(mi.floor,-100,100000)&&integer(mi.monsters,0,10000)&&integer(mi.lowest,0,100000)&&integer(mi.stones,0,100000)&&typeof mi.ladder==='boolean'&&typeof mi.shaft==='boolean'&&typeof mi.mustKill==='boolean'&&num(mi.luck)&&Math.abs(mi.luck)<=1)&&
      (ni==null||['sleeping','shipping','levelup','saving','waking'].includes(ni.phase)&&integer(ni.total,0)&&integer(ni.count,0)&&(ni.weatherTomorrow==null||text(ni.weatherTomorrow,40)));},()=>{s.scene=null;})){
    const mi=s.scene.mine,n=s.scene.night;
    if(mi){if(mi.monsterTypes!=null)part('scene-monsters',()=>list(mi.monsterTypes,16,m=>text(m.id,160)&&m.id.length>0&&text(m.name,240)&&integer(m.count,1,1024)&&(m.icon==null||asset(m.icon))&&(m.health==null||integer(m.health))&&optionalId(m.slayer)&&optionalId(m.mod)&&Array.isArray(m.drops)&&m.drops.length<=16&&m.drops.every(id=>text(id,160)&&/^\([A-Za-z]+\)[^\s]+$/.test(id))&&new Set(m.drops).size===m.drops.length)&&new Set(mi.monsterTypes.map(m=>m.id)).size===mi.monsterTypes.length,()=>{delete mi.monsterTypes;});
     if(mi.floorKind!=null)part('scene-floor',()=>['normal','infested','treasure','dino','mushroom','quarry','skull','volcano'].includes(mi.floorKind),()=>{delete mi.floorKind;});
     if(mi.limited!=null)part('scene-mine-limited',()=>Array.isArray(mi.limited)&&mi.limited.length<=16&&mi.limited.every(v=>text(v,80)),()=>{delete mi.limited;});}
    if(n){if(n.skills!=null)part('night-skills',()=>list(n.skills,13,k=>text(k.id,160)&&k.id.length>0&&integer(k.experience)&&integer(k.startLevel,0,1000)&&integer(k.level,0,1000)&&(k.pendingProfession==null||typeof k.pendingProfession==='boolean'))&&new Set(n.skills.map(k=>k.id)).size===n.skills.length,()=>{delete n.skills;});
     if(n.friends!=null)part('night-friends',()=>integer(n.friends.talked,0,512)&&integer(n.friends.gifted,0,512),()=>{delete n.friends;});
     if(n.money!=null)part('night-money',()=>integer(n.money),()=>{delete n.money;});
     // The day the night ends (the game moves its date forward early in the night).
     if(n.season!=null||n.day!=null||n.year!=null)part('night-date',()=>['spring','summer','fall','winter'].includes(n.season)&&integer(n.day,1,28)&&integer(n.year,1,100000),()=>{delete n.season;delete n.day;delete n.year;});}
   }
   if(s.night!=null)part('night',()=>typeof s.night==='boolean',()=>{s.night=null;});
   if(s.context!=null)part('context',()=>['chest','shop','fishing','mine','dialogue','night'].includes(s.context),()=>{s.context=null;});
   // The context card: a bad card becomes "unable to read the target", never a guessed one.
   if(s.targetState!=null)part('target-state',()=>['ready','empty','busy','error','unavailable'].includes(s.targetState),()=>{s.targetState='error';s.target=null;});
   if(s.target!=null)part('target',()=>{const t=s.target;
     return optionalId(t.itemId)&&optionalId(t.outputId)&&(t.outputStack==null||integer(t.outputStack,1))&&s.targetState==='ready'&&['ready','multiplayer-unverified'].includes(s.state)&&['npc','crop','machine','animal','object'].includes(t.kind)&&text(t.id,240)&&!!t.id&&text(t.name,240)&&text(t.location,240)&&[t.x,t.y].every(n=>Number.isInteger(n)&&Math.abs(n)<=10000)&&(t.icon==null||asset(t.icon)||png(t.icon))&&Array.isArray(t.fields)&&t.fields.length<=16&&t.fields.every(f=>f&&text(f.key,40)&&text(f.value,1000))&&Array.isArray(t.gifts)&&t.gifts.length<=64&&t.gifts.every(g=>g&&text(g.id,160)&&text(g.name,240)&&[0,2,4,6,7,8].includes(g.taste))&&typeof t.giftsLimited==='boolean'&&
      (t.social==null||t.kind==='npc'&&Number.isInteger(t.social.points)&&Number.isInteger(t.social.hearts)&&t.social.hearts>=0&&t.social.hearts<=20&&Number.isInteger(t.social.maxHearts)&&t.social.maxHearts>=1&&t.social.maxHearts<=20&&typeof t.social.talkedToday==='boolean'&&['giftsToday','giftsThisWeek'].every(k=>Number.isInteger(t.social[k])&&t.social[k]>=0&&t.social[k]<=100));},()=>{s.target=null;s.targetState='error';});
   else if(s.targetState==='ready'){s.targetState='error';dropped.push('target-missing');}
   // Map tracking: a bad resident or map is left out; a bad frame drops tracking.
   const point=p=>p===null||(p&&typeof p.region==='string'&&p.region.length<=160&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.abs(p.x)<=4096&&Math.abs(p.y)<=4096);
   if(s.tracking!=null&&part('tracking',()=>{const t=s.tracking;return point(t.player)&&(t.playerAvatar==null||asset(t.playerAvatar))&&(t.playerBody==null||asset(t.playerBody))&&Array.isArray(t.residents)&&t.residents.length<=192&&Array.isArray(t.maps)&&t.maps.length<=16;},()=>{s.tracking=null;})){
    const t=s.tracking,resident=p=>p&&typeof p.id==='string'&&typeof p.name==='string'&&typeof p.location==='string'&&point(p.position)&&(p.portrait==null||asset(p.portrait))&&(p.mapAvatar==null||asset(p.mapAvatar))&&(p.schedule==null||Array.isArray(p.schedule)&&p.schedule.length<=32&&p.schedule.every(s=>s&&Number.isInteger(s.time)&&typeof s.location==='string'));
    const map=m=>m&&typeof m.id==='string'&&[m.width,m.height].every(n=>Number.isInteger(n)&&n>0&&n<=4096)&&Array.isArray(m.layers)&&m.layers.length<=64&&m.layers.every(l=>l&&asset(l.image)&&[l.x,l.y,l.width,l.height].every(Number.isFinite));
    const residents=t.residents.filter(resident);if(residents.length!==t.residents.length){t.residents=residents;dropped.push('resident');}
    const maps=t.maps.filter(map);if(maps.length!==t.maps.length){t.maps=maps;dropped.push('map');}}
   // Friendship rows: a malformed or duplicated villager is left out.
   if(s.social!=null&&part('social',()=>Array.isArray(s.social)&&s.social.length<=192,()=>{s.social=null;})){const ids=new Set(),rows=s.social.filter(r=>{const ok=r&&typeof r.id==='string'&&r.id&&r.id.length<=160&&!ids.has(r.id)&&Number.isSafeInteger(r.points)&&Number.isInteger(r.hearts)&&r.hearts>=0&&r.hearts<=20&&Number.isInteger(r.maxHearts)&&r.maxHearts>=1&&r.maxHearts<=20&&['giftsThisWeek','giftsToday'].every(k=>Number.isInteger(r[k])&&r[k]>=0&&r[k]<=100)&&typeof r.talkedToday==='boolean'&&typeof r.relationship==='string'&&r.relationship.length<=80;if(ok)ids.add(r.id);return ok;});
    if(rows.length!==s.social.length){s.social=rows;dropped.push('social-row');}}
   // The backpack is all or nothing (never half a bag); a slot's optional extras can go on their own.
   if(s.bag!==null&&part('bag',()=>{const b=s.bag;return Number.isInteger(b.capacity)&&b.capacity>=0&&b.capacity<=144&&Array.isArray(b.slots)&&b.slots.length===b.capacity&&b.slots.every((v,i)=>v===null||v.slotIndex===i&&typeof v.id==='string'&&typeof v.name==='string'&&typeof v.description==='string'&&v.description.length<=4000&&Number.isInteger(v.stack)&&v.stack>=0&&Number.isInteger(v.quality)&&v.quality>=0&&(v.icon===null||png(v.icon)));},()=>{s.bag=null;})){
    const extras={stats:v=>list(v,16,s=>typeof s.icon==='string'&&/^[A-Za-z0-9]{0,40}$/.test(s.icon)&&text(s.text,200)&&(s.tone==null||['enchanted','negative','enchantment','secondary'].includes(s.tone))),categoryName:v=>text(v,120),categoryColor:v=>/^#[0-9a-f]{6}$/i.test(v),menuShadow:v=>typeof v==='boolean',canDrop:v=>typeof v==='boolean'};
    for(const v of s.bag.slots){if(!v)continue;for(const [k,ok] of Object.entries(extras))if(v[k]!=null&&!ok(v[k])){delete v[k];dropped.push('slot-'+k);}
     if(v.water!=null&&!(integer(v.water.capacity,1,1000000)&&integer(v.water.current,0,v.water.capacity)&&typeof v.water.bottomless==='boolean'&&typeof v.water.showGauge==='boolean')){delete v.water;dropped.push('slot-water');}}}
   if(this.retired.has(s.session))return false;
   if(this.snapshot?.session===s.session&&(s.seq<this.snapshot.seq||s.revision<this.snapshot.revision))return false;
   if(this.snapshot&&this.snapshot.session!==s.session){this.retired.add(this.snapshot.session);if(this.retired.size>32)this.retired.delete(this.retired.values().next().value);}
   this.snapshot=s;this.busy=busy;this.dropped=[...new Set(dropped)];this.received=now;this.age=e.gameAgeMs;this.online=true;this.error='';this.failureKind=null;
   // Older mods do not report a version; anything unexpected is dropped, never shown.
   this.modVersion=typeof e.modVersion==='string'&&/^[0-9A-Za-z.+-]{1,32}$/.test(e.modVersion)?e.modVersion:null;return true;
  }
  fail(reason,kind='transport'){this.online=false;this.busy=null;this.error=reason;this.failureKind=kind==='data'?'data':'transport';}
  // Stream heartbeat (architecture v2): nothing shown changed, but the game is alive. Refresh the
  // freshness clock, the saving flag and seq without re-validating the whole snapshot.
  touch(e,now){
   if(!this.snapshot||!e||typeof e!=='object'||!Number.isSafeInteger(e.gameAgeMs)||e.gameAgeMs<0)return false;
   if(e.busy!=null&&e.busy!=='saving')return false;
   if(Number.isSafeInteger(e.seq)&&e.seq>this.snapshot.seq)this.snapshot={...this.snapshot,seq:e.seq};
   this.received=now;this.age=e.gameAgeMs;this.busy=e.busy??null;this.online=true;this.error='';this.failureKind=null;return true;
  }
  status(now){if(!this.snapshot)return 'disconnected';if(!this.online||now-this.received>3500||this.busy!=='saving'&&now-this.received+this.age>3500)return 'stale';return this.snapshot.state;}
 }
 // On-demand farm report (/bridge/farm). Returns false for anything malformed or oversized.
 const farmKinds=['cropReady','cropDry','machine','grabber','animalPet','animalHarvest','animalProduct','hay','petBowl','fruitTree','cropTomorrow','cropWither','machineSoon'];
 Model.validFarm=function(r){
  const text=(v,n)=>typeof v==='string'&&v.length<=n,integer=(v,min=0,max=2147483647)=>Number.isSafeInteger(v)&&v>=min&&v<=max,bool=v=>typeof v==='boolean';
  const list=(v,max,check)=>Array.isArray(v)&&v.length<=max&&v.every(x=>x&&check(x));let tiles=0;
  const task=t=>farmKinds.includes(t.kind)&&text(t.id,160)&&text(t.name,240)&&integer(t.count,1,10000000)&&Array.isArray(t.tiles)&&t.tiles.length%2===0&&t.tiles.length<=1200&&(tiles+=t.tiles.length)<=16000&&t.tiles.every(v=>integer(v,-10000,10000))&&(t.extra==null||integer(t.extra,0,100000000))&&(t.minutes==null||integer(t.minutes,0,100000))&&(t.icon==null||text(t.icon,160));
  if(!r||!integer(r.version,0,Number.MAX_SAFE_INTEGER)||!integer(r.collectedAt,0,Number.MAX_SAFE_INTEGER)||!['ready','limited'].includes(r.state)||!list(r.limited,16,k=>text(k,80))||
   !list(r.places,128,p=>text(p.locationId,160)&&p.locationId.length>0&&text(p.location,240)&&list(p.tasks,256,task)))return false;
  const h=r.harvest;
  if(h!=null&&!(integer(h.year,1,99999)&&integer(h.season,0,3)&&integer(h.day,1,28)&&list(h.crops,256,c=>text(c.location,180)&&text(c.id,160)&&text(c.name,160)&&integer(c.days,-1,999)&&integer(c.count,1,10000000)&&integer(c.dry,0,c.count)&&integer(c.regrow,0,999))))return false;
  const pl=r.planner,season=v=>['spring','summer','fall','winter'].includes(v);
  if(pl!=null&&!(integer(pl.farmingLevel,0,100)&&bool(pl.agriculturist)&&bool(pl.tiller)&&Number.isFinite(pl.profitMargin)&&pl.profitMargin>0&&pl.profitMargin<=10&&
   list(pl.crops,256,c=>text(c.seedId,160)&&text(c.seedName,160)&&text(c.harvestId,160)&&text(c.harvestName,160)&&list(c.seasons,4,season)&&Array.isArray(c.phases)&&c.phases.length>0&&c.phases.length<=12&&c.phases.every(d=>integer(d,0,999))&&
    integer(c.regrow,-1,999)&&integer(c.minStack,1,999)&&integer(c.maxStack,1,999)&&Number.isFinite(c.maxPerLevel)&&c.maxPerLevel>=0&&c.maxPerLevel<=10&&Number.isFinite(c.extraChance)&&c.extraChance>=0&&c.extraChance<=1&&
    integer(c.seedPrice,0,1000000)&&integer(c.sellPrice,0,1000000)&&Number.isSafeInteger(c.category)&&bool(c.paddy)&&bool(c.trellis)&&(c.restricted==null||bool(c.restricted)))))return false;
  if(r.extras!=null&&!Model.validateFarmExtras(r.extras))return false;
  const o=r.outlook;if(o==null)return true;
  const m=o.merchant,sauce=o.sauce,tool=o.tool;
  return integer(o.daysLeft,0,27)&&['spring','summer','fall','winter'].includes(o.nextSeason)&&text(o.weatherTomorrow,40)&&(o.islandWeatherTomorrow==null||text(o.islandWeatherTomorrow,40))&&
   Number.isFinite(o.luck)&&Math.abs(o.luck)<=1&&integer(o.luckLevel,-2,2)&&text(o.luckText,600)&&integer(o.hay)&&integer(o.hayCapacity)&&
   (sauce==null||(text(sauce.key,160)&&text(sauce.name,160)&&text(sauce.outputId,160)&&bool(sauce.known)&&bool(sauce.today)&&bool(sauce.rerun)&&integer(sauce.inDays,0,6)))&&
   !!m&&bool(m.today)&&integer(m.nextInDays,0,28)&&(m.stockLimited==null||bool(m.stockLimited))&&list(m.stock,48,i=>text(i.id,160)&&text(i.name,160)&&integer(i.price)&&integer(i.stock,-1,9999)&&bool(i.bundle))&&
   (tool==null||(text(tool.id,160)&&text(tool.name,160)&&integer(tool.daysLeft,0,99)));
 };
 Model.validateFarmExtras=function(r){
  const text=(v,n)=>typeof v==='string'&&v.length<=n,num=(v,a=0,b=2147483647)=>Number.isSafeInteger(v)&&v>=a&&v<=b,bool=v=>typeof v==='boolean',nullable=(v,check)=>v==null||check(v);
  const state=v=>['ready','building','absent','unsupported','unavailable'].includes(v),list=(v,n,check)=>Array.isArray(v)&&v.length<=n&&v.every(x=>x!=null&&check(x));
  if(!r||!num(r.version,0,Number.MAX_SAFE_INTEGER)||!state(r.state)||!list(r.limited,16,k=>text(k,80)))return false;
  const j=r.junimos,f=r.family,b=r.playerBirthday;
  if(!j||!state(j.state)||!nullable(j.paidToday,bool)||!nullable(j.huts,v=>num(v,0,256))||!nullable(j.abilities,v=>list(v,32,k=>text(k,160)))||(j.state==='ready'&&(!bool(j.paidToday)||!num(j.huts,0,256)||!Array.isArray(j.abilities))))return false;
  if(!f||!state(f.state)||!['vanilla','mod'].includes(f.source)||!state(f.modState)||!nullable(f.spouse,v=>text(v,160))||!list(f.children,16,c=>text(c.name,160)&&nullable(c.birthday,v=>text(v,240))&&nullable(c.daysToGrow,v=>num(v,-1,1000000))))return false;
  if(!b||!state(b.state)||!nullable(b.season,v=>['spring','summer','fall','winter'].includes(v))||!nullable(b.day,v=>num(v,1,28))||!nullable(b.today,bool)||(b.season==null)!==(b.day==null)||(b.season==null)!==(b.today==null))return false;
  const seen=new Set();return list(r.slayer,64,g=>text(g.id,160)&&g.id.length>0&&!seen.has(g.id)&&seen.add(g.id)&&text(g.name,240)&&num(g.killed)&&num(g.goal)&&nullable(g.reward,v=>text(v,160)&&/^\([A-Za-z]+\)[^\s]+$/.test(v))&&bool(g.claimed));
 };
 Model.validateMods=function(r){
  const text=(v,n)=>typeof v==='string'&&v.length<=n,id=v=>text(v,160)&&/^[A-Za-z0-9_.-]+$/.test(v)&&!v.startsWith('.')&&!v.endsWith('.')&&!v.includes('..'),num=v=>Number.isSafeInteger(v)&&v>=0;
  if(!r||!['building','ready','unsupported'].includes(r.state)||!num(r.version)||!text(r.language,40)||!num(r.total)||!['ready','absent','unsupported'].includes(r.gmcm)||!Array.isArray(r.limited)||r.limited.length>16||r.limited.some(v=>!text(v,80))||!Array.isArray(r.mods)||r.mods.length>256||r.mods.length>r.total)return false;
  const seen=new Set();
  return r.mods.every(m=>m&&id(m.id)&&!seen.has(m.id.toLowerCase())&&seen.add(m.id.toLowerCase())&&text(m.name,240)&&text(m.version,80)&&text(m.author,240)&&text(m.description,1000)&&(m.contentPackFor===null||id(m.contentPackFor))&&(m.hasConfigMenu===null||typeof m.hasConfigMenu==='boolean')&&(r.gmcm==='ready'||m.hasConfigMenu===null)&&Array.isArray(m.integrated)&&m.integrated.length<=16&&m.integrated.every(v=>text(v,80)));
 };
 Model.validateEvents=function(r){
  const text=(v,n)=>typeof v==='string'&&v.length<=n,num=(v,max=2147483647)=>Number.isSafeInteger(v)&&v>=0&&v<=max,list=(v,max,fn)=>Array.isArray(v)&&v.length<=max&&v.every(fn),optional=v=>v===null||text(v,160);
  if(r?.digests!=null&&!(Array.isArray(r.digests)&&r.digests.length===r.pages&&r.digests.every(d=>typeof d==='string'&&/^[0-9A-F]{16}$/.test(d))))return false;
  if(!r||!['building','ready','absent','unsupported','unavailable','out-of-range'].includes(r.state)||!num(r.version,Number.MAX_SAFE_INTEGER)||!text(r.language,40)||!num(r.page,81)||!num(r.pages,82)||!num(r.total,4096)||!num(r.sourceTotal)||r.total>r.sourceTotal||r.pages!==Math.ceil(r.total/50)||!list(r.limited,16,v=>text(v,80))||!list(r.entries,50,e=>e&&text(e.id,160)&&e.id.length>0&&text(e.name,240)&&text(e.location,160)&&optional(e.mod)&&optional(e.source)&&typeof e.seen==='boolean'&&typeof e.disabled==='boolean'&&(e.dialogue==null||list(e.dialogue,3,d=>d&&(d.npc===null||text(d.npc,160))&&text(d.text,160)&&d.text.length>=4))&&(()=>{const c=e.conditions;return c&&text(c.raw,512)&&[c.startTime,c.endTime].every(v=>v===null||num(v,2800))&&num(c.freeSlots,144)&&list(c.requiredItems,8,v=>text(v,160))&&list(c.npcsPresent,8,v=>text(v,160))&&list(c.hearts,8,h=>h&&text(h.npc,160)&&Number.isSafeInteger(h.points)&&text(h.kind,80))&&list(c.when,4,w=>list(w,8,p=>p&&text(p.key,80)&&text(p.value,240)));})()))return false;
  const trigger=t=>{if(t==null)return true;if(typeof t!=='object')return false;const at=t.checkedAt??{day:1,season:'spring',year:1,time:600,location:''},rows=v=>list(v,16,x=>x&&num(x.index,127)&&text(x.kind,80)&&x.kind.length>0)&&new Set(v.map(x=>x.index)).size===v.length;
   return ['ready','blocked','seen','gate','unknown'].includes(t.state)&&at&&num(at.day,28)&&at.day>0&&['spring','summer','fall','winter'].includes(at.season)&&num(at.year,99999)&&at.year>0&&num(at.time,2800)&&text(at.location,160)&&rows(t.failed)&&rows(t.chance)&&rows(t.unknown)&&(t.gate==null||text(t.gate,80))&&list(t.limited,16,x=>text(x,80))&&(t.state!=='ready'||t.failed.length===0&&t.unknown.length===0)&&(t.state!=='blocked'||t.failed.length>0)&&(t.state!=='gate'||typeof t.gate==='string'&&t.gate.length>0);
  };
  if(r.locationNames!=null&&!(r.page===0&&typeof r.locationNames==='object'&&!Array.isArray(r.locationNames)&&Object.keys(r.locationNames).length<=1024&&Object.entries(r.locationNames).every(([k,v])=>text(k,160)&&text(v,80))))return false;
  if(r.verdicts!=null&&!(r.page===0&&list(r.verdicts,4096,v=>v&&text(v.id,160)&&v.id.length>0&&v.trigger!=null&&typeof v.trigger==='object'&&trigger(Model.fullTrigger(v.trigger)))))return false;
  return r.entries.every(e=>trigger(e.trigger))&&(r.state==='ready'?(r.page<Math.max(1,r.pages)&&r.entries.length===Math.min(50,Math.max(0,r.total-r.page*50))):r.entries.length===0)&&new Set(r.entries.map(e=>e.id)).size===r.entries.length;
 };
 Model.validateBundles=function(r){
  const text=(v,n)=>typeof v==='string'&&v.length<=n,num=(v,min=0,max=1000000)=>Number.isSafeInteger(v)&&v>=min&&v<=max,list=(v,max,fn)=>Array.isArray(v)&&v.length<=max&&v.every(fn),nullableBool=v=>v===null||typeof v==='boolean';
  const item=i=>i&&((i.id===null)||(text(i.id,168)&&/^\([A-Za-z]+\).+/.test(i.id)))&&(i.category===null||num(i.category,-2147483648,-1))&&(i.currency===null||i.currency==='money')&&[i.id!==null,i.category!==null,i.currency!==null].filter(Boolean).length===1&&num(i.count,1)&&num(i.quality)&&nullableBool(i.donated);
  if(!r||!['building','ready','joja','unsupported','unavailable'].includes(r.state)||!num(r.version,0,Number.MAX_SAFE_INTEGER)||!text(r.language,40)||!list(r.limited,20,v=>text(v,80))||!list(r.rooms,16,room=>room&&text(room.id,160)&&room.id.length>0&&text(room.name,240)&&list(room.bundles,128,b=>b&&num(b.id,0,2147483647)&&text(b.name,240)&&num(b.required,1,32)&&nullableBool(b.complete)&&list(b.items,32,item)&&b.items.length>=b.required&&b.reward&&text(b.reward.raw,1000)&&['ready','unsupported'].includes(b.reward.state)&&list(b.reward.items,16,item))))return false;
  const all=r.rooms.flatMap(room=>room.bundles);
  return all.length<=128&&(r.state==='ready'||r.rooms.length===0)&&new Set(r.rooms.map(room=>room.id)).size===r.rooms.length&&new Set(all.map(b=>b.id)).size===all.length;
 };
 Model.validateCollections=function(r){
  const integer=(v,min=0,max=2147483647)=>Number.isSafeInteger(v)&&v>=min&&v<=max,text=(v,n)=>typeof v==='string'&&v.length<=n;
  const states=['ready','building','absent','unsupported','unavailable'],ids=['museum','fish','shipped','cooking','birds','nature','aquarium'];
  if(!r||!states.includes(r.state)||!integer(r.version,0,Number.MAX_SAFE_INTEGER)||!text(r.language,40)||!Array.isArray(r.sets)||r.sets.length>7||!Array.isArray(r.limited)||r.limited.length>32||!r.limited.every(v=>text(v,80))||new Set(r.sets.map(s=>s?.id)).size!==r.sets.length)return false;
  return r.sets.every(s=>s&&ids.includes(s.id)&&states.includes(s.state)&&(s.found==null||integer(s.found))&&(s.total==null||integer(s.total))&&(s.donated==null||integer(s.donated))&&(s.mod==null||text(s.mod,160))&&Array.isArray(s.entries)&&s.entries.length<=1024&&(s.state==='ready'||s.entries.length===0)&&new Set(s.entries.map(e=>e?.id)).size===s.entries.length&&s.entries.every(e=>e&&text(e.id,160)&&e.id.length>0&&text(e.name,240)&&typeof e.found==='boolean'&&(e.donated==null||typeof e.donated==='boolean')&&(e.icon==null||/^\/bridge\/asset\/[0-9a-f]{64}$/.test(e.icon))&&(e.seasons==null||Array.isArray(e.seasons)&&e.seasons.length<=4&&new Set(e.seasons).size===e.seasons.length&&e.seasons.every(v=>['spring','summer','fall','winter'].includes(v)))));
 };
 // Page 0's verdicts are brief: empty lists and a null gate are left out (bridge EventVerdictTrigger).
 Model.fullTrigger=t=>({failed:[],chance:[],unknown:[],gate:null,limited:[],checkedAt:null,...t});
 Model.validateCatalog=function(r){
  const text=(v,n)=>typeof v==='string'&&v.length<=n,num=(v,min=0,max=2147483647)=>Number.isSafeInteger(v)&&v>=min&&v<=max,list=(v,max,fn)=>Array.isArray(v)&&v.length<=max&&v.every(fn),qid=v=>text(v,160)&&/^\([^()]+\).+$/.test(v),icon=v=>v===null||text(v,78)&&/^\/bridge\/asset\/[0-9a-f]{64}$/.test(v),optional=v=>v===null||text(v,160),season=v=>['spring','summer','fall','winter'].includes(v),bool=v=>typeof v==='boolean';
  if(!r||!['items','people'].includes(r.kind)||!num(r.version,0,Number.MAX_SAFE_INTEGER)||!text(r.language,40)||!num(r.page,0,r.kind==='people'?5:81)||!num(r.total,0,r.kind==='people'?512:8192)||r.pages!==Math.ceil(r.total/100)||!['building','ready','unsupported','out-of-range'].includes(r.state)||!list(r.limited,16,v=>text(v,80))||!Array.isArray(r.entries)||r.entries.length>100)return false;
  // Page 0 may carry a 16-hex digest per page (the reader keeps unchanged pages).
  if(r.digests!=null&&!(r.page===0&&r.state==='ready'&&list(r.digests,82,d=>typeof d==='string'&&/^[0-9A-Fa-f]{16}$/.test(d))&&r.digests.length===r.pages))return false;
  if(r.state==='building'&&!(r.progress&&num(r.progress.done)&&num(r.progress.total)&&r.progress.done<=r.progress.total))return false;
  if(r.state!=='ready')return r.entries.length===0;
  if(r.page>=Math.max(1,r.pages)||r.entries.length!==Math.min(100,Math.max(0,r.total-r.page*100)))return false;
  const entry=e=>e&&text(e.id,160)&&e.id.length>0&&text(e.name,240)&&optional(e.mod)&&(r.kind==='items'?(qid(e.id)&&text(e.description,1200)&&text(e.category,120)&&num(e.categoryId,-2147483648)&&(e.price===null||num(e.price))&&icon(e.icon)&&['object','bigCraftable','weapon','tool','boots','hat','clothing','trinket','furniture','other'].includes(e.type)&&bool(e.edible)&&(e.recipe===null||e.recipe&&['cooking','crafting'].includes(e.recipe.kind)&&list(e.recipe.ingredients,12,i=>i&&(qid(i.id)||text(i.id,160)&&/^-\d+$/.test(i.id))&&num(i.count,1,999999)))):((e.birthday===null||e.birthday&&season(e.birthday.season)&&num(e.birthday.day,1,28))&&['alwaysShown','unknownUntilMet','hiddenUntilMet','hiddenAlways'].includes(e.socialTab)&&bool(e.canSocialize)&&bool(e.datable)&&icon(e.portrait)&&text(e.homeRegion,160)&&e.gifts&&['love','like','neutral','dislike','hate'].every(k=>list(e.gifts[k],64,qid))&&Object.values(e.gifts).flat().length<=64&&(e.relations==null||list(e.relations,16,p=>p&&text(p.id,160)&&p.id.length>0&&text(p.kind,80)&&p.kind.length>0))));
  return r.entries.every(entry)&&new Set(r.entries.map(e=>e.id)).size===r.entries.length;
 };
 Model.validateProgress=function(r){
  const text=(v,n)=>typeof v==='string'&&v.length<=n,num=(v,max=2147483647)=>Number.isSafeInteger(v)&&v>=0&&v<=max,list=(v,max,fn)=>Array.isArray(v)&&v.length<=max&&v.every(fn),qid=v=>text(v,160)&&/^\([^()]+\).+$/.test(v);
  return !!r&&num(r.version,Number.MAX_SAFE_INTEGER)&&['building','ready','unsupported','unavailable'].includes(r.state)&&text(r.language,40)&&list(r.metNpcs,512,v=>text(v,160)&&v.length>0)&&new Set(r.metNpcs).size===r.metNpcs.length&&list(r.knownItems,8192,qid)&&new Set(r.knownItems).size===r.knownItems.length&&!!r.itemSources&&['shipped','fish','minerals','artifacts','cooked','recipes','owned'].every(k=>num(r.itemSources[k],16384))&&!!r.mapAreas&&typeof r.mapAreas==='object'&&!Array.isArray(r.mapAreas)&&Object.keys(r.mapAreas).length<=512&&Object.entries(r.mapAreas).every(([k,v])=>text(k,160)&&k.length>0&&typeof v==='boolean')&&num(r.eventsSeen)&&list(r.limited,16,v=>text(v,80));
 };
 root.StardewModel=Model;if(typeof module==='object')module.exports=Model;
})(typeof window==='object'?window:globalThis);
