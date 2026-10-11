// Local view history only. Never persist a command, receipt or game object.
(()=>{'use strict';
const history=[],tabs=new Map();let navigating=false,lastSession=null,restoreEpoch=0;
function capture(){return {page,selected,bagPage,personId,guideId,profile:$(page)?.classList.contains('profile'),scroll:$(page)?.scrollTop||0,
 peopleSearch:$('people-search').value,peopleFilter:$('season-filter').value,itemSearch:$('item-search').value,category:$('category-filter').value,
 giftTaste,giftLimit,catalogLimit:window.catalogLimit||90,region:currentRegion,map:window.MapView?.getState(),journal:window.Journal?.getState(),farm:window.Farm?.getState(),peopleView:window.PeopleView?.getState(),modManager:window.ModManager?.getState()};}
function restore(s){window.ThorFeedback?.reset();const epoch=++restoreEpoch;navigating=true;selected=s.selected??selected;bagPage=s.bagPage??bagPage;personId=s.personId??personId;guideId=s.guideId??guideId;
 $('people-search').value=s.peopleSearch??'';$('season-filter').value=s.peopleFilter??'';$('item-search').value=s.itemSearch??'';$('category-filter').value=s.category??'';
 giftTaste=s.giftTaste??0;giftLimit=s.giftLimit??12;window.catalogLimit=s.catalogLimit??90;currentRegion=s.region??currentRegion;
 if(s.journal)window.Journal?.restore(s.journal);else if(s.guideId&&s.page==='manual')window.Journal?.restore({section:'items'});
 if(s.peopleView)window.PeopleView?.restore(s.peopleView);
 if(s.farm)window.Farm?.restore(s.farm);
 window.ModManager?.restore(s.page==='settings'?s.modManager:null);
 if(['people','manual'].includes(s.page))showProfile(s.page,!!s.profile);
 showPage(s.page);if(s.page==='people')renderPeople();if(s.page==='manual')renderGuide();syncControls();render();
 requestAnimationFrame(()=>{if(epoch!==restoreEpoch||page!==s.page)return;if(s.map&&s.page==='map')window.MapView?.restore(s.map);if(s.focus)window.MapView?.focus(s.focus.x,s.focus.y);$(s.page).scrollTop=s.scroll||0;});navigating=false;update();}
// A tab keeps only its own back steps: a villager opened from the map returns to the map while that trip
// lasts, but once the player switches tabs the villager tab's back leads to its own list, not the map.
function remember(){tabs.set(page,{view:capture(),history:history.filter(h=>h.page===page)});}
// A sidebar tab owns its own browsing state. Restore only that tab's fields so a
// remembered guide page cannot rewind the resident filters or the inventory selection.
// Tapping the tab already open returns it to its first level (the list, not a profile).
function switchTab(next){if(next===page){if(['people','manual'].includes(page)&&$(page).classList.contains('profile')){history.length=0;showProfile(page,false);render();window.ThorSound?.play('cancel');}return;}remember();const saved=tabs.get(next),target={...capture(),page:next,scroll:0,profile:false};
 const fields={bag:['selected','bagPage'],map:['region','map'],people:['personId','peopleSearch','peopleFilter','giftTaste','giftLimit','peopleView'],manual:['guideId','itemSearch','category','catalogLimit','journal'],quests:['journal'],farm:['farm'],settings:['modManager']}[next]||[];
 if(saved){for(const k of ['profile','scroll',...fields])target[k]=saved.view[k];}else{
  if(next==='manual')target.journal={section:'home',detailId:null,query:''};
  if(next==='quests')target.journal={section:'quests',detailId:null,questView:'active',query:''};
  if(next==='farm'){window.Farm?.home();target.farm=window.Farm?.getState();}
  if(next==='settings')target.modManager=null;
 }
 // Journal hosts are shared; keep each root's state isolated until it is visible.
 if(!['manual','quests'].includes(next))delete target.journal;
 history.splice(0,history.length,...(saved?.history||[]));restore(target);}
function open(next,opts={}){const target=typeof next==='string'?{page:next,...opts}:next;if(!target||!$(target.page))return;
 if(!navigating){if(target.page!==page)remember();if(!opts.replaceHistory||target.page!==page){history.push(capture());if(history.length>24)history.shift();}}restore(target);}
function performBack(){const modal=document.querySelector('dialog[open]');if(modal){modal.close();return true;}if(history.length){restore(history.pop());return true;}
 if((page==='manual'||(page==='quests'&&(window.Journal?.getState()?.detailId||window.Journal?.getState()?.section==='events')))&&window.Journal?.back()){update();return true;}if(['people','manual'].includes(page)&&$(page).classList.contains('profile')){showProfile(page,false);render();return true;}
 if(page==='settings'&&window.ModManager?.back()){render();update();return true;}
 if(page==='farm'&&window.Farm?.back()){update();return true;}
 if(page!=='bag'){showPage('bag');update();return true;}return false;}
function back(){window.ThorFeedback?.reset();const changed=performBack();if(changed)window.ThorSound?.play('cancel');return changed;}
const heading=document.querySelector('.book-heading'),pageBack=el('button','page-back');pageBack.id='page-back';pageBack.append(img('art/action-back.svg'));pageBack.onclick=back;heading.prepend(pageBack);
function update(){const section=window.Journal?.getState()?.section,shown=(page==='farm'&&!!window.Farm?.canBack())||(page==='settings'&&!!window.ModManager?.getState()?.open)||(page==='quests'&&(!!window.Journal?.getState()?.detailId||section==='events'))||history.length>0||(page==='manual'&&section&&section!=='home')||(['people','manual'].includes(page)&&$(page).classList.contains('profile'));
 const parent=page==='map'?document.querySelector('.map-toolbar'):heading;if(pageBack.parentElement!==parent)parent.prepend(pageBack);
 pageBack.hidden=!shown;pageBack.title=lang==='zh'?'返回':'Back';pageBack.setAttribute('aria-label',pageBack.title);heading.classList.toggle('has-back',shown&&page!=='map');}
for(const b of document.querySelectorAll('nav button'))b.onclick=()=>switchTab(b.dataset.page);
$('person-back').onclick=$('guide-back').onclick=back;
const previous=render;render=function(){const s=model.snapshot?.session;if(s!==lastSession){history.length=0;tabs.clear();lastSession=s;}previous();update();};
window.ThorNav={open,back,capture,refresh:update,depth:()=>history.length};
addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.querySelector('dialog[open]')){e.preventDefault();back();}});update();
})();
