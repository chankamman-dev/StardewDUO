/* One full-page state for every page: not connected, waiting for a save, loading, or an older
   game-side mod. The little Thor (thor-buddy.js) shows the page icon on its lower screen and a
   face for the state, then a title and what to do next, centred. */
(()=>{'use strict';
const T={zh:{connecting:'正在连接游戏…',saving:'正在保存游戏…',hintSaving:'游戏在结算和保存，完成后会自动恢复',disconnected:'未连接游戏',stale:'连接已断开',error:'暂时无法读取',title:'等待进入存档',transition:'等待进入存档',loading:'正在读取…',update:'请更新配套模组',
  invalid:'游戏数据暂时无法读取',hintInvalid:'已收到游戏回应，但数据格式不匹配；请确认下屏和模组版本配套',hintConnect:'请确认掌机上的星露谷物语正在运行，并已启用配套模组',hintSave:'在游戏里读取存档后会自动显示',hintUpdate:'游戏端模组版本较旧，还不会发送这部分数据'},
 en:{connecting:'Connecting to the game…',saving:'Saving the game…',hintSaving:'The game is settling the day and saving; this page comes back by itself',disconnected:'Game not connected',stale:'Connection lost',error:'Unable to read the game',title:'Waiting for a save',transition:'Waiting for a save',loading:'Loading…',update:'Update the companion mod',
  invalid:'Unable to read game data',hintInvalid:'The game replied, but its data format did not match. Check the App and mod versions',hintConnect:'Make sure Stardew Valley is running on the handheld with the companion mod enabled',hintSave:'Shows up once a save is loaded in the game',hintUpdate:'The game-side mod is older and does not send this yet'}};
const w=k=>(T[lang]||T.en)[k]||k;
// Which face the buddy makes for each connection state.
const MOOD={connecting:'loading',saving:'saving',invalid:'confused',disconnected:'sleep',stale:'sleep',error:'sleep',title:'idle',transition:'idle'};
function box(icon,title,hint,mood){const n=el('div','state-box');n.setAttribute('role','status');if(window.ThorBuddy)n.append(ThorBuddy.make(icon,mood));else if(icon)n.append(img(icon));n.append(el('p','state-title',title));if(hint)n.append(el('small','state-hint',hint));return n;}
// The game goes quiet while it ships and saves after sleep. When the last snapshot was the night
// scene, a pause of up to two minutes is that, not a lost connection.
function saving(){const s=model.snapshot;return model.status(performance.now())==='stale'&&s?.scene?.kind==='night'&&!!s.scene.night&&performance.now()-model.received<120000;}
// The connection state right now, or null when a save is loaded and live.
function connection(){const s=model.status(performance.now());if(['ready','multiplayer-unverified'].includes(s))return null;
 // Before the first reply of a fresh start there is nothing to report yet: a quiet 'connecting'
 // state that only appears if the reply takes more than half a second (no flash of 'not connected').
 if(!model.snapshot&&!model.error&&!model.online)return {key:'connecting',title:w('connecting'),hint:null,first:true};
 if(saving())return {key:'saving',title:w('saving'),hint:w('hintSaving')};
 if(model.failureKind==='data')return {key:'invalid',title:w('invalid'),hint:w('hintInvalid')};
 const key=['title','transition'].includes(s)?s:['stale','error'].includes(s)?s:'disconnected';return {key,title:w(key),hint:['title','transition'].includes(key)?w('hintSave'):w('hintConnect')};}
window.StateBox={
 box,
 connection(icon){const c=connection();if(!c)return null;const n=box(icon,c.title,c.hint,MOOD[c.key]);if(c.first)n.classList.add('is-first');return n;},
 saving,
 loading:icon=>box(icon,w('loading'),null,'loading'),
 update:(icon,title)=>box(icon,title||w('update'),w('hintUpdate'),'update'),
 text:w};
})();
