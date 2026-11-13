package com.msm.auto;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.View;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** The phone side: activation, picking and designing the car dashboard, and the permissions it needs. */
public class MainActivity extends Activity {
    private WebView web;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final ExecutorService net = Executors.newFixedThreadPool(2);
    private String pickId;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        Window w = getWindow();
        w.setStatusBarColor(Color.parseColor("#0B0C10"));
        w.setNavigationBarColor(Color.parseColor("#0B0C10"));
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#0B0C10"));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true); s.setAllowFileAccess(true);
        s.setAllowFileAccessFromFileURLs(true); s.setAllowUniversalAccessFromFileURLs(true);
        s.setTextZoom(100);
        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient());
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.addJavascriptInterface(new Bridge(), "B");
        web.loadUrl("file:///android_asset/index.html");
        setContentView(web);
    }

    @Override protected void onResume() {
        super.onResume();
        if (web != null) web.evaluateJavascript("window.onResumeApp&&onResumeApp()", null);
    }

    @Override public void onBackPressed() {
        web.evaluateJavascript("window.goBack?goBack():false", v -> { if (!"true".equals(v)) moveTaskToBack(true); });
    }

    private void cb(String id, boolean ok, String res) {
        String q = JSONObject.quote(res == null ? "" : res);
        ui.post(() -> web.evaluateJavascript("window.__cb&&__cb(" + JSONObject.quote(id) + "," + ok + "," + q + ")", null));
    }

    @Override protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req != 7 || pickId == null) return;
        String id = pickId; pickId = null;
        if (res != RESULT_OK || data == null || data.getData() == null) { cb(id, false, "CANCEL"); return; }
        Uri u = data.getData();
        net.execute(() -> {
            try (InputStream in = getContentResolver().openInputStream(u)) {
                Bitmap bm = BitmapFactory.decodeStream(in);
                if (bm == null) throw new Exception("الصورة ما تنفتح");
                float k = Math.min(1f, 1920f / Math.max(bm.getWidth(), bm.getHeight()));
                Bitmap sc = Bitmap.createScaledBitmap(bm, Math.round(bm.getWidth() * k), Math.round(bm.getHeight() * k), true);
                try (FileOutputStream o = new FileOutputStream(new File(getFilesDir(), "wall.jpg"))) { sc.compress(Bitmap.CompressFormat.JPEG, 82, o); }
                App.kv(this).edit().putLong("wallAt", System.currentTimeMillis()).apply();
                cb(id, true, Media.png(sc, 640, true));
            } catch (Throwable e) { cb(id, false, e.getMessage()); }
        });
    }

    @Override public void onRequestPermissionsResult(int rc, String[] p, int[] g) {
        super.onRequestPermissionsResult(rc, p, g);
        web.evaluateJavascript("window.onResumeApp&&onResumeApp()", null);
    }

    private void openUrl(String url, String pkg) {
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            if (pkg != null && !pkg.isEmpty()) {
                i.setPackage(pkg);
                try { startActivity(i); return; } catch (Throwable ignored) { i.setPackage(null); }
            }
            startActivity(i);
        } catch (Throwable e) { Toast.makeText(this, "ما گدرت أفتح الرابط", Toast.LENGTH_SHORT).show(); }
    }

    private boolean has(String pkg) {
        try { getPackageManager().getPackageInfo(pkg, 0); return true; } catch (Throwable e) { return false; }
    }

    class Bridge {
        @JavascriptInterface public String code() { return Acct.deviceCode(MainActivity.this); }
        @JavascriptInterface public boolean active() { return Acct.active(MainActivity.this); }
        @JavascriptInterface public boolean activate(String c) { return Acct.activate(MainActivity.this, c); }
        @JavascriptInterface public String cfg() { return App.cfg(MainActivity.this); }
        @JavascriptInterface public void cfgSet(String j) { App.kv(MainActivity.this).edit().putString("cfg", j).apply(); }
        @JavascriptInterface public String kvGet(String k) { return App.kv(MainActivity.this).getString("ui_" + k, null); }
        @JavascriptInterface public void kvSet(String k, String v) { App.kv(MainActivity.this).edit().putString("ui_" + k, v).apply(); }
        @JavascriptInterface public String car() { return App.kv(MainActivity.this).getString("car", ""); }
        @JavascriptInterface public String version() {
            try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionName; } catch (Exception e) { return "1"; }
        }
        @JavascriptInterface public String apps() { return Media.apps(MainActivity.this).toString(); }
        @JavascriptInterface public String now() { return Media.now(MainActivity.this).toString(); }
        @JavascriptInterface public String perms() {
            try {
                return new JSONObject()
                        .put("media", Media.allowed(MainActivity.this))
                        .put("loc", checkSelfPermission(android.Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED)
                        .put("call", checkSelfPermission(android.Manifest.permission.CALL_PHONE) == PackageManager.PERMISSION_GRANTED)
                        .put("aa", has("com.google.android.projection.gearhead")).toString();
            } catch (Exception e) { return "{}"; }
        }
        @JavascriptInterface public void askMedia() {
            ui.post(() -> { try { startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)); } catch (Throwable e) { openUrl("package:" + getPackageName(), null); } });
        }
        @JavascriptInterface public void askLoc() {
            ui.post(() -> requestPermissions(new String[]{ android.Manifest.permission.ACCESS_FINE_LOCATION, android.Manifest.permission.ACCESS_COARSE_LOCATION }, 3));
        }
        @JavascriptInterface public void askCall() { ui.post(() -> requestPermissions(new String[]{ android.Manifest.permission.CALL_PHONE }, 4)); }
        @JavascriptInterface public void openAA() {
            ui.post(() -> {
                try {
                    startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:com.google.android.projection.gearhead"))
                            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                } catch (Throwable e) { openUrl("https://play.google.com/store/apps/details?id=com.google.android.projection.gearhead", ""); }
            });
        }
        @JavascriptInterface public void pickWall(String id) {
            ui.post(() -> {
                pickId = id;
                try { startActivityForResult(new Intent(Intent.ACTION_GET_CONTENT).setType("image/*").addCategory(Intent.CATEGORY_OPENABLE), 7); }
                catch (Throwable e) { pickId = null; cb(id, false, "ما لگيت معرض صور"); }
            });
        }
        @JavascriptInterface public String wall() {
            File f = new File(getFilesDir(), "wall.jpg");
            if (!f.exists()) return "";
            Bitmap b = BitmapFactory.decodeFile(f.getAbsolutePath());
            return Media.png(b, 640, true);
        }
        @JavascriptInterface public void ai(String id, String system, String prompt) {
            net.execute(() -> {
                try { cb(id, true, Gemini.generate(MainActivity.this, system, prompt)); }
                catch (Throwable e) { cb(id, false, e.getMessage() == null ? "صار خطأ" : e.getMessage()); }
            });
        }
        @JavascriptInterface public void open(String url, String pkg) { ui.post(() -> openUrl(url, pkg)); }
        @JavascriptInterface public void copy(String t) {
            ((ClipboardManager) getSystemService(CLIPBOARD_SERVICE)).setPrimaryClip(ClipData.newPlainText("text", t));
        }
        @JavascriptInterface public void toast(String t) { ui.post(() -> Toast.makeText(MainActivity.this, t, Toast.LENGTH_SHORT).show()); }
        @JavascriptInterface public void vibe() {
            try { web.performHapticFeedback(android.view.HapticFeedbackConstants.VIRTUAL_KEY); } catch (Throwable ignored) { }
        }
    }
}
