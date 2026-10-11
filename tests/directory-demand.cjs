const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
function requests(page,section,ready){const asked=[],c={page,db:null,Journal:{getState:()=>({section})},LiveData:{need:n=>asked.push(n),peek:n=>ready?{state:'ready'}:null,onChange:()=>{}},render:()=>{}};c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync('android/assets/runtime-catalog.js','utf8'),c);c.render();return asked;}
for(const [page,section,secondary] of [['manual','collections','items'],['manual','bundles','items'],['quests','events','people']]){
 assert.deepEqual(requests(page,section,false),[],section+' cold read does not start unrelated exports');
 assert.deepEqual(requests(page,section,true),[secondary],section+' warms only the useful catalogue after primary data');
}
assert.deepEqual(requests('people',null,false),['people','progress']);
assert.deepEqual(requests('bag',null,false),['items','progress']);
console.log('PASS directory demand: primary-first loading and ordinary page demand preserved');
