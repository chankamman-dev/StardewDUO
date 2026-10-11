// DS Buddy launcher icon: the Thor buddy's big head in a straw hat, its lower half running off the
// bottom edge, on grass green. Drawn here as pixels on a 64 x 64 grid that spans the whole adaptive
// icon layer (108dp; launchers show the middle 72dp). Each density uses a whole-number scale so
// every pixel stays square, capped so the hat brim stays inside the visible 72dp; the bottom row
// continues to the layer edge so the base always leaves through the bottom.
const fs=require('fs'),path=require('path'),{PNG}=require('pngjs');
const root=path.resolve(__dirname,'..'),res=path.join(root,'android/res');
const N=64,O=8,BACKGROUND='#9ED36A';
const C={o:'#502916',L:'#f6ecd9',M:'#ddcdb2',h:'#c9b391',d:'#3b2619',e:'#ffe0a0',p:'#ffcf87',k:'#5f4a3c',K:'#8a7566',
 R:'#d9473c',Y:'#e9b53b',B:'#4a70d2',g2:'#3f9b4b',pink:'#f08c7a',white:'#fffaf0',glare:'#57402f',
 straw:'#eec766',strawShade:'#c9993e',strawLight:'#f7dc8c',band:'#c8453a'};
const HEART=['.RR..RR.','RRRRRRRR','.RRRRRR.','..RRRR..','...RR...'];
const cells=new Map();
const px=(x,y,c)=>{x+=O;y+=O;if(x>=0&&y>=0&&x<N&&y<N)cells.set(y*N+x,c);};
const rect=(x,y,w,h,c)=>{for(let j=0;j<h;j++)for(let i=0;i<w;i++)px(x+i,y+j,c);};
const box=(x,y,w,h,line,fill)=>{rect(x+1,y,w-2,1,line);rect(x+1,y+h-1,w-2,1,line);rect(x,y+1,1,h-2,line);rect(x+w-1,y+1,1,h-2,line);rect(x+1,y+1,w-2,h-2,fill);};
// Straw hat centred on the head, brim bottom row on the lid's top edge.
function hat(y){const bl=5,br=42,cl=17,cr=30;
 rect(bl+1,y,br-bl-1,1,C.o);
 for(const [row,fill] of [[1,C.strawShade],[2,C.straw]]){px(bl,y-row,C.o);rect(bl+1,y-row,br-bl-1,1,fill);px(br,y-row,C.o);}
 rect(bl+1,y-3,cl-bl-1,1,C.o);rect(cl,y-3,cr-cl+1,1,C.straw);rect(cr+1,y-3,br-cr-1,1,C.o);
 px(cl,y-4,C.o);rect(cl+1,y-4,cr-cl-1,1,C.band);px(cr,y-4,C.o);
 px(cl,y-5,C.o);rect(cl+1,y-5,cr-cl-1,1,C.straw);for(let x=cl+2;x<cr;x+=3)px(x,y-5,C.strawShade);px(cr,y-5,C.o);
 px(cl,y-6,C.o);rect(cl+1,y-6,cr-cl-1,1,C.straw);rect(cl+2,y-6,3,1,C.strawLight);px(cr,y-6,C.o);
 rect(cl+1,y-7,cr-cl-1,1,C.o);}
function buddy(){const y=12;
 // Upper half: the face screen.
 box(7,y,34,23,C.o,C.L);rect(8,y+21,32,1,C.M);rect(10,y+3,28,16,C.d);rect(34,y+4,2,1,C.glare);px(35,y+5,C.glare);
 for(const ex of [15,29]){rect(ex,y+7,4,5,C.e);rect(ex,y+7,2,1,C.white);px(ex,y+8,C.white);}
 px(20,y+13,C.e);rect(21,y+14,6,1,C.e);px(27,y+13,C.e);rect(12,y+14,3,1,C.pink);rect(33,y+14,3,1,C.pink);
 // Hinge, then the lower half running off the bottom: sticks, ABXY and the heart on the lower screen.
 rect(11,y+23,26,1,C.h);px(10,y+23,C.o);px(37,y+23,C.o);
 const b=y+24;rect(8,b,32,N,C.L);rect(8,b,32,1,C.o);rect(7,b+1,1,N,C.o);rect(40,b+1,1,N,C.o);
 rect(17,b+2,14,N,C.d);rect(18,b+3,12,N,C.p);
 HEART.forEach((row,j)=>[...row].forEach((ch,i)=>{if(ch==='R')px(20+i,b+5+j,C.R);}));
 rect(10,b+3,3,3,C.k);px(11,b+4,C.K);rect(10,b+9,3,1,C.k);rect(11,b+8,1,3,C.k);
 px(35,b+3,C.B);px(34,b+4,C.g2);px(36,b+4,C.R);px(35,b+5,C.Y);rect(34,b+8,3,3,C.k);px(35,b+9,C.K);
 hat(y);}
buddy();
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
// Widest artwork row (the hat brim), in grid cells, must fit the 72dp the launcher shows.
let minX=N,maxX=0;for(const k of cells.keys()){minX=Math.min(minX,k%N);maxX=Math.max(maxX,k%N);}
const width=maxX-minX+1;
for(const [density,size] of Object.entries({mdpi:108,hdpi:162,xhdpi:216,xxhdpi:324,xxxhdpi:432})){
 const scale=Math.max(1,Math.min(Math.round(size/N),Math.floor(size*72/108/width))),off=Math.floor((size-N*scale)/2),png=new PNG({width:size,height:size});
 const put=(x,y,c)=>{if(x<0||y<0||x>=size||y>=size)return;const i=(y*size+x)*4,[r,g,b]=rgb(c);png.data[i]=r;png.data[i+1]=g;png.data[i+2]=b;png.data[i+3]=255;};
 for(const [k,c] of cells){const gx=k%N,gy=Math.floor(k/N),last=gy===N-1;
  for(let y=off+gy*scale;y<(last?size:off+(gy+1)*scale);y++)for(let x=off+gx*scale;x<off+(gx+1)*scale;x++)put(x,y,c);}
 const dir=path.join(res,'mipmap-'+density);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'ic_launcher_foreground.png'),PNG.sync.write(png));console.log(density,size+'px','scale',scale);
}
fs.mkdirSync(path.join(res,'mipmap-anydpi-v26'),{recursive:true});fs.mkdirSync(path.join(res,'values'),{recursive:true});
fs.writeFileSync(path.join(res,'mipmap-anydpi-v26/ic_launcher.xml'),'<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n <background android:drawable="@color/ic_launcher_background"/>\n <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n</adaptive-icon>\n');
fs.writeFileSync(path.join(res,'values/ic_launcher.xml'),'<?xml version="1.0" encoding="utf-8"?>\n<resources>\n <color name="ic_launcher_background">'+BACKGROUND+'</color>\n</resources>\n');
