/* Settings → 游戏连接: what the App talks to. Mod version (from the snapshot envelope; older
   mods do not report one), App version, pairing and how long ago the game last answered. */
(()=>{'use strict';
const T={zh:{mod:'游戏端模组',app:'伴侣 App',pair:'控制配对',sync:'上次同步',oldMod:'旧版（未报告版本）',paired:'已配对',unpaired:'未配对，只能查看',preview:'浏览器预览',
  now:'刚刚',seconds:'{n} 秒前',minutes:'{n} 分钟前',never:'—'},
 en:{mod:'Game mod',app:'Companion app',pair:'Control pairing',sync:'Last update',oldMod:'Older (no version reported)',paired:'Paired',unpaired:'Not paired; view only',preview:'Browser preview',
  now:'Just now',seconds:'{n}s ago',minutes:'{n} min ago',never:'—'}};
const w=(k,n)=>((T[lang]||T.en)[k]||k).replace('{n}',n);
const list=el('dl','connection-facts'),values={};
for(const key of ['mod','app','pair','sync']){const dt=el('dt'),dd=el('dd');list.append(dt,dd);values[key]=[dt,dd];}
$('setting-state').closest('.settings-row').after(list);
const appVersion=()=>document.querySelector('footer span:last-child')?.textContent.trim()||'—';
function update(){const s=model.snapshot,live=!!s&&model.online;
 const age=s&&Number.isFinite(model.age)?Math.max(0,performance.now()-model.received+model.age):null;
 const sync=age==null?w('never'):age<3000?w('now'):age<60000?w('seconds',Math.round(age/1000)):w('minutes',Math.round(age/60000));
 const pair=typeof window.ThorCommands?.paired!=='function'?w('preview'):ThorCommands.paired()?w('paired'):w('unpaired');
 const text={mod:model.modVersion||(live?w('oldMod'):w('never')),app:appVersion(),pair,sync};
 for(const [key,[dt,dd]] of Object.entries(values)){if(dt.textContent!==w(key))dt.textContent=w(key);if(dd.textContent!==text[key])dd.textContent=text[key];}}
const previous=render;render=function(){previous();if(page==='settings')update();};update();
})();
