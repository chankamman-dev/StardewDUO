package io.github.chankamman_dev.stardewds;
import java.io.*;
public class PairingFileTest {
 public static void main(String[] args)throws Exception{
  String key=new String(new char[64]).replace('\0','a'),valid=" \n\""+key+"\"\r\n";
  byte[] data=valid.getBytes("UTF-8");
  InputStream shortReads=new ByteArrayInputStream(data){@Override public synchronized int read(byte[] b,int off,int len){return super.read(b,off,Math.min(len,3));}};
  if(!PairingFile.read(shortReads).equals(key))throw new AssertionError("short reads");
  int checks=1;
  for(String bad:new String[]{"",key,"\"abc\"","\""+key+"\" true","{\"key\":\""+key+"\"}","\""+key.toUpperCase()+"\"",new String(new char[257]).replace('\0',' ')}){
   try{PairingFile.read(new ByteArrayInputStream(bad.getBytes("UTF-8")));throw new AssertionError("accepted invalid pairing");}catch(IOException expected){checks++;}
  }
  System.out.println("PASS pairing import: "+checks+" checks");
 }
}
