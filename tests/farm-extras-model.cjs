const assert=require('node:assert/strict'),Model=require('../android/assets/model.js');
const ready={version:1,state:'ready',junimos:{state:'ready',paidToday:false,huts:2,abilities:['Water']},family:{state:'ready',source:'vanilla',modState:'absent',spouse:null,children:[{name:'孩子',birthday:'春季5日',daysToGrow:3}]},playerBirthday:{state:'ready',season:'spring',day:5,today:false},slayer:[{id:'Slimes',name:'史莱姆',killed:800,goal:1000,reward:'(O)520',claimed:false}],limited:[]};
let checks=0;function Check(v,name){assert(v,name);checks++;}
Check(Model.validateFarmExtras(ready),'ready extras');
const report={version:1,collectedAt:1,state:'ready',places:[],outlook:null,limited:[],extras:ready};Check(Model.validFarm(report),'extras integrated into farm even without outlook');
for(const state of ['building','absent','unsupported','unavailable'])Check(Model.validateFarmExtras({...ready,state,junimos:{state},family:{...ready.family,state},playerBirthday:{state}}),'explicit '+state);
for(const bad of [{version:-1},{junimos:{...ready.junimos,huts:257}},{junimos:{...ready.junimos,paidToday:0}},{family:{...ready.family,children:Array(17).fill(ready.family.children[0])}},{family:{...ready.family,children:[{...ready.family.children[0],daysToGrow:-2}]}},{playerBirthday:{state:'ready',season:'spring',day:29,today:false}},{playerBirthday:{state:'ready',season:null,day:5,today:null}},{slayer:[{...ready.slayer[0],reward:'guess'}]},{slayer:[ready.slayer[0],ready.slayer[0]]},{limited:Array(17).fill('limit')}])Check(!Model.validateFarmExtras({...ready,...bad}),'reject malformed extras '+JSON.stringify(bad));
Check(!Model.validFarm({...report,extras:{...ready,version:-1}}),'malformed extras rejected by farm');
console.log('PASS farm extras model',checks,'checks');
