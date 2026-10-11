// Only selected local original UI tracks. Cue indices come from the isolated game's SoundBank.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.join(process.env.STARDEW_GAME_PATH,'Content/XACT');
const cues=JSON.parse(fs.readFileSync('sandbox/Mods/GameProbe/audio-cues.json','utf8'));
const manifest=[];fs.mkdirSync('android/assets/audio',{recursive:true});
// Microsoft XACT mini-format and MS ADPCM coefficient table:
// https://github.com/microsoft/DirectXTK/blob/main/Audio/WaveBankReader.cpp
function decodeAdpcm(raw,channels,blockSize){
 if(channels<1||channels>2)throw Error('Unsupported channel count');
 const coefficients=[[256,0],[512,-256],[0,0],[192,64],[240,0],[460,-208],[392,-232]],adapt=[230,230,230,230,307,409,512,614,768,614,512,409,307,230,230,230],samples=[];
 for(let start=0;start<raw.length;start+=blockSize){
  const end=Math.min(raw.length,start+blockSize);if(end-start<7*channels)throw Error('Short ADPCM block');let at=start;
  const state=Array.from({length:channels},()=>({predictor:raw[at++]}));for(const s of state){if(s.predictor>6)throw Error('Bad predictor');s.delta=raw.readInt16LE(at);at+=2;}for(const s of state){s.last=raw.readInt16LE(at);at+=2;}for(const s of state){s.previous=raw.readInt16LE(at);at+=2;}
  samples.push(...state.map(s=>s.previous),...state.map(s=>s.last));
  function nibble(s,n){const [a,b]=coefficients[s.predictor];let value=Math.trunc((s.last*a+s.previous*b)/256)+(n>=8?n-16:n)*s.delta;value=Math.max(-32768,Math.min(32767,value));s.previous=s.last;s.last=value;s.delta=Math.max(16,Math.trunc(s.delta*adapt[n]/256));samples.push(value);}
  while(at<end){const byte=raw[at++];nibble(state[0],byte>>4);nibble(state[channels-1],byte&15);}
 }
 const pcm=Buffer.alloc(samples.length*2);samples.forEach((v,i)=>pcm.writeInt16LE(v,i*2));return pcm;
}
for(const [name,variants] of Object.entries(cues)){
 const v=variants[0];if(!v)continue;const file=path.join(root,v.bank+'.xwb'),fd=fs.openSync(file,'r'),header=Buffer.alloc(512);fs.readSync(fd,header,0,512,0);
 if(header.toString('ascii',0,4)!=='WBND'||header.readUInt32LE(4)<42)throw Error('Unsupported XWB header');
 const bankOffset=header.readUInt32LE(12),metaOffset=header.readUInt32LE(20),waveOffset=header.readUInt32LE(44);
 const flags=header.readUInt32LE(bankOffset),entrySize=header.readUInt32LE(bankOffset+72);
 if(flags&0x20000||entrySize<24)throw Error('Unsupported compact bank');
 const meta=Buffer.alloc(entrySize);fs.readSync(fd,meta,0,entrySize,metaOffset+v.track*entrySize);
 const format=meta.readUInt32LE(4),codec=format&3,channels=(format>>>2)&7,rate=(format>>>5)&0x3ffff,bits=codec===2?16:(format>>>31)?16:8;
 const length=meta.readUInt32LE(12);if(length>2e6)throw Error('UI cue unexpectedly large');let raw=Buffer.alloc(length);fs.readSync(fd,raw,0,length,waveOffset+meta.readUInt32LE(8));fs.closeSync(fd);
 if(codec===2)raw=decodeAdpcm(raw,channels,(((format>>>23)&255)+22)*channels);else if(codec!==0)throw Error(name+' unsupported codec '+codec);
 const wav=Buffer.alloc(44+raw.length);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(channels,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*channels*bits/8,28);wav.writeUInt16LE(channels*bits/8,32);wav.writeUInt16LE(bits,34);wav.write('data',36);wav.writeUInt32LE(raw.length,40);raw.copy(wav,44);
 fs.writeFileSync('android/assets/audio/'+name+'.wav',wav);manifest.push({cue:name,bank:v.bank,track:v.track,sourceCodec:codec,codec:'PCM',channels,rate,bits,seconds:raw.length/(rate*channels*bits/8),volume:v.volume,sha256:crypto.createHash('sha256').update(wav).digest('hex')});
}
fs.writeFileSync('evidence/audio-assets-0.6.json',JSON.stringify({source:root,scope:'Local original UI sounds only; not music; cue mapping exported from the native SoundBank',tracks:manifest},null,2));console.log(manifest);
