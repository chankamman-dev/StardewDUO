/* Crop profit planning with the game's own rules; pure (no DOM, no network, no randomness).
   Growth: HoeDirt.applySpeedIncreases. Yield: Crop.harvest (average of the random stack plus
   expected extra harvests). Price: Object.sellToStorePrice at base quality (Tiller x1.1 for
   vegetables/fruit/flowers, then the save's profit margin). Seeds: the price a shop lists (the mod reads Data/Shops); 0 = no shop sells it. */
((root)=>{'use strict';
 const seasons=['spring','summer','fall','winter'];
 const fertilizers={none:0,speed:.1,deluxe:.25,hyper:.33};
 const integer=(n,min,max,fallback)=>Number.isInteger(n)&&n>=min&&n<=max?n:fallback;
 function options(o={}){return {season:seasons.includes(o.season)?o.season:'spring',day:integer(o.day,1,28,1),plots:integer(o.plots,1,999,1),
  fertilizer:Object.hasOwn(fertilizers,o.fertilizer)?o.fertilizer:'none',replant:o.replant!==false,paddyWater:o.paddyWater===true,includeUnsold:o.includeUnsold===true,
  sort:['profit','daily','first','cost'].includes(o.sort)?o.sort:'profit'};}
 // Phase days after speed boosts, exactly as the game trims them (final 99999 phase untouched).
 // The game sums the boosts in 32-bit floats (fertilizer, +0.25f paddy, +0.1f Agriculturist) and
 // takes Math.Ceiling of (float)total * boost, so mirror that with Math.fround at every step.
 function boost(fertilizer,paddy,agriculturist){let b=Math.fround(fertilizers[fertilizer]||0);if(paddy)b=Math.fround(b+Math.fround(.25));if(agriculturist)b=Math.fround(b+Math.fround(.1));return b;}
 function phases(crop,b){const days=[...crop.phases,99999];if(!(b>0))return days;
  let total=0;for(let i=0;i<days.length-1;i++)total+=days[i];
  let remove=Math.ceil(Math.fround(Math.fround(total)*b)),tries=0;
  while(remove>0&&tries<3){for(let j=0;j<days.length;j++){if((j>0||days[j]>1)&&days[j]!==99999&&days[j]>0){days[j]--;remove--;}if(remove<=0)break;}tries++;}
  return days;}
 function growthDays(crop,o,farmer){return phases(crop,boost(o.fertilizer,crop.paddy&&o.paddyWater,!!farmer?.agriculturist)).slice(0,-1).reduce((a,b)=>a+b,0);}
 function averageYield(crop,level){const max=Math.max(crop.minStack,crop.maxStack)+(crop.maxPerLevel>0?Math.floor(level*crop.maxPerLevel):0);
  const base=crop.minStack>1||max>1?(crop.minStack+max)/2:1,p=Math.min(.9,crop.extraChance||0);return base+(p>0?p/(1-p):0);}
 function sellPrice(crop,farmer){const tiller=farmer?.tiller&&[-75,-79,-80].includes(crop.category)?1.1:1,margin=farmer?.profitMargin>0?farmer.profitMargin:1;
  const p=crop.sellPrice*tiller;return p>0?Math.floor(Math.max(1,p*margin)):0;}
 // The crop keeps growing through the following seasons it is in season for (no wrap past winter).
 function horizon(crop,season){let n=0;for(let i=seasons.indexOf(season);i<4&&crop.seasons.includes(seasons[i]);i++)n++;return n*28;}
 function calculate(crop,input,farmer){const o=options(input),growth=growthDays(crop,o,farmer),end=horizon(crop,o.season),harvests=[],sowings=[];
  if(growth>0&&end>0){sowings.push(o.day);let day=o.day+growth;
   while(day<=end){harvests.push(day);if(crop.regrow>0)day+=crop.regrow;else if(o.replant&&day+growth<=end){sowings.push(day);day+=growth;}else break;}}
  const each=averageYield(crop,farmer?.farmingLevel||0),price=sellPrice(crop,farmer),seeds=sowings.length*o.plots,quantity=harvests.length*o.plots*each;
  const cost=seeds*crop.seedPrice,revenue=Math.round(quantity*price),profit=revenue-cost,last=harvests.at(-1)??o.day,span=Math.max(1,last-o.day);
  return {id:crop.seedId,growth,end,seasonsCovered:end/28,harvests,sowings,seeds,quantity,each,price,cost,revenue,profit,
   initialCost:o.plots*crop.seedPrice,perDay:profit/span,first:harvests[0]??null,lastSow:end-growth,feasible:harvests.length>0,seedKnown:crop.seedPrice>0};}
 function compare(a,b,sort){if(a.feasible!==b.feasible)return a.feasible?-1:1;
  return (sort==='first'?(a.first??999)-(b.first??999):sort==='cost'?a.initialCost-b.initialCost:sort==='daily'?b.perDay-a.perDay:b.profit-a.profit)||a.id.localeCompare(b.id);}
 const api={options,boost,phases,growthDays,averageYield,sellPrice,horizon,calculate,compare,fertilizers:Object.keys(fertilizers)};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.CropMath=api;
})(typeof window==='undefined'?globalThis:window);
