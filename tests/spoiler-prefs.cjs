const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync('android/assets/spoiler.js','utf8'),keys=['residents','items','tastes','maps','collections','events'];
function open(saved={}){
 const store=new Map(Object.entries(saved)),nodes=[];
 function node(cls=''){const n={className:cls,textContent:'',dataset:{},append(){},after(){},addEventListener(){},setAttribute(k,v){this[k]=v;},closest(){return this;}};nodes.push(n);return n;}
 const anchor=node(),ctx={lang:'en',page:'settings',el:(tag,cls)=>node(cls),$:()=>anchor,performance:{now:()=>0},
  document:{querySelectorAll:()=>[]},localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},render(){},
  model:{status:()=> 'ready',snapshot:{state:'ready',social:[{id:'Lewis'}]}},LiveData:{peek:()=>({metNpcs:['Lewis'],knownItems:['known'],mapAreas:{locked:false}})},
  db:{en:{people:[{id:'Lewis',revealed:{love:['known']}},{id:'Abigail'},{id:'Ghost',socialTab:'hiddenAlways'}]}}};ctx.window=ctx;
 vm.createContext(ctx);vm.runInContext(source,ctx);
 return {ctx,store,toggle:k=>nodes.find(n=>n.dataset.spoiler===k).onclick(),all:()=>nodes.find(n=>n.className.includes('spoiler-row'))&&nodes.find(n=>n.className==='spoiler-toggle'&&!n.dataset.spoiler).onclick()};
}
for(const old of ['on','off']){const h=open({'stardew.spoiler.v1':old});for(const k of keys)assert.equal(h.ctx.Spoiler.enabled(k),old==='on');}
const h=open();assert(h.ctx.Spoiler.hides('Abigail'));assert(!h.ctx.Spoiler.itemKnown('secret'));assert(!h.ctx.Spoiler.mapOpen('locked'));assert(h.ctx.Spoiler.tastesFolded('person:Lewis'));
h.toggle('residents');assert(!h.ctx.Spoiler.hides('Abigail'));assert(!h.ctx.Spoiler.itemKnown('secret'));assert(h.ctx.Spoiler.tastesFolded('person:Lewis'));assert(!h.ctx.Spoiler.visible('Ghost'));
h.toggle('items');assert(h.ctx.Spoiler.itemKnown('secret'));assert(h.ctx.Spoiler.enabled('collections'));assert(!h.ctx.Spoiler.mapOpen('locked'));
h.toggle('collections');assert(!h.ctx.Spoiler.enabled('collections'));h.toggle('tastes');assert(!h.ctx.Spoiler.tastesFolded('person:Lewis'));assert.equal(h.ctx.Spoiler.revealed('Lewis'),null);
const restored=open(Object.fromEntries(h.store));assert.deepEqual({...restored.ctx.Spoiler.prefs()},{residents:false,items:false,tastes:false,maps:true,collections:false,events:true});
restored.all();assert(keys.every(k=>restored.ctx.Spoiler.enabled(k)));restored.all();assert(keys.every(k=>!restored.ctx.Spoiler.enabled(k)));assert.equal(restored.store.get('stardew.spoiler.v1'),'off');
const broken=open({'stardew.spoiler.v1':'off','stardew.spoiler.v2':'broken'});assert(keys.every(k=>!broken.ctx.Spoiler.enabled(k)));
const partial=open({'stardew.spoiler.v1':'off','stardew.spoiler.v2':JSON.stringify({items:true,residents:'true'})});assert(partial.ctx.Spoiler.enabled('items'));assert(!partial.ctx.Spoiler.enabled('residents'));
console.log('PASS spoiler preferences: legacy migration, independent gates, reload, mixed/master states and malformed storage');
