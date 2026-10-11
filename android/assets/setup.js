/* First launch: explain the one-time asset import and show its progress and errors in the
   page itself. The native side reports through window.stardewImport({kind,state,code}); on
   success it loads the App directly. */
(()=>{'use strict';
const T={
 zh:{tagline:'星露谷物语双屏伴侣',title:'首次使用：导入你自己的游戏素材',
  why:'为尊重版权，App 不附带任何游戏图片与文字。用你拥有的 PC 版游戏生成一份素材包，只需要做一次。',
  step1:'在电脑上生成素材包',step1Hint:'按安装说明运行 AssetExporter 和提取脚本',
  step2:'复制到 Thor',step2Hint:'把 StardewDS-private-assets.zip 放进“下载”',
  step3:'在这里选择它',step3Hint:'逐个文件校验；失败不会影响已有素材',
  choose:'选择素材 ZIP',local:'素材只保存在这台设备上，不会上传。',lang:'EN',
  idle:['还没有导入素材','准备好 ZIP 后点右边的按钮'],checking:['正在检查素材包…','文件较多，需要几秒钟'],ok:['导入完成','正在打开 StardewDS…'],
  format:['这不是素材包','请选择提取脚本生成的 ZIP'],incomplete:['素材包不完整','缺少必要文件，请重新生成'],
  damaged:['素材包已损坏','文件校验失败，请重新复制'],size:['文件太大','超过 128 MB，不像素材包'],
  read:['无法读取这个文件','请确认文件已完整复制后重试'],preview:['浏览器预览','请在 Thor 上的 App 里选择']},
 en:{tagline:'Stardew Valley dual-screen companion',title:'First run: import assets from your own game',
  why:'The App ships without any game art or text. Generate an asset pack once from the PC game you own.',
  step1:'Generate the pack on a PC',step1Hint:'Run AssetExporter and the extract script (see INSTALL)',
  step2:'Copy it to the Thor',step2Hint:'Put StardewDS-private-assets.zip in Download',
  step3:'Choose it here',step3Hint:'Every file is checked; a failure keeps your current assets',
  choose:'Choose ZIP',local:'Assets stay on this device and are never uploaded.',lang:'中文',
  idle:['No assets imported yet','Tap the button when ready'],checking:['Checking the asset pack…','Many files; a few seconds'],ok:['Imported','Opening StardewDS…'],
  format:['Not an asset pack','Pick the ZIP the script made'],incomplete:['Asset pack incomplete','Files missing; generate it again'],
  damaged:['Asset pack damaged','A file failed; copy it again'],size:['File too large','Over 128 MB; not an asset pack'],
  read:['Cannot read this file','Copy it fully, then try again'],preview:['Browser preview','Works in the App on the Thor']}};
let lang='zh';try{lang=localStorage.getItem('stardew.language')==='en'?'en':'zh';}catch{}
let status={state:'idle'};
const $=id=>document.getElementById(id),put=(node,text)=>{if(node.textContent!==text)node.textContent=text;};
function paint(){const t=T[lang];document.documentElement.lang=lang==='zh'?'zh-CN':'en';
 document.querySelectorAll('[data-t]').forEach(n=>put(n,t[n.dataset.t]));put($('setup-lang').firstElementChild,t.lang);
 const [title,detail]=t[status.state==='error'?(t[status.code]?status.code:'read'):status.state]||t.idle;
 $('setup-status').dataset.state=status.state;put($('status-title'),title);put($('status-detail'),detail);
 $('setup-choose').disabled=status.state==='checking'||status.state==='ok';}
window.stardewImport=result=>{if(result?.kind!=='assets')return;status={state:result.state==='idle'?'idle':result.state,code:result.code};paint();};
$('setup-choose').onclick=()=>{if(typeof window.ThorCommands?.importAssets!=='function'){status={state:'error',code:'preview'};paint();return;}window.ThorCommands.importAssets();};
$('setup-lang').onclick=()=>{lang=lang==='zh'?'en':'zh';try{localStorage.setItem('stardew.language',lang);}catch{}paint();};
paint();
})();
