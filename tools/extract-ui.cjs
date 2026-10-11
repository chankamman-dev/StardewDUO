// Original local assets only; no writes to the source installation.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{unpackToFiles}=require('xnb'),{PNG}=require('pngjs');
const root=path.resolve(process.env.STARDEW_WORK_ROOT||path.join(__dirname,'..')),game=process.argv[2]||process.env.STARDEW_GAME_PATH,out=path.join(root,'android/assets/art'),raw=path.join(root,'evidence/extracted');
const manifest=[];
async function extract(rel,name){const source=path.join(game,'Content',rel+'.xnb'),b=fs.readFileSync(source),files=await unpackToFiles({buffer:b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)},{fileName:name+'.xnb'});const f=files.find(f=>f.extension==='png');if(!f)throw Error(rel);const data=Buffer.from(f.data instanceof Blob?await f.data.arrayBuffer():f.data);fs.writeFileSync(path.join(raw,name+'.png'),data);const p=PNG.sync.read(data);manifest.push({source,sha256:crypto.createHash('sha256').update(b).digest('hex'),width:p.width,height:p.height});return p;}
function crop(p,x,y,w,h,name){const q=new PNG({width:w,height:h});PNG.bitblt(p,q,x,y,w,h,0,0);const file=path.join(out,name+'.png');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,PNG.sync.write(q));}
(async()=>{
 const cursors=await extract('LooseSprites/Cursors','cursors');
 for(const [name,n] of Object.entries({bag:0,people:2,map:3,manual:5,settings:6}))crop(cursors,n*16,368,16,16,'tab-'+name);
 for(let i=0;i<4;i++)await extract('Fonts/Chinese_'+i,'Chinese_'+i);
 fs.copyFileSync(path.join(game,'Content/Fonts/Chinese.fnt'),path.join(raw,'Chinese.fnt'));
 const data=JSON.parse(fs.readFileSync(path.join(root,'sandbox/Mods/GameProbe/offline-data.json')));
 const available=new Set();
 for(const p of data.en.people){const texture=p.id==='Leo'?'ParrotBoy':p.id;if(!/^[A-Za-z0-9]+$/.test(p.id)||!fs.existsSync(path.join(game,'Content/Portraits',texture+'.xnb')))continue;const png=await extract('Portraits/'+texture,'portrait-'+p.id);crop(png,0,0,64,64,'portraits/'+p.id);available.add(p.id);}
 for(const lang of ['en','zh'])data[lang].people=data[lang].people.filter(p=>available.has(p.id));
 fs.writeFileSync(path.join(root,'android/assets/offline.json'),JSON.stringify({version:'1.6.15',source:'local-vanilla-content',...data}));
 fs.writeFileSync(path.join(root,'evidence/ui-art-manifest.json'),JSON.stringify(manifest,null,2));
 console.log('Extracted',available.size,'portraits, menu tabs, 6985-glyph Chinese font pages, offline catalog.');
})().catch(e=>{console.error(e);process.exitCode=1});
