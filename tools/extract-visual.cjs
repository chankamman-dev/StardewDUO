// Private local extraction. SpriteFont metrics are preserved, never traced.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{unpackToFiles}=require('xnb'),{PNG}=require('pngjs');
const root=path.resolve(process.env.STARDEW_WORK_ROOT||path.join(__dirname,'..')),game=path.join(process.env.STARDEW_GAME_PATH,'Content'),out=path.join(root,'android/assets/art'),manifest=[];
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function font(rel,name,shipping=true){
 const source=path.join(game,rel+'.xnb'),b=fs.readFileSync(source),files=await unpackToFiles({buffer:b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)},{fileName:name+'.xnb'});
 const raw=JSON.parse(await files.find(f=>f.extension==='json').data.text()).content,png=Buffer.from(await files.find(f=>f.extension==='png').data.arrayBuffer());
 const chars={};raw.characterMap.forEach((c,i)=>{const g=raw.glyphs[i],r=raw.cropping[i],k=raw.kerning[i];chars[c.codePointAt(0)]=[g.x,g.y,g.width,g.height,r.x,r.y,k.x,k.y,k.z];});
 const data={line:raw.verticalLineSpacing,spacing:raw.horizontalSpacing,designScale:rel.includes('Chinese_round')?(name.includes('title')?.875:.75):1,chars};
 const dest=shipping?path.join(out,'font'):path.join(root,'evidence/extracted');fs.mkdirSync(dest,{recursive:true});
 fs.writeFileSync(path.join(dest,name+'.png'),png);fs.writeFileSync(path.join(dest,name+'.json'),JSON.stringify(data));
 manifest.push({source,sha256:sha(b),name,shipping,line:data.line,spacing:data.spacing,glyphs:Object.keys(chars).length,samples:Object.fromEntries(['背','青','A','1'].map(c=>[c,chars[c.codePointAt(0)]]))});
}
function crop(p,x,y,w,h,name){const q=new PNG({width:w,height:h});PNG.bitblt(p,q,x,y,w,h,0,0);fs.writeFileSync(path.join(out,name+'.png'),PNG.sync.write(q));return q;}
(async()=>{
 for(const [rel,name,ship] of [['Fonts/SmallFont.zh-CN','pixel-menu-zh',false],['Fonts/SpriteFont1.zh-CN','pixel-title-zh',false],['Fonts/SmallFont','menu-en',true],['Fonts/SpriteFont1','title-en',true],['Fonts/Chinese_round/SmallFont.zh-CN','menu-zh',true],['Fonts/Chinese_round/SpriteFont1.zh-CN','title-zh',true]])await font(rel,name,ship);
 const menu=PNG.sync.read(fs.readFileSync(path.join(root,'evidence/extracted/menu.png'))),cursor=PNG.sync.read(fs.readFileSync(path.join(root,'evidence/extracted/cursors.png')));
 // Game1.drawDialogueBox corners/edges; trim only exterior transparent margin.
 const frame=new PNG({width:144,height:144});
 for(let row=0;row<3;row++)for(let col=0;col<3;col++){
  const sx=col===0?16:col===2?192:128,sy=row===0?16:row===2?192:128;
  PNG.bitblt(menu,frame,col===1&&row===1?64:sx,sy,48,48,col*48,row*48);
 }
 fs.writeFileSync(path.join(out,'frame-main.png'),PNG.sync.write(frame));
 crop(menu,0,256,60,60,'frame-tooltip');crop(menu,44,300,4,4,'rule');
 // Rotate the ORIGINAL TAB FRAME only; its icon is a separate upright image.
 const tab=crop(cursor,0,368,16,16,'tab-source'),empty=new PNG({width:16,height:16});
 for(let y=0;y<16;y++)for(let x=0;x<16;x++){
  // Reconstruct the covered central parchment from the identical bare side columns.
  const sx=x>=4&&x<=11?3:x,si=(y*16+sx)*4,di=(x*16+(15-y))*4;
  tab.data.copy(empty.data,di,si,si+4);
 }
 fs.writeFileSync(path.join(out,'tab-right.png'),PNG.sync.write(empty));
 fs.writeFileSync(path.join(root,'evidence/visual-art-0.4.json'),JSON.stringify({fonts:manifest,frames:{main:{source:'Maps/MenuTiles',corners:'16/192,16/192,48,48',edges:'128,16/192 and 16/192,128',slice:48},tooltip:{source:'Maps/MenuTiles',rect:[0,256,60,60],slice:20},tab:{source:'LooseSprites/Cursors',rect:[0,368,16,16],operation:'Remove icon using row-matched bare parchment at x=3, rotate frame 90 degrees clockwise; use upright icon separately'}}},null,2));
 console.log('Extracted original menu/title fonts and native frame/tab parts.');
})().catch(e=>{console.error(e);process.exit(1)});

