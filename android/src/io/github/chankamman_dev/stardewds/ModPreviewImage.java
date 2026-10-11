package io.github.chankamman_dev.stardewds;

import java.io.*;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;

/** One explicitly selected local PNG/JPEG. Bound encoded bytes and decoded pixels. */
final class ModPreviewImage {
 static String read(InputStream in)throws IOException{
  ByteArrayOutputStream bytes=new ByteArrayOutputStream();byte[] buffer=new byte[8192];int n;
  while((n=in.read(buffer))!=-1){if(bytes.size()+n>8*1024*1024)throw new IOException("oversize");bytes.write(buffer,0,n);}
  byte[] source=bytes.toByteArray();boolean png=source.length>=8&&source[0]==(byte)137&&source[1]==80&&source[2]==78&&source[3]==71;
  boolean jpeg=source.length>=3&&source[0]==(byte)255&&source[1]==(byte)216&&source[2]==(byte)255;
  if(!png&&!jpeg)throw new IOException("format");
  BitmapFactory.Options bounds=new BitmapFactory.Options();bounds.inJustDecodeBounds=true;BitmapFactory.decodeByteArray(source,0,source.length,bounds);
  if(bounds.outWidth<1||bounds.outHeight<1||bounds.outWidth>8192||bounds.outHeight>8192||(long)bounds.outWidth*bounds.outHeight>32000000)throw new IOException("pixels");
  BitmapFactory.Options decode=new BitmapFactory.Options();decode.inSampleSize=1;while(Math.max(bounds.outWidth,bounds.outHeight)/decode.inSampleSize>640)decode.inSampleSize*=2;
  Bitmap bitmap=BitmapFactory.decodeByteArray(source,0,source.length,decode);if(bitmap==null)throw new IOException("decode");Bitmap thumb=null;
  try{double scale=Math.min(1,320.0/Math.max(bitmap.getWidth(),bitmap.getHeight()));thumb=Bitmap.createScaledBitmap(bitmap,Math.max(1,(int)(bitmap.getWidth()*scale)),Math.max(1,(int)(bitmap.getHeight()*scale)),true);
   ByteArrayOutputStream output=new ByteArrayOutputStream();if(!thumb.compress(Bitmap.CompressFormat.PNG,100,output)||output.size()>260000)throw new IOException("thumbnail");
   return "data:image/png;base64,"+Base64.encodeToString(output.toByteArray(),Base64.NO_WRAP);
  }finally{if(thumb!=null&&thumb!=bitmap)thumb.recycle();bitmap.recycle();}
 }
}
