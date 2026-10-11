// Unit checks for android/assets/crop-math.js (the game's rules; crop-host.cjs checks every
// crop against the running game). Values below follow the game code paths directly.
const assert=require('node:assert/strict'),M=require('../android/assets/crop-math.js');
const crop=(o)=>({seedId:'(O)x',seedName:'x',harvestId:'(O)y',harvestName:'y',seasons:['spring'],phases:[1,1,1,1],regrow:-1,minStack:1,maxStack:1,maxPerLevel:0,extraChance:0,seedPrice:20,sellPrice:35,category:-75,paddy:false,trellis:false,...o});
let n=0;const check=(a,b,m)=>{assert.deepEqual(a,b,m);n++;};
const parsnip=crop({}),cauli=crop({phases:[1,2,4,4,1],seedPrice:80,sellPrice:175});
const grow=(c,f,agri)=>M.growthDays(c,M.options({fertilizer:f}),{agriculturist:agri});
check(grow(parsnip,'none',false),4,'parsnip base');check(grow(parsnip,'speed',false),3,'parsnip speed-gro');check(grow(parsnip,'hyper',false),2,'parsnip hyper');
check(grow(cauli,'none',false),12,'cauliflower base');check(grow(cauli,'none',true),10,'agriculturist');check(grow(cauli,'deluxe',true),7,'deluxe + agriculturist (float sum)');
// Replant: day 1 sowing, 4-day parsnip harvests on 5,9,...,25; the day-25 crop could not ripen again.
let r=M.calculate(parsnip,{season:'spring',day:1,plots:1},{});check(r.harvests,[5,9,13,17,21,25],'parsnip schedule');check(r.seeds,6,'six seeds');check(r.profit,6*35-6*20,'parsnip profit');
r=M.calculate(parsnip,{season:'spring',day:1,plots:10,replant:false},{});check(r.harvests,[5],'sown once');check(r.cost,200,'ten seeds');
// Too late: sown on day 26, a 4-day crop would ripen on day 30.
r=M.calculate(parsnip,{season:'spring',day:26},{});check(r.feasible,false,'too late');check(r.lastSow,24,'last sow day');
// Regrow: first harvest after growth, then every regrow days; one seed.
r=M.calculate(crop({phases:[1,2,2,2,3],regrow:3,seasons:['summer']}),{season:'summer',day:1},{});check(r.harvests.slice(0,3),[11,14,17],'regrow schedule');check(r.seeds,1,'regrow one seed');
// Multi-season: corn (summer+fall) keeps growing into fall from summer, not from fall.
const corn=crop({phases:[2,3,3,3,3],regrow:4,seasons:['summer','fall']});check(M.horizon(corn,'summer'),56,'two seasons');check(M.horizon(corn,'fall'),28,'one season');
// Yield: random stack 1..(3 + level x 0.5) averaged, plus p/(1-p) extra harvests.
check(M.averageYield(crop({minStack:1,maxStack:3,maxPerLevel:.5}),4),(1+5)/2,'stack average with level');check(Math.round(M.averageYield(crop({extraChance:.2}),0)*1000)/1000,1.25,'extra harvest chance');
// Price: Tiller x1.1 for vegetables/fruit/flowers only, then the profit margin, floored.
check(M.sellPrice(parsnip,{tiller:true}),38,'tiller vegetable');check(M.sellPrice(crop({category:-81}),{tiller:true}),35,'tiller does not apply');check(M.sellPrice(parsnip,{profitMargin:.75}),26,'profit margin');
// Sort: infeasible last; per-day sort.
const rows=[crop({seedId:'a',sellPrice:100}),crop({seedId:'b',phases:[20]})].map(c=>M.calculate(c,{season:'spring',day:10},{}));check(rows.sort((x,y)=>M.compare(x,y,'profit')).map(x=>x.id),['a','b'],'feasible first');
console.log('PASS crop math:',n,'checks');
