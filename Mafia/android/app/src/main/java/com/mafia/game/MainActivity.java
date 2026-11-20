package com.mafia.game;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.util.ArrayList;
import java.util.List;

/**
 * شاشة البداية: «أنا الراوي» (يشغّل الخادم ونقطة الاتصال على هذا الهاتف ثم يفتح اللعبة)
 * أو «أنا لاعب» (يفتح رابط الغرفة؛ ويمكن للاعب أيضاً اللعب من متصفحه دون التطبيق).
 */
public class MainActivity extends Activity {
    private static final String START = "file:///android_asset/start.html";
    private static final int REQ = 7;
    private WebView web;
    private final Handler ui = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().setStatusBarColor(0xFF090D1B);
        getWindow().setNavigationBarColor(0xFF090D1B);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        web = new WebView(this);
        web.setBackgroundColor(0xFF090D1B);
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setUserAgentString(s.getUserAgentString() + " MafiaApp/2");
        web.addJavascriptInterface(new Bridge(), "Android");
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                String u = r.getUrl().toString();
                if (u.startsWith("file:") || u.startsWith("http://")) return false; // الغرفة دائماً عنوان محلي http
                try { startActivity(new Intent(Intent.ACTION_VIEW, r.getUrl())); } catch (Exception ignored) { }
                return true;
            }
            @Override
            public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
                if (r.isForMainFrame() && !r.getUrl().toString().startsWith("file:"))
                    showStart(HostService.running ? "تعذّر فتح الغرفة. حاول مجدداً." : "تعذّر الوصول إلى الغرفة. تأكد أنك متصل بشبكة الراوي وأطفئ بيانات الهاتف.");
            }
        });
        if (HostService.running && HostService.port > 0) openHost(); else showStart(null);
    }

    private void showStart(String err) { web.loadUrl(START + (err == null ? "" : "#err=" + Uri.encode(err))); }

    private void openHost() {
        final long t0 = System.currentTimeMillis();
        Runnable wait = new Runnable() { public void run() {
            if (HostService.port > 0) web.loadUrl("http://127.0.0.1:" + HostService.port + "/");
            else if (HostService.port < 0 || System.currentTimeMillis() - t0 > 8000) showStart("تعذّر تشغيل خادم اللعبة على هذا الهاتف.");
            else ui.postDelayed(this, 200);
        } };
        ui.post(wait);
    }

    private void startHost() {
        Intent i = new Intent(this, HostService.class);
        if (Build.VERSION.SDK_INT >= 26) startForegroundService(i); else startService(i);
        openHost();
    }

    /** صلاحيات نقطة الاتصال: الأجهزة القديمة تحتاج الموقع، وأندرويد 13+ يحتاج «الأجهزة القريبة» والإشعارات */
    private void requestHost() {
        List<String> need = new ArrayList<>();
        if (Build.VERSION.SDK_INT >= 33) { need.add(Manifest.permission.NEARBY_WIFI_DEVICES); need.add(Manifest.permission.POST_NOTIFICATIONS); }
        else need.add(Manifest.permission.ACCESS_FINE_LOCATION);
        List<String> missing = new ArrayList<>();
        for (String p : need) if (checkSelfPermission(p) != PackageManager.PERMISSION_GRANTED) missing.add(p);
        if (missing.isEmpty()) startHost(); else requestPermissions(missing.toArray(new String[0]), REQ);
    }
    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] res) {
        if (code == REQ) startHost(); // نكمل حتى لو رُفضت: يبقى الخادم ويُطلب تشغيل نقطة الاتصال يدوياً
    }

    class Bridge {
        @JavascriptInterface public boolean isHosting() { return HostService.running; }
        @JavascriptInterface public void host() { ui.post(MainActivity.this::requestHost); }
        @JavascriptInterface public void openHostRoom() { ui.post(MainActivity.this::openHost); }
        @JavascriptInterface public void stopHost() { ui.post(() -> { stopService(new Intent(MainActivity.this, HostService.class)); HostService.running = false; showStart(null); }); }
        @JavascriptInterface public void join(String link) {
            final String u = link == null ? "" : link.trim();
            if (!u.startsWith("http://") && !u.startsWith("https://")) return;
            ui.post(() -> web.loadUrl(u));
        }
        @JavascriptInterface public void changeServer() { ui.post(() -> showStart(null)); }
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else if (HostService.running) moveTaskToBack(true); // الرجوع لا يوقف الغرفة
        else super.onBackPressed();
    }
}
