/* The guide's character page (equipment, the five skills, mod skills and the character sheet),
   split out of journal.js. Each render takes the journal's own helpers from window.JournalKit, so
   the code below is unchanged from when it lived there. */
(()=>{'use strict';
function renderEquipment(){const {journal,available,host,button,go,row,art,item,openItem,lex,t,gameBar}=window.JournalKit,view=window.JournalKit.view();
const skillLabels={zh:['耕种','钓鱼','采集','采矿','战斗'],en:['Farming','Fishing','Foraging','Mining','Combat']};

// Skills mods add through SpaceCore (archaeology, Sword & Sorcery…): full-width rows below the
// character block (whose skill list is sized for exactly the game's five). Read-only.
function renderCustomSkills(){const custom=journal()?.character?.customSkills||[];if(!custom.length)return;const box=el('div','character-skills custom-skills');host.append(el('h3','section-title journal-section-title custom-skills-title',lang==='zh'?'模组技能':'Mod skills'));
for(const k of custom){const row=el('div','character-skill custom-skill'),title=el('span','skill-title'),bar=el('span','skill-levels'),total=Math.max(k.level,k.totalLevel);row.dataset.skill=k.id;row.setAttribute('aria-label',k.name+' '+total);title.append(img(k.icon||'art/skill-4.png'),el('span','',k.name));bar.setAttribute('aria-hidden','true');for(let i=1;i<=10;i++){const node=i%5===0,cell=img('art/skill-'+(node?'node-':'')+(k.level>=i?'full':'empty')+'.png');cell.className=node?'skill-node':'';bar.append(cell);}row.append(title,bar,el('strong',total>k.level?'skill-buffed':'',String(total)));if(k.professions.length)row.append(el('small','custom-professions',factRow(k.professions)));box.append(row);}
host.append(box);}
function renderSkills(top){const list=el('div','character-skills'),character=journal().character;
if(!character){list.append(el('p','character-unavailable',lang==='zh'?'更新配套模组后查看技能':'Update the companion mod to view skills'));top.append(list);return;}
for(const skill of character.skills){const name=skillLabels[lang][skill.id],b=button('',()=>go('equipment','skill-'+skill.id),'character-skill');b.dataset.skill=skill.id;b.setAttribute('aria-pressed',String(view.detailId==='skill-'+skill.id));b.setAttribute('aria-label',name+' '+skill.level+'/10');const title=el('span','skill-title');title.append(img('art/skill-'+skill.id+'.png'),el('span','',name));const bar=el('span','skill-levels');bar.setAttribute('aria-hidden','true');for(let i=1;i<=10;i++){const node=i%5===0,profession=skill.professions.find(p=>p.level===i),cell=img(profession?'art/profession-'+profession.id+'.png':'art/skill-'+(node?'node-':'')+(skill.level>=i?'full':'empty')+'.png');cell.className=node?'skill-node':'';bar.append(cell);}b.append(title,bar,el('strong',skill.effectiveLevel>skill.level?'skill-buffed':'',String(skill.effectiveLevel)));list.append(b);}
top.append(list);}
// With nothing selected: a character sheet — health, energy and money, each skill's progress to its
// next level, the professions chosen, and what the worn gear adds.
const OV={zh:{status:'状态',health:'生命',energy:'体力',money:'金钱',progress:'技能经验',max:'满级',toNext:'还差 {n}',professions:'已选职业',noProfessions:'技能到 5 级后可以选择职业',gear:'装备加成',tip:'点技能或装备查看详细资料'},
 en:{status:'Status',health:'Health',energy:'Energy',money:'Money',progress:'Skill progress',max:'Max',toNext:'{n} to go',professions:'Professions',noProfessions:'Choose a profession when a skill reaches level 5',gear:'Gear bonuses',tip:'Tap a skill or item for details'}};
const ov=(k,v={})=>((OV[lang]||OV.en)[k]||k).replace(/\{(\w)\}/g,(_,x)=>v[x]??'');
function sheetTitle(text,icon){const h=el('h3','char-sheet-title');if(icon)h.append(img(icon));h.append(el('span','',text));return h;}
function overview(detail){const c=journal().character,w=model.snapshot?.world,gear=journal().equipment||[];
 detail.classList.add('char-sheet');
 // Health, energy, money.
 if(w&&Number.isFinite(w.health)){const box=el('div','char-status');
  for(const [key,now,max] of [['health',w.health,w.maxHealth],['energy',Math.round(w.stamina),w.maxStamina]]){const r=el('div','char-stat is-'+key),bar=el('span','char-bar'),fill=el('i');fill.style.width=(max>0?Math.max(0,Math.min(100,Math.round(now/max*100))):0)+'%';bar.append(fill);r.append(el('small','',ov(key)),bar,el('strong','',now+' / '+max));box.append(r);}
  if(Number.isFinite(w.money)){const r=el('div','char-stat is-money');r.append(img('art/hud-coin.svg'),el('small','',ov('money')),el('strong','',w.money.toLocaleString(lang)+(lang==='zh'?' 金':'g')));box.append(r);}
  detail.append(box);}
 // Each skill: level and progress to the next.
 detail.append(sheetTitle(ov('progress'),'art/quality-gold.png'));const xp=el('div','char-xp');
 for(const s of c.skills){const max=s.nextLevel==null,span=max?1:Math.max(1,s.nextLevel-Math.max(0,s.levelStart)),done=max?1:Math.max(0,s.experience-Math.max(0,s.levelStart)),b=button('',()=>go('equipment','skill-'+s.id),'char-xp-row');b.dataset.xp=s.id;
  const bar=el('span','char-bar is-xp'),fill=el('i');fill.style.width=Math.round(Math.min(1,done/span)*100)+'%';bar.append(fill);
  b.append(img('art/skill-'+s.id+'.png'),el('span','char-xp-name',skillLabels[lang][s.id]),el('strong','char-xp-level','Lv '+s.level),bar,el('small','char-xp-left',max?ov('max'):ov('toNext',{n:(s.nextLevel-s.experience).toLocaleString(lang)})));
  xp.append(b);}
 detail.append(xp);
 // Professions chosen so far.
 const chosen=c.skills.flatMap(s=>s.professions.map(p=>({...p,skill:s.id}))).sort((a,b)=>a.skill-b.skill||a.level-b.level);detail.append(sheetTitle(ov('professions'),'art/profession-0.png'));
 if(chosen.length){const list=el('div','char-professions');for(const p of chosen){const b=button('',()=>go('equipment','skill-'+p.skill),'char-profession');b.append(img('art/profession-'+p.id+'.png'),el('span','',p.name),el('small','','Lv '+p.level));list.append(b);}detail.append(list);}
 else detail.append(el('p','char-none',ov('noProfessions')));
 // What the worn gear adds (rings, boots and so on), summed by kind.
 const sums=new Map();for(const g of gear)if(g.slot!=='tool')for(const f of g.fields){const n=Number(String(f.value).replace(/[^\d.-]/g,''));if(['defense','immunity','damage','speed'].includes(f.key)&&Number.isFinite(n)&&n)sums.set(f.key,(sums.get(f.key)||0)+n);}
 if(sums.size){detail.append(sheetTitle(ov('gear'),'art/stat-defense.png'));const box=el('div','char-gear');for(const [key,n] of sums){const r=el('div','char-gear-stat');r.append(img('art/stat-'+key+'.png'),el('small','',lex[lang].fields[key]||key),el('strong','',(n>0?'+':'')+n));box.append(r);}detail.append(box);}}
function renderSkillDetail(){const c=journal().character;if(!c)return;const skill=c.skills.find(s=>'skill-'+s.id===view.detailId),detail=el('div','character-detail');
if(skill){const title=el('div','skill-detail-title');title.append(img('art/skill-'+skill.id+'.png'),el('h2','',skillLabels[lang][skill.id]),el('span','',skill.level+' / 10'));detail.append(title);const max=skill.nextLevel==null;detail.append(el('p','skill-xp',max?(lang==='zh'?'已满级':'Maximum level'):(lang==='zh'?'经验 ':'XP ')+skill.experience+' / '+skill.nextLevel));detail.append(gameBar(max?1:Math.max(0,skill.experience-skill.levelStart),max?1:Math.max(1,skill.nextLevel-skill.levelStart),skillLabels[lang][skill.id],'skill-progress',skill.id));if(skill.effect)detail.append(el('p','skill-effect',skill.effect));if(skill.effectiveLevel!==skill.level)detail.append(el('small','', (lang==='zh'?'当前加成等级 ':'Current boosted level ')+skill.effectiveLevel));for(const tier of [5,10]){const p=skill.professions.find(p=>p.level===tier),r=el('div','skill-profession');r.append(img(p?'art/profession-'+p.id+'.png':'art/skill-node-empty.png'));const text=el('div');text.append(el('strong','',p?p.name:(lang==='zh'?tier+' 级职业': 'Level '+tier+' profession')),el('p','',p?p.description:(skill.level>=tier?(lang==='zh'?'尚未选择':'Not selected yet'):(lang==='zh'?'达到等级后解锁':'Unlocks at this level'))));r.append(text);detail.append(r);}}
else overview(detail);
const mastery=el('details','character-mastery'),unlocked=c.skills.every(s=>s.level>=10),summary=el('summary','',unlocked?withCount(lang==='zh'?'精通':'Mastery',c.masteryLevel+' / 5'):lang==='zh'?'精通（五项技能达到 10 级解锁）':'Mastery (reach level 10 in all five skills)');mastery.append(summary,el('p','',(lang==='zh'?'累计精通经验 ':'Total mastery XP ')+c.masteryExperience));detail.append(mastery);host.append(detail);}
function renderPage(){if(!available())return;const rows=journal().equipment,gear=rows.find(r=>r.slot===view.detailId),layout=el('div','equipment-layout');
const slots=keys=>{const column=el('div','equipment-column');for(const key of keys){const v=rows.find(r=>r.slot===key),label=lex[lang].slot[key]||key,b=button('',()=>go('equipment',key),'equipment-slot');b.dataset.slot=key;b.setAttribute('aria-label',label+(v?' · '+v.name:''));b.setAttribute('aria-pressed',String(view.detailId===key));b.style.backgroundImage=`url('art/equipment-${v?'empty':key.endsWith('Ring')?'ring':key}.png')`;if(v)b.append(img(art(v.id)));b.disabled=!v;column.append(b);}return column;};
const portrait=el('div','equipment-portrait '+((model.snapshot?.world?.time??600)>=1900?'is-night':'is-day')),body=model.snapshot?.tracking?.playerBody;if(body)portrait.append(img(body));else portrait.append(el('small','portrait-note',lang==='zh'?'更新模组后显示角色':'Update the mod to show your farmer'));
layout.append(slots(['leftRing','rightRing','boots']),portrait,slots(['hat','shirt','pants']));const top=el('div','character-top'),farmer=el('div','character-farmer');farmer.append(layout,el('h2','equipment-farmer',model.snapshot?.world?.farmer||''));top.append(farmer);renderSkills(top);host.append(top);renderCustomSkills();
for(const extra of rows.filter(r=>!['leftRing','rightRing','boots','hat','shirt','pants','tool'].includes(r.slot)))host.append(row(art(extra.id),extra.name,lex[lang].slot[extra.slot]||extra.slot,()=>go('equipment',extra.slot)));
if(!gear)renderSkillDetail();
if(gear){const detail=el('div','equipment-detail'),top=el('div','journal-identity');top.append(img(art(gear.id,'art/icon-bag.png')),el('h2','',gear.name));detail.append(top,el('p','journal-description',gear.description));for(const f of gear.fields){const r=el('div','journal-fact'),icon={defense:'stat-defense',immunity:'stat-immunity',damage:'stat-damage',speed:'stat-speed'}[f.key];if(icon)r.append(img('art/'+icon+'.png'));r.append(el('span','',lex[lang].fields[f.key]||f.key),el('strong','',f.value));detail.append(r);}if(item(gear.id))detail.append(button(t('items')+' ›',()=>openItem(gear.id),'journal-item-link'));host.append(detail);}}
renderPage();}
window.JournalCharacter={renderEquipment};
})();
