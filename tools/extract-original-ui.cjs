// Crop original menu art from the local game textures for the 0.10.1 art pass.
// Reads XNB files read-only; outputs native-size PNGs that CSS scales by whole pixels.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {unpackToFiles}=require('xnb'),{PNG}=require('pngjs');
const root=path.resolve(process.env.STARDEW_WORK_ROOT||path.join(__dirname,'..')),game=process.argv[2]||process.env.STARDEW_GAME_PATH;
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function texture(rel){const source=path.join(game,'Content',rel+'.xnb'),data=fs.readFileSync(source);
 const files=await unpackToFiles({buffer:data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)},{fileName:path.basename(rel)+'.xnb'});
 const file=files.find(f=>f.extension==='png');if(!file)throw Error(rel+' texture missing');
 return {source,sha256:hash(data),png:PNG.sync.read(Buffer.from(file.data instanceof Blob?await file.data.arrayBuffer():file.data))};}
(async()=>{
 const outputs=[],sources=[];
 function crop(tex,name,x,y,width,height,why){const p=new PNG({width,height});PNG.bitblt(tex.png,p,x,y,width,height,0,0);const bytes=PNG.sync.write(p);fs.writeFileSync(path.join(root,'android/assets/art',name+'.png'),bytes);outputs.push({name,source:path.basename(tex.source),rectangle:{x,y,width,height},use:why,sha256:hash(bytes)});}
 const cursors=await texture('LooseSprites/Cursors'),menu=await texture('Maps/MenuTiles');
 sources.push(...[cursors,menu].map(t=>({source:t.source,sha256:t.sha256})));
 crop(cursors,'hud-season',406,441,12,32,'DayTimeMoneyBox season icons: spring, summer, fall, winter stacked 12x8');
 // Local map: fixed Cursors pieces shipped with the app, so the mod never reads the whole sheet back.
 crop(cursors,'localmap-water',0,2064,64,192,'GameLocation.drawWaterTile frames (64px source per tile, 2 checker rows)');
 crop(cursors,'localmap-tree-shadow',663,1011,41,30,'Tree.shadowSourceRect');
 crop(cursors,'ui-arrow-left',352,495,12,11,'Standard left page arrow');
 crop(cursors,'ui-arrow-right',365,495,12,11,'Standard right page arrow');
 // drawHorizontalPartition: tiles 4/6/7 join the beam into the menu frame.
 crop(menu,'ui-partition-left',0,64,64,64,'MenuTiles tile 4');
 crop(menu,'ui-partition-middle',128,64,64,64,'MenuTiles tile 6');
 crop(menu,'ui-partition-right',192,64,64,64,'MenuTiles tile 7');
 // Billboard calendar board; weekday names and day numerals are printed in the texture.
 for(const [rel,name] of [['LooseSprites/Billboard','calendar-board-en'],['LooseSprites/Billboard.zh-CN','calendar-board-zh']]){const board=await texture(rel);sources.push({source:board.source,sha256:board.sha256});crop(board,name,0,198,301,198,'Billboard calendar page; days at (38+32c, 50+32r), 31px cells');}
 fs.writeFileSync(path.join(root,'evidence/original-ui-source.json'),JSON.stringify({originalReadOnly:true,sources,outputs},null,2)+'\n');
 console.log('Extracted original UI controls:',outputs.length);
})().catch(e=>{console.error(e);process.exitCode=1;});
