package io.github.chankamman_dev.stardewds;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.net.Uri;
import android.os.Bundle;
import android.view.Display;
import android.view.Gravity;
import android.view.View;
import android.webkit.*;
import android.widget.LinearLayout;
import android.widget.TextView;

/** Online wiki reader. No JavaScript interface, no local files, no game bridge: only pages on the
 *  Stardew Valley Wiki (WikiUrlPolicy) load; anything else is refused. */
public final class WikiReaderActivity extends Activity {
 private static final int INK=Color.rgb(91,43,42),PAPER=Color.rgb(255,215,135),EDGE=Color.rgb(177,78,5);
 private WebView web;private TextView status;private View backButton;private String initial,current;private boolean english;private int textScale;
 @Override protected void attachBaseContext(Context base){Configuration c=new Configuration(base.getResources().getConfiguration());c.uiMode=(c.uiMode&~Configuration.UI_MODE_NIGHT_MASK)|Configuration.UI_MODE_NIGHT_NO;super.attachBaseContext(base.createConfigurationContext(c));}
 private String t(String zh,String en){return english?en:zh;}
 @Override public void onCreate(Bundle state){super.onCreate(state);
  initial=state!=null?state.getString("current",getIntent().getStringExtra("url")):getIntent().getStringExtra("url");
  if(!WikiUrlPolicy.allowed(initial)){finish();return;}
  english=!"zh.stardewvalleywiki.com".equals(Uri.parse(initial).getHost());textScale=getPreferences(0).getInt("textScale",100);
  getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY|View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
  LinearLayout layout=new LinearLayout(this);layout.setOrientation(LinearLayout.VERTICAL);layout.setBackgroundColor(PAPER);
  LinearLayout bar=new LinearLayout(this);bar.setGravity(Gravity.CENTER_VERTICAL);bar.setBackgroundColor(PAPER);bar.setPadding(dp(4),0,dp(4),0);
  backButton=button(bar,t("上一页","Previous page"),0,v->{if(web.canGoBack())web.goBack();});enable(backButton,false);
  button(bar,t("关闭阅读","Close reader"),1,v->finish());
  status=new TextView(this);status.setTextSize(14);status.setTextColor(INK);status.setSingleLine(true);status.setEllipsize(android.text.TextUtils.TruncateAt.END);status.setGravity(Gravity.CENTER_VERTICAL);status.setPadding(dp(8),0,dp(8),0);status.setText("Stardew Valley Wiki");
  bar.addView(status,new LinearLayout.LayoutParams(0,-1,1));
  button(bar,t("缩小文字","Smaller text"),2,v->scaleText(-10));button(bar,t("放大文字","Larger text"),3,v->scaleText(10));
  final int other=otherDisplay();if(other!=displayId())button(bar,onTop()?t("移回下屏","Move to the lower screen"):t("移到上屏","Move to the top screen"),4,v->moveTo(other));
  layout.addView(bar,new LinearLayout.LayoutParams(-1,dp(44)));
  View rule=new View(this);rule.setBackgroundColor(EDGE);layout.addView(rule,new LinearLayout.LayoutParams(-1,dp(2)));
  web=new WebView(this);WebSettings s=web.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setAllowFileAccess(false);s.setAllowContentAccess(false);
  s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);s.setSupportMultipleWindows(false);s.setJavaScriptCanOpenWindowsAutomatically(false);s.setSafeBrowsingEnabled(true);
  s.setBuiltInZoomControls(true);s.setDisplayZoomControls(false);s.setUseWideViewPort(true);s.setLoadWithOverviewMode(true);s.setTextZoom(textScale);s.setForceDark(WebSettings.FORCE_DARK_OFF);
  web.setWebViewClient(new WebViewClient(){
   @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){if(WikiUrlPolicy.allowed(r.getUrl().toString()))return false;status.setText(t("此链接不在 Wiki 内","That link leaves the wiki"));return true;}
   @Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest r){return "https".equals(r.getUrl().getScheme())?null:new WebResourceResponse("text/plain","UTF-8",new java.io.ByteArrayInputStream(new byte[0]));}
   @Override public void onPageStarted(WebView v,String url,android.graphics.Bitmap icon){if(!WikiUrlPolicy.allowed(url)){v.stopLoading();status.setText(t("此链接不在 Wiki 内","That link leaves the wiki"));return;}current=url;status.setText(t("正在加载…","Loading…"));}
   @Override public void onPageFinished(WebView v,String url){if(!WikiUrlPolicy.allowed(url))return;current=url;String title=v.getTitle();status.setText(title==null||title.isEmpty()?"Stardew Valley Wiki":title);}
   @Override public void doUpdateVisitedHistory(WebView v,String url,boolean reload){enable(backButton,v.canGoBack());}
   @Override public void onReceivedError(WebView v,WebResourceRequest r,WebResourceError e){if(r.isForMainFrame())status.setText(t("连接失败，请检查网络","Can't connect; check the network"));}
   @Override public void onReceivedHttpError(WebView v,WebResourceRequest r,WebResourceResponse e){if(r.isForMainFrame())status.setText(t("页面暂时无法打开","The page can't be opened right now"));}
  });
  layout.addView(web,new LinearLayout.LayoutParams(-1,0,1));setContentView(layout);current=initial;
  Bundle saved=state==null?null:state.getBundle("web");if(saved==null||web.restoreState(saved)==null)web.loadUrl(initial);
 }
 private void scaleText(int delta){textScale=Math.max(70,Math.min(170,textScale+delta));web.getSettings().setTextZoom(textScale);getPreferences(0).edit().putInt("textScale",textScale).apply();status.setText(t("文字 ","Text ")+textScale+"%");}
 private int displayId(){Display d=getDisplay();return d==null?Display.DEFAULT_DISPLAY:d.getDisplayId();}
 private boolean onTop(){return displayId()==Display.DEFAULT_DISPLAY;}
 /** The other physical screen, or our own id when only one is reported. */
 private int otherDisplay(){if(!onTop())return Display.DEFAULT_DISPLAY;android.hardware.display.DisplayManager m=(android.hardware.display.DisplayManager)getSystemService(DISPLAY_SERVICE);
  for(Display d:m.getDisplays())if(d.getDisplayId()!=Display.DEFAULT_DISPLAY&&d.isValid())return d.getDisplayId();return displayId();}
 private void moveTo(int target){String url=WikiUrlPolicy.allowed(web.getUrl())?web.getUrl():current;
  // A fresh task, otherwise the launch folds back into the task on the screen we are leaving.
  Intent intent=new Intent(this,WikiReaderActivity.class).putExtra("url",url).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_MULTIPLE_TASK);
  android.app.ActivityOptions o=android.app.ActivityOptions.makeBasic();o.setLaunchDisplayId(target);try{startActivity(intent,o.toBundle());finish();}catch(RuntimeException ignored){}}
 private int dp(int v){return Math.round(v*getResources().getDisplayMetrics().density);}
 private void enable(View b,boolean on){b.setEnabled(on);b.setAlpha(on?1f:.35f);}
 /** Pixel icons in the game's ink: 0 back, 1 close, 2 smaller text, 3 larger text, 4 other screen. */
 private View button(LinearLayout row,String label,int kind,View.OnClickListener click){
  View b=new View(this){final Paint p=new Paint();@Override protected void onDraw(Canvas c){super.onDraw(c);c.save();c.translate((getWidth()-dp(20))/2f,(getHeight()-dp(20))/2f);c.scale(dp(20)/20f,dp(20)/20f);p.setColor(INK);
   if(kind==0){c.drawRect(4,9,18,11,p);for(int i=0;i<4;i++){c.drawRect(3+i*2,7-i*2,5+i*2,9-i*2,p);c.drawRect(3+i*2,11+i*2,5+i*2,13+i*2,p);}}
   else if(kind==1){for(int i=0;i<7;i++){c.drawRect(3+i*2,3+i*2,5+i*2,5+i*2,p);c.drawRect(15-i*2,3+i*2,17-i*2,5+i*2,p);}}
   else if(kind==2||kind==3){c.drawRect(2,4,4,18,p);c.drawRect(8,4,10,18,p);c.drawRect(4,2,8,4,p);c.drawRect(4,10,8,12,p);c.drawRect(12,10,19,12,p);if(kind==3)c.drawRect(14.5f,7.5f,16.5f,14.5f,p);}
   else{c.drawRect(3,2,17,4,p);c.drawRect(3,7,17,9,p);c.drawRect(3,2,5,9,p);c.drawRect(15,2,17,9,p);c.drawRect(3,11,17,18,p);}
   c.restore();}};
  b.setContentDescription(label);b.setTooltipText(label);b.setFocusable(true);android.util.TypedValue v=new android.util.TypedValue();getTheme().resolveAttribute(android.R.attr.selectableItemBackground,v,true);b.setBackgroundResource(v.resourceId);
  b.setOnClickListener(click);row.addView(b,new LinearLayout.LayoutParams(dp(44),-1));return b;}
 @Override protected void onSaveInstanceState(Bundle state){super.onSaveInstanceState(state);if(web==null)return;state.putString("current",current);Bundle w=new Bundle();web.saveState(w);state.putBundle("web",w);}
 @Override public void onBackPressed(){if(web!=null&&web.canGoBack())web.goBack();else finish();}
 @Override protected void onDestroy(){if(web!=null){web.stopLoading();web.destroy();web=null;}super.onDestroy();}
}
