import io.github.chankamman_dev.stardewds.ReadOnlyDataRoutes;
public class ReadOnlyDataRoutesTest {
 public static void main(String[] args){int checks=0;
  for(String path:new String[]{"/bridge/mods","/bridge/bundles","/bridge/collections","/bridge/events","/bridge/progress","/bridge/catalog/items","/bridge/catalog/people"}){if(!("/v1/"+path.substring(8)).equals(ReadOnlyDataRoutes.route(path,null)))throw new AssertionError(path);checks++;}
  for(String page:new String[]{"0","1","50","81"}){if(!("/v1/events?page="+page).equals(ReadOnlyDataRoutes.route("/bridge/events","page="+page)))throw new AssertionError(page);checks++;}
  for(String query:new String[]{"","page=-1","page=82","page=10000000","page=1.5","page=%31","page=00","page=+1","page=1&page=2","page=1&url=http://evil","limit=500"}){if(ReadOnlyDataRoutes.route("/bridge/events",query)!=null)throw new AssertionError(query);checks++;}
  for(String path:new String[]{"/bridge/mods","/bridge/bundles","/bridge/collections","/bridge/progress"}){if(ReadOnlyDataRoutes.route(path,"page=0")!=null)throw new AssertionError(path);checks++;}
  for(String path:new String[]{"/bridge/catalog/items","/bridge/catalog/people"}){if(ReadOnlyDataRoutes.route(path,"page=5")==null)throw new AssertionError(path);checks++;for(String query:new String[]{"page=82","page=00","page=%31","page=-1","page=5&foo=x"}){if(ReadOnlyDataRoutes.route(path,query)!=null)throw new AssertionError(query);checks++;}}
  if(ReadOnlyDataRoutes.route("/bridge/catalog/people","page=6")!=null||ReadOnlyDataRoutes.route("/bridge/catalog/items","page=81")==null)throw new AssertionError("kind-specific limits");checks++;
  for(String path:new String[]{null,"/bridge/%65vents","/bridge/events/../mods","/bridge/events/","/v1/events","http://evil/v1/events"}){if(ReadOnlyDataRoutes.route(path,null)!=null)throw new AssertionError(path);checks++;}
  if(!"/v1/mod-config/example.Mod".equals(ReadOnlyDataRoutes.route("/bridge/mod-config/example.Mod",null)))throw new AssertionError("mod config");
  for(String id:new String[]{"","../mod","a..b","a/b","a%2fb",".mod","mod.","中.Mod"})if(ReadOnlyDataRoutes.route("/bridge/mod-config/"+id,null)!=null)throw new AssertionError(id);
  if(ReadOnlyDataRoutes.route("/bridge/mod-config/example.Mod","page=0")!=null)throw new AssertionError("mod-config query");
  if(!"/v1/mod-preview/example.Mod".equals(ReadOnlyDataRoutes.route("/bridge/mod-preview/example.Mod",null)))throw new AssertionError("mod preview");
  if(ReadOnlyDataRoutes.route("/bridge/mod-preview/example.Mod","path=config.json")!=null||ReadOnlyDataRoutes.route("/bridge/mod-preview/../bad",null)!=null)throw new AssertionError("preview paths");
  System.out.println(checks+" native read-only route checks passed plus mod config routes");
 }
}
