// Calendar art as Billboard.draw uses it: each villager's mugshot (their Characters sheet,
// NPC.getMugShotSourceRect: 16x24 at 0,0, children at 0,4), the animated festival flag,
// passive-festival star, fishing-derby icon and bookseller balloon.
// Pixel-exact crops, no resampling.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{unpackToFiles}=require('xnb'),{PNG}=require('pngjs');
const game=process.argv[2]||process.env.STARDEW_GAME_PATH,root=path.resolve(process.env.STARDEW_WORK_ROOT||path.join(__dirname,'..'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function sheet(rel){const b=fs.readFileSync(path.join(game,'Content',rel+'.xnb'));const files=await unpackToFiles({buffer:b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)},{fileName:path.basename(rel)+'.xnb'});const f=files.find(f=>f.extension==='png');return PNG.sync.read(Buffer.from(f.data instanceof Blob?await f.data.arrayBuffer():f.data));}
function crop(src,x,y,w,h,out,outputs,name){const p=new PNG({width:w,height:h});PNG.bitblt(src,p,x,y,w,h,0,0);const bytes=PNG.sync.write(p);fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,bytes);outputs.push({name,rect:[x,y,w,h],sha256:hash(bytes)});}
(async()=>{
 const outputs=[],art=p=>path.join(root,'android/assets/art',p);
 const people=JSON.parse(fs.readFileSync(path.join(root,'android/assets/offline.json'),'utf8')).en.people.map(p=>p.id);
 const children=new Set(['Jas','Vincent']),textures={Leo:'ParrotBoy'};
 for(const id of people){try{const s=await sheet('Characters/'+(textures[id]||id));crop(s,0,children.has(id)?4:0,16,24,art('mugshots/'+id+'.png'),outputs,'mugshot '+id);}catch(e){console.warn('no sprite for',id);}}
 const billboard=await sheet('LooseSprites/Billboard'),cursors=await sheet('LooseSprites/Cursors'),c16=await sheet('LooseSprites/Cursors_1_6');
 crop(billboard,1,398,84,12,art('cal-festival.png'),outputs,'festival flag, 6 frames of 14x12');
 crop(billboard,1,398,14,12,art('cal-festival-1.png'),outputs,'festival flag, first frame (event list)');
 crop(cursors,346,392,8,8,art('cal-passive.png'),outputs,'passive festival star');
 crop(c16,103,2,10,11,art('cal-derby.png'),outputs,'fishing derby');
 crop(c16,71,63,8,15,art('cal-bookseller.png'),outputs,'bookseller balloon');
 fs.writeFileSync(path.join(root,'evidence/calendar-art-source.json'),JSON.stringify({game,outputs,reference:'Billboard.draw / NPC.getMugShotSourceRect'},null,1));
 console.log(outputs.length,'calendar sprites');
})().catch(e=>{console.error(e);process.exit(1);});
