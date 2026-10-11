/* Settings child page: bounded cards, global search, device-local notes/art and explicit GMCM edits. */
(()=>{'use strict';
const T={zh:{section:'模组',title:'模组管理',count:'{n} 个模组，{c} 个可设置',countNoGmcm:'{n} 个模组',open:'查看',back:'设置',search:'搜索模组…',
  all:'全部',config:'可设置',integrated:'已接入下屏',pack:'内容包：{p}',by:'作者 {a}',hasConfig:'有设置',integ:'下屏：{l}',openConfig:'在上屏打开设置',
  waiting:'正在打开…',opened:'已在上屏打开设置',none:'没有符合条件的模组',building:'正在读取模组列表…',update:'更新游戏端模组后可查看',
  noGmcm:'没有安装 Generic Mod Config Menu，无法打开设置',gmcmOld:'这个版本的 Generic Mod Config Menu 暂不支持',
  err:{unpaired:'需要先配对控制',busy:'游戏里有菜单、剧情或对话，关掉后再试',invalid:'请求无效',connection:'连接不上游戏','no-config':'这个模组没有可打开的设置','game-error':'游戏没能打开设置',unavailable:'现在无法打开'},
  kinds:{skills:'技能',collections:'图鉴',events:'剧情事件',bundles:'收集包',relations:'居民关系',farm:'农务',config:'设置'}},
 en:{section:'Mods',title:'Mod manager',count:'{n} mods, {c} with settings',countNoGmcm:'{n} mods',open:'View',back:'Settings',search:'Search mods…',
  all:'All',config:'Settings',integrated:'On this screen',pack:'Content pack: {p}',by:'by {a}',hasConfig:'Settings',integ:'Here: {l}',openConfig:'Open settings on the top screen',
  waiting:'Opening…',opened:'Settings opened on the top screen',none:'No mods match',building:'Reading the mod list…',update:'Update the game mod to see this',
  noGmcm:'Generic Mod Config Menu is not installed',gmcmOld:'This Generic Mod Config Menu version is not supported',
  err:{unpaired:'Pair controls first',busy:'Close the menu, event or dialogue in game first',invalid:'Invalid request',connection:'Cannot reach the game','no-config':'This mod has no settings to open','game-error':'The game could not open the settings',unavailable:'Not available right now'},
  kinds:{skills:'skills',collections:'collections',events:'events',bundles:'bundles',relations:'relations',farm:'farm',config:'settings'}}};
const w=(k,v={})=>{const x=(T[lang]||T.en)[k];return typeof x==='string'?x.replace(/\{(\w)\}/g,(_,z)=>v[z]??''):x;};
T.zh.pinned='已置顶';T.en.pinned='Pinned';T.zh.integrated='下屏适配';T.en.integrated='App support';
const panel=$('settings');let state={open:false,query:'',filter:'all',category:'',expanded:null,editing:null,listPage:0},status={},drawn='',epoch=0;
const pageSize=12,cards=new Map();let catalogKey='',catalog=[],listKey='';
// ---- Entry row in Settings ----
const heading=el('h2','section-title mods-title'),row=el('div','settings-row mods-row'),copy=el('div'),label=el('h3'),count=el('small','mods-count'),go=el('button','mods-go');
go.type='button';copy.append(label,count);row.append(copy,go);go.onclick=()=>{window.ThorSound?.play?.('smallSelect');window.ThorNav?.open('settings',{modManager:{...state,open:true,expanded:null}});};
const anchor=document.querySelector('#settings [data-i=connectionTitle]');anchor?anchor.before(heading,row):panel.append(heading,row);
// ---- Sub page ----
const view=el('section','mods-view');view.hidden=true;const bar=el('div','journal-toolbar mods-bar'),search=el('input','mods-search');
search.type='search';search.autocomplete='off';search.dataset.native='true';search.classList.add('mods-native');search.oninput=()=>{state.query=search.value;state.listPage=0;drawn='';draw();};
bar.append(search);const chips=el('div','collection-filter mods-filter'),list=el('div','mods-list'),note=el('p','mods-note');
for(const k of ['all','pinned','config','integrated']){const b=el('button');b.type='button';b.dataset.filter=k;b.onclick=()=>{state.filter=k;state.listPage=0;drawn='';draw();};chips.append(b);}
const category=el('select','mods-category directory-kind'),categoryControl=el('div','game-control select-control directory-kind-control'),categoryLabel=el('span','control-label');categoryLabel.setAttribute('aria-hidden','true');categoryControl.append(category,categoryLabel);category.onchange=()=>{state.category=category.value;state.listPage=0;drawn='';draw();};
const paging=el('div','directory-pages mods-pages'),previous=el('button'),next=el('button'),pageCount=el('small');previous.type=next.type='button';
function turn(amount){state.listPage+=amount;state.expanded=null;drawn='';draw();panel.scrollTop=0;}
previous.onclick=()=>turn(-1);next.onclick=()=>turn(1);paging.append(previous,pageCount,next);
bar.append(categoryControl);view.append(bar,note,chips,list,paging);panel.append(view);
function data(){return ModLibrary.data();}
function paint(){const d=data(),n=d?.total??null,c=d?.mods.filter(m=>m.hasConfigMenu).length||0;
 for(const [node,text] of [[heading,w('section')],[label,w('title')],[count,n==null?'':d.gmcm==='ready'?w('count',{n,c}):w('countNoGmcm',{n})],[go,w('open')+' ›']])if(node.textContent!==text)node.textContent=text;}
function matches(m){const p=ModLibrary.info(m),q=state.query.trim().toLocaleLowerCase();if(q&&!(p.name+' '+p.description+' '+m.name+' '+m.id+' '+m.author).toLocaleLowerCase().includes(q))return false;
 return (!state.category||p.category===state.category)&&(state.filter==='all'||(state.filter==='pinned'?ModLibrary.pinned(m.id):state.filter==='config'?m.hasConfigMenu===true:m.integrated.length>0));}
async function openConfig(m){const s=model.snapshot,e=epoch;status[m.id]={state:'waiting'};drawn='';draw();
 const code=!s||model.status(performance.now())!=='ready'?'connection':window.ThorCommands?.paired&&!ThorCommands.paired()?'unpaired':s.control?.modConfig!==true?'busy':null;
 if(code){status[m.id]={state:'error',code};drawn='';draw();return;}
 const c={id:uid(),order:Math.max(Date.now(),Number(localStorage.getItem('stardew.order')||0)+1),session:s.session,revision:s.revision,action:'open-mod-config',modId:m.id};
 localStorage.setItem('stardew.order',String(c.order));const body=JSON.stringify(c);let result=await commandRequest('command',body);
 for(let i=0;i<7&&(!result||['queued','unavailable'].includes(result.state));i++){await new Promise(r=>setTimeout(r,[40,70,120,180,250,350,500][i]));if(e!==epoch||s.session!==model.snapshot?.session)return;result=await commandRequest('receipt/'+c.id);}
 if(e!==epoch||s.session!==model.snapshot?.session)return;
 status[m.id]=result?.state==='applied'?{state:'done'}:{state:'error',code:result?.code||'unavailable'};if(result?.state==='applied')window.ThorSound?.play?.('dwop');drawn='';draw();}
function statusText(s){if(!s)return '';if(s.state==='waiting')return w('waiting');if(s.state==='done')return w('opened');return w('err')[s.code]||w('err').unavailable;}
function draw(){ModLibrary.focus(state.open&&page==='settings'&&!state.editing?state.expanded:null);if(!state.open||page!=='settings')return;const d=data();
 const key=JSON.stringify([lang,d?.version,d?.language,LiveData.status('mods'),state,status,ModLibrary.revision(),model.snapshot?.control?.modConfig,model.status(performance.now())]);if(key===drawn)return;drawn=key;
 for(const n of [bar,note,chips,categoryControl,list,paging])n.hidden=!!state.editing;
 if(state.editing){const m=d?.mods.find(m=>m.id===state.editing);if(m)ModEditor.open(m,view);return;}ModEditor.close();
 search.placeholder=w('search');if(search.value!==state.query)search.value=state.query;
 category.setAttribute('aria-label',lang==='zh'?'筛选模组用途':'Filter mod purpose');if(category.dataset.language!==lang){category.replaceChildren(...[['',lang==='zh'?'全部用途':'All purposes'],...ModLibrary.categories()].map(([id,name])=>{const option=el('option','',name);option.value=id;return option;}));category.dataset.language=lang;}category.value=state.category;const selectedCategory=category.selectedOptions[0]?.textContent||'';if(categoryLabel.textContent!==selectedCategory)categoryLabel.textContent=selectedCategory;
 // How many mods each filter would show with the current search and purpose.
 const counts={all:0,pinned:0,config:0,integrated:0};if(d){const keep=state.filter;state.filter='all';for(const m of d.mods)if(matches(m)){counts.all++;if(ModLibrary.pinned(m.id))counts.pinned++;if(m.hasConfigMenu===true)counts.config++;if(m.integrated.length)counts.integrated++;}state.filter=keep;}
 for(const b of chips.children){const key=w(b.dataset.filter)+'|'+(d?counts[b.dataset.filter]:'');if(b.dataset.key!==key){b.dataset.key=key;b.replaceChildren(d?withCount(w(b.dataset.filter),counts[b.dataset.filter]):el('span','',w(b.dataset.filter)));}b.setAttribute('aria-pressed',String(state.filter===b.dataset.filter));}
 const notice=!['ready','title'].includes(model.status(performance.now()))?(lang==='zh'?'未连接游戏，上次记录只能查看，不能修改设置':'Disconnected; the last recorded list is read-only'):!d?'':d.gmcm==='absent'?w('noGmcm'):d.gmcm==='unsupported'?w('gmcmOld'):'';if(note.textContent!==notice)note.textContent=notice;note.hidden=!notice;note.dataset.tone=!['ready','title'].includes(model.status(performance.now()))||d?.gmcm==='absent'||d?.gmcm==='unsupported'?'warn':'info';
 if(!d){paging.hidden=true;const empty=LiveData.status('mods')?w('building'):(lang==='zh'?'连接游戏后读取已加载的模组':'Connect to read loaded mods');if(list.textContent!==empty)list.replaceChildren(el('p','journal-empty',empty));listKey='';cards.clear();return;}
 const sortKey=JSON.stringify([model.snapshot?.session,lang,d.version,d.language,ModLibrary.notesRevision(),ModLibrary.pinRevision()]);if(sortKey!==catalogKey){catalogKey=sortKey;const plain=n=>n.replace(/^\s*\[[^\]]*\]\s*/,'');catalog=d.mods.slice().sort((a,b)=>Number(ModLibrary.pinned(b.id))-Number(ModLibrary.pinned(a.id))||plain(a.name).localeCompare(plain(b.name),lang));}
 const shown=catalog.filter(matches),pages=Math.max(1,Math.ceil(shown.length/pageSize));state.listPage=Math.max(0,Math.min(pages-1,state.listPage||0));paging.hidden=pages===1;previous.disabled=!state.listPage;next.disabled=state.listPage===pages-1;
 for(const [node,value] of [[previous,lang==='zh'?'上一页':'Previous'],[next,lang==='zh'?'下一页':'Next'],[pageCount,(state.listPage+1)+' / '+pages+' · '+shown.length]])if(node.textContent!==value)node.textContent=value;
 if(!shown.length){if(list.textContent!==w('none'))list.replaceChildren(el('p','journal-empty',w('none')));listKey='';cards.clear();return;}
 const visible=shown.slice(state.listPage*pageSize,(state.listPage+1)*pageSize),visibleIds=new Set(visible.map(m=>m.id));for(const id of cards.keys())if(!visibleIds.has(id))cards.delete(id);
 const nodes=[];for(const m of visible){const signature=JSON.stringify([lang,m,ModLibrary.revision(m.id),ModLibrary.info(m),state.expanded===m.id,state.expanded===m.id?[status[m.id],d.gmcm,model.status(performance.now()),model.snapshot?.control?.modConfig]:null]);
  const saved=cards.get(m.id);if(saved?.signature===signature){nodes.push(saved.node);continue;}
  const item=el('div','mods-item'),head=el('button','mods-head'),copy=el('span','mods-copy'),tags=el('span','mods-tags');head.type='button';item.dataset.mod=m.id;
  copy.append(el('strong','',m.name),el('small','',factRow([m.version,m.author&&w('by',{a:m.author})])));
  if(m.hasConfigMenu)tags.append(el('small','mods-tag is-config',w('hasConfig')));if(m.integrated.length)tags.append(el('small','mods-tag is-integrated',w('integrated')));
  head.append(copy,tags);head.setAttribute('aria-expanded',String(state.expanded===m.id));head.onclick=()=>{state.expanded=state.expanded===m.id?null:m.id;drawn='';draw();};const identity=el('div','mods-identity'),pin=el('button','mods-pin');pin.type='button';pin.setAttribute('aria-pressed',String(ModLibrary.pinned(m.id)));pin.title=lang==='zh'?(ModLibrary.pinned(m.id)?'取消置顶':'置顶模组'):(ModLibrary.pinned(m.id)?'Unpin mod':'Pin mod');pin.setAttribute('aria-label',pin.title);pin.append(img('art/pin.svg'));pin.onclick=()=>{state.listPage=0;ModLibrary.togglePin(m.id);};identity.append(head,pin);item.append(identity);
  if(state.expanded===m.id){const more=el('div','mods-more');if(m.contentPackFor)more.append(el('small','',w('pack',{p:d.mods.find(x=>x.id.toLowerCase()===m.contentPackFor.toLowerCase())?.name||m.contentPackFor})));
   if(m.integrated.length)more.append(el('small','',w('integ',{l:m.integrated.map(k=>w('kinds')[k]||k).join(lang==='zh'?'、':', ')})));
   if(m.description)more.append(el('p','mods-description',m.description));
   if(m.hasConfigMenu&&d.gmcm==='ready'){const b=el('button','mods-config');b.type='button';b.textContent=w('openConfig');b.disabled=status[m.id]?.state==='waiting';b.onclick=()=>openConfig(m);more.append(b);}
   const s=statusText(status[m.id]);if(s){const n=el('small','mods-status',s);n.dataset.state=status[m.id].state;more.append(n);}
   item.append(more);}
  ModLibrary.decorate(item,m);cards.set(m.id,{signature,node:item});nodes.push(item);if(saved?.node.parentElement===list)saved.node.replaceWith(item);}
 const ids=visible.map(m=>m.id).join('|');if(ids!==listKey||list.children.length!==nodes.length){list.replaceChildren(...nodes);listKey=ids;}
}
function show(open){panel.classList.toggle('mods-open',open);view.hidden=!open;if(open){drawn='';draw();}else ModEditor.close();}
const base=window.render;window.render=function(){base();if(page==='settings'){if(state.open&&!state.editing)LiveData.need('mods');paint();draw();if(state.open)put('heading',state.editing?(lang==='zh'?'模组设置':'Mod settings'):w('title'));}else{drawn='';ModLibrary.focus(null);ModEditor.close();}};
window.ModManager={info:ModLibrary.info,openConfig,preview:ModLibrary.preview,refresh:()=>{drawn='';draw();},getState:()=>({...state}),restore:s=>{epoch++;status={};state={open:!!s?.open,query:s?.query||'',filter:['all','pinned','config','integrated'].includes(s?.filter)?s.filter:'all',category:ModLibrary.categories().some(([id])=>id===s?.category)?s.category:'',expanded:s?.expanded||null,editing:s?.editing||null,listPage:Math.max(0,Number.isInteger(s?.listPage)?s.listPage:0)};show(state.open);},back:()=>{if(!state.open)return false;if(state.editing){state.editing=null;show(true);return true;}state.open=false;show(false);return true;}};
paint();
})();
