const assert=require('assert/strict'),Model=require('../android/assets/model.js');
const envelope=()=>({protocol:'stardew-thor.readonly.v1',gameAgeMs:0,snapshot:{session:'fixture',seq:1,revision:1,state:'ready',language:'zh',bag:{capacity:1,slots:[null]},source:'fixture',targetState:'ready',target:{id:'npc/Lewis',kind:'npc',name:'Lewis',icon:null,location:'Saloon',x:1,y:1,fields:[],gifts:[],giftsLimited:false}}});
for(const icon of ['/bridge/asset/'+'a'.repeat(64),'data:image/png;base64,AAAA',null]){const e=envelope();e.snapshot.target.icon=icon;const m=new Model();assert(m.accept(e,0));assert.equal(m.status(1),'ready');}
const m=new Model();m.accept(envelope(),0);
for(const icon of ['https://example.com/p.png','/bridge/asset/'+ 'a'.repeat(63),'/bridge/asset/'+ 'a'.repeat(64)+'?x=1','//example.com/p.png','file:///portrait.png','data:image/svg+xml;base64,AAAA']){const bad=envelope();bad.snapshot.seq=2;bad.snapshot.target.icon=icon;{const k=new Model();assert(k.accept(bad,1));assert.equal(k.snapshot.target,null,'unsafe portrait never kept');}}
m.fail('target','data');assert.equal(m.failureKind,'data');assert.equal(m.status(1),'stale');assert.equal(m.snapshot.seq,1);
assert(m.accept(envelope(),2));assert.equal(m.failureKind,null);assert.equal(m.status(3),'ready');m.fail('timeout');assert.equal(m.failureKind,'transport');
console.log('PASS target portrait contract: local hash and legacy PNG, unsafe URL rejection, atomicity and failure classification');
