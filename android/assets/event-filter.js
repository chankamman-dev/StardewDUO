/* Candidate selection from existing snapshots only. Never runs game/mod predicates.
   Unknown conditions remain unknown; this is not a native triggerability guarantee. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./event-labels.js'):root.EventLabels);if(typeof module==='object'&&module.exports)module.exports=api;else root.EventFilter=api;})(typeof globalThis!=='undefined'?globalThis:this,Labels=>{
 'use strict';
 const cache=new WeakMap(),aliases={f:'Friendship',O:'Spouse',o:'NotSpouse',p:'NpcVisibleHere',t:'Time',y:'Year',e:'SawEvent',u:'DayOfMonth',z:'NotSeason',c:'FreeInventorySlots'};
 function parsed(e){if(cache.has(e))return cache.get(e);const parts=Labels.parts(e.conditions?.raw||''),tokens=(parts||[]).map(part=>{const a=part.trim().match(/"[^"\r\n]*"|[^\s]+/g)||[],raw=a.shift()||'',negative=raw.startsWith('!'),key=raw.replace(/^!/,''),kind=aliases[key]||key;return {kind,negative,args:a.map(v=>v.replace(/^"|"$/g,''))};});
  const result={tokens,unknown:!parts||!parts.length,relationship:tokens.some(t=>['Friendship','Spouse','NotSpouse'].includes(t.kind))||(!e.conditions?.raw&&e.conditions?.hearts?.some(h=>h.points>0))};cache.set(e,result);return result;}
 function context(snapshot,entries=[],fresh=false){return {fresh,world:snapshot?.world,bag:snapshot?.bag,social:new Map((snapshot?.social||[]).map(p=>[p.id,p.points])),seen:new Map(entries.map(e=>[e.id,e.seen]))};}
 function candidate(e,ctx){if(e.seen||e.disabled)return {candidate:false,checked:0,unknown:0,blocked:true};const plan=parsed(e);let unknown=plan.unknown?1:0,checked=0,blocked=false;
  for(const {kind,negative,args:a} of plan.tokens){let value=null;const numeric=()=>a.every(v=>/^\d+$/.test(v)),world=ctx.fresh?ctx.world:null;
   if(kind==='Friendship'&&ctx.fresh&&a.length>=2&&a.length%2===0&&a.every((v,i)=>i%2===0||/^\d+$/.test(v))){const results=[];for(let i=0;i<a.length;i+=2)results.push(ctx.social.has(a[i])?ctx.social.get(a[i])>=Number(a[i+1]):null);value=results.includes(false)?false:results.includes(null)?null:true;}
   else if(kind==='Time'&&world&&a.length===2&&numeric()&&a.every(v=>Number(v)<=2800&&Number(v)%100<60)&&Number(a[0])<=Number(a[1]))value=world.time>=Number(a[0])&&world.time<=Number(a[1]);
   else if(kind==='Year'&&world&&a.length===1&&numeric())value=Number(a[0])===1?world.year===1:world.year>=Number(a[0]);
   // Multiple-season native syntax varies between game versions; only single-season checks are used.
   else if(['Season','NotSeason'].includes(kind)&&world&&a.length===1&&['spring','summer','fall','winter'].includes(a[0].toLowerCase())){value=world.season===a[0].toLowerCase();if(kind==='NotSeason')value=!value;}
   else if(kind==='DayOfMonth'&&world&&a.length&&numeric()&&a.every(v=>Number(v)>=1&&Number(v)<=28))value=a.map(Number).includes(world.day);
   else if(kind==='FreeInventorySlots'&&ctx.fresh&&ctx.bag&&a.length===1&&numeric())value=ctx.bag.capacity-ctx.bag.slots.filter(Boolean).length>=Number(a[0]);
   else if(kind==='SawEvent'&&ctx.fresh&&a.length){const values=a.map(id=>ctx.seen.has(id)?ctx.seen.get(id):null);value=values.includes(true)?true:values.includes(null)?null:false;}
   // HUD weather is not location.IsRainingHere; cached map NPCs do not prove visibility.
   // Marriage status does not fully describe farmer.spouse. Leave all of these unknown.
   if(value===null)unknown++;else{checked++;if(negative?value:!value)blocked=true;}
  }
  if(e.conditions?.when?.length)unknown++;
  if(e.conditions?.requiredItems?.length)unknown++;
  return {candidate:ctx.fresh&&!blocked&&checked>0,checked,unknown,blocked};
 }
 return {parsed,context,candidate};
});
