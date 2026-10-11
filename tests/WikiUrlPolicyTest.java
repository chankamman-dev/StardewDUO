import io.github.chankamman_dev.stardewds.WikiUrlPolicy;
public class WikiUrlPolicyTest {
 public static void main(String[] args){
  for(String url:new String[]{"https://stardewvalleywiki.com/Crops","https://zh.stardewvalleywiki.com/%E4%BD%9C%E7%89%A9","https://stardewvalleywiki.com:443/Special_Items_%26_Powers#Books",
   "https://zh.stardewvalleywiki.com/index.php?search=%E9%98%B2%E9%A3%8E%E8%8D%89&go=Go","https://stardewvalleywiki.com/"})
   if(!WikiUrlPolicy.allowed(url))throw new AssertionError("should allow "+url);
  for(String url:new String[]{null,"","file:///android_asset/index.html","javascript:alert(1)","https://stardew.local/bridge/state","http://127.0.0.1:23871/v1/snapshot",
   "http://stardewvalleywiki.com/Crops","https://evil.example/Crops","https://stardewvalleywiki.com.evil.example/","https://evilstardewvalleywiki.com/","https://en.stardewvalleywiki.com/",
   "https://stardewvalleywiki.com:8443/","https://user@stardewvalleywiki.com/","https://zh.stardewvalleywiki.com/a/../b","https://zh.stardewvalleywiki.com/a/%2e%2e/b","https://zh.stardewvalleywiki.com/a\\b"})
   if(WikiUrlPolicy.allowed(url))throw new AssertionError("should refuse "+url);
  System.out.println("PASS wiki URL policy: two wiki hosts only; schemes, ports, credentials, dot segments refused");
 }
}
