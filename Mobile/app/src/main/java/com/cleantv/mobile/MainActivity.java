package com.cleantv.mobile;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/** «قنواتي موبايل»: the page (assets/index.html) is the whole interface; this class gives it storage, network and the player. */
public class MainActivity extends Activity {
    static MainActivity inst;
    private WebView web;
    private SharedPreferences prefs;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        inst = this;
        prefs = getSharedPreferences("mobile", MODE_PRIVATE);
        getWindow().setStatusBarColor(Color.parseColor("#15181B"));
        getWindow().setNavigationBarColor(Color.parseColor("#15181B"));
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#15181B"));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true); s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        web.setWebChromeClient(new WebChromeClient());
        web.addJavascriptInterface(new Bridge(), "Android");
        setContentView(web);
        web.loadUrl("file:///android_asset/index.html");
        route(getIntent());
        try { com.msm.widgets.Shortcuts.publish(this, new com.cleantv.mobile.wd.MobileWidgets(), com.msm.widgets.ActActivity.class, com.msm.widgets.PickActivity.class); } catch (Throwable ignored) { }
    }

    /** a widget or an icon shortcut asked to open a place inside the app */
    @Override
    protected void onNewIntent(Intent i) { super.onNewIntent(i); setIntent(i); route(i); }

    /** a link sent with «share», or a stream/playlist opened with this app: the page offers to save it */
    private void incoming(Intent i) {
        if (i == null || web == null) return;
        String t = null;
        if (Intent.ACTION_SEND.equals(i.getAction())) t = i.getStringExtra(Intent.EXTRA_TEXT);
        else if (Intent.ACTION_VIEW.equals(i.getAction()) && i.getData() != null && i.getStringExtra("msm_route") == null) {
            String sc = i.getData().getScheme();
            if ("http".equals(sc) || "https".equals(sc)) t = i.getDataString();
        }
        if (t == null) return;
        i.setAction(Intent.ACTION_MAIN);
        web.evaluateJavascript("(function(){var t=" + JSONObject.quote(t) + ",n=0;function g(){try{if(window.__incoming&&window.__incoming(t)!==false)return;}catch(e){}if(++n<40)setTimeout(g,300)}g()})()", null);
    }

    @Override
    public void onWindowFocusChanged(boolean f) { super.onWindowFocusChanged(f); if (f && web != null) web.evaluateJavascript("window.onFocused && window.onFocused()", null); }

    private void route(Intent i) {
        incoming(i);
        String r = i == null ? null : i.getStringExtra("msm_route");
        if (r == null || web == null) return;
        i.removeExtra("msm_route");
        web.evaluateJavascript("(function(){var r=" + JSONObject.quote(r) + ",n=0;function g(){try{if(window.__route&&window.__route(r)!==false)return;}catch(e){}if(++n<40)setTimeout(g,300)}g()})()", null);
    }

    @Override
    public void onBackPressed() { web.evaluateJavascript("window.onBack ? window.onBack() : false", v -> { if (!"true".equals(v)) finish(); }); }

    @Override
    protected void onResume() { super.onResume(); if (web != null) web.evaluateJavascript("window.onResumed && window.onResumed()", null); }

    void js(final String code) { runOnUiThread(() -> { if (web != null) web.evaluateJavascript(code, null); }); }

    /** one gentle GET: the first bytes, the status, the type, the time; never throws */
    static String get(String url, String ua, int maxBytes, boolean body) {
        JSONObject o = new JSONObject();
        long t0 = System.currentTimeMillis();
        try {
            HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
            c.setRequestProperty("User-Agent", ua); c.setRequestProperty("Accept", "*/*");
            c.setConnectTimeout(10000); c.setReadTimeout(25000); c.setInstanceFollowRedirects(true);
            int code = c.getResponseCode();
            o.put("code", code).put("type", String.valueOf(c.getContentType())).put("url", c.getURL().toString());
            InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream();
            if (in != null) {
                ByteArrayOutputStream bo = new ByteArrayOutputStream(); byte[] buf = new byte[32768]; int n, tot = 0;
                while (tot < maxBytes && (n = in.read(buf)) > 0) { bo.write(buf, 0, n); tot += n; }
                in.close(); o.put("head", bo.toString("UTF-8"));
            }
            c.disconnect();
        } catch (java.net.UnknownHostException e) { try { o.put("err", "ما لگيت عنوان الخادم"); } catch (Throwable ignored) { } }
        catch (java.net.SocketTimeoutException e) { try { o.put("err", "الخادم تأخر بالرد"); } catch (Throwable ignored) { } }
        catch (Throwable t) { try { o.put("err", t.getClass().getSimpleName()); } catch (Throwable ignored) { } }
        try { o.put("ms", System.currentTimeMillis() - t0); } catch (Throwable ignored) { }
        return o.toString();
    }

    private static final String[] UAS = { "VLC/3.0.20 LibVLC/3.0.20", "IPTVSmartersPro", "okhttp/4.12.0", "Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36" };

    class Bridge {
        @JavascriptInterface public String deviceCode() { return Acct.deviceCode(MainActivity.this); }
        @JavascriptInterface public boolean active() { return Acct.active(MainActivity.this); }
        @JavascriptInterface public boolean activate(String code) { return Acct.activate(MainActivity.this, code); }
        @JavascriptInterface public void share(final String t) {
            runOnUiThread(() -> startActivity(Intent.createChooser(new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, t), "مشاركة")));
        }
        @JavascriptInterface public String getPref(String k) { return prefs.getString(k, ""); }
        @JavascriptInterface public void setPref(String k, String v) {
            prefs.edit().putString(k, v).apply();
            if (k.startsWith("w_") || k.equals("quietOn")) com.cleantv.mobile.wd.MobileWidgets.refreshAll(MainActivity.this);
        }
        @JavascriptInterface public void toast(String t) { runOnUiThread(() -> Toast.makeText(MainActivity.this, t, Toast.LENGTH_SHORT).show()); }
        @JavascriptInterface public void copy(String t) {
            runOnUiThread(() -> { ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE); cm.setPrimaryClip(ClipData.newPlainText("t", t)); });
        }
        @JavascriptInterface public String paste() {
            try { ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE); ClipData d = cm.getPrimaryClip(); return d != null && d.getItemCount() > 0 ? String.valueOf(d.getItemAt(0).getText()) : ""; } catch (Throwable t) { return ""; }
        }
        /** text of a link (a playlist, a catalogue): answers window.__cb(id, text) — "ERR:…" if it failed. A refused request is tried again as other known players. */
        @JavascriptInterface public void fetchText(final String url, final String id) {
            if (!Acct.active(MainActivity.this)) { js("window.__cb && window.__cb(" + JSONObject.quote(id) + ",\"ERR:التطبيق غير مفعّل\")"); return; }
            new Thread(() -> {
                String res = "ERR:no";
                for (int i = 0; i < UAS.length; i++) {
                    JSONObject o;
                    try { o = new JSONObject(get(url, UAS[i], 6000000, true)); } catch (Throwable t) { break; }
                    int code = o.optInt("code", 0);
                    if (o.has("err")) { res = "ERR:" + o.optString("err"); break; }
                    if (code >= 200 && code < 300) { res = o.optString("head"); break; }
                    res = "ERR:رد الخادم " + code;
                    if (code != 403 && code != 401 && code != 406) break;
                }
                final String r = res;
                js("window.__cb && window.__cb(" + JSONObject.quote(id) + "," + JSONObject.quote(r) + ")");
            }).start();
        }
        /** a look at a link for the smart link: answers window.__cb(id, json) */
        @JavascriptInterface public void probe(final String url, final String ua, final String id) {
            new Thread(() -> {
                String r = get(url, ua == null || ua.isEmpty() ? UAS[0] : ua, 12000, true);
                js("window.__cb && window.__cb(" + JSONObject.quote(id) + "," + JSONObject.quote(r) + ")");
            }).start();
        }
        @JavascriptInterface public void play(String json, int idx) {
            if (!Acct.active(MainActivity.this)) return;
            PlayerActivity.PACK = json;
            startActivity(new Intent(MainActivity.this, PlayerActivity.class).putExtra("idx", idx));
        }
        /** opens a website inside the app: the streams the page plays can be played and saved (only on an activated phone) */
        @JavascriptInterface public void openSite(final String url) {
            if (!Acct.active(MainActivity.this)) return;
            runOnUiThread(() -> startActivity(new Intent(MainActivity.this, SiteActivity.class).putExtra("url", url)));
        }
        /** opens a website to read its arrangement: it is kept as a site with a قنواتي-style front (rows of posters) */
        @JavascriptInterface public void readSite(final String url) {
            if (!Acct.active(MainActivity.this)) return;
            runOnUiThread(() -> startActivity(new Intent(MainActivity.this, SiteActivity.class).putExtra("url", url).putExtra("auto", true)));
        }
        /** opens a title of a saved site: the app clicks «play» for you and, when the page starts a stream, plays it in the app's own player */
        @JavascriptInterface public void playSite(final String url) {
            if (!Acct.active(MainActivity.this)) return;
            runOnUiThread(() -> startActivity(new Intent(MainActivity.this, SiteActivity.class).putExtra("url", url).putExtra("play", true)));
        }
        /** The app icon takes the colour of the chosen theme: one launcher alias is enabled, the others disabled. */
        @JavascriptInterface public void setIcon(String id) {
            try {
                final String[][] T = {{"dijla", "IconDijla"}, {"sumer", "IconSumer"}, {"night", "IconNight"}, {"hibr", "IconHibr"}, {"zumurrud", "IconZumurrud"}, {"ishara", "IconIshara"}, {"rasheed", "IconRasheed"}, {"sadu", "IconSadu"}, {"kashi", "IconKashi"}, {"tareeq", "IconTareeq"}};
                boolean known = false; for (String[] t : T) if (t[0].equals(id)) known = true;
                if (!known) return;
                android.content.pm.PackageManager pm = getPackageManager();
                for (String[] t : T) {
                    android.content.ComponentName cn = new android.content.ComponentName(getPackageName(), "com.cleantv.mobile." + t[1]);
                    int s = pm.getComponentEnabledSetting(cn);
                    boolean now = s == android.content.pm.PackageManager.COMPONENT_ENABLED_STATE_DEFAULT ? t[0].equals("rasheed") : s == android.content.pm.PackageManager.COMPONENT_ENABLED_STATE_ENABLED;
                    boolean want = t[0].equals(id);
                    if (now != want) pm.setComponentEnabledSetting(cn, want ? android.content.pm.PackageManager.COMPONENT_ENABLED_STATE_ENABLED : android.content.pm.PackageManager.COMPONENT_ENABLED_STATE_DISABLED, android.content.pm.PackageManager.DONT_KILL_APP);
                }
            } catch (Throwable ignored) { }
        }
        @JavascriptInterface public String version() { return "17.0"; }
    }
}
