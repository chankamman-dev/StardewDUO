using System.IO.Compression;
using System.Buffers.Binary;
using Microsoft.Xna.Framework;
namespace StardewThor.ReadOnly;
internal static class Png {
 // Byte-identical to the original per-byte writer, but one row per zlib write and a
 // table CRC: local-map texture sheets are megabytes, not 64px icons.
 private static readonly uint[] CrcTable=Enumerable.Range(0,256).Select(n=>{uint c=(uint)n;for(int k=0;k<8;k++)c=(c&1)!=0?0xedb88320^(c>>1):c>>1;return c;}).ToArray();
 public static byte[] Encode(int w,int h,Color[] pixels)=>Encode(w,h,pixels,0,w);
 // Encode a w×h window starting at pixels[offset], rows `stride` apart.
 public static byte[] Encode(int w,int h,Color[] pixels,int offset,int stride){
  using var output=new MemoryStream();output.Write(new byte[]{137,80,78,71,13,10,26,10});
  var header=new byte[13];BinaryPrimitives.WriteInt32BigEndian(header,w);BinaryPrimitives.WriteInt32BigEndian(header.AsSpan(4),h);header[8]=8;header[9]=6;Chunk(output,"IHDR",header);
  using var data=new MemoryStream();var row=new byte[1+w*4];
  using(var z=new ZLibStream(data,CompressionLevel.Fastest,true))for(int y=0;y<h;y++){
   int p=offset+y*stride,o=1;
   for(int x=0;x<w;x++){var c=pixels[p+x];int a=c.A;
    // Game textures are premultiplied; PNG stores straight alpha.
    if(a==255){row[o]=c.R;row[o+1]=c.G;row[o+2]=c.B;}else if(a==0){row[o]=row[o+1]=row[o+2]=0;}else{row[o]=(byte)Math.Min(255,c.R*255/a);row[o+1]=(byte)Math.Min(255,c.G*255/a);row[o+2]=(byte)Math.Min(255,c.B*255/a);}
    row[o+3]=(byte)a;o+=4;}
   z.Write(row,0,row.Length);
  }
  Chunk(output,"IDAT",data.ToArray());Chunk(output,"IEND",Array.Empty<byte>());return output.ToArray();
 }
 private static void Chunk(Stream s,string type,byte[] bytes){
  var len=new byte[4];BinaryPrimitives.WriteInt32BigEndian(len,bytes.Length);s.Write(len);var t=System.Text.Encoding.ASCII.GetBytes(type);s.Write(t);s.Write(bytes);
  uint crc=0xffffffff;foreach(byte b in t)crc=CrcTable[(crc^b)&0xff]^(crc>>8);foreach(byte b in bytes)crc=CrcTable[(crc^b)&0xff]^(crc>>8);
  BinaryPrimitives.WriteUInt32BigEndian(len,crc^0xffffffff);s.Write(len);
 }
}
