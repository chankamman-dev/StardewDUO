package io.github.chankamman_dev.stardewds;

/** New read-only data routes. Inputs are encoded path/query from a local GET request. */
public final class ReadOnlyDataRoutes {
 private ReadOnlyDataRoutes(){}
 public static String route(String path,String query){
  if(path!=null&&(path.startsWith("/bridge/mod-config/")||path.startsWith("/bridge/mod-preview/"))){
   String prefix=path.startsWith("/bridge/mod-config/")?"/bridge/mod-config/":"/bridge/mod-preview/";
   String id=path.substring(prefix.length());return query==null&&id.length()>0&&id.length()<=160&&id.matches("[A-Za-z0-9_-]+(?:\\.[A-Za-z0-9_-]+)*")?"/v1/"+path.substring(8):null;
  }
  if("/bridge/mods".equals(path)||"/bridge/bundles".equals(path)||"/bridge/collections".equals(path)||"/bridge/progress".equals(path))return query==null?"/v1/"+path.substring(8):null;
  if("/bridge/catalog/items".equals(path)||"/bridge/catalog/people".equals(path)){
   if(query==null)return "/v1/"+path.substring(8);
   if(!query.matches("page=(0|[1-9][0-9]?)"))return null;
   int page=Integer.parseInt(query.substring(5));return page<=(path.endsWith("people")?5:81)?"/v1/"+path.substring(8)+"?"+query:null;
  }
  if(!"/bridge/events".equals(path))return null;
  if(query==null)return "/v1/events";
  if(!query.matches("page=(0|[1-9][0-9]?)"))return null;
  int page=Integer.parseInt(query.substring(5));return page<=81?"/v1/events?"+query:null;
 }
}
