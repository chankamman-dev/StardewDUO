/* Crop profit planner (farm tab). Crop data, farming level and professions come from the live
   game through the farm report; all maths is CropMath (the game's own rules). Read-only. */
(()=>{'use strict';
const T={
 zh:{today:'使用今日',sowDay:'播种日',plots:'格数',dayShort:'{n}日',plotsShort:'{n}格',settings:'计算条件',fert:{none:'无肥料',speed:'高速',deluxe:'高级高速',hyper:'超级高速'},replant:'收获后补种',paddy:'稻类靠近水源',unsold:'含商店不卖的种子',
  farmer:'耕种{n}级',agri:'农业学家',tiller:'耕种者',margin:'利润率{n}%',fromSave:'按存档中的耕种等级与职业计算',
  sortBy:'排序',sort:{profit:'净收益',daily:'日均',first:'最早收获',cost:'最低投入'},first:'{day}日首收',times:'收{n}次',grow:'生长{n}天',seasons:'跨{n}季',
  tooLate:'本季来不及成熟',tooLong:'一季内无法成熟',lateGroup:'本季来不及成熟',none:'这个季节没有可种的作物',restricted:'限特定地点',restrictedLine:'只能种在特定地点（如温室或花盆），户外无法种植',
  invest:'投入 {n}',noSeed:'种子不售卖',perDay:'{n}/天',
  cost:'种子成本',revenue:'预计收入',profit:'预计净收益',seedsLine:'种子 {seeds} 袋，每次收获平均 {each} 个，单价 {price} 金',growthLine:'生长 {n} 天',baseGrowth:'（不加速 {n} 天）',
  regrowTag:'每{n}天再生',regrowLine:'之后每 {n} 天再收获，只需买一次种子',replantLine:'收获当天补种，只补能在季内成熟的轮次',onceLine:'只播种一次',calendar:'收获日历',
  legendSow:'播种',legendHarvest:'收获',legendGrow:'占地',legendPast:'播种前',noSeedLine:'这种种子商店不卖，未计入成本',lastSow:'最晚{day}日播种',
  update:'更新配套模组后可使用利润计算器',seasonNames:{spring:'春季',summer:'夏季',fall:'秋季',winter:'冬季'},back:'返回列表'},
 en:{today:'Use today',sowDay:'Sow day',plots:'Plots',dayShort:'Day {n}',plotsShort:'{n} plots',settings:'Settings',fert:{none:'None',speed:'Speed-Gro',deluxe:'Deluxe',hyper:'Hyper'},replant:'Replant',paddy:'Paddy by water',unsold:'Unsold seeds (no shop)',
  farmer:'Farming {n}',agri:'Agriculturist',tiller:'Tiller',margin:'Margin {n}%',fromSave:'Uses the farming level and professions from your save',
  sortBy:'Sort',sort:{profit:'Profit',daily:'Per day',first:'Earliest',cost:'Cheapest'},first:'Day {day}',times:'{n}×',grow:'{n} days',seasons:'{n} seasons',
  tooLate:'Too late this season',tooLong:'Cannot ripen in one season',lateGroup:'Too late this season',none:'Nothing to plant this season',restricted:'Limited spots',restrictedLine:'Can only be planted in special spots (e.g. greenhouse or pots), not outdoors',
  invest:'Cost {n}',noSeed:'Seed not sold',perDay:'{n}/day',
  cost:'Seed cost',revenue:'Revenue',profit:'Net profit',seedsLine:'{seeds} seeds, {each} per harvest on average, {price}g each',growthLine:'{n} days to grow',baseGrowth:' ({n} without boosts)',
  regrowTag:'Regrows {n}d',regrowLine:'Regrows every {n} days; seeds bought once',replantLine:'Replanted on harvest day while it can still ripen',onceLine:'Sown once',calendar:'Harvest calendar',
  legendSow:'Sow',legendHarvest:'Harvest',legendGrow:'Growing',legendPast:'Before sowing',noSeedLine:'Not sold in shops; seed cost not included',lastSow:'Sow by day {day}',
  update:'Update the companion mod to use the profit planner',seasonNames:{spring:'Spring',summer:'Summer',fall:'Fall',winter:'Winter'},back:'Back to list'}};
const tr=(k,v={})=>{let s=k.split('.').reduce((o,p)=>o?.[p],T[lang]||T.en)??k;if(typeof s==='string')for(const [a,b] of Object.entries(v))s=s.replace('{'+a+'}',b);return s;};
const seasons=['spring','summer','fall','winter'],fertIcon={speed:'(O)465',deluxe:'(O)466',hyper:'(O)918'};
let config;try{config=CropMath.options(JSON.parse(localStorage.getItem('stardew.crop-plan.v1')||'{}'));}catch{config=CropMath.options();}
let selected=null,redraw=()=>{},open=false;try{open=localStorage.getItem('stardew.crop-plan.open')==='1';}catch{/* collapsed */}
const icon=(id,fallback='art/icon-farm.png')=>icons.get(id)||db?.[lang]?.items.find(v=>v.id===id)?.icon||fallback;
const btn=(cls,text,click)=>{const b=el('button',cls);b.type='button';if(text!=null)b.append(el('span','',text));b.onclick=click;return b;};
const money=n=>Math.round(n).toLocaleString(lang);
function change(p){config=CropMath.options({...config,...p});try{localStorage.setItem('stardew.crop-plan.v1',JSON.stringify(config));}catch{/* still usable */}redraw();}
function farmerOf(pl){return {farmingLevel:pl.farmingLevel,agriculturist:pl.agriculturist,tiller:pl.tiller,profitMargin:pl.profitMargin};}
function stepper(label,key,min,max,big){const row=el('div','plan-step');row.append(el('small','',label));
 const add=d=>()=>change({[key]:Math.max(min,Math.min(max,config[key]+d))});
 if(big){const b=btn('plan-step-btn','−'+big,add(-big));b.disabled=config[key]===min;row.append(b);}
 const minus=btn('plan-step-btn','−',add(-1));minus.disabled=config[key]===min;const plus=btn('plan-step-btn','+',add(1));plus.disabled=config[key]===max;
 row.append(minus,el('strong','plan-step-value',String(config[key])),plus);if(big){const b=btn('plan-step-btn','+'+big,add(big));b.disabled=config[key]===max;row.append(b);}return row;}
function strip(items,current,pick,cls){const s=el('div','plan-strip '+cls);for(const [id,label,iconId] of items){const b=btn('plan-chip',null,()=>pick(id));b.setAttribute('aria-pressed',String(current===id));if(iconId)b.append(img(icon(iconId)));b.append(el('span','',label));s.append(b);}return s;}
function toggle(label,key){const b=btn('plan-toggle',null,()=>change({[key]:!config[key]}));b.setAttribute('role','switch');b.setAttribute('aria-checked',String(config[key]));b.append(img('art/check-'+(config[key]?'on':'off')+'.png'),el('span','',label));return b;}
// Icon + short text; the text is its own element so the pixel font can draw it.
function tagged(cls,src,text){const s=el('span',cls);if(src)s.append(img(src));s.append(el('small','',text));return s;}
// The HUD's season sprite (DayTimeMoneyBox), one frame per season.
function seasonMark(season){const m=el('span','plan-season-mark');m.style.setProperty('--season',seasons.indexOf(season));m.setAttribute('role','img');m.setAttribute('aria-label',tr('seasonNames.'+season));return m;}
function dayLabel(abs){return abs>28?tr('seasonNames.'+seasons[seasons.indexOf(config.season)+Math.floor((abs-1)/28)])+((abs-1)%28+1):String(abs);}
// The conditions fold into one line that shows what the numbers are for; tap it to change them.
function fold(panel){const b=btn('plan-summary',null,()=>{open=!open;try{localStorage.setItem('stardew.crop-plan.open',open?'1':'0');}catch{/* session only */}redraw();});
 b.setAttribute('aria-expanded',String(open));b.setAttribute('aria-label',tr('settings'));
 const season=el('span','plan-summary-item');season.append(seasonMark(config.season),el('small','',tr('seasonNames.'+config.season)));
 const fert=el('span','plan-summary-item');if(fertIcon[config.fertilizer])fert.append(img(icon(fertIcon[config.fertilizer])));fert.append(el('small','',tr('fert.'+config.fertilizer)));
 if(open)b.append(el('small','plan-summary-item is-label',tr('settings')),el('span','plan-fold-arrow','›'));
 else b.append(season,el('small','plan-summary-item',tr('dayShort',{n:config.day})),el('small','plan-summary-item',tr('plotsShort',{n:config.plots})),fert,el('span','plan-fold-arrow','›'));
 panel.classList.toggle('is-open',open);panel.append(b);return open;}
function list(host,pl){
 const world=model.status(performance.now())==='ready'?model.snapshot?.world:null,panel=el('div','plan-panel');host.append(panel);
 const inSeason=pl.crops.filter(c=>c.seasons.includes(config.season)),crops=inSeason.filter(c=>config.includeUnsold||c.seedPrice>0);
 if(fold(panel)){
 // When: season, sow day, jump to today.
 const month=el('div','journal-month plan-season'),prev=btn('',null,()=>change({season:seasons[(seasons.indexOf(config.season)+3)%4]})),next=btn('',null,()=>change({season:seasons[(seasons.indexOf(config.season)+1)%4]}));
 prev.setAttribute('aria-label',lang==='zh'?'上一季':'Previous season');next.setAttribute('aria-label',lang==='zh'?'下一季':'Next season');
 const today=btn('journal-today',tr('today'),()=>{if(world)change({season:world.season,day:world.day});});today.disabled=!world;
 month.append(prev,seasonMark(config.season),el('h2','',tr('seasonNames.'+config.season)),next,stepper(tr('sowDay'),'day',1,28),today);panel.append(month);
 // How much: plots and replanting; then fertilizer.
 const amount=el('div','plan-row');amount.append(stepper(tr('plots'),'plots',1,999,10),toggle(tr('replant'),'replant'));panel.append(amount);
 panel.append(strip(['none','speed','deluxe','hyper'].map(f=>[f,tr('fert.'+f),fertIcon[f]]),config.fertilizer,f=>change({fertilizer:f}),'plan-fert'));
 // Optional switches and the farmer the numbers are for (read from the save).
 const extra=el('div','plan-row plan-extra');
 if(inSeason.some(c=>c.paddy))extra.append(toggle(tr('paddy'),'paddyWater'));if(inSeason.some(c=>!(c.seedPrice>0)))extra.append(toggle(tr('unsold'),'includeUnsold'));
 const who=el('span','plan-farmer');who.title=tr('fromSave');who.append(tagged('plan-badge','art/skill-0.png',tr('farmer',{n:pl.farmingLevel})));
 if(pl.tiller)who.append(tagged('plan-badge','art/profession-1.png',tr('tiller')));if(pl.agriculturist)who.append(tagged('plan-badge','art/profession-5.png',tr('agri')));
 if(Math.abs(pl.profitMargin-1)>.001)who.append(tagged('plan-badge','art/hud-coin.svg',tr('margin',{n:Math.round(pl.profitMargin*100)})));
 extra.append(who);panel.append(extra);}
 const sort=strip(['profit','daily','first','cost'].map(s=>[s,tr('sort.'+s)]),config.sort,s=>change({sort:s}),'plan-sort');sort.prepend(el('small','plan-strip-label',tr('sortBy')));host.append(sort);
 const farmer=farmerOf(pl),rows=crops.map(c=>({c,r:CropMath.calculate(c,config,farmer)})).sort((a,b)=>CropMath.compare(a.r,b.r,config.sort));
 const metric=r=>config.sort==='daily'?r.perDay:r.profit,ok=rows.filter(x=>x.r.feasible),late=rows.filter(x=>!x.r.feasible),top=Math.max(0,...ok.map(x=>metric(x.r)));
 for(const {c,r} of ok)host.append(cropRow(c,r,metric(r),top));
 if(late.length){host.append(el('h3','section-title plan-late-title',tr('lateGroup')));for(const {c,r} of late)host.append(cropRow(c,r,0,0));}
 if(!rows.length)host.append(el('p','farm-none',tr('none')));
}
function cropRow(c,r,value,top){const b=btn('journal-row plan-crop',null,()=>{selected=c.seedId;redraw();requestAnimationFrame(()=>{$('farm').scrollTop=0;});});b.dataset.seed=c.seedId;b.classList.toggle('too-late',!r.feasible);
 const box=el('span','plan-icon');box.append(img(icon(c.harvestId,icon(c.seedId))));b.append(box);
 const copy=el('span','journal-row-copy'),name=el('span','plan-name');name.append(el('strong','',c.harvestName));
 if(c.restricted)name.append(el('small','plan-tag is-warn',tr('restricted')));
 const facts=el('span','plan-facts');facts.append(tagged('plan-fact','art/quest-timed.png',tr('grow',{n:r.growth})));
 if(r.feasible)facts.append(tagged('plan-fact','art/icon-calendar.png',tr('first',{day:dayLabel(r.first)})));
 if(r.seasonsCovered>1)facts.append(tagged('plan-fact is-seasons',null,tr('seasons',{n:r.seasonsCovered})));
 if(!r.feasible)facts.append(tagged('plan-fact is-late',null,r.lastSow>=1?tr('lastSow',{day:r.lastSow}):tr('tooLong')));
 copy.append(name,facts);b.append(copy);
 const end=el('span','plan-money'),main=el('span','plan-value');
 if(r.feasible)main.append(img('art/hud-coin.svg'),el('strong',r.profit<0?'is-loss':'',config.sort==='daily'?tr('perDay',{n:money(r.perDay)}):(r.profit>0?'+':'')+money(r.profit)));
 else main.append(el('strong','is-muted','—'));
 end.append(main,el('small','',r.seedKnown?tr('invest',{n:money(r.initialCost)}):tr('noSeed')));
 if(top>0){const bar=el('span','plan-bar'),fill=el('i');fill.style.width=Math.max(0,Math.min(100,value/top*100)).toFixed(1)+'%';bar.append(fill);end.append(bar);}
 b.append(end,el('span','journal-arrow','›'));return b;}
function detail(host,pl,c){
 const r=CropMath.calculate(c,config,farmerOf(pl)),base=CropMath.growthDays(c,{...config,fertilizer:'none',paddyWater:false},{}),cropIcon=icon(c.harvestId,icon(c.seedId)),seedIcon=icon(c.seedId,cropIcon);
 const head=el('div','plan-head'),box=el('span','plan-icon');box.append(img(cropIcon));head.append(box);
 const t=el('div','plan-head-copy'),marks=el('div','plan-head-marks');marks.append(el('small','plan-head-seed',c.seedName));for(const s of seasons)if(c.seasons.includes(s))marks.append(seasonMark(s));
 if(c.regrow>0)marks.append(el('small','plan-tag is-good',tr('regrowTag',{n:c.regrow})));if(c.restricted)marks.append(el('small','plan-tag is-warn',tr('restricted')));
 t.append(el('h2','journal-title',c.harvestName),marks);head.append(t);host.append(head);
 const cards=el('div','plan-cards');
 for(const [src,label,value,cls] of [[seedIcon,tr('cost'),r.seedKnown?money(r.cost):'—',''],['art/hud-coin.svg',tr('revenue'),money(r.revenue),''],['art/quest-coins.png',tr('profit'),(r.profit>0?'+':'')+money(r.profit),r.profit<0?'is-loss':'is-gain']]){
  const card=el('div','plan-card'),copy=el('span','plan-card-copy');card.append(img(src));copy.append(el('small','',label),el('strong',cls,value));card.append(copy);cards.append(card);}
 host.append(cards);
 const last=r.harvests.at(-1)??config.day;
 for(let s=0;s<Math.max(1,r.seasonsCovered);s++){const season=seasons[seasons.indexOf(config.season)+s];if(!season)break;
  const title=el('h3','section-title farm-info-title plan-cal-title');title.append(seasonMark(season),el('span','',r.seasonsCovered>1?(lang==='zh'?tr('seasonNames.'+season)+tr('calendar'):tr('seasonNames.'+season)+' '+tr('calendar').toLowerCase()):tr('calendar')));host.append(title);
  const board=el('div','journal-calendar plan-board');board.setAttribute('role','group');board.setAttribute('aria-label',tr('calendar'));
  for(let d=1;d<=28;d++){const abs=s*28+d,cell=el('div','journal-day plan-day'),sow=r.sowings.includes(abs),harvest=r.harvests.includes(abs);
   cell.classList.toggle('past',abs<config.day);cell.classList.toggle('grow',r.feasible&&abs>=config.day&&abs<=last);cell.classList.toggle('sow',sow);cell.classList.toggle('harvest',harvest);
   if(sow){const i=img(seedIcon);i.className='plan-mark-sow';cell.append(i);}if(harvest){const i=img(cropIcon);i.className='plan-mark-harvest';cell.append(i);}
   cell.setAttribute('aria-label',`${tr('seasonNames.'+season)} ${d}${sow?' · '+tr('legendSow'):''}${harvest?' · '+tr('legendHarvest'):''}`);board.append(cell);}
  host.append(board);}
 const legend=el('div','plan-legend');legend.append(tagged('plan-legend-item',seedIcon,tr('legendSow')),tagged('plan-legend-item',cropIcon,tr('legendHarvest')),tagged('plan-legend-item is-grow',null,tr('legendGrow')),tagged('plan-legend-item is-past',null,tr('legendPast')));host.append(legend);
 const facts=el('div','plan-facts-list'),line=(src,text)=>{const d=el('div','plan-line');d.append(img(src),el('p','',text));facts.append(d);};
 line('art/quest-timed.png',tr('growthLine',{n:r.growth})+(base!==r.growth?tr('baseGrowth',{n:base}):''));
 line(seedIcon,tr('seedsLine',{seeds:r.seeds,each:(Math.round(r.each*100)/100).toString(),price:r.price}));
 line('art/icon-calendar.png',c.regrow>0?tr('regrowLine',{n:c.regrow}):config.replant?tr('replantLine'):tr('onceLine'));
 if(!r.feasible)line('art/quest-timed.png',tr('tooLate')+(lang==='zh'?'，':'; ')+(r.lastSow>=1?tr('lastSow',{day:r.lastSow}):tr('tooLong')));
 if(c.restricted)line('art/icon-farm.png',tr('restrictedLine'));if(!r.seedKnown)line('art/hud-coin.svg',tr('noSeedLine'));
 host.append(facts);
}
window.CropPlanner={
 render(host,planner,refresh){redraw=refresh;if(!planner){host.append(StateBox.update('art/hud-coin.svg',tr('update')));return;}
  const crop=selected&&planner.crops.find(c=>c.seedId===selected);if(selected&&!crop)selected=null;if(crop)detail(host,planner,crop);else list(host,planner);},
 stateKey:()=>JSON.stringify([config,selected,open]),canBack:()=>!!selected,back(){if(!selected)return false;selected=null;redraw();return true;},reset(){selected=null;}};
})();
