/* Display-only interpretation of supported vanilla preconditions. Never evaluates or triggers an event.
   Aliases and minimum/year/weather semantics were checked against the installed game's Preconditions. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.EventLabels=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 // The game splits conditions outside quotes. Mod event IDs may contain '/';
 // escaped or truncated quoted data stays unsupported rather than being misread.
 function parts(raw){const result=[];let part='',quoted=false;for(const c of raw){if(c==='\\')return null;if(c==='"')quoted=!quoted;if(c==='/'&&!quoted){if(part.trim())result.push(part);part='';}else part+=c;}if(quoted)return null;if(part.trim())result.push(part);return result;}
 function describe(e,language,people=[],location=e.location){
  const zh=language==='zh',text=(a,b)=>zh?a:b,find=id=>people.find(p=>String(p.id).toLowerCase()===id.toLowerCase()),person=id=>find(id)?.name||({grandpa:text('爷爷','Grandpa')})[id.toLowerCase()]||id;
  const clock=n=>String(Math.floor(n/100)).padStart(2,'0')+':'+String(n%100).padStart(2,'0'),rows=[],names=new Set();let unknown=0;
  const add=(key,value)=>rows.push({key,value}),seasons={spring:text('春季','Spring'),summer:text('夏季','Summer'),fall:text('秋季','Fall'),winter:text('冬季','Winter')};
  const aliases={f:'Friendship',O:'Spouse',o:'NotSpouse',p:'NpcVisibleHere',t:'Time',w:'Weather',y:'Year',e:'SawEvent',u:'DayOfMonth',z:'NotSeason',c:'FreeInventorySlots'};
  const conditions=parts(e.conditions?.raw||'');if(!conditions)unknown++;
  for(const part of conditions||[]){
   const tokens=part.trim().match(/"[^"\r\n]*"|[^\s]+/g)||[],raw=tokens.shift()||'',negated=raw.startsWith('!'),key=raw.replace(/^!/,''),kind=aliases[key]||key,args=tokens.map(s=>s.replace(/^"|"$/g,''));let value=null;
   const numbers=()=>args.every(s=>/^\d+$/.test(s));
   if(kind==='Friendship'&&!negated&&args.length>=2&&args.length%2===0&&args.every((s,i)=>i%2===0||/^\d+$/.test(s))){value=args.reduce((list,id,i)=>{if(i%2===0){names.add(person(id));const points=Number(args[i+1]);list.push(person(id)+' ≥ '+points/250+text(' 心',' hearts')+' ('+points+text(' 好感',' points')+')');}return list;},[]).join('\n');}
   else if(['Spouse','NotSpouse'].includes(kind)&&args.length===1){names.add(person(args[0]));value=person(args[0])+text(kind==='NotSpouse'?'：未订婚或结婚':'：订婚或结婚',kind==='NotSpouse'?': not engaged or married':': engaged or married');}
   else if(kind==='NpcVisibleHere'&&args.length===1){names.add(person(args[0]));value=person(args[0])+text('在此地点可见',' visible at this location');}
   else if(kind==='Time'&&args.length===2&&numbers()&&args.every(n=>Number(n)<=2800&&Number(n)%100<60))value=clock(Number(args[0]))+' – '+clock(Number(args[1]));
   else if(kind==='Year'&&args.length===1&&numbers())value=text('年份','Year')+(args[0]==='1'?' = ':' ≥ ')+args[0];
   else if(kind==='Weather'&&args.length===1&&['rainy','sunny'].includes(args[0]))value=text(args[0]==='rainy'?'当前地点下雨':'当前地点不下雨',args[0]==='rainy'?'Raining at this location':'Not raining at this location');
   else if(['Season','NotSeason'].includes(kind)&&args.length&&args.every(s=>seasons[s.toLowerCase()]))value=text(kind==='NotSeason'?'排除季节：':'季节：',kind==='NotSeason'?'Excluded seasons: ':'Season: ')+args.map(s=>seasons[s.toLowerCase()]).join(' / ');
   else if(kind==='DayOfMonth'&&args.length&&numbers()&&args.every(n=>Number(n)>=1&&Number(n)<=28))value=text('每月 ','Day of month: ')+args.join(' / ')+text(' 日','');
   else if(kind==='SawEvent'&&args.length)value=text('已看过以下任一事件：','Seen any of these events: ')+args.join(' / ');
   else if(kind==='FreeInventorySlots'&&args.length===1&&numbers())value=text('背包空位 ≥ ','Free inventory slots ≥ ')+args[0];
   if(value){if(negated)value=text('不满足：','NOT: ')+value;add(kind,value);}else unknown++;
  }
  if(!e.conditions?.raw){for(const h of e.conditions?.hearts||[])if(find(h.npc)&&h.points>0){names.add(person(h.npc));add('Friendship',person(h.npc)+' '+h.points+text(' 好感（模组记录）',' points (reported by mod)'));}}
  const dialogue=(e.dialogue||[]).map(d=>({speaker:d.npc?person(d.npc):text('旁白','Narration'),text:d.text}));
  const excerpt=dialogue.find(d=>Array.from(d.text).length>=12)||dialogue[0];
  const clip=s=>{const letters=Array.from(s),max=zh?30:64;return letters.length>max?letters.slice(0,max).join('')+'…':s;};
  const title=e.name?.trim()||(excerpt?excerpt.speaker+text('：「',': “')+clip(excerpt.text)+text('」','”'):(names.size?text([...names].slice(0,2).join('、')+'的'+location+'剧情',location+' event with '+[...names].slice(0,2).join(' and ')):location+text('剧情',' event')));
  return {title,rows,unknown,unnamed:!e.name?.trim(),fromDialogue:!e.name?.trim()&&!!excerpt,dialogue,people:[...names]};
 }
 return {describe,parts};
});
