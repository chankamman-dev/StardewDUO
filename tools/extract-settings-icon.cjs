// Exact local native sprite pixels; never modifies the game installation.
const fs=require('fs'),path=require('path'),{PNG}=require('pngjs');
const root=path.resolve(process.env.STARDEW_WORK_ROOT||path.join(__dirname,'..')),sheet=PNG.sync.read(fs.readFileSync(path.join(root,'evidence/extracted/cursors.png')));
const icon=new PNG({width:10,height:10}),colors=new Set(['3d3d3d','6b6b6b','8d9293','0088ff','42c436','dd003b','fff000']);
for(let y=0;y<10;y++)for(let x=0;x<10;x++){
 const a=((372+y)*sheet.width+99+x)*4,b=(y*10+x)*4;
 if(colors.has(sheet.data.subarray(a,a+3).toString('hex')))sheet.data.copy(icon.data,b,a,a+4);
}
for(const name of ['nav-settings','icon-settings'])fs.writeFileSync(path.join(root,'android/assets/art',name+'.png'),PNG.sync.write(icon));
console.log('Extracted complete native controller: Cursors(99,372,10,10); parchment excluded by exact palette.');
