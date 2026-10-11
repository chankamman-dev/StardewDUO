/* The live game's own item and villager catalogue (every mod's content included), merged into
   the offline one. Offline entries keep their extra details; the live catalogue adds what the
   offline one does not know (mod villagers and items) and, for villagers, how the social tab
   treats them, the gift tastes this save has revealed, and relationships. Read-only. */
(()=>{'use strict';
const pages={people:['people','map','target','manual','quests','farm'],items:['manual','bag']};
function wantData(){
 const section=window.Journal?.getState?.().section;
 const primary=page==='manual'&&['collections','bundles'].includes(section)?section:page==='quests'&&section==='events'?'events':null;
 if(primary){
  // These documents already contain their own progress. Let their first read finish
  // before exporting thousands of unrelated item textures and villager profiles.
  if(LiveData.peek(primary)?.state==='ready')LiveData.need(primary==='events'?'people':'items');
  return;
 }
 if(pages.people.includes(page)){LiveData.need('people');LiveData.need('progress');}if(pages.items.includes(page)){LiveData.need('items');LiveData.need('progress');}
}
let merged={people:null,items:null};
function mergePeople(){const r=LiveData.peek('people');if(!r?.entries||!db)return false;
 const key=r.language+r.version;if(merged.people===key)return false;merged.people=key;
 for(const locale of ['zh','en']){const list=db[locale].people;
  for(const e of r.entries){let p=list.find(v=>v.id===e.id);
   if(!p){p={id:e.id,name:e.name,season:e.birthday?.season,day:e.birthday?.day,romance:e.datable,region:e.homeRegion||'Other',runtime:true};list.push(p);}
   Object.assign(p,{catalogDatable:e.datable,socialTab:e.socialTab,canSocialize:e.canSocialize,revealed:e.gifts,relations:e.relations||null,catalog:r.version});
   if(e.portrait)p.catalogPortrait=e.portrait;}}
 return true;}
function mergeItems(){const r=LiveData.peek('items');if(!r?.entries||!db)return false;
 const key=r.language+r.version;if(merged.items===key)return false;merged.items=key;
 // Items the offline catalogue already has still learn which mod added them.
 const owner=new Map(r.entries.filter(e=>e.mod).map(e=>[e.id,e.mod]));
 for(const locale of ['zh','en']){const list=db[locale].items,have=new Set(list.map(i=>i.id));
  for(const i of list)if(owner.has(i.id))i.mod=owner.get(i.id);
  for(const e of r.entries)if(!have.has(e.id))list.push({id:e.id,name:e.name,description:e.description,category:e.category||'',icon:e.icon,price:e.price,runtime:true,mod:e.mod});}
 return true;}
// A mod's display name: its manifest name from the installed list, else the ID without its author.
function modName(id){if(!id)return null;const m=LiveData.need('mods')?.mods?.find(m=>m.id.toLowerCase()===String(id).toLowerCase());if(m?.name)return m.name.replace(/\s*\[[^\]]*\]\s*$/,'')||m.name;
 const tail=String(id).split('.').slice(1).join('.')||String(id);return tail.replace(/[_-]+/g,' ').replace(/([a-z0-9])([A-Z])/g,'$1 $2').trim();}
// Which installed mod an ID belongs to, by the "UniqueID_" / "UniqueID." prefix content packs use.
function modOf(id){const low=String(id||'').toLowerCase(),mods=LiveData.need('mods')?.mods||[];let best=null;
 for(const m of mods){const p=m.id.toLowerCase();if((low.startsWith(p+'_')||low.startsWith(p+'.'))&&(!best||p.length>best.id.length))best=m;}return best?.id||null;}
function modChip(id,cls=''){const name=modName(id);if(!name)return null;const c=el('span','mod-chip'+(cls?' '+cls:''));c.dataset.mod=id;c.append(img('art/mod-badge.svg'),el('small','',(lang==='zh'?'来自 ':'From ')+name));return c;}
// A new save: forget what the last save had revealed before its own catalogue arrives.
function forget(){merged={people:null,items:null};if(!db)return;for(const locale of ['zh','en'])for(const p of db[locale].people){delete p.catalogPortrait;delete p.catalogDatable;delete p.socialTab;delete p.canSocialize;delete p.revealed;delete p.relations;delete p.catalog;}}
LiveData.onChange(name=>{if(name==='*')forget();window.render?.();});
// Merging happens on render, so a catalogue that arrived before the offline data still lands.
const base=window.render;window.render=function(){wantData();const people=mergePeople(),items=mergeItems();base();if(people)window.renderPeople?.();if(items)window.renderGuide?.();};
window.RuntimeCatalog={modName,modOf,modChip,person:id=>{const r=LiveData.peek('people');return r?.entries?.find(e=>e.id===id)||null;},item:id=>{const r=LiveData.peek('items');return r?.entries?.find(e=>e.id===id)||null;}};
})();
