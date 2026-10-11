// Adapt the local original Billboard texture for the Thor's taller reading area.
// Keeps its wood grain, irregular paper edge and pins; no game files are modified.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {unpackToFiles}=require('xnb'),{PNG}=require('pngjs');
const root=path.resolve(process.env.STARDEW_WORK_ROOT||path.join(__dirname,'..')),game=process.argv[2]||process.env.STARDEW_GAME_PATH;
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
 const source=path.join(game,'Content/LooseSprites/Billboard.xnb'),data=fs.readFileSync(source);
 const files=await unpackToFiles({buffer:data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)},{fileName:'Billboard.xnb'});
 const file=files.find(f=>f.extension==='png');if(!file)throw Error('Billboard texture missing');
 const texture=PNG.sync.read(Buffer.from(file.data instanceof Blob?await file.data.arrayBuffer():file.data));
 const outputs=[];
 function crop(name,x,y,width,height,adapt){const p=new PNG({width,height});PNG.bitblt(texture,p,x,y,width,height,0,0);adapt?.(p);const bytes=PNG.sync.write(p),target=path.join(root,'android/assets/art/'+name+'.png');fs.writeFileSync(target,bytes);outputs.push({name,rectangle:{x,y,width,height},sha256:hash(bytes)});return p;}
 // A clear wood plank, repeated rather than stretching the original wide board.
 crop('quest-wood',12,60,48,44);
 // Paper is cropped separately. Replace the original English heading with its own
 // untextured paper colour, so both languages use the approved pixel text renderer.
 crop('quest-paper',64,23,208,157,p=>{const colour=texture.data.subarray((90*texture.width+120)*4,(90*texture.width+120)*4+4);for(let y=9;y<39;y++)for(let x=28;x<181;x++)p.data.set(colour,(y*p.width+x)*4);for(let i=0;i<p.data.length;i+=4){if(p.data[i]<200||p.data[i+1]<150||p.data[i+2]<120)p.data[i+3]=0;}for(const left of [18,181])for(let y=0;y<10;y++)for(let x=left;x<left+15;x++)p.data.set(colour,(y*p.width+x)*4);const exterior=new Uint8Array(p.width*p.height),queue=[];const visit=i=>{if(i>=0&&i<exterior.length&&!exterior[i]&&!p.data[i*4+3]){exterior[i]=1;queue.push(i);}};for(let x=0;x<p.width;x++){visit(x);visit((p.height-1)*p.width+x);}for(let y=0;y<p.height;y++){visit(y*p.width);visit(y*p.width+p.width-1);}for(let n=0;n<queue.length;n++){const i=queue[n],x=i%p.width;if(x>0)visit(i-1);if(x<p.width-1)visit(i+1);visit(i-p.width);visit(i+p.width);}for(let i=0;i<exterior.length;i++)if(!exterior[i]&&!p.data[i*4+3])p.data.set(colour,i*4);});
 crop('quest-pin',82,18,14,14);
 fs.writeFileSync(path.join(root,'evidence/quest-board-source.json'),JSON.stringify({source,sourceSha256:hash(data),originalReadOnly:true,method:'Original Billboard wood crop, separately stretched torn paper with localised heading, pins at original pixel aspect ratio',outputs},null,2)+'\n');
 console.log('Extracted original board textures:',outputs.length);
})().catch(e=>{console.error(e);process.exitCode=1;});
