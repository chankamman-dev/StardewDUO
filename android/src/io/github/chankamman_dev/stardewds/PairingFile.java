package io.github.chankamman_dev.stardewds;
import java.io.*;
import java.nio.charset.StandardCharsets;
/** Strict bounded JSON string; content providers may return short reads. */
public final class PairingFile {
 public static String read(InputStream in)throws IOException{
  ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] b=new byte[64];int n;
  while((n=in.read(b))!=-1){if(out.size()+n>256)throw new IOException("Pairing file too large");out.write(b,0,n);}
  String json=new String(out.toByteArray(),StandardCharsets.UTF_8).trim();
  if(!json.matches("\"[0-9a-f]{64}\""))throw new IOException("Invalid pairing file");
  return json.substring(1,65);
 }
}
