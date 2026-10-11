/* Settings → 本机文件: control pairing and the imported game assets, each with its current state
   and one button. Import progress and errors are shown in the row (never a system toast); the
   native side reports through window.stardewImport({kind,state,code}). Only in the Android App. */
(()=>{'use strict';
const native=window.ThorCommands;if(typeof native?.importAssets!=='function')return;
const T={zh:{title:'本机文件',pairing:'控制配对',assets:'游戏素材',paired:'已配对，可以在下屏整理背包和制作',unpaired:'未配对，只能查看',
  pair:'导入配对',repair:'重新配对',import:'重新导入',bundled:'开发版内置素材',none:'尚未导入',files:'{n} 个文件，{d}导入',
  checking:'正在检查…',pairOk:'配对完成',assetsOk:'素材已更新，共 {n} 个文件',pairError:'不是有效的 control-key.json',
  format:'不是素材包',incomplete:'素材包不完整',damaged:'文件校验失败',size:'文件太大',read:'无法读取文件',kept:'，原素材已保留'},
 en:{title:'Local files',pairing:'Control pairing',assets:'Game assets',paired:'Paired: bag and crafting controls on',unpaired:'Not paired: view only',
  pair:'Pair',repair:'Pair again',import:'Re-import',bundled:'Built into this dev build',none:'Not imported',files:'{n} files, imported {d}',
  checking:'Checking…',pairOk:'Paired',assetsOk:'Assets updated: {n} files',pairError:'Not a valid control-key.json',
  format:'Not an asset pack',incomplete:'Pack incomplete',damaged:'Check failed',size:'File too large',read:'Cannot read the file',kept:'; assets kept'}};
const w=(k,v={})=>((T[lang]||T.en)[k]||k).replace(/\{(\w)\}/g,(_,x)=>v[x]??'');
const title=el('h2','section-title local-title'),rows={};
for(const kind of ['pairing','assets']){const row=el('div','settings-row local-row'),copy=el('div','local-copy'),label=el('h3'),state=el('small','local-state'),button=el('button','local-button');
 button.type='button';button.dataset.kind=kind;copy.append(label,state);row.append(copy,button);rows[kind]={row,label,state,button,message:null};
 button.onclick=()=>{window.ThorSound?.play?.('smallSelect');kind==='pairing'?native.importPairing?.():native.importAssets();};}
const details=document.querySelector('#settings > details');(details?details.before.bind(details):$('settings').append.bind($('settings')))(title,rows.pairing.row,rows.assets.row);
let info=null;function assetInfo(){if(!info)try{info=JSON.parse(native.assetInfo?.()||'null');}catch{}return info||{source:'none'};}
function day(ms){const d=new Date(ms);return lang==='zh'?`${d.getMonth()+1}月${d.getDate()}日`:d.toLocaleDateString('en',{month:'short',day:'numeric'});}
// A result stays until the next import or 12 s, whichever comes first.
function show(kind,state,text){rows[kind].message={state,text,at:performance.now()};update();}
window.stardewImport=result=>{const r=rows[result?.kind];if(!r)return;
 if(result.state==='idle'){r.message=null;update();return;}
 if(result.state==='checking')return show(result.kind,'checking',w('checking'));
 if(result.state==='ok')return show(result.kind,'ok',result.kind==='pairing'?w('pairOk'):w('assetsOk',{n:result.files}));
 show(result.kind,'error',result.kind==='pairing'?w('pairError'):w(T.zh[result.code]?result.code:'read')+w('kept'));};
try{const pending=JSON.parse(native.notice?.()||'null');if(pending)window.stardewImport(pending);}catch{}
function put(node,text){if(node.textContent!==text)node.textContent=text;}
function update(){put(title,w('title'));const paired=!!native.paired?.(),a=assetInfo();
 const base={pairing:paired?w('paired'):w('unpaired'),assets:a.source==='bundled'?w('bundled'):a.source==='pack'?w('files',{n:a.files,d:day(a.at)}):w('none')};
 for(const [kind,r] of Object.entries(rows)){if(r.message&&r.message.state!=='checking'&&performance.now()-r.message.at>12000)r.message=null;
  put(r.label,w(kind));put(r.state,r.message?.text||base[kind]);r.state.dataset.state=r.message?.state||(kind==='pairing'?(paired?'ok':'off'):(a.source==='none'?'off':'ok'));
  put(r.button,kind==='pairing'?(paired?w('repair'):w('pair')):w('import'));r.button.disabled=r.message?.state==='checking';}}
const before=render;render=function(){before();if(page==='settings')update();};update();
})();
