package io.github.chankamman_dev.stardewds;
import android.app.Activity;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.util.Log;
import android.webkit.*;
import java.io.*;
import java.net.*;
import java.util.Collections;
import org.json.JSONObject;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import android.media.SoundPool;
import android.media.AudioAttributes;
import java.util.HashMap;
import java.util.Map;

public final class MainActivity extends Activity {
 private WebView web;
 private AssetPackStore assetPacks;
 // One-shot result shown by the page after it reloads (e.g. new assets imported).
 private volatile String notice="";
 private final ExecutorService imports=Executors.newSingleThreadExecutor();
 // Performance log (perf-log.js): lines appended on one background thread to the App's own files
 // directory (adb pull /sdcard/Android/data/<package>/files/perf), 1 MB per file, the last 5 kept.
 // Page names, counts and timings only: no save data, pairing key or request bodies.
 private final ExecutorService perfWriter=Executors.newSingleThreadExecutor();
 private File perfFile;
 private void perfAppend(String text){perfWriter.execute(()->{try{File dir=getExternalFilesDir("perf");if(dir==null)return;
   if(perfFile==null||perfFile.length()>1<<20){perfFile=new File(dir,"perf-"+new java.text.SimpleDateFormat("yyyyMMdd-HHmmss",java.util.Locale.ROOT).format(new java.util.Date())+".log");
    File[] old=dir.listFiles((d,n)->n.startsWith("perf-")&&n.endsWith(".log"));if(old!=null&&old.length>=5){java.util.Arrays.sort(old);for(int i=0;i<old.length-4;i++)old[i].delete();}}
   try(Writer w=new OutputStreamWriter(new FileOutputStream(perfFile,true),java.nio.charset.StandardCharsets.UTF_8)){w.write(text);if(!text.endsWith("\n"))w.write('\n');}}catch(IOException e){Log.w("StardewThor","perf log: "+e);}});}
 private InputStream content(String path)throws IOException{try{return getAssets().open(path);}catch(IOException e){if(assetPacks!=null)return assetPacks.open(path);throw e;}}
 private boolean hasContent(){try(InputStream in=content("offline.json")){return true;}catch(IOException e){return false;}}
 private void pickAssets(){startActivityForResult(new android.content.Intent(android.content.Intent.ACTION_OPEN_DOCUMENT).addCategory(android.content.Intent.CATEGORY_OPENABLE).setType("application/zip"),71);}
 private void pickPairing(){startActivityForResult(new android.content.Intent(android.content.Intent.ACTION_OPEN_DOCUMENT).addCategory(android.content.Intent.CATEGORY_OPENABLE).setType("application/json"),72);}
 private String previewMod;
 private void pickModPreview(String id){if(previewMod!=null)return;previewMod=id;startActivityForResult(new android.content.Intent(android.content.Intent.ACTION_OPEN_DOCUMENT).addCategory(android.content.Intent.CATEGORY_OPENABLE).setType("image/*").putExtra(android.content.Intent.EXTRA_MIME_TYPES,new String[]{"image/png","image/jpeg"}),73);}
 private void previewResult(int result,android.content.Intent data){final String id=previewMod;previewMod=null;if(id==null||result!=RESULT_OK||data==null||data.getData()==null)return;final android.net.Uri uri=data.getData();
  imports.execute(()->{try(InputStream in=getContentResolver().openInputStream(uri)){if(in==null)throw new IOException("file");final String image=ModPreviewImage.read(in);runOnUiThread(()->{if(web!=null&&!isDestroyed())web.evaluateJavascript("window.ModManager&&ModManager.preview("+JSONObject.quote(id)+","+JSONObject.quote(image)+")",null);});}
   catch(Exception e){runOnUiThread(()->{if(web!=null&&!isDestroyed())web.evaluateJavascript("window.ModLibrary&&ModLibrary.previewError()",null);});}});
 }
 // Import results go to the page (first-run setup or Settings), never to a system toast.
 private void report(String kind,String state,String code){if(web==null)return;String json="{\"kind\":\""+kind+"\",\"state\":\""+state+"\""+(code==null?"":",\"code\":\""+code+"\"")+"}";web.evaluateJavascript("window.stardewImport&&window.stardewImport("+json+")",null);}
 @Override protected void onActivityResult(int request,int result,android.content.Intent data){super.onActivityResult(request,result,data);if(request==73){previewResult(result,data);return;}if(request!=71&&request!=72)return;String kind=request==72?"pairing":"assets";
  if(result!=RESULT_OK||data==null||data.getData()==null){report(kind,"idle",null);return;}android.net.Uri uri=data.getData();report(kind,"checking",null);
  imports.execute(()->{try(InputStream in=getContentResolver().openInputStream(uri)){if(in==null)throw new IOException("Cannot open file");
    if(request==72){String key=PairingFile.read(in);getPreferences(0).edit().putString("controlKey",key).commit();runOnUiThread(()->report(kind,"ok",null));}
    else{int files=assetPacks.install(in);runOnUiThread(()->{if(isDestroyed())return;notice="{\"kind\":\"assets\",\"state\":\"ok\",\"files\":"+files+"}";start(true);});}}
   catch(Exception e){Log.w("StardewThor","Local import: "+e.getClass().getSimpleName());String code=request==72?"pairing":AssetPackStore.reason(e);runOnUiThread(()->report(kind,"error",code));}});}
 // Without game assets the page is the first-run import guide; with them, the App itself.
 private void start(boolean fresh){boolean ready=hasContent();if(ready){if(soundPool!=null){soundPool.release();soundPool=null;sounds.clear();}loadSounds();}if(fresh)web.clearCache(true);web.loadUrl(ready?"https://stardew.local/":"https://stardew.local/setup.html");}
 private boolean resumed;
 private final ExecutorService commands=Executors.newSingleThreadExecutor();
 private SoundPool soundPool;private final Map<String,Integer> sounds=new HashMap<>();
 private void loadSounds(){soundPool=new SoundPool.Builder().setMaxStreams(2).setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build()).build();
  soundPool.setOnLoadCompleteListener((pool,sample,status)->Log.i("StardewThor","UI sound loaded: "+sample+" status="+status));
  for(String cue:new String[]{"smallSelect","bigSelect","dwop","cancel"})try{File file=new File(getCacheDir(),"thor-"+cue+".wav");try(InputStream in=content("audio/"+cue+".wav");OutputStream out=new FileOutputStream(file)){byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1)out.write(b,0,n);}sounds.put(cue,soundPool.load(file.getAbsolutePath(),1));}catch(IOException e){Log.w("StardewThor","UI audio unavailable: "+cue);}
 }
 private void pairing(android.content.Intent intent){String key=intent.getStringExtra("controlKey");if(key!=null&&key.matches("[0-9a-f]{64}"))getPreferences(0).edit().putString("controlKey",key).apply();intent.removeExtra("controlKey");}
 @Override protected void onNewIntent(android.content.Intent intent){super.onNewIntent(intent);setIntent(intent);pairing(intent);}
 @Override public void onCreate(Bundle state){super.onCreate(state);getWindow().addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);try{assetPacks=new AssetPackStore(new File(getFilesDir(),"game-assets"));}catch(IOException e){Log.w("StardewThor","Asset storage unavailable");}pairing(getIntent());web=new WebView(this);setContentView(web);immersive();
  web.addJavascriptInterface(new NativeCommands(),"ThorCommands");
  WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setMediaPlaybackRequiresUserGesture(true);
  settings.setUseWideViewPort(true);settings.setLoadWithOverviewMode(true);settings.setSupportZoom(false);settings.setTextZoom(100);
  web.setWebViewClient(new WebViewClient(){
   @Override public boolean onRenderProcessGone(WebView v,RenderProcessGoneDetail detail){Log.w("StardewThor","Web renderer restarted; crash="+detail.didCrash());if(web==v){web=null;((android.view.ViewGroup)v.getParent()).removeView(v);v.destroy();recreate();}return true;}
   @Override public void onPageFinished(WebView v,String url){v.post(()->v.evaluateJavascript("window.stardewLifecycle&&window.stardewLifecycle("+resumed+");window.GameFont&&window.GameFont.layout();JSON.stringify({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,visualWidth:visualViewport.width,visualScale:visualViewport.scale})",value->Log.i("StardewThor","viewport "+value)));}
   @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){return true;}
   @Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest r){
    if(!r.getUrl().getScheme().equals("https")||!r.getUrl().getHost().equals("stardew.local")||!r.getMethod().equals("GET"))return error();
    String path=r.getUrl().getPath();
    try{
     String dataRoute=ReadOnlyDataRoutes.route(r.getUrl().getEncodedPath(),r.getUrl().getEncodedQuery());
     if(dataRoute!=null)return bridge(dataRoute);
     if(path.startsWith("/bridge/mod-config/")||path.startsWith("/bridge/mod-preview/")||path.equals("/bridge/mods")||path.equals("/bridge/events")||path.equals("/bridge/bundles")||path.equals("/bridge/collections")||path.equals("/bridge/progress")||path.startsWith("/bridge/catalog/"))return error();
     if(path.matches("/bridge/tracking/(map|profile|off)"))return bridge("/v1/tracking/"+path.substring(path.lastIndexOf('/')+1));
     if(path.equals("/bridge/state"))return bridge("/v1/snapshot");
     // Architecture v2 phase 4: the documents the open stream should hold and announce.
     if(path.equals("/bridge/demand")){String q=r.getUrl().getEncodedQuery();if(q!=null&&q.matches("id=[0-9a-f]{32}&docs=[a-z%2C,-]{0,160}"))return bridge("/v3/demand?"+q);return error();}
     if(path.equals("/bridge/farm"))return bridge("/v1/farm");
     if(path.equals("/bridge/target/on")||path.equals("/bridge/target/off"))return bridge("/v1/target/"+path.substring(path.lastIndexOf('/')+1));
     if(path.matches("/bridge/asset/[0-9a-f]{64}"))return asset(path.substring(14));
     if(path.matches("/bridge/localmap/(blob/[0-9a-f]{64}|[A-Za-z0-9_. -]{1,80})"))return localMap(path.substring(17));
     if(path.equals("/"))path="/index.html";
     if(!path.matches("/[a-zA-Z0-9._/-]+")||path.contains(".."))return error();
     String mime=path.endsWith(".wav")?"audio/wav":path.endsWith(".js")?"application/javascript":path.endsWith(".css")?"text/css":path.endsWith(".svg")?"image/svg+xml":path.endsWith(".png")?"image/png":path.endsWith(".json")?"application/json":path.endsWith(".woff2")?"font/woff2":"text/html";
     return new WebResourceResponse(mime,"UTF-8",content(path.substring(1)));
    }catch(Exception e){return error();}
   }
  });start(false);
 }
 // Local map manifest (JSON) and immutable blobs (PNG sheets, gzip draw data), read-only.
 private WebResourceResponse localMap(String rest)throws IOException{
  boolean blob=rest.startsWith("blob/");
  HttpURLConnection c=(HttpURLConnection)new URL("http://127.0.0.1:23871/v1/localmap/"+(blob?rest:android.net.Uri.encode(rest))).openConnection();c.setConnectTimeout(700);c.setReadTimeout(3000);c.setInstanceFollowRedirects(false);
  try{if(c.getResponseCode()!=200)return error();String type=c.getContentType();String mime=type==null?"application/octet-stream":type.split(";")[0].trim();
   try(InputStream in=c.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] b=new byte[16384];int n;while((n=in.read(b))!=-1){if(out.size()+n>4*1048576+65536)throw new IOException("oversize");out.write(b,0,n);}
    WebResourceResponse response=new WebResourceResponse(mime,mime.startsWith("application/json")?"UTF-8":null,new ByteArrayInputStream(out.toByteArray()));
    java.util.Map<String,String> headers=new java.util.HashMap<>();headers.put("Cache-Control",blob?"public, max-age=31536000, immutable":"no-store");response.setResponseHeaders(headers);return response;}}
  finally{c.disconnect();}
 }
 private WebResourceResponse asset(String hash)throws IOException{
  HttpURLConnection c=(HttpURLConnection)new URL("http://127.0.0.1:23871/v1/asset/"+hash).openConnection();c.setConnectTimeout(700);c.setReadTimeout(1200);c.setInstanceFollowRedirects(false);
  try{if(c.getResponseCode()!=200)return error();try(InputStream in=c.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1){if(out.size()+n>1048576)throw new IOException("oversize");out.write(b,0,n);}return new WebResourceResponse("image/png",null,new ByteArrayInputStream(out.toByteArray()));}}finally{c.disconnect();}
 }
 private final class NativeCommands{
  @JavascriptInterface public void importAssets(){runOnUiThread(()->pickAssets());}
  @JavascriptInterface public void importPairing(){runOnUiThread(()->pickPairing());}
  @JavascriptInterface public void importModPreview(String id){if(id!=null&&id.length()<=160&&id.matches("[A-Za-z0-9_-]+(?:\\.[A-Za-z0-9_-]+)*"))runOnUiThread(()->pickModPreview(id));}
  @JavascriptInterface public void play(String cue){Integer sound=sounds.get(cue);if(sound!=null&&soundPool!=null)soundPool.play(sound,.25f,.25f,1,0,1f);}
  // Architecture v2: one long-lived /v3/stream connection on its own thread. Each batch of complete
  // lines goes to window.stardewStream; the end (or a refusal status) to window.stardewStreamEnd.
  @JavascriptInterface public void openStream(String topics){if(topics==null||!topics.matches("[a-z,]{1,80}"))return;stopStream();Thread t=new Thread(()->runStream(topics),"StardewDS stream");streamThread=t;t.start();}
  @JavascriptInterface public void closeStream(){stopStream();}
  @JavascriptInterface public void perfLog(String lines){if(lines!=null&&lines.length()<=65536)perfAppend(lines);}
  @JavascriptInterface public String appVersion(){try{return getPackageManager().getPackageInfo(getPackageName(),0).versionName;}catch(Exception e){return "";}}
  @JavascriptInterface public boolean paired(){return getPreferences(0).contains("controlKey");}
  @JavascriptInterface public String notice(){String value=notice;notice="";return value;}
  // Where the game assets come from: built into a development APK, or the imported pack.
  @JavascriptInterface public String assetInfo(){try(InputStream in=getAssets().open("offline.json")){return "{\"source\":\"bundled\"}";}catch(IOException e){}try{long[] v=assetPacks==null?null:assetPacks.summary();return v==null?"{\"source\":\"none\"}":"{\"source\":\"pack\",\"files\":"+v[0]+",\"at\":"+v[1]+"}";}catch(IOException e){return "{\"source\":\"none\"}";}}
  // Wiki pages open in their own bridge-free reader on this screen; the URL is checked again there.
  @JavascriptInterface public void openWiki(String url){if(!WikiUrlPolicy.allowed(url))return;runOnUiThread(()->{android.content.Intent intent=new android.content.Intent(MainActivity.this,WikiReaderActivity.class).putExtra("url",url);
   android.app.ActivityOptions options=android.app.ActivityOptions.makeBasic();if(getDisplay()!=null)options.setLaunchDisplayId(getDisplay().getDisplayId());try{startActivity(intent,options.toBundle());}catch(RuntimeException e){Log.w("StardewThor","Wiki reader: "+e.getClass().getSimpleName());}});}
  @JavascriptInterface public void request(String correlation,String route,String body){
   if(!correlation.matches("[0-9a-f]{32}")||!(route.equals("command")||route.matches("receipt/[0-9a-f]{32}"))||body.length()>2048)return;
   commands.execute(()->{String result="{\"state\":\"unavailable\",\"code\":\"connection\"}";HttpURLConnection c=null;
    try{c=(HttpURLConnection)new URL("http://127.0.0.1:23871/v2/"+route).openConnection();c.setConnectTimeout(700);c.setReadTimeout(1200);c.setInstanceFollowRedirects(false);c.setRequestProperty("X-Stardew-Key",getPreferences(0).getString("controlKey",""));
     if(route.equals("command")){c.setRequestMethod("POST");c.setDoOutput(true);c.setRequestProperty("Content-Type","application/json");byte[] payload=body.getBytes("UTF-8");c.setFixedLengthStreamingMode(payload.length);try(OutputStream out=c.getOutputStream()){out.write(payload);}}
     if(c.getResponseCode()==403)result="{\"state\":\"rejected\",\"code\":\"unpaired\"}";
     else if(c.getResponseCode()==200)try(InputStream in=c.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] b=new byte[1024];int n;while((n=in.read(b))!=-1){if(out.size()+n>4096)throw new IOException("oversize");out.write(b,0,n);}result=out.toString("UTF-8");}
    }catch(Exception e){Log.w("StardewThor","Control transport: "+e.getClass().getSimpleName());}finally{if(c!=null)c.disconnect();}
    final String reply=result;if(web!=null)web.post(()->{if(web!=null)web.evaluateJavascript("window.stardewCommandReply&&window.stardewCommandReply("+JSONObject.quote(correlation)+","+reply+")",null);});
   });
  }
 }
 private volatile Thread streamThread;private volatile HttpURLConnection streamConnection;
 private void stopStream(){Thread t=streamThread;streamThread=null;HttpURLConnection c=streamConnection;streamConnection=null;if(c!=null)commands.execute(c::disconnect);if(t!=null)t.interrupt();}
 private void runStream(String topics){HttpURLConnection c=null;int code=0;
  try{c=(HttpURLConnection)new URL("http://127.0.0.1:23871/v3/stream?topics="+topics).openConnection();streamConnection=c;
   // The mod sends a heartbeat every second; four silent seconds mean the game is gone.
   c.setConnectTimeout(700);c.setReadTimeout(4000);c.setUseCaches(false);c.setInstanceFollowRedirects(false);
   code=c.getResponseCode();if(code!=200)return;
   try(java.io.BufferedReader in=new java.io.BufferedReader(new java.io.InputStreamReader(c.getInputStream(),"UTF-8"),65536)){
    StringBuilder batch=new StringBuilder();String line;
    while(streamThread==Thread.currentThread()&&(line=in.readLine())!=null){
     if(line.length()>2_000_000)throw new IOException("oversize");batch.append(line).append('\n');
     if(!in.ready()||batch.length()>1_000_000){String text=batch.toString();batch.setLength(0);toPage("window.stardewStream&&window.stardewStream("+JSONObject.quote(text)+")");}
    }
   }
   code=0;
  }catch(Exception e){if(streamThread==Thread.currentThread())Log.w("StardewThor","Stream: "+e.getClass().getSimpleName());code=0;}
  finally{if(c!=null)c.disconnect();if(streamThread==Thread.currentThread()){streamThread=null;toPage("window.stardewStreamEnd&&window.stardewStreamEnd("+code+")");}}
 }
 private void toPage(String script){WebView w=web;if(w!=null)w.post(()->{if(web!=null)web.evaluateJavascript(script,null);});}
 private void immersive(){web.setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY|View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_LAYOUT_STABLE|View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN|View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);}
 @Override public void onWindowFocusChanged(boolean focused){super.onWindowFocusChanged(focused);if(focused&&web!=null){immersive();web.post(()->web.evaluateJavascript("window.GameFont&&window.GameFont.layout()",null));}}
 private WebResourceResponse bridge(String route) throws IOException {
  HttpURLConnection c=(HttpURLConnection)new URL("http://127.0.0.1:23871"+route).openConnection();
  c.setConnectTimeout(700);c.setReadTimeout(900);c.setUseCaches(false);c.setInstanceFollowRedirects(false);
  try{if(c.getResponseCode()==404&&route.startsWith("/v1/target/"))return new WebResourceResponse("application/json","UTF-8",404,"Not Found",Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));if(c.getResponseCode()!=200)return error();try(InputStream in=c.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){
   byte[] bytes=new byte[8192];int n;while((n=in.read(bytes))!=-1){if(out.size()+n>600000)throw new IOException("oversize");out.write(bytes,0,n);}
   return new WebResourceResponse("application/json","UTF-8",200,"OK",Collections.singletonMap("Cache-Control","no-store"),new ByteArrayInputStream(out.toByteArray()));
  }}finally{c.disconnect();}
 }
 private WebResourceResponse error(){return new WebResourceResponse("text/plain","UTF-8",503,"Unavailable",Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));}
 @Override protected void onPause(){resumed=false;if(web!=null){web.evaluateJavascript("window.stardewLifecycle&&window.stardewLifecycle(false)",null);web.onPause();}super.onPause();}
 @Override protected void onResume(){super.onResume();resumed=true;if(web!=null){web.onResume();web.evaluateJavascript("window.stardewLifecycle&&window.stardewLifecycle(true)",null);}}
 @Override public void onBackPressed(){if(web==null){super.onBackPressed();return;}web.evaluateJavascript("!!(window.ThorNav&&window.ThorNav.back())",value->{if(!"true".equals(value))moveTaskToBack(true);});}
 @Override protected void onDestroy(){stopStream();imports.shutdownNow();commands.shutdownNow();if(soundPool!=null){soundPool.release();soundPool=null;}if(web!=null){web.destroy();web=null;}super.onDestroy();}
}
