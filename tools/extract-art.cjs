// Personal local build only. Read original XNBs; never modify the game directory.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {unpackToFiles}=require('xnb'),{PNG}=require('pngjs');
const root=path.resolve(process.env.STARDEW_WORK_ROOT||path.join(__dirname,'..')),game=process.argv[2]||process.env.STARDEW_GAME_PATH;
const out=path.join(root,'android/assets/art'),raw=path.join(root,'evidence/extracted');
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(raw,{recursive:true});
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function crop(src,x,y,w,h,name){const p=new PNG({width:w,height:h});PNG.bitblt(src,p,x,y,w,h,0,0);fs.writeFileSync(path.join(out,name+'.png'),PNG.sync.write(p));}
(async()=>{
 const manifest=[];
 for(const [rel,name] of [['Maps/MenuTiles','menu'],['LooseSprites/Cursors','cursors'],['Maps/springobjects','objects'],['LooseSprites/map','map']]){
  const source=path.join(game,'Content',rel+'.xnb'),b=fs.readFileSync(source);
  const files=await unpackToFiles({buffer:b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)},{fileName:name+'.xnb'});
  for(const f of files)if(f.extension==='png'){
   const data=Buffer.from(f.data instanceof Blob?await f.data.arrayBuffer():f.data),p=PNG.sync.read(data);fs.writeFileSync(path.join(raw,name+'.png'),data);
   manifest.push({source,sha256:hash(b),width:p.width,height:p.height,outputHash:hash(data)});
   if(name==='menu'){crop(p,(10%(p.width/64))*64,Math.floor(10/(p.width/64))*64,64,64,'slot');crop(p,0,256,60,60,'panel');}
   if(name==='objects')fs.writeFileSync(path.join(out,'objects.png'),data);
   if(name==='map')crop(p,0,0,300,180,'map'); // base-map region; remaining sheet contains overlays
  }
 }
 fs.writeFileSync(path.join(root,'evidence/art-manifest.json'),JSON.stringify({game,personalUseOnly:true,assets:manifest},null,2));
 console.log('Extracted original art:',manifest);
})().catch(e=>{console.error(e);process.exitCode=1;});
