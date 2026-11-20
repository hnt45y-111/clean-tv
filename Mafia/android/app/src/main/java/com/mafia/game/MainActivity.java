package com.mafia.game;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** غلاف بسيط: يفتح واجهة اللعبة من خادمها. أول مرة (إن لم يُضبط عنوان عند البناء) يسأل عن العنوان ويحفظه. */
public class MainActivity extends Activity {
    private static final String START = "file:///android_asset/start.html";
    private WebView web;
    private SharedPreferences prefs;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().setStatusBarColor(0xFF090D1B);
        getWindow().setNavigationBarColor(0xFF090D1B);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON); // لا تنطفئ الشاشة أثناء اللعب
        prefs = getSharedPreferences("mafia", MODE_PRIVATE);
        web = new WebView(this);
        web.setBackgroundColor(0xFF090D1B);
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        s.setUserAgentString(s.getUserAgentString() + " MafiaApp/1");
        web.addJavascriptInterface(new Bridge(), "Android");
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl(); String server = server();
                if (u.toString().startsWith("file:") || (!server.isEmpty() && u.toString().startsWith(server))) return false;
                // الروابط الخارجية (مثل مشاركة الرقم) تفتح خارج التطبيق
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
                return true;
            }
            @Override
            public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
                if (r.isForMainFrame() && !r.getUrl().toString().startsWith("file:")) showStart("تعذّر الوصول إلى الخادم. تأكد من الإنترنت ومن العنوان.");
            }
        });
        if (server().isEmpty()) showStart(null); else web.loadUrl(server());
    }

    private String server() {
        String s = prefs.getString("server", BuildConfig.SERVER_URL);
        return s == null ? "" : s;
    }

    private void showStart(String err) {
        web.loadUrl(START + (err == null ? "" : "#err=" + Uri.encode(err)));
    }

    static String normalize(String in) {
        String u = in == null ? "" : in.trim();
        if (u.isEmpty()) return "";
        if (!u.startsWith("http://") && !u.startsWith("https://")) u = "https://" + u;
        int hash = u.indexOf('#');
        String base = hash >= 0 ? u.substring(0, hash) : u;
        while (base.endsWith("/")) base = base.substring(0, base.length() - 1);
        return base;
    }

    class Bridge {
        @JavascriptInterface public String getServer() { return server(); }
        @JavascriptInterface public void connect(String input) {
            final String base = normalize(input);
            if (base.isEmpty()) return;
            int hash = input.indexOf('#'); // رابط دعوة كامل: نحفظ الخادم ونفتح الرابط نفسه
            final String open = hash >= 0 ? base + "/" + input.substring(hash) : base;
            prefs.edit().putString("server", base).apply();
            runOnUiThread(() -> web.loadUrl(open));
        }
        @JavascriptInterface public void changeServer() { runOnUiThread(() -> showStart(null)); }
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack(); else super.onBackPressed();
    }
}
