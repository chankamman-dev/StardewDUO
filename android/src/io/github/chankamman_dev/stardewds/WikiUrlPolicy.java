package io.github.chankamman_dev.stardewds;
import java.net.URI;
/** Pure policy so the reader boundary is testable off-device. Same rules as wiki.js safeUrl:
 *  https, the Stardew Valley Wiki (zh or en) only, default port, no credentials, no dot segments. */
public final class WikiUrlPolicy {
 public static boolean allowed(String value){
  if(value==null||value.length()>2048||value.contains("\\"))return false;
  try{URI u=new URI(value);String host=u.getHost(),path=u.getPath();
   if(!"https".equals(u.getScheme())||!("stardewvalleywiki.com".equals(host)||"zh.stardewvalleywiki.com".equals(host))||(u.getPort()!=-1&&u.getPort()!=443)||u.getUserInfo()!=null||path==null)return false;
   // getPath() is decoded, so %2e%2e arrives here as "..".
   for(String segment:path.split("/"))if(segment.equals("..")||segment.equals("."))return false;return true;
  }catch(Exception e){return false;}
 }
 private WikiUrlPolicy(){}
}
