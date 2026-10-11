// Character and quest pages: pixel-exact crops of the original InventoryPage backgrounds,
// QuestLog frames/bar/reward box/badges (QuestLog.draw) and tooltip stat icons.
// Badges come from the localized Cursors sheet for Chinese. No resampling.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{unpackToFiles}=require('xnb'),{PNG}=require('pngjs');
const game=process.argv[2]||process.env.STARDEW_GAME_PATH,root=path.resolve(process.env.STARDEW_WORK_ROOT||path.join(__dirname,'..'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const crops=[
 ['portrait-day','daybg',0,0,128,192],['portrait-night','nightbg',0,0,128,192],
 ['quest-row-box','Cursors',384,396,15,15],
 // Special-order progress frame (Cursors2 0,224,47,12): 5px caps, stretched middle, 1px notch.
 ['quest-bar-left','Cursors2',0,224,5,12],['quest-bar-mid','Cursors2',5,224,37,12],['quest-bar-right','Cursors2',42,224,5,12],['quest-bar-notch','Cursors2',47,224,1,12],
 ['quest-reward-box','Cursors',293,360,24,24],['quest-coins','Cursors',280,410,16,16],['quest-bullet','Cursors',412,495,5,4],
 ['quest-new-en','Cursors',317,410,23,9],['quest-done-en','Cursors',341,410,23,9],['quest-new-zh','Cursors.zh-CN',317,410,23,9],['quest-done-zh','Cursors.zh-CN',341,410,23,9],
 // Item tooltip icons: buff k at Cursors (10+10k,428); weapon lines; food duration clock;
 // primary (Cursors2) and secondary (Cursors_1_6) enchantment marks (MeleeWeapon.drawTooltip).
 ...Array.from({length:12},(_,k)=>['stat-buff'+k,'Cursors',10+10*k,428,10,10]),
 ['stat-defense','Cursors',110,428,10,10],['stat-immunity','Cursors',150,428,10,10],['stat-damage','Cursors',120,428,10,10],['stat-speed','Cursors',130,428,10,10],
 ['stat-critChance','Cursors',40,428,10,10],['stat-critPower','Cursors',160,428,10,10],['stat-weight','Cursors',70,428,10,10],['stat-duration','Cursors',410,501,9,9],
 ['stat-enchant','Cursors2',127,35,10,10],['stat-enchantSecondary','Cursors_1_6',502,430,10,10],
 // SpriteText.drawString scroll banner (map location names): left cap, 1px middle, right cap.
 ['map-scroll-left','Cursors',325,318,12,18],['map-scroll-mid','Cursors',337,318,1,18],['map-scroll-right','Cursors',338,318,12,18]];
(async()=>{
 const sheets={};
 for(const name of new Set(crops.map(c=>c[1]))){const b=fs.readFileSync(path.join(game,'Content/LooseSprites',name+'.xnb'));const files=await unpackToFiles({buffer:b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)},{fileName:name+'.xnb'});const f=files.find(f=>f.extension==='png');sheets[name]=PNG.sync.read(Buffer.from(f.data instanceof Blob?await f.data.arrayBuffer():f.data));}
 const outputs=[];
 for(const [name,sheet,x,y,w,h] of crops){const p=new PNG({width:w,height:h});PNG.bitblt(sheets[sheet],p,x,y,w,h,0,0);const bytes=PNG.sync.write(p);fs.writeFileSync(path.join(root,'android/assets/art',name+'.png'),bytes);outputs.push({name,sheet,rect:[x,y,w,h],sha256:hash(bytes)});}
 fs.writeFileSync(path.join(root,'evidence/journal-art-source.json'),JSON.stringify({game,outputs,reference:'InventoryPage daybg/nightbg; QuestLog.draw frames, bar, reward box, badges; Item tooltip stat icons'},null,1));
 console.log(outputs.length,'journal sprites');
})().catch(e=>{console.error(e);process.exit(1);});
