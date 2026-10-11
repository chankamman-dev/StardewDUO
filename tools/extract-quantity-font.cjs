// Extract the exact original tiny-digit texture. Personal local game installation only.
// Item.DrawMenuIcons -> Utility.drawTinyDigits: Cursors(368 + digit * 5, 56, 5, 7).
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {unpackToFiles}=require('xnb'),{PNG}=require('pngjs');
const root=path.resolve(process.env.STARDEW_WORK_ROOT||path.join(__dirname,'..')),game=process.argv[2]||process.env.STARDEW_GAME_PATH;
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
 const source=path.join(game,'Content/LooseSprites/Cursors.xnb'),data=fs.readFileSync(source);
 const files=await unpackToFiles({buffer:data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)},{fileName:'Cursors.xnb'});
 const file=files.find(f=>f.extension==='png');if(!file)throw Error('Cursors texture missing');
 const bytes=Buffer.from(file.data instanceof Blob?await file.data.arrayBuffer():file.data),texture=PNG.sync.read(bytes),atlas=new PNG({width:50,height:7});
 PNG.bitblt(texture,atlas,368,56,50,7,0,0);const png=PNG.sync.write(atlas);
 fs.writeFileSync(path.join(root,'android/assets/art/stack-digits.png'),png);
 const metadata={schema:1,texture:'art/stack-digits.png',digits:'0123456789',glyph:{width:5,height:7},scale:3,backingScale:2,advance:14,nativeAdvance:'floor(5 * scale) - 1',shadow:'Baked into original texture; no extra shadow, outline, tint, or smoothing',sourceRectangle:{x:368,y:56,width:50,height:7}};
 fs.writeFileSync(path.join(root,'android/assets/quantity-font.json'),JSON.stringify(metadata,null,2)+'\n');
 const evidence={...metadata,source,sourceSha256:hash(data),atlasSha256:hash(png),originalReadOnly:true,gameAssemblySha256:hash(fs.readFileSync(path.join(game,'Stardew Valley.dll'))),localCode:[{file:'evidence/decompiled/Utility.cs',method:'Utility.drawTinyDigits',line:2351},{file:'evidence/decompiled/Item.cs',method:'Item.DrawMenuIcons',line:467}],originalPlacement:'location + (64 - getWidthOfTinyDigitString(stack, 3 * scale_size) + 3 * scale_size, 64 - 18 * scale_size + 1)',originalStackVisibility:'StackDrawType.Draw hides 1; Draw_OneInclusive shows 1'};
 fs.writeFileSync(path.join(root,'evidence/quantity-font-source.json'),JSON.stringify(evidence,null,2)+'\n');
 console.log('Extracted original 50x7 stack digits:',hash(png));
})().catch(e=>{console.error(e);process.exitCode=1;});
