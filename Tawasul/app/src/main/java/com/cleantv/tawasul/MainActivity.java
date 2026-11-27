package com.cleantv.tawasul;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;

/** «تواصل»: the page (assets/index.html) does everything; this host gives it files, the microphone, notifications and sharing. */
public class MainActivity extends Activity {
    static volatile boolean visible = false;
    private WebView web;
    private ValueCallback<Uri[]> chooser;
    private PermissionRequest pendingPerm;
    private String pendingOpen = "";
    private String pendingShare = "";
    private static final int REQ_FILE = 11, REQ_PERM = 12, REQ_NOTIF = 13;

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences("tawasul", MODE_PRIVATE); }

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().setStatusBarColor(Color.parseColor("#0B0C10"));
        getWindow().setNavigationBarColor(Color.parseColor("#0B0C10"));
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#0B0C10"));
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(true);
        web.addJavascriptInterface(new Bridge(), "Android");
        web.setWebViewClient(new WebViewClient());
        web.setDownloadListener((url, ua, cd, mime, len) -> openUrl(url, mime));
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (chooser != null) chooser.onReceiveValue(null);
                chooser = cb;
                try { startActivityForResult(p.createIntent(), REQ_FILE); } catch (Throwable t) { chooser = null; return false; }
                return true;
            }
            @Override public void onPermissionRequest(final PermissionRequest r) {
                runOnUiThread(() -> {
                    if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) r.grant(r.getResources());
                    else { pendingPerm = r; requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQ_PERM); }
                });
            }
        });
        handle(getIntent());
        web.loadUrl("file:///android_asset/index.html");
        PollJob.schedule(this);
    }

    private void handle(Intent i) {
        if (i == null) return;
        String o = i.getStringExtra("open");
        if (o != null && o.length() > 0) pendingOpen = o;
        if (Intent.ACTION_SEND.equals(i.getAction())) {
            try {
                JSONObject j = new JSONObject();
                Uri u = i.getParcelableExtra(Intent.EXTRA_STREAM);
                if (u != null) {
                    String name = "file", mime = i.getType() == null ? "application/octet-stream" : i.getType();
                    Cursor c = getContentResolver().query(u, null, null, null, null);
                    if (c != null) { try { if (c.moveToFirst()) { int k = c.getColumnIndex(OpenableColumns.DISPLAY_NAME); if (k >= 0) name = c.getString(k); } } finally { c.close(); } }
                    ByteArrayOutputStream out = new ByteArrayOutputStream();
                    InputStream in = getContentResolver().openInputStream(u);
                    byte[] buf = new byte[16384]; int n; long tot = 0;
                    while (in != null && (n = in.read(buf)) > 0) { tot += n; if (tot > 12L * 1024 * 1024) { Toast.makeText(this, "الملف أكبر من ١٢ ميجا", Toast.LENGTH_LONG).show(); out = null; break; } out.write(buf, 0, n); }
                    if (in != null) in.close();
                    if (out != null) { j.put("name", name); j.put("mime", mime); j.put("b64", Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)); pendingShare = j.toString(); }
                } else {
                    String t = i.getStringExtra(Intent.EXTRA_TEXT);
                    if (t != null) { j.put("text", t); pendingShare = j.toString(); }
                }
            } catch (Throwable ignored) { }
        }
    }

    @Override protected void onNewIntent(Intent i) {
        super.onNewIntent(i);
        handle(i);
        web.evaluateJavascript("window.__twIntent&&window.__twIntent()", null);
    }

    @Override protected void onResume() { super.onResume(); visible = true; web.evaluateJavascript("window.__twResume&&window.__twResume()", null); }
    @Override protected void onPause() { visible = false; super.onPause(); }

    @Override public void onBackPressed() {
        web.evaluateJavascript("(function(){return window.onBack&&window.onBack()?1:0})()", v -> { if (!"1".equals(v)) super.onBackPressed(); });
    }

    @Override protected void onActivityResult(int req, int res, Intent d) {
        if (req == REQ_FILE && chooser != null) {
            Uri[] r = null;
            if (res == RESULT_OK && d != null) {
                if (d.getClipData() != null) { ClipData cd = d.getClipData(); r = new Uri[cd.getItemCount()]; for (int k = 0; k < r.length; k++) r[k] = cd.getItemAt(k).getUri(); }
                else if (d.getData() != null) r = new Uri[]{d.getData()};
            }
            chooser.onReceiveValue(r); chooser = null;
        } else super.onActivityResult(req, res, d);
    }

    @Override public void onRequestPermissionsResult(int req, String[] p, int[] g) {
        if (req == REQ_PERM && pendingPerm != null) {
            if (g.length > 0 && g[0] == PackageManager.PERMISSION_GRANTED) pendingPerm.grant(pendingPerm.getResources()); else pendingPerm.deny();
            pendingPerm = null;
        } else super.onRequestPermissionsResult(req, p, g);
    }

    private void openUrl(String url, String mime) {
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            if (mime != null && mime.length() > 0 && !"text/html".equals(mime)) i.setDataAndType(Uri.parse(url), mime);
            startActivity(i);
        } catch (Throwable t) { try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (Throwable ignored) { Toast.makeText(this, "ما لقيت تطبيق يفتح هذا الملف", Toast.LENGTH_LONG).show(); } }
    }

    private class Bridge {
        /** The page tells the host who this device is, so the background check can ask for new messages. */
        @JavascriptInterface public void creds(String code, String token) {
            prefs(MainActivity.this).edit().putString("code", code).putString("token", token).apply();
            PollJob.schedule(MainActivity.this);
            if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
                runOnUiThread(() -> requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIF));
        }
        @JavascriptInterface public void notifOn(boolean on) { prefs(MainActivity.this).edit().putBoolean("notif", on).apply(); }
        @JavascriptInterface public String takeInbox() { String q = prefs(MainActivity.this).getString("queue", "[]"); prefs(MainActivity.this).edit().putString("queue", "[]").apply(); return q; }
        @JavascriptInterface public String takeOpen() { String o = pendingOpen; pendingOpen = ""; return o; }
        @JavascriptInterface public String takeShare() { String o = pendingShare; pendingShare = ""; return o; }
        @JavascriptInterface public void copy(String t) { ClipboardManager m = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE); if (m != null) m.setPrimaryClip(ClipData.newPlainText("code", t)); }
        @JavascriptInterface public String paste() { try { ClipboardManager m = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE); if (m != null && m.hasPrimaryClip()) return String.valueOf(m.getPrimaryClip().getItemAt(0).coerceToText(MainActivity.this)); } catch (Throwable ignored) { } return ""; }
        @JavascriptInterface public void share(String t) { Intent i = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, t); startActivity(Intent.createChooser(i, null)); }
        @JavascriptInterface public void openUrl(String url, String mime) { runOnUiThread(() -> MainActivity.this.openUrl(url, mime)); }
        @JavascriptInterface public void toast(String t) { runOnUiThread(() -> Toast.makeText(MainActivity.this, t, Toast.LENGTH_SHORT).show()); }
        @JavascriptInterface public String version() { return "1.0"; }
    }
}
