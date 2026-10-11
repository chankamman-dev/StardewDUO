// Reuse only local, previously extracted original textures. No game writes.
const fs=require('node:fs'),{PNG}=require('pngjs');
const root=require('node:path').resolve(process.env.STARDEW_WORK_ROOT||require('node:path').join(__dirname,'..'));
const read=p=>PNG.sync.read(fs.readFileSync(root+'/'+p));
const sheet=read('evidence/extracted/cursors.png'),objects=read('android/assets/art/objects.png');
const sources=[];
function crop(p,x,y,w,h,name,clearEdges=false){
 const q=new PNG({width:w,height:h});PNG.bitblt(p,q,x,y,w,h,0,0);
 if(clearEdges){
  // Only flood the tab's exposed parchment background, keeping enclosed icon pixels.
  const seen=new Set(),todo=[];for(let a=0;a<w;a++)todo.push([a,0],[a,h-1]);for(let b=0;b<h;b++)todo.push([0,b],[w-1,b]);
  while(todo.length){const [a,b]=todo.pop();if(a<0||b<0||a>=w||b>=h||seen.has(b*w+a))continue;seen.add(b*w+a);const n=(b*w+a)*4,[r,g,blue]=q.data.subarray(n,n+3);if(!(r>185&&g>130&&blue<190&&r>g&&g>blue))continue;q.data[n+3]=0;todo.push([a-1,b],[a+1,b],[a,b-1],[a,b+1]);}
 }
 fs.writeFileSync(root+'/android/assets/art/nav-'+name+'.png',PNG.sync.write(q));sources.push({name,texture:p===sheet?'Cursors':'springobjects',rect:[x,y,w,h],transparentEdgeCleanup:clearEdges});
}
for(const [name,n] of Object.entries({bag:0,people:2,map:3,settings:6}))crop(sheet,n*16+4,371,8,12,name,true);
// Vanilla Lost Book (object 102) is a readable book symbol for the offline guide.
crop(objects,102%(objects.width/16)*16,Math.floor(102/(objects.width/16))*16,16,16,'manual');
fs.writeFileSync(root+'/evidence/navigation-art-0.3.json',JSON.stringify({source:'local original extracted textures',sources},null,2));
console.log('Extracted five standalone original navigation icons.');
// The original generic 8px inset clips the controller's left/right handles.
require('./extract-settings-icon.cjs');
