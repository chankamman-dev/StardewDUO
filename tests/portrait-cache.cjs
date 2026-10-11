const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync('android/assets/features.js','utf8'),a=src.indexOf('let livePeopleSession='),b=src.indexOf('\nfunction runtimePerson',a);assert(a>=0&&b>a);
let fresh=true;const c={livePeopleSignature:'',session:'save-a',lang:'zh',performance:{now:()=>0},model:{status:()=>fresh?'ready':'stale',snapshot:{tracking:{residents:[]}}},db:{zh:{people:[{id:'Abigail',name:'A'}]},en:{people:[{id:'Abigail',name:'A'}]}},renderPeople:()=>{}};vm.createContext(c);vm.runInContext(src.slice(a,b),c);const row=()=>c.db.zh.people[0];
function read(rows){c.model.snapshot.tracking=rows===null?null:{residents:rows};c.updateLivePeople();}
read([{id:'Abigail',portrait:'mod-a',mapAvatar:'head-a'},{id:'AddedNpc',name:'Mod NPC',portrait:'extra'}]);assert.equal(row().livePortrait,'mod-a');
read(null);assert.equal(row().livePortrait,'mod-a');assert(c.db.zh.people.some(p=>p.id==='AddedNpc'));
read([{id:'Abigail',portrait:null,mapAvatar:null}]);assert.equal(row().livePortrait,'mod-a');assert.equal(row().liveMapAvatar,'head-a');
fresh=false;c.updateLivePeople();assert.equal(row().livePortrait,'mod-a');fresh=true;c.lang='en';c.updateLivePeople();assert.equal(c.db.en.people[0].livePortrait,'mod-a');
read([{id:'Abigail',portrait:'mod-b',mapAvatar:'head-b'}]);assert.equal(row().livePortrait,'mod-b');
const journal=fs.readFileSync('android/assets/journal.js','utf8'),ca=journal.indexOf('function calendarIcon('),cb=journal.indexOf('\nfunction ',ca+1);vm.runInContext(journal.slice(ca,cb),c);assert.equal(c.calendarIcon({kind:'birthday',npcId:'Abigail'}).src,'head-b');
c.session='save-b';read(null);assert.equal(row().livePortrait,undefined);assert(!c.db.zh.people.some(p=>p.runtime));
console.log('PASS portrait continuity: partial/null/stale/language preserve live image; new portrait replaces; calendar prefers live; new save clears');
