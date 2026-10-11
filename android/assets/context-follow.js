/* Settings → 情境页: per-context "switch the bottom screen to the context page" choices, and
   "go back afterwards". The bottom screen stays a menu by default; only sleeping and waking
   (moments nobody is using it) switch on their own unless the player turns more on.
   Never switches within 5 s of a touch; after a touch the player owns the page again, so the
   automatic return is skipped. The game reports the active context in every snapshot. */
(()=>{'use strict';
const KEY='stardew.follow.v1',CONTEXTS=['chest','shop','fishing','mine','dialogue','sleep','wake'];
const DEFAULTS={chest:false,shop:false,fishing:false,mine:false,dialogue:false,sleep:true,wake:true,back:true};
const T={zh:{title:'情境页',
  chest:'打开箱子时',shop:'进商店时',fishing:'钓鱼时',mine:'进入矿井时',dialogue:'和村民对话时',sleep:'睡觉时',wake:'睡醒时（显示早晨简报）',back:'情境结束后回到原来的页面',on:'开启',off:'关闭'},
 en:{title:'Now page',
  chest:'Opening a chest',shop:'Entering a shop',fishing:'Fishing',mine:'Entering the mines',dialogue:'Talking to a villager',sleep:'Going to sleep',wake:'Waking up (morning briefing)',back:'Go back to the previous page afterwards',on:'On',off:'Off'}};
const t=k=>(T[lang]||T.en)[k]||k;
function load(){let v={};try{v=JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch{}
 // The earlier single sleep/wake switch.
 try{if(!('sleep' in v)&&localStorage.getItem('stardew.briefing.auto')==='off'){v.sleep=false;v.wake=false;}}catch{}
 const out={};for(const k of Object.keys(DEFAULTS))out[k]=typeof v[k]==='boolean'?v[k]:DEFAULTS[k];return out;}
let prefs=load();
function save(){try{localStorage.setItem(KEY,JSON.stringify(prefs));}catch{}}
// ---- Follow ----
let lastTouch=0,lastContext=null,lastDay=null,auto=null,newDay=false;
document.addEventListener('pointerdown',()=>{lastTouch=performance.now();},true);
const idle=()=>performance.now()-lastTouch>5000;
function toContext(reason){if(!idle()||page==='target'||!window.ThorNav)return;auto={from:page,reason,at:performance.now()};window.ThorNav.open('target');}
function follow(){const s=model.snapshot;if(!s?.world||model.status(performance.now())!=='ready')return;
 const ctx=s.context??(s.night?'night':null),day=window.Briefing?.dayKey?.(s)??null;
 if(ctx!==lastContext){
  const setting=ctx==='night'?'sleep':ctx;
  if(ctx&&prefs[setting])toContext(ctx);
  // The context this page came for is over: return, unless the player has touched it since.
  else if(!ctx&&auto&&auto.reason===lastContext&&auto.reason!=='night'&&prefs.back&&page==='target'&&lastTouch<auto.at&&window.ThorNav?.depth?.()>0){auto=null;window.ThorNav.back();}
  if(!ctx&&auto?.reason===lastContext)auto=null;}
 // A new day: open the briefing (and switch to it if chosen). The game moves its date on early in
 // the night, so the day changes while still asleep: wait for the night to end.
 if(lastDay&&day!==lastDay)newDay=true;
 if(newDay&&ctx!=='night'){newDay=false;if(prefs.wake){window.Briefing?.open?.();auto=null;toContext('wake');}}
 lastContext=ctx;lastDay=day;}
// ---- Settings section ----
const group=el('details','follow-settings'),section=el('summary','section-title follow-title'),rows={};
for(const k of [...CONTEXTS,'back']){const row=el('div','settings-row follow-row'),copy=el('div'),label=el('h3'),toggle=el('button','follow-toggle');toggle.type='button';toggle.dataset.follow=k;
 copy.append(label);row.append(copy,toggle);toggle.onclick=()=>{prefs[k]=!prefs[k];save();window.ThorSound?.play?.('smallSelect');paint();};rows[k]={label,toggle,row};}
group.append(section,...Object.values(rows).map(r=>r.row));
const anchor=document.querySelector('#settings [data-i=connectionTitle]');anchor?.before(group);
group.addEventListener('toggle',paint);
function paint(){const heading=(group.open?'▼ ':'▶ ')+t('title');if(section.textContent!==heading)section.textContent=heading;
 for(const [k,{label,toggle}] of Object.entries(rows)){if(label.textContent!==t(k))label.textContent=t(k);const text=t(prefs[k]?'on':'off');if(toggle.textContent!==text)toggle.textContent=text;toggle.dataset.checked=String(prefs[k]);toggle.setAttribute('aria-pressed',String(prefs[k]));toggle.setAttribute('aria-label',t(k)+' · '+text);}}
const base=window.render;window.render=function(){base();follow();if(page==='settings')paint();};paint();
window.ContextFollow={prefs:()=>({...prefs})};
})();
