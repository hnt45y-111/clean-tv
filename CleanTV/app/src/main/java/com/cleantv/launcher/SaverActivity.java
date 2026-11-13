package com.cleantv.launcher;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** Dim screensaver shown above other apps when nothing is playing and no key was pressed. */
public class SaverActivity extends Activity {
    static volatile boolean showing = false;
    private WebView web;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        showing = true;
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
        try {
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.screenBrightness = 0.12f; // dimmed; TVs that do not support it simply ignore it
            getWindow().setAttributes(lp);
        } catch (Throwable ignored) { }
        web = new WebView(this);
        web.setBackgroundColor(Color.BLACK);
        web.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        web.setFocusable(false);
        web.setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowFileAccessFromFileURLs(true);
        web.setWebViewClient(new WebViewClient());
        web.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public String media() { return MediaListener.info(SaverActivity.this); }

            @JavascriptInterface
            public String loc() { return CarSensors.state(); }

            @JavascriptInterface
            public void fetchAsync(final String url, final String cbId) {
                new Thread(() -> {
                    String res = "";
                    java.net.HttpURLConnection con = null;
                    try {
                        con = (java.net.HttpURLConnection) new java.net.URL(url).openConnection();
                        con.setConnectTimeout(10000); con.setReadTimeout(15000);
                        con.setRequestProperty("User-Agent", "CleanTV/3.0 (personal Android TV launcher)");
                        java.io.BufferedReader r = new java.io.BufferedReader(new java.io.InputStreamReader(con.getInputStream(), java.nio.charset.StandardCharsets.UTF_8));
                        StringBuilder sb = new StringBuilder(); String line;
                        while ((line = r.readLine()) != null) sb.append(line).append('\n');
                        r.close(); res = sb.toString();
                    } catch (Throwable ignored) { } finally { if (con != null) con.disconnect(); }
                    final String out = res;
                    web.post(() -> web.evaluateJavascript("window.__cb(" + org.json.JSONObject.quote(cbId) + "," + org.json.JSONObject.quote(out) + ")", null));
                }).start();
            }

            @JavascriptInterface
            public String listBgAssets() {
                org.json.JSONArray arr = new org.json.JSONArray();
                try {
                    String[] names = getAssets().list("bg");
                    if (names != null) for (String n : names) if (n.toLowerCase().endsWith(".jpg")) arr.put("bg/" + n);
                } catch (Throwable ignored) { }
                return arr.toString();
            }
        }, "Android");
        setContentView(web);
        web.loadUrl("file:///android_asset/saver.html");
    }

    private void close() {
        PowerService.lastInput = System.currentTimeMillis();
        if (!isFinishing()) finish();
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (event.getAction() == KeyEvent.ACTION_DOWN) close();
        return true;
    }

    @Override
    public boolean dispatchTouchEvent(MotionEvent ev) { close(); return true; }

    @Override
    protected void onPause() {
        super.onPause();
        // counted as activity: without this the idle check reopened the saver right away (on/off flicker)
        PowerService.lastInput = System.currentTimeMillis();
        if (!isFinishing()) finish();
    }

    @Override
    protected void onDestroy() {
        showing = false;
        if (web != null) { web.destroy(); web = null; }
        super.onDestroy();
    }
}
