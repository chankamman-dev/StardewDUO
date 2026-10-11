// Local native-art derivatives and exact upstream BDF glyphs. Never writes game files.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{PNG}=require('pngjs'),{unpackToFiles}=require('xnb');
const root=path.resolve(process.env.STARDEW_WORK_ROOT||path.join(__dirname,'..')),out=path.join(root,'android/assets/art'),fontOut=path.join(root,'android/assets/fonts');
const put=(name,s)=>fs.writeFileSync(path.join(out,name),s),svg=body=>`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" shape-rendering="crispEdges">${body}</svg>`;
put('hud-coin.svg',svg('<path fill="#784113" d="M7 2H17V4H20V7H22V17H20V20H17V22H7V20H4V17H2V7H4V4H7Z"/><path fill="#ef991e" d="M7 4H17V6H20V17H17V20H7V18H4V7H7Z"/><path fill="#ffdc51" d="M8 5H16V7H18V16H16V18H8V16H6V8H8Z"/><path fill="#fff2a0" d="M8 6H15V8H9V16H7V8H8Z"/><path fill="#c77915" d="M12 9H15V16H12Z"/>'));
put('hud-clock.svg',svg('<path fill="#6b3d25" d="M7 1H17V3H21V7H23V17H21V21H17V23H7V21H3V17H1V7H3V3H7Z"/><path fill="#c58a42" d="M7 3H17V5H19V7H21V17H19V19H17V21H7V19H5V17H3V7H5V5H7Z"/><path fill="#ffecb5" d="M8 5H16V7H19V17H16V19H8V17H5V8H8Z"/><path fill="#683d2b" d="M11 7H13V12H17V14H11Z"/>'));
put('map-zoom.svg',svg('<path fill="#693c22" d="M6 2H15V4H18V7H19V14H17V17H19V19H22V23H18V20H15V18H7V16H3V13H2V7H4V4H6Z"/><path fill="#e5ad5c" d="M7 4H14V6H16V8H17V13H15V15H7V13H4V8H6Z"/><path fill="#d2ece0" d="M7 5H13V7H15V13H7V11H5V8H7Z"/><path fill="#fff8d5" d="M7 6H13V8H8V11H6V8H7Z"/>'));
put('map-reset.svg',svg('<path fill="#703f20" d="M4 3H10V6H6V10H3V4H4ZM14 3H20V4H21V10H18V6H14ZM3 14H6V18H10V21H4V20H3ZM18 14H21V20H20V21H14V18H18Z"/><path fill="#d09b50" d="M9 9H15V15H9Z"/>'));
function crop(p,x,y,w,h,name){const q=new PNG({width:w,height:h});PNG.bitblt(p,q,x,y,w,h,0,0);put(name+'.png',PNG.sync.write(q));}
(async()=>{
 const cursors=PNG.sync.read(fs.readFileSync(path.join(root,'evidence/extracted/cursors.png')));
 // Native skills tab is already empty: the game draws the farmer separately.
 // Keep all bevel/paper pixels, rotate ONLY this frame clockwise. Do not erase
 // an inventory icon with a flat-color column (that destroys the cream inset).
 const nativeTab=new PNG({width:16,height:16});
 for(let y=0;y<16;y++)for(let x=0;x<16;x++){const si=((368+y)*cursors.width+16+x)*4,di=(x*16+15-y)*4;cursors.data.copy(nativeTab.data,di,si,si+4);}
 put('tab-original-right.png',PNG.sync.write(nativeTab));
 for(const [n,x,y,w,h] of [['heart-full',211,428,7,6],['heart-empty',218,428,7,6],['check-off',227,425,9,9],['check-on',236,425,9,9],['organize',162,440,16,16],['trash',564,102,18,26]])crop(cursors,x,y,w,h,n);
 const file=path.join(process.env.STARDEW_GAME_PATH,'Content/LooseSprites/Cursors2.xnb'),b=fs.readFileSync(file),entries=await unpackToFiles({buffer:b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)},{fileName:'cursors2.xnb'}),p=PNG.sync.read(Buffer.from(await entries.find(f=>f.extension==='png').data.arrayBuffer()));
 crop(p,166,174,14,12,'gift');crop(p,180,175,13,11,'chat');
 // Trim transparent padding; CSS centers every tab around the same visual center.
 for(const n of ['bag','map','people','manual','settings']){const p=PNG.sync.read(fs.readFileSync(path.join(out,'nav-'+n+'.png')));let x0=p.width,y0=p.height,x1=0,y1=0;for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++)if(p.data[(y*p.width+x)*4+3]){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}crop(p,x0,y0,x1-x0+1,y1-y0+1,'icon-'+n);}
 if(process.env.STARDEW_KEEP_FONT)return;
 const source=fs.readFileSync(path.join(root,'.deps/fusion-2026.09.01/bdf/fusion-pixel-12px-proportional-zh_hans.bdf'),'utf8'),chunks=source.split('STARTCHAR ').slice(1),glyphs={},pages=[];let index=0;
 for(const chunk of chunks){const cp=Number(chunk.match(/ENCODING (-?\d+)/)[1]),advance=Number(chunk.match(/DWIDTH (\d+)/)[1]),box=chunk.match(/BBX (\d+) (\d+) (-?\d+) (-?\d+)/).slice(1).map(Number),[w,h,bx,by]=box,rows=(chunk.match(/BITMAP\r?\n([\s\S]*?)ENDCHAR/)?.[1]||'').trim().split(/\r?\n/);const page=Math.floor(index/16384),offset=index%16384,x=offset%64*16,y=Math.floor(offset/64)*16;if(!pages[page])pages[page]=new PNG({width:1024,height:4096});for(let row=0;row<h;row++){const bits=BigInt('0x'+rows[row]),padded=rows[row].length*4;for(let col=0;col<w;col++)if(bits&(1n<<BigInt(padded-1-col))){const i=((y+row)*1024+x+col)*4;pages[page].data.fill(255,i,i+4);}}glyphs[cp]=[page,x,y,w,h,bx,by,advance];index++;}
 pages.forEach((p,i)=>fs.writeFileSync(path.join(fontOut,'fusion-bitmap-'+i+'.png'),PNG.sync.write(p)));
 fs.writeFileSync(path.join(fontOut,'fusion-bitmap.json'),JSON.stringify({source:'Fusion Pixel Font 2026.09.01 / 12px proportional zh_hans BDF',ascent:13,height:16,pages:pages.length,glyphs}));
 fs.writeFileSync(path.join(root,'evidence/ui-assets-0.5.json'),JSON.stringify({at:new Date().toISOString(),fontGlyphs:index,fontSourceSha256:crypto.createHash('sha256').update(source).digest('hex'),originalSources:[file,'Content/LooseSprites/Cursors.xnb'],derivatives:['native blank skills tab Cursors[16,368,16,16], frame rotated clockwise; no icon erasure','pixel coin, clock and map controls drawn as code-native SVG','upright native icons with transparent margins trimmed'],scope:'local companion assets only'},null,2));console.log('Built UI art and exact BDF glyphs:',index);
})().catch(e=>{console.error(e);process.exit(1)});
