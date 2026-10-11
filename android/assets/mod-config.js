/* Standard GMCM settings: draft locally, explicit authenticated Save, no background writes. */
(()=>{'use strict';
function valid(d){
 const text=(s,n)=>typeof s==='string'&&s.length<=n;
 return !!d&&['building','ready','unsupported'].includes(d.state)&&text(d.modId,160)&&text(d.session,64)&&text(d.language,40)&&text(d.token,64)&&Array.isArray(d.limited)&&d.limited.length<=16&&d.limited.every(x=>text(x,80))&&Array.isArray(d.options)&&d.options.length<=128&&new Set(d.options.map(o=>o.key)).size===d.options.length&&d.options.every(o=>o&&/^\d{1,3}$/.test(o.key)&&Number(o.key)<128&&text(o.page,240)&&text(o.name,240)&&text(o.tooltip,1000)&&typeof o.editable==='boolean'&&['bool','int','float','text','choice','section','unsupported'].includes(o.kind)&&[o.min,o.max,o.step].every(n=>n==null||typeof n==='number'&&Number.isFinite(n))&&(o.reason==null||text(o.reason,80))&&(o.choices==null||Array.isArray(o.choices)&&o.choices.length<=64&&o.choices.every(c=>text(c.value,512)&&text(c.label,240)))&&(o.kind==='bool'?typeof o.value==='boolean':o.kind==='int'?Number.isSafeInteger(o.value):o.kind==='float'?Number.isFinite(o.value):['text','choice'].includes(o.kind)?o.value==null||text(o.value,512):o.value==null))&&(d.state!=='ready'||/^[a-f0-9]{64}$/.test(d.token));
}
if(typeof module==='object'){module.exports={valid};return;}
const zh=()=>lang==='zh',word=(cn,en)=>zh()?cn:en;
let host=null,mod=null,doc=null,draft={},epoch=0,flight=null,busy=false,notice='',last=-Infinity,lastSession=null;
const active=()=>!!mod&&page==='settings'&&!document.hidden&&!stopped&&window.ModManager?.getState().editing===mod.id;
const dirty=()=>doc?.options.filter(o=>Object.hasOwn(draft,o.key)&&!Object.is(draft[o.key],o.value))||[];
function close(){epoch++;flight?.abort();flight=null;mod=null;doc=null;draft={};notice='';busy=false;if(host){host.remove();host=null;}}
function open(m,parent){if(mod?.id===m.id&&host?.parentNode===parent)return;close();mod=m;host=el('section','mods-editor');parent.append(host);last=-Infinity;draw();tick();}
async function load(force=false){if(!active()||busy||flight)return;const e=epoch,s=model.snapshot?.session,m=mod.id,controller=new AbortController();flight=controller;last=performance.now();
 const timeout=setTimeout(()=>controller.abort(),4000);
 try{const r=await fetch('/bridge/mod-config/'+m,{cache:'no-store',signal:controller.signal});if(!r.ok)throw Error();const value=await r.json();if(e!==epoch||!active()||s!==model.snapshot?.session)return;
  if(!valid(value)||value.modId!==m)throw Error();if(value.state==='ready'&&value.session!==s)throw Error();
  if(value.state==='building'){if(!doc)notice=word('正在读取设置…','Reading settings…');last=performance.now()-4200;return;}
  if(!force&&doc?.state===value.state&&doc?.token===value.token)return;
  if(force||!dirty().length||!doc){doc=value;draft={};notice='';draw();}
  else if(doc.token!==value.token){notice=word('游戏中的设置已变化。请重新读取后再编辑。','Settings changed in game. Reload before editing.');draw();}
 }catch{if(e===epoch&&!controller.signal.aborted){notice=word('无法读取设置，请检查连接或更新游戏端模组。','Cannot read settings. Check the connection or update the bridge.');draw();}}
 finally{clearTimeout(timeout);if(flight===controller)flight=null;}}
function error(code){return ({'config-changed':word('设置已变化，请重新读取。','Settings changed. Reload first.'),'session-changed':word('存档已切换，请重新读取。','Save changed. Reload first.'),'config-readonly':word('此项只能在标题画面或上屏修改。','Edit this on the title screen or top screen.'),'config-value':word('设置值不在允许范围内。','Value outside the allowed range.'),'config-save-failed':word('保存回调失败，部分设置可能已生效。请重新读取核对。','Save callback failed; some changes may have applied. Reload to check.'),'game-busy':word('请结束剧情或对话后再保存。','Finish the event or dialogue first.'),'close-menu':word('请关闭上屏当前菜单后再保存。','Close the current top-screen menu first.'),'unpaired':word('请先配对控制。','Pair controls first.'),'multiplayer':word('联机时暂不支持修改模组设置。','Settings writes are unavailable in multiplayer.')})[code]||word('保存未确认，请重新读取核对后再操作。','Save was not confirmed. Reload to check before retrying.');}
async function save(){if(busy||!doc||!dirty().length)return;const s=model.snapshot,changes=dirty().map(o=>({key:o.key,value:draft[o.key]}));
 if(!s||!['ready','title'].includes(model.status(performance.now()))){notice=word('未连接游戏，不能保存。','Connect to the game to save.');draw();return;}
 if(window.ThorCommands?.paired&&!ThorCommands.paired()){notice=error('unpaired');draw();return;}
 if(changes.length>12){notice=word('一次最多保存 12 项，请分批调整。','Change up to 12 options at a time.');draw();return;}
 const command={id:uid(),order:Math.max(Date.now(),Number(localStorage.getItem('stardew.order')||0)+1),session:s.session,revision:s.revision,action:'save-mod-config',modId:mod.id,configToken:doc.token,configChanges:changes};
 const body=JSON.stringify(command);if(new TextEncoder().encode(body).length>2048){notice=word('这批内容过长，请减少修改项后保存。','Changes are too large. Save fewer options.');draw();return;}
 localStorage.setItem('stardew.order',String(command.order));busy=true;notice=word('正在保存…','Saving…');const e=epoch;draw();
 let receipt;try{receipt=await commandRequest('command',body);for(let i=0;i<8&&(!receipt||['queued','unavailable'].includes(receipt.state));i++){await new Promise(r=>setTimeout(r,[80,120,180,250,350,450,500,500][i]));if(e!==epoch)return;receipt=await commandRequest('receipt/'+command.id);}}catch{}
 if(e!==epoch)return;busy=false;if(receipt?.state==='applied'){draft={};notice=word('已保存。部分模组需重载或重启游戏。','Saved. Some mods require a reload or restart.');window.ThorSound?.play?.('dwop');doc=null;last=-Infinity;draw();load();}else{notice=error(receipt?.code);draw();}}
function button(text,click,cls=''){const b=el('button',cls,text);b.type='button';b.onclick=click;b.disabled=busy;return b;}
function draw(){if(!host||!mod)return;host.replaceChildren();const info=window.ModManager?.info(mod)||mod;
 const head=el('div','mods-editor-head');head.append(el('h2','',word(info.name,mod.name)),el('small','mods-original',factRow([mod.name,mod.version])));host.append(head);
 if(!doc){host.append(el('p','mods-note',notice||word('正在读取设置…','Reading settings…')));return;}
 if(doc.state!=='ready'){host.append(el('p','mods-note',word('这个模组的设置暂不能在下屏读取。','These settings cannot be read on this screen.')));host.append(button(word('在上屏打开设置','Open on top screen'),()=>ModManager.openConfig(mod)));return;}
 const actions=el('div','mods-editor-actions'),changed=dirty().length,saveButton=button(changed?withCount(word('保存','Save'),changed):word('保存','Save'),save,'mods-save'+(changed?' is-ready':''));saveButton.disabled=busy||!dirty().length;
 actions.append(saveButton,button(word('撤销修改','Discard changes'),()=>{draft={};notice='';draw();}),button(word('重新读取','Reload'),()=>{draft={};doc=null;notice='';draw();load(true);}));host.append(actions);
 if(notice)host.append(el('p','mods-note',notice));
 let previous=null;
 for(const o of doc.options){if(o.page!==previous){previous=o.page;if(o.page)host.append(el('h3','mods-option-page',o.page));}
  if(o.kind==='section'){host.append(el('h3','mods-option-page',o.name));continue;}
  const edited=Object.hasOwn(draft,o.key)&&!Object.is(draft[o.key],o.value),row=el('div','mods-option'+(edited?' is-changed':'')+(['choice','text'].includes(o.kind)?' is-wide':'')),copy=el('div','mods-option-copy');copy.append(el('strong','',o.name||word('未命名选项','Unnamed option')));if(edited)copy.append(el('small','mods-changed',word('已修改','Changed')));if(o.tooltip)copy.append(el('small','',o.tooltip));row.append(copy);
  if(!o.editable){row.append(el('small','mods-locked',o.reason==='title-only'?word('仅标题画面可改','Title screen only'):word('使用上屏设置','Use top-screen settings')));host.append(row);continue;}
  const value=Object.hasOwn(draft,o.key)?draft[o.key]:o.value,controls=el('div','mods-option-controls');
  const set=v=>{draft[o.key]=v;draw();};
  if(o.kind==='bool'){const b=button('',()=>set(!value),'mods-toggle');b.append(el('span','mods-knob'),el('small','',value?word('开启','On'):word('关闭','Off')));b.setAttribute('aria-pressed',String(value));controls.append(b);}
  else if(o.kind==='int'||o.kind==='float'){const step=o.step>0?o.step:o.kind==='float'?0.01:1,number=n=>Math.max(o.min??-2147483648,Math.min(o.max??2147483647,Number(n.toFixed(5))));const minus=button('−',()=>set(number(value-step))),plus=button('+',()=>set(number(value+step)));minus.disabled=busy||o.min!=null&&value<=o.min;plus.disabled=busy||o.max!=null&&value>=o.max;
   controls.append(minus,el('strong','mods-number',String(value)),plus);if(o.max!=null)controls.append(button(word('最大','Max'),()=>set(number(o.step>0?Math.floor(o.max/o.step)*o.step:o.max))));}
  else if(o.kind==='choice'){const select=el('select','mods-native');select.setAttribute('aria-label',o.name);for(const c of o.choices||[]){const n=el('option','',c.label);n.value=c.value;select.append(n);}select.value=value;select.disabled=busy;select.onchange=()=>set(select.value);controls.append(select);}
  else if(o.kind==='text'){const input=el('input','mods-native');input.type='text';input.maxLength=512;input.value=value??'';input.disabled=busy;input.setAttribute('aria-label',o.name);input.oninput=()=>{draft[o.key]=input.value;saveButton.disabled=busy||!dirty().length;};controls.append(input);}
  row.dataset.option=o.key;row.append(controls);host.append(row);
 }
 
 host.append(button(word('在上屏打开完整设置','Open full settings on top screen'),()=>ModManager.openConfig(mod)));
}
function tick(){if(!active()){flight?.abort();return;}const session=model.snapshot?.session;if(lastSession!==session){lastSession=session;epoch++;flight?.abort();flight=null;doc=null;draft={};last=-Infinity;draw();}
 if(!['ready','title'].includes(model.status(performance.now())))return;if(performance.now()-last>=5000)load();}
setInterval(tick,1000);window.ModEditor={open,close,tick,valid,dirty:()=>dirty().length};
})();
