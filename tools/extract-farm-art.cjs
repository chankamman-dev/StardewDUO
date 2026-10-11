// Farm tab art: original TV screens/overlays (TV.setWeatherOverlay, setFortuneOverlay), the
// cart, Queen of Sauce and luck icons UI Info Suite 2 uses, and a JunimoNote bundle bag.
// Pixel-exact crops, no resampling; overlay strips keep every animation frame side by side.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{unpackToFiles}=require('xnb'),{PNG}=require('pngjs');
const game=process.argv[2]||process.env.STARDEW_GAME_PATH,root=path.resolve(process.env.STARDEW_WORK_ROOT||path.join(__dirname,'..'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const crops=[
 // [output, sheet, x, y, w, h, frames]
 ['farm-tv-weather','Cursors',497,305,42,28,1],['farm-tv-greenrain','Cursors_1_6',213,335,43,28,1],['farm-tv-island','Cursors2',148,62,42,28,1],['farm-tv-fortune','Cursors',624,305,42,28,1],['farm-tv-fortune-good','Cursors_1_6',424,447,42,28,1],['farm-tv-fortune-bad','Cursors_1_6',424,476,42,28,1],
 ['farm-wx-sun','Cursors',413,333,13,13,4],['farm-wx-rain','Cursors',465,333,13,13,4],['farm-wx-snow','Cursors',465,346,13,13,4],['farm-wx-storm','Cursors',413,346,13,13,4],
 ['farm-wx-festival','Cursors',413,372,13,13,4],['farm-wx-wind-spring','Cursors',465,359,13,13,4],['farm-wx-wind','Cursors',413,359,13,13,4],['farm-wx-greenrain','Cursors_1_6',178,363,13,13,6],
 ['farm-luck-2','Cursors',644,333,13,13,4],['farm-luck-1','Cursors',592,333,13,13,4],['farm-luck-0','Cursors',540,333,13,13,4],['farm-luck-m1','Cursors',540,346,13,13,4],['farm-luck-m2','Cursors',592,346,13,13,4],
 ['farm-merchant','Cursors',192,1411,20,20,1],['farm-sauce','Cursors',609,361,28,28,1],['farm-dice','Cursors',50,428,10,14,1],['farm-bundle','JunimoNote',0,244,16,16,1]];
(async()=>{
 const sheets={};
 for(const name of new Set(crops.map(c=>c[1]))){const b=fs.readFileSync(path.join(game,'Content/LooseSprites',name+'.xnb'));const files=await unpackToFiles({buffer:b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)},{fileName:name+'.xnb'});const f=files.find(f=>f.extension==='png');sheets[name]=PNG.sync.read(Buffer.from(f.data instanceof Blob?await f.data.arrayBuffer():f.data));}
 const outputs=[];
 for(const [name,sheet,x,y,w,h,frames] of crops){const p=new PNG({width:w*frames,height:h});PNG.bitblt(sheets[sheet],p,x,y,w*frames,h,0,0);const bytes=PNG.sync.write(p);fs.writeFileSync(path.join(root,'android/assets/art',name+'.png'),bytes);outputs.push({name,sheet,rect:[x,y,w,h],frames,sha256:hash(bytes)});}
 // Farm animals: first frame (facing down) of each vanilla texture; barn animals use 32px frames.
 fs.mkdirSync(path.join(root,'android/assets/art/animals'),{recursive:true});
 for(const [type,size] of [['White Chicken',16],['Brown Chicken',16],['Blue Chicken',16],['Void Chicken',16],['Golden Chicken',16],['Duck',16],['Rabbit',16],['Dinosaur',16],['White Cow',32],['Brown Cow',32],['Goat',32],['Sheep',32],['Pig',32],['Ostrich',32]]){
  const b=fs.readFileSync(path.join(game,'Content/Animals',type+'.xnb'));const files=await unpackToFiles({buffer:b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)},{fileName:type+'.xnb'});const f=files.find(f=>f.extension==='png');
  const sheet=PNG.sync.read(Buffer.from(f.data instanceof Blob?await f.data.arrayBuffer():f.data)),p=new PNG({width:size,height:size});PNG.bitblt(sheet,p,0,0,size,size,0,0);const bytes=PNG.sync.write(p);
  const name='animals/'+type.toLowerCase().replace(/ /g,'-');fs.writeFileSync(path.join(root,'android/assets/art',name+'.png'),bytes);outputs.push({name,sheet:'Animals/'+type,rect:[0,0,size,size],frames:1,sha256:hash(bytes)});}
 fs.mkdirSync(path.join(root,'evidence'),{recursive:true});fs.writeFileSync(path.join(root,'evidence/farm-art-source.json'),JSON.stringify({game,outputs,reference:'TV.setWeatherOverlay/setFortuneOverlay; UI Info Suite 2 icons; JunimoNote bundle bag'},null,1));
 console.log(outputs.length,'farm sprites');
})().catch(e=>{console.error(e);process.exit(1);});
