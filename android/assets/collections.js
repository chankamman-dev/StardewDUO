/* Manual → 图鉴: the game's own collections (museum, fish, shipped, cooking) and the ones mods add
   (Ornithologist's Guild birds, Nature in the Valley creatures, Stardew Aquarium donations), one
   page each, only for what is installed. Like the in-game collections page, what has not been
   found is a silhouette and "???" while undiscovered info is hidden. Read-only. */
(()=>{'use strict';
const T={zh:{museum:'博物馆',fish:'鱼类',shipped:'出货',cooking:'烹饪',birds:'观鸟',nature:'自然收集',aquarium:'水族馆',
  found:'已收集 {n} / {t}',foundOnly:'已收集 {n}',donated:'已捐赠 {n}',all:'全部',have:'已收集',missing:'未收集',donatedTag:'已捐赠',
  building:'正在读取…',unsupported:'这个版本的模组暂不支持',unavailable:'暂时无法读取',none:'没有可显示的图鉴',update:'更新游戏端模组后可查看图鉴',empty:'这里还没有东西'},
 en:{museum:'Museum',fish:'Fish',shipped:'Shipped',cooking:'Cooking',birds:'Birds',nature:'Creatures',aquarium:'Aquarium',
  found:'{n} / {t} found',foundOnly:'{n} found',donated:'{n} donated',all:'All',have:'Found',missing:'Missing',donatedTag:'Donated',
  building:'Reading…',unsupported:'This version of the mod is not supported yet',unavailable:'Not available right now',none:'No collections to show',update:'Update the game mod to see collections',empty:'Nothing here yet'}};
const w=(k,v={})=>((T[lang]||T.en)[k]||k).replace(/\{(\w)\}/g,(_,x)=>v[x]??'');
const icon={museum:'(O)96',fish:'(O)130',shipped:'(O)24',cooking:'(O)194',nature:'(O)766',aquarium:'(O)145'};
let filter='all';
function artOf(id,fallback='art/icon-manual.png'){return icons.get(id)||db?.[lang]?.items.find(i=>i.id===id)?.icon||fallback;}
function categoryArt(id){return id==='birds'?'art/collection-birds.svg':artOf(icon[id]);}
function hidden(entry){return !entry.found&&!!window.Spoiler?.enabled('collections');}
function progress(set){const bar=el('span','collection-bar'),fill=el('span','collection-fill');bar.append(fill);const pct=set.total?Math.round(100*(set.found||0)/set.total):0;fill.style.width=pct+'%';bar.setAttribute('aria-hidden','true');return bar;}
function summary(set){if(set.state!=='ready')return w(set.state==='building'?'building':set.state==='unsupported'?'unsupported':'unavailable');
 let text=set.total!=null?w('found',{n:set.found??0,t:set.total}):w('foundOnly',{n:set.found??0});if(set.donated!=null&&set.id!=='museum'||set.id==='museum'&&set.donated)text+=(lang==='zh'?'，':', ')+w('donated',{n:set.donated});return text;}
function renderOverview(host,data,ui){const sets=data.sets.filter(s=>s.state!=='absent');if(!sets.length){host.append(el('p','journal-empty',w('none')));return;}
 const list=el('div','collection-list');
 for(const set of sets){const b=ui.button('',()=>ui.go('collections',set.id),'journal-row collection-row'),copy=el('span','journal-row-copy');b.dataset.collection=set.id;
  b.append(img(categoryArt(set.id)));copy.append(el('strong','',w(set.id)),el('small','',summary(set)));if(set.state==='ready'&&set.total)copy.append(progress(set));b.append(copy,el('span','journal-arrow','›'));
  b.disabled=set.state!=='ready';list.append(b);}
 host.append(list);}
function renderSet(host,set,ui){
 const head=el('div','collection-head');head.append(img(categoryArt(set.id)));const copy=el('div');copy.append(el('h2','journal-title',w(set.id)),el('small','',summary(set)));head.append(copy);host.append(head);
 if(set.state==='ready'&&set.total)host.append(progress(set));
 if(set.state!=='ready')return;
 const chips=el('div','collection-filter');for(const k of ['all','have','missing']){const c=ui.button(w(k),()=>{filter=k;window.Journal?.render();},'');c.setAttribute('aria-pressed',String(filter===k));chips.append(c);}host.append(chips);
 const shown=set.entries.filter(e=>filter==='all'||(filter==='have'?e.found:!e.found));if(!shown.length){host.append(el('p','journal-empty',w('empty')));return;}
 const grid=el('div','collection-grid');
 for(const e of shown){const secret=hidden(e),b=ui.button('',()=>{if(!secret&&db?.[lang]?.items.some(i=>i.id===e.id))ui.openItem(e.id);},'collection-entry'),face=img(e.icon||artOf(e.id,'art/icon-manual.png'));
  b.dataset.entry=e.id;b.dataset.found=String(e.found);if(!e.found)face.classList.add(secret?'spoiler-silhouette':'collection-missing');b.append(face,el('span','',secret?'???':e.name));
  if(e.donated)b.append(el('small','collection-donated',w('donatedTag')));if(secret)b.disabled=true;grid.append(b);}
 host.append(grid);}
function render(host,view,ui){const data=LiveData.need('collections');
 if(!data){host.append(StateBox.connection?.('art/nav-manual.png')||el('p','journal-empty',LiveData.status('collections')?w('building'):w('update')));return;}
 if(!view.detailId){renderOverview(host,data,ui);return;}
 const set=data.sets.find(s=>s.id===view.detailId);if(!set){host.append(el('p','journal-empty',w('none')));return;}renderSet(host,set,ui);}
// The journal only redraws on change, so keep asking while the section is on screen.
const base=window.render;window.render=function(){if(page==='manual'&&window.Journal?.getState?.().section==='collections')LiveData.need('collections');base();};
window.Collections={render,stateKey:()=>{const d=LiveData.peek('collections');return [d?.version,d?.language,LiveData.status('collections'),filter,window.Spoiler?.enabled('collections'),lang];}};
})();
