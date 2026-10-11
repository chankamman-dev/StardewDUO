/* Manual → Wiki: links into the Stardew Valley Wiki (community run; zh / en sites). Pages open
   in a separate native reader with no game bridge (WikiReaderActivity); this page only builds
   URLs. Keep HOSTS in step with WikiUrlPolicy.java, which guards the same boundary.
   Every path below was checked to exist on its site (2026-09-26). */
(()=>{'use strict';
const HOSTS={zh:'https://zh.stardewvalleywiki.com',en:'https://stardewvalleywiki.com'};
// [id, icon, zh title, zh page, en title, en page]
const GROUPS=[
 {id:'farm',icon:'(O)24',zh:'农场',en:'Farming',entries:[
  ['crops','(O)24','作物','作物','Crops','Crops'],['fruitTrees','(O)613','果树','果树','Fruit Trees','Fruit_Trees'],['animals','art/animals/white-cow.png','动物','动物','Animals','Animals'],
  ['buildings','(O)388','建筑','木匠的商店','Buildings','Buildings'],['fertilizer','(O)368','肥料','肥料','Fertilizer','Fertilizer'],['sprinklers','(O)599','洒水器','洒水器','Sprinklers','Sprinklers'],
  ['artisan','(BC)12','工匠物品','工匠物品','Artisan Goods','Artisan_Goods'],['seasons','art/icon-calendar.png','季节','季节','Seasons','Seasons']]},
 {id:'nature',icon:'(O)145',zh:'采集与钓鱼',en:'Foraging & Fishing',entries:[
  ['foraging','(O)16','采集','采集','Foraging','Foraging'],['fishing','(T)BambooPole','钓鱼','钓鱼','Fishing','Fishing'],['fish','(O)145','鱼','鱼','Fish','Fish'],['minerals','(O)60','矿物','矿物','Minerals','Minerals']]},
 {id:'make',icon:'(O)194',zh:'烹饪与制作',en:'Cooking & Crafting',entries:[
  ['cooking','(O)194','烹饪','烹饪','Cooking','Cooking'],['crafting','(BC)13','制作','制作','Crafting','Crafting'],['tailoring','(O)428','裁缝','裁缝','Tailoring','Tailoring'],
  ['tools','(T)WateringCan','工具','工具','Tools','Tools'],['weapons','(W)0','武器','武器','Weapons','Weapons']]},
 {id:'town',icon:'art/heart-full.png',zh:'城镇与居民',en:'Town & Villagers',entries:[
  ['villagers','art/icon-people.png','居民','居民','Villagers','Villagers'],['friendship','art/heart-full.png','友谊','友谊','Friendship','Friendship'],['marriage','(O)458','婚姻','婚姻','Marriage','Marriage'],
  ['festivals','art/cal-festival-1.png','节日','节日','Festivals','Festivals'],['calendar','art/icon-calendar.png','日历','日历','Calendar','Calendar'],['town','art/icon-map.png','鹈鹕镇','鹈鹕镇','Pelican Town','Pelican_Town']]},
 {id:'explore',icon:'(W)0',zh:'冒险',en:'Adventure',entries:[
  ['mines','(O)378','矿井','矿井','The Mines','The_Mines'],['skullCavern','(O)386','骷髅洞穴','骷髅洞穴','Skull Cavern','Skull_Cavern'],['monsters','(O)766','怪物','怪物','Monsters','Monsters'],['island','(O)73','姜岛','姜岛','Ginger Island','Ginger_Island']]},
 {id:'progress',icon:'art/farm-bundle.png',zh:'进度与收集',en:'Progress',entries:[
  ['bundles','art/farm-bundle.png','收集包','收集包','Bundles','Bundles'],['museum','(O)96','博物馆','博物馆','Museum','Museum'],['quests','art/icon-quests.png','任务','任务','Quests','Quests'],
  ['skills','art/skill-0.png','技能','技能','Skills','Skills'],['achievements','art/quality-gold.png','成就','成就','Achievements','Achievements'],['powers','art/quality-iridium.png','特殊物品','特殊物品与能力','Special Items','Special_Items_&_Powers'],
  ['perfection','art/quality-iridium.png','完美度','完美','Perfection','Perfection']]}];
const W={zh:{title:'Wiki',home:'Wiki 首页',homeNote:'星露谷物语中文维基',guide:'新手指南',guideNote:'从第一天开始',search:'搜索 Wiki',go:'搜索',
  source:'资料来自 Stardew Valley Wiki（社区维护，非本应用内容），需要联网。页面在单独的阅读窗口中打开，不会接触游戏。'},
 en:{title:'Wiki',home:'Wiki home',homeNote:'The Stardew Valley Wiki',guide:'Getting started',guideNote:'From day one',search:'Search the wiki',go:'Search',
  source:'From the Stardew Valley Wiki (community run, not part of this app); needs internet. Pages open in a separate reader that never touches the game.'}};
const lg=()=>lang==='zh'?'zh':'en',wt=k=>W[lg()][k];
const host=()=>HOSTS[lg()];
// Same boundary as WikiUrlPolicy.java: https, one of the two hosts, no credentials or dot segments.
// Dot segments are rejected on the raw string: URL() would silently resolve them away.
function safeUrl(value){try{if(typeof value!=='string'||value.length>2048||value.includes('\\'))return null;
 for(const s of value.split(/[?#]/)[0].split('/'))if(/^(%2e|\.){1,2}$/i.test(s))return null;const u=new URL(value);
 if(u.protocol!=='https:'||!Object.values(HOSTS).includes(u.origin)||u.username||u.password)return null;
 return u.href;}catch{return null;}}
const page=title=>safeUrl(host()+'/'+encodeURIComponent(title.replace(/ /g,'_')));
const search=q=>safeUrl(host()+'/index.php?search='+encodeURIComponent(q)+'&go=Go');
function open(url){if(!url)return;window.ThorSound?.play?.('smallSelect');
 if(typeof window.ThorCommands?.openWiki==='function'){ThorCommands.openWiki(url);return;}
 // Desktop preview only: a normal browser tab.
 window.open(url,'_blank','noopener');}
const iconOf=(id,fallback)=>id.startsWith('art/')?id:(icons.get(id)||db?.[lang]?.items.find(v=>v.id===id)?.icon||fallback);
function btn(cls,click){const b=el('button',cls);b.type='button';b.onclick=click;return b;}
function render(root){
 // Search: exact titles jump straight to the page (MediaWiki "go"), otherwise the results list.
 const form=el('form','wiki-search'),input=el('input','journal-search');input.type='search';input.placeholder=wt('search');input.setAttribute('aria-label',wt('search'));input.maxLength=80;input.enterKeyHint='search';
 const go=btn('wiki-go',null);go.type='submit';go.append(el('span','',wt('go')));form.append(input,go);
 form.onsubmit=e=>{e.preventDefault();const q=input.value.trim();if(q)open(search(q));};root.append(form);
 const quick=el('div','wiki-quick');
 for(const [src,title,note,url] of [[iconOf('(O)SkillBook_0','art/nav-manual.png'),wt('home'),wt('homeNote'),safeUrl(host()+'/')],[iconOf('(O)PurpleBook','art/icon-manual.png'),wt('guide'),wt('guideNote'),page(lg()==='zh'?'新手指南':'Getting_Started')]]){
  const b=btn('wiki-card',()=>open(url)),copy=el('span','wiki-card-copy');b.append(img(src));copy.append(el('strong','',title),el('small','',note));b.append(copy);quick.append(b);}
 root.append(quick);
 for(const g of GROUPS){const h=el('h3','section-title farm-info-title wiki-group');h.append(img(iconOf(g.icon,'art/icon-manual.png')),el('span','',g[lg()]));root.append(h);
  const grid=el('div','wiki-grid');
  for(const [id,icon,zhTitle,zhPage,enTitle,enPage] of g.entries){const title=lg()==='zh'?zhTitle:enTitle,url=page(lg()==='zh'?zhPage:enPage),b=btn('wiki-entry',()=>open(url));
   b.dataset.wiki=id;b.dataset.url=url||'';b.append(img(iconOf(icon,iconOf(g.icon,'art/icon-manual.png'))),el('span','',title));grid.append(b);}
  root.append(grid);}
 root.append(el('p','plan-note wiki-source',wt('source')));
}
// Other pages link here by name: an exact wiki title opens directly, otherwise the search results.
window.StardewWiki={render,safeUrl,hosts:HOSTS,groups:GROUPS,openSearch:q=>open(search(String(q).slice(0,80)))};
})();
