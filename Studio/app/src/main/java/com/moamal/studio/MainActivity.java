package com.moamal.studio;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.BroadcastReceiver;
import android.content.IntentFilter;
import android.app.PendingIntent;
import android.content.pm.PackageInstaller;
import android.media.projection.MediaProjectionManager;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.view.View;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    static final String REPO = "hnt45y-111/clean-tv";
    private WebView web;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final ExecutorService work = Executors.newFixedThreadPool(3);
    private final ExecutorService keys = Executors.newSingleThreadExecutor();
    private final ExecutorService net = Executors.newFixedThreadPool(2);
    private Discovery disc;
    private String pickId, pickMode, pickDir, pickUrl, pickToken, voiceId, castHost;
    private byte[] lastShot;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#0B0C10"));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setTextZoom(100);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, String url) {
                if (url.startsWith("file:")) return false;
                openUrl(url, null);
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient());
        web.addJavascriptInterface(new Bridge(), "A");
        setContentView(web);
        web.loadUrl("file:///android_asset/index.html");
        disc = new Discovery(this, o -> js("window.onFound&&onFound(" + o + ")"));
        self = this;
    }

    /* Coming back from the background: the ADB socket may still say "connected" while the screen no longer
       answers. Check it for real, reconnect if needed, and tell the page the true state. */
    @Override
    protected void onResume() {
        super.onResume();
        if (web == null) return;
        work.execute(() -> {
            boolean ok = false; String host = ""; int port = 0;
            try {
                Adb a = adb(); host = a.host; port = a.port;
                if (!host.isEmpty()) {
                    ok = a.healthy(3500);
                    if (!ok) { try { ok = a.reconnect() && a.healthy(5000); } catch (Throwable ignored) { ok = false; } }
                }
            } catch (Throwable ignored) { }
            try {
                js("window.onAdbResume&&onAdbResume(" + new JSONObject().put("connected", ok).put("host", host).put("port", port) + ")");
            } catch (Throwable ignored) { }
        });
    }

    @Override
    public void onBackPressed() {
        js("window.goBack&&goBack()||A.exit()");
    }

    @Override
    protected void onDestroy() {
        disc.stop();
        if (recvReg) try { unregisterReceiver(installReceiver); } catch (Throwable ignored) { }
        super.onDestroy();
    }

    private static MainActivity self;
    static void jsStatic(String code) { MainActivity m = self; if (m != null) m.js(code); }
    void js(String code) {
        ui.post(() -> { try { web.evaluateJavascript(code, null); } catch (Throwable ignored) { } });
    }

    private void cb(String id, boolean ok, Object data) {
        String d = data == null ? "null" : (data instanceof JSONObject || data instanceof JSONArray) ? data.toString() : JSONObject.quote(String.valueOf(data));
        js("window.__cb&&__cb(" + JSONObject.quote(id) + "," + ok + "," + d + ")");
    }

    private void prog(String text) {
        js("window.onProg&&onProg(" + JSONObject.quote(text) + ")");
    }

    static SharedPreferences kv(Context c) { return c.getSharedPreferences("kv", 0); }

    private void openUrl(String url, String pkg) {
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            if (pkg != null && !pkg.isEmpty()) {
                i.setPackage(pkg);
                try { startActivity(i); return; } catch (Throwable ignored) { i.setPackage(null); }
            }
            startActivity(i);
        } catch (Throwable t) { Toast.makeText(this, "ما گدرت أفتح الرابط", Toast.LENGTH_SHORT).show(); }
    }

    private Adb adb() throws Exception { return Adb.get(this); }

    private Adb live() throws Exception {
        Adb a = adb();
        if (!a.alive()) {
            if (a.host.isEmpty()) throw new Exception("ما متصل بأي شاشة");
            if ("usb".equals(a.host)) throw new Exception("انقطع الكيبل، اربطه وجرّب «الاتصال عبر الكيبل» مرة ثانية");
            if (!a.open(a.host, a.port)) throw new Exception("انقطع الاتصال بالشاشة");
        }
        return a;
    }

    // ---------------------------------------------------------------- bridge
    class Bridge {
        @JavascriptInterface public String code() { return Accounts.deviceCode(MainActivity.this); }
        @JavascriptInterface public String session() {
            try { return Accounts.session(MainActivity.this).toString(); } catch (Exception e) { return "{\"ok\":false}"; }
        }
        @JavascriptInterface public String login(String u, String p) {
            try { return Accounts.login(MainActivity.this, u, p).toString(); }
            catch (Exception e) { return "{\"ok\":false,\"msg\":\"خطأ\"}"; }
        }
        @JavascriptInterface public void logout() { Accounts.logout(MainActivity.this); }
        @JavascriptInterface public String gen(String code, String user, int days) {
            try {
                if (!Accounts.session(MainActivity.this).optBoolean("admin")) return "";
            } catch (Exception e) { return ""; }
            return Accounts.generate(code, user, days);
        }
        @JavascriptInterface public String genAuto(String code) {
            try { if (!Accounts.session(MainActivity.this).optBoolean("admin")) return ""; } catch (Exception e) { return ""; }
            return Accounts.autoCode(code);
        }
        @JavascriptInterface public String kvGet(String k) { return kv(MainActivity.this).getString(k, null); }
        @JavascriptInterface public void kvSet(String k, String v) {
            if (v == null) kv(MainActivity.this).edit().remove(k).apply();
            else kv(MainActivity.this).edit().putString(k, v).apply();
        }
        @JavascriptInterface public void open(String url, String pkg) { ui.post(() -> openUrl(url, pkg)); }
        @JavascriptInterface public void copy(String t) {
            ClipboardManager cm = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
            cm.setPrimaryClip(ClipData.newPlainText("text", t));
        }
        @JavascriptInterface public void share(String t) {
            ui.post(() -> {
                Intent i = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, t);
                startActivity(Intent.createChooser(i, "مشاركة"));
            });
        }
        @JavascriptInterface public void toast(String t) { ui.post(() -> Toast.makeText(MainActivity.this, t, Toast.LENGTH_SHORT).show()); }
        @JavascriptInterface public void vibe() {
            try {
                Vibrator v = (Vibrator) getSystemService(VIBRATOR_SERVICE);
                v.vibrate(VibrationEffect.createOneShot(18, 120));
            } catch (Throwable ignored) { }
        }
        @JavascriptInterface public void bars(boolean dark, String color) {
            ui.post(() -> {
                try {
                    Window w = getWindow();
                    int c = Color.parseColor(color);
                    w.setStatusBarColor(c);
                    w.setNavigationBarColor(c);
                    View d = w.getDecorView();
                    int f = d.getSystemUiVisibility();
                    if (dark) f &= ~(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | 0x10);
                    else f |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | 0x10;
                    d.setSystemUiVisibility(f);
                    web.setBackgroundColor(c);
                } catch (Throwable ignored) { }
            });
        }
        @JavascriptInterface public String version() {
            try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionName; } catch (Exception e) { return "1"; }
        }
        @JavascriptInterface public void exit() { ui.post(() -> moveTaskToBack(true)); }
        @JavascriptInterface public void discover(boolean on) { ui.post(() -> { if (on) disc.start(); else disc.stop(); }); }

        @JavascriptInterface public int build() {
            try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionCode; } catch (Exception e) { return 0; }
        }
        @JavascriptInterface public void live(boolean touch) {
            ui.post(() -> startActivity(new Intent(MainActivity.this, LiveActivity.class).putExtra("touch", touch)));
        }
        @JavascriptInterface public void castDirect(String host, String token) { castHost = host; CastService.token = token; }
        @JavascriptInterface public void cast(boolean start) {
            ui.post(() -> {
                if (!start) { CastService.stop(MainActivity.this); return; }
                MediaProjectionManager m = (MediaProjectionManager) getSystemService(MEDIA_PROJECTION_SERVICE);
                startActivityForResult(m.createScreenCaptureIntent(), 43);
            });
        }
        @JavascriptInterface public String castState() {
            try { return new JSONObject().put("on", CastService.on).put("stage", CastService.stage).put("frames", CastService.frames).put("error", CastService.error == null ? "" : CastService.error).toString(); }
            catch (Exception e) { return "{}"; }
        }
        @JavascriptInterface public String assetList(String dir) {
            try { return new JSONArray(java.util.Arrays.asList(getAssets().list(dir))).toString(); } catch (Exception e) { return "[]"; }
        }
        @JavascriptInterface public String asset(String path) {
            try (InputStream in = getAssets().open(path)) { return new String(Adb.readAll(in), StandardCharsets.UTF_8); }
            catch (Exception e) { return null; }
        }

        /** Async operations; the answer comes back through window.__cb(id, ok, data). */
        @JavascriptInterface public void run(String id, String op, String args) {
            JSONObject a;
            try { a = new JSONObject(args == null || args.isEmpty() ? "{}" : args); } catch (Exception e) { a = new JSONObject(); }
            final JSONObject arg = a;
            if ("key".equals(op) || "text".equals(op)) {
                keys.execute(() -> exec(id, op, arg));
            } else if ("voice".equals(op)) {
                voiceId = id;
                ui.post(() -> {
                    Intent i = new Intent(android.speech.RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                    i.putExtra(android.speech.RecognizerIntent.EXTRA_LANGUAGE_MODEL, android.speech.RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                    i.putExtra(android.speech.RecognizerIntent.EXTRA_LANGUAGE, arg.optString("lang", "ar-IQ"));
                    i.putExtra(android.speech.RecognizerIntent.EXTRA_PROMPT, "احجي هسه…");
                    try { startActivityForResult(i, 44); } catch (Throwable t) { cb(id, false, "NOVOICE"); }
                });
            } else if ("appDetails".equals(op)) {
                ui.post(() -> { try { startActivity(new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName()))); } catch (Throwable ignored) { } });
                cb(id, true, true);
            } else if ("pick".equals(op)) {
                pickId = id;
                pickMode = arg.optString("mode");
                pickDir = arg.optString("dir", "/sdcard/Download");
                pickUrl = arg.optString("url", "");
                pickToken = arg.optString("token", "");
                ui.post(() -> {
                    Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");
                    if ("install".equals(pickMode) || "dinstall".equals(pickMode)) i.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/vnd.android.package-archive", "application/octet-stream"});
                    if ("backup".equals(pickMode)) i.setType("application/json");
                    if ("zip".equals(pickMode)) i.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/zip", "application/x-zip-compressed", "application/octet-stream"});
                    if ("image".equals(pickMode) || "bgimage".equals(pickMode) || "bgimages".equals(pickMode) || "logo".equals(pickMode)) i.setType("image/*");
                    if ("bgimages".equals(pickMode)) i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                    startActivityForResult(i, 42);
                });
            } else if ("ai".equals(op) || "httpPost".equals(op) || "policyPut".equals(op) || "tele".equals(op)) {
                // internet calls never wait behind (or hold up) the screen's ADB commands
                net.execute(() -> exec(id, op, arg));
            } else {
                work.execute(() -> exec(id, op, arg));
            }
        }
    }

    private void exec(String id, String op, JSONObject a) {
        try {
            cb(id, true, doOp(op, a));
        } catch (Throwable t) {
            String m = t.getMessage();
            if (t instanceof io.github.muntashirakon.adb.AdbPairingRequiredException) m = "PAIR";
            cb(id, false, m == null ? t.getClass().getSimpleName() : m);
        }
    }

    private Object doOp(String op, JSONObject a) throws Exception {
        switch (op) {
            case "pair": {
                boolean ok = adb().pair(a.getString("host"), a.getInt("port"), a.getString("code").trim());
                if (!ok) throw new Exception("رمز الربط غير صحيح");
                return true;
            }
            case "connect": {
                Adb x = adb();
                if (!x.open(a.getString("host"), a.getInt("port"))) {
                    if (!x.alive()) throw new Exception("ما وافقت الشاشة على الاتصال");
                }
                return status();
            }
            case "status": return status();
            case "disconnect": {
                try { if (UsbAdb.active()) { UsbAdb.get().close(); adb().host = ""; } else adb().disconnect(); } catch (Throwable ignored) { }
                return status();
            }
            case "sh": return live().sh(a.getString("cmd"));
            case "shs": {
                JSONArray cmds = a.getJSONArray("cmds"), out = new JSONArray();
                Adb x = live();
                for (int i = 0; i < cmds.length(); i++) {
                    String r;
                    try { r = x.sh(cmds.getString(i)); } catch (Throwable t) { r = "ERR " + t.getMessage(); }
                    out.put(r);
                    if (a.optBoolean("progress")) prog((i + 1) + "/" + cmds.length());
                }
                return out;
            }
            case "key": live().sh("input keyevent " + a.getInt("code")); return true;
            case "text": {
                String t = a.getString("t").replace("\\", "\\\\").replace("'", "'\\''").replace(" ", "%s");
                live().sh("input text '" + t + "'");
                return true;
            }
            case "info": return info();
            case "shot": return shot(a.optInt("w", 0), a.optInt("q", 70));
            case "saveShot": return saveShot();
            case "launcher": {
                pctFrom = a.optInt("from", 0); pctTo = a.optInt("to", 100);
                try { return installLauncher(); } finally { pctFrom = 0; pctTo = 100; }
            }
            case "castPrep": return castPrep();
            case "cfgGet": return cfgGet();
            case "gallery": return gallery();
            case "usbConnect": {
                boolean ok = adb().openUsb(this, this::prog);
                return new JSONObject().put("connected", ok).put("host", "usb").put("port", 0).put("model", UsbAdb.get().model);
            }
            case "usbClose": UsbAdb.get().close(); adb().host = ""; return true;
            case "usbCancel": UsbAdb.cancel = true; return true;
            case "usbTcpip": {
                // same as «adb tcpip 5555» from a computer: the phone on the cable starts listening on Wi-Fi
                String r = "";
                try { r = new String(UsbAdb.get().exec("tcpip:" + a.optInt("port", 5555)), StandardCharsets.UTF_8); } catch (Throwable ignored) { }
                UsbAdb.get().close(); adb().host = "";
                return r;
            }
            case "tetherSettings": {
                ui.post(() -> {
                    Intent t = new Intent().setClassName("com.android.settings", "com.android.settings.TetherSettings").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    try { startActivity(t); } catch (Throwable e) {
                        try { startActivity(new Intent(android.provider.Settings.ACTION_WIRELESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); } catch (Throwable ignored) { }
                    }
                });
                return true;
            }
            case "fetchText": return httpText(a.getString("url"));
            case "zipTheme": prog("أجهّز صور الواجهة…"); return ZipThemes.images(a.optString("path"), a.optInt("max", 20));
            case "ai": return GeminiService.generate(this, a.getString("system"), a.getString("prompt"));
            case "aiKey": { String k = a.optString("key", "").trim(); if (k.isEmpty()) kv(this).edit().remove("geminiKey").apply(); else kv(this).edit().putString("geminiKey", k).apply(); return true; }
            case "httpPost": return httpPost(a.getString("url"), a.getString("body"), a.optString("type", "text/plain"));
            case "tele": return telemetry();
            case "policyPut": return policyPut(a.getString("token"), a.getString("policy"));
            case "ghPublish": return ghPublish(a);
            case "pushData": return pushToLauncher(a.getString("name"), a.getString("data"));
            case "ghDelete": return ghDelete(a.getString("token"), a.getString("id"));
            case "ghCheck": return ghCheck(a.getString("token"));
            case "capture": return capture(a);
            case "dl": {
                pctFrom = a.optInt("from", 0); pctTo = a.optInt("to", 100);
                File f = download(a.getString("url"), new File(getCacheDir(), "dl.json"));
                pctFrom = 0; pctTo = 100;
                return new String(Adb.readAll(new java.io.FileInputStream(f)), StandardCharsets.UTF_8);
            }
            case "cfgSet": return cfgSet(a.getString("cfg"));
            case "saveText": return saveText(a.getString("name"), a.getString("text"));
            case "pull": return pullToDownloads(a.getString("path"));
            case "release": return latestRelease(a.getString("prefix"));
            case "selfUpdate": return selfUpdate();
            case "launcherUpdate": return installLauncher();
            case "selfInfo": return new JSONObject().put("sdk", Build.VERSION.SDK_INT).put("release", Build.VERSION.RELEASE)
                    .put("brand", Build.MANUFACTURER).put("model", Build.MODEL).put("pair", SelfAdb.pairPort).put("conn", SelfAdb.connPort).put("last", SelfAdb.last);
            case "selfStart": {
                if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission("android.permission.POST_NOTIFICATIONS") != android.content.pm.PackageManager.PERMISSION_GRANTED)
                    ui.post(() -> { try { requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 31); } catch (Throwable ignored) { } });
                SelfAdb.last = ""; SelfAdb.pairPort = 0; SelfAdb.discover(this);
                SelfAdb.notifyAsk(this, "افتح: الإعدادات ← خيارات المطوّر ← تصحيح الأخطاء اللاسلكي ← «إقران جهاز برمز الإقران». بعدين اسحب هذا الإشعار واكتب الرمز.");
                return true;
            }
            case "selfStop": SelfAdb.stop(); SelfAdb.cancel(this); return true;
            case "devSettings": {
                try { startActivity(new Intent(android.provider.Settings.ACTION_APPLICATION_DEVELOPMENT_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); }
                catch (Throwable t) { startActivity(new Intent(android.provider.Settings.ACTION_DEVICE_INFO_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); }
                return true;
            }
            case "shareStart": return shareStart();
            case "shareStop": ShareServer.stopNow(); return true;
            default: throw new Exception("عملية غير معروفة");
        }
    }

    private JSONObject status() throws Exception {
        Adb x = adb();
        return new JSONObject().put("connected", x.alive()).put("host", x.host).put("port", x.port);
    }

    private JSONObject info() throws Exception {
        Adb x = live();
        String script = "getprop ro.product.manufacturer; echo '|'; getprop ro.product.model; echo '|'; "
                + "getprop ro.build.version.release; echo '|'; getprop ro.build.version.sdk; echo '|'; "
                + "settings get global device_name; echo '|'; wm size; echo '|'; "
                + "grep -E 'MemTotal|MemAvailable' /proc/meminfo; echo '|'; df -h /data | tail -1; echo '|'; "
                + "cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.HOME | tail -1; echo '|'; "
                + "getprop ro.board.platform; echo '|'; ps -A | wc -l; echo '|'; pm list packages | wc -l; echo '|'; pm list packages -d | wc -l; echo '|'; "
                + "dumpsys tv_input 2>/dev/null | grep -ciE 'hdmi|tuner|atv|dtv'; echo '|'; "
                + "pm list packages | grep -ciE 'com\\.syu|microntek|com\\.ts\\.|com\\.fyt|zjinnova|carlink|autochips|com\\.tw\\.|easyconn'";
        String[] p = x.sh(script).split("\\|");
        String[] k = {"brand", "model", "android", "sdk", "name", "size", "mem", "disk", "home", "chip", "procs", "pkgs", "disabled", "tvin", "carpk"};
        JSONObject o = new JSONObject();
        for (int i = 0; i < k.length; i++) o.put(k[i], i < p.length ? p[i].trim() : "");
        o.put("host", x.host);
        int tvin = 0;
        try { tvin = Integer.parseInt(o.optString("tvin", "0").trim()); } catch (Throwable ignored) { }
        int carpk = 0;
        try { carpk = Integer.parseInt(o.optString("carpk", "0").trim()); } catch (Throwable ignored) { }
        o.put("isCar", carpk > 0 && tvin == 0);
        o.put("isTv", tvin > 0 && carpk == 0);
        return o;
    }

    private String shot(int w, int q) throws Exception {
        byte[] png = live().exec("screencap -p");
        if (png.length < 100) throw new Exception("ما گدرت آخذ صورة");
        lastShot = png;
        Bitmap bm = BitmapFactory.decodeByteArray(png, 0, png.length);
        if (bm == null) throw new Exception("الصورة تالفة");
        if (w > 0 && bm.getWidth() > w) {
            Bitmap sc = Bitmap.createScaledBitmap(bm, w, bm.getHeight() * w / bm.getWidth(), true);
            bm.recycle();
            bm = sc;
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        bm.compress(Bitmap.CompressFormat.JPEG, q, out);
        bm.recycle();
        return "data:image/jpeg;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
    }

    private String saveShot() throws Exception {
        if (lastShot == null) throw new Exception("ماكو صورة");
        String name = "TV_" + System.currentTimeMillis() + ".png";
        if (Build.VERSION.SDK_INT >= 29) {
            ContentValues v = new ContentValues();
            v.put(MediaStore.Images.Media.DISPLAY_NAME, name);
            v.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
            v.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/MoamalStudio");
            Uri u = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, v);
            try (OutputStream o = getContentResolver().openOutputStream(u)) { o.write(lastShot); }
            return "الصور ← MoamalStudio";
        }
        File d = new File(getExternalFilesDir(Environment.DIRECTORY_PICTURES), name);
        try (OutputStream o = new FileOutputStream(d)) { o.write(lastShot); }
        return d.getAbsolutePath();
    }

    // ---------------------------------------------------------------- launcher install
    private String httpText(String url) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setRequestProperty("Accept", "application/vnd.github+json");
        c.setRequestProperty("User-Agent", "MoamalStudio");
        c.setConnectTimeout(15000);
        c.setReadTimeout(20000);
        try (InputStream in = c.getInputStream()) { return new String(Adb.readAll(in), StandardCharsets.UTF_8); }
    }

    private String httpPost(String url, String body, String type) throws Exception {
        byte[] d = body.getBytes(StandardCharsets.UTF_8);
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setRequestMethod("POST");
        c.setRequestProperty("Content-Type", type);
        c.setRequestProperty("User-Agent", "MoamalStudio");
        c.setConnectTimeout(15000);
        c.setReadTimeout(20000);
        c.setDoOutput(true);
        c.setFixedLengthStreamingMode(d.length);
        try (OutputStream o = c.getOutputStream()) { o.write(d); }
        int code = c.getResponseCode();
        InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream();
        String txt = in == null ? "" : new String(Adb.readAll(in), StandardCharsets.UTF_8);
        if (code >= 400) throw new Exception("HTTP " + code);
        return txt;
    }

    /** This phone, for the admin's account list: model, Android, IP, screen size, ID. */
    private JSONObject telemetry() throws Exception {
        android.util.DisplayMetrics dm = new android.util.DisplayMetrics();
        try { getWindowManager().getDefaultDisplay().getRealMetrics(dm); } catch (Throwable t) { dm = getResources().getDisplayMetrics(); }
        String ip = "";
        try {
            for (java.net.NetworkInterface ni : java.util.Collections.list(java.net.NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                for (java.net.InetAddress ad : java.util.Collections.list(ni.getInetAddresses()))
                    if (ad instanceof java.net.Inet4Address && (ip.isEmpty() || ni.getName().startsWith("wlan"))) ip = ad.getHostAddress();
            }
        } catch (Throwable ignored) { }
        String mac = "";
        try (java.io.BufferedReader r = new java.io.BufferedReader(new java.io.FileReader("/sys/class/net/wlan0/address"))) { String l = r.readLine(); if (l != null && !l.startsWith("02:00:00")) mac = l.trim(); } catch (Throwable ignored) { }
        return new JSONObject().put("code", Accounts.deviceCode(this)).put("brand", Build.MANUFACTURER).put("model", Build.MODEL)
                .put("android", Build.VERSION.RELEASE).put("sdk", Build.VERSION.SDK_INT).put("ip", ip).put("mac", mac)
                .put("res", dm.widthPixels + "×" + dm.heightPixels)
                .put("aid", android.provider.Settings.Secure.getString(getContentResolver(), android.provider.Settings.Secure.ANDROID_ID));
    }

    /** Admin: write the account rules (suspend / features) to the «accounts» release that every app reads. */
    private JSONObject policyPut(String token, String policy) throws Exception {
        JSONObject rel;
        try { rel = new JSONObject(gh("GET", "https://api.github.com/repos/" + REPO + "/releases/tags/accounts", token, null, null)); }
        catch (Exception e) {
            if (!String.valueOf(e.getMessage()).contains("404")) throw e;
            JSONObject nr = new JSONObject().put("tag_name", "accounts").put("name", "Accounts").put("body", "قواعد الحسابات لتطبيق مدير الشاشة")
                    .put("prerelease", true).put("make_latest", "false");
            rel = new JSONObject(gh("POST", "https://api.github.com/repos/" + REPO + "/releases", token, nr.toString().getBytes(StandardCharsets.UTF_8), "application/json"));
            if (!rel.has("assets")) rel.put("assets", new JSONArray());
        }
        replaceAsset(token, rel, "policy.json", policy.getBytes(StandardCharsets.UTF_8), "application/json");
        return new JSONObject().put("ok", true);
    }

    private File download(String url, File to) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setRequestProperty("User-Agent", "MoamalStudio");
        c.setInstanceFollowRedirects(true);
        c.setConnectTimeout(15000);
        c.setReadTimeout(30000);
        long total = c.getContentLengthLong(), got = 0;
        int lastPct = -1;
        try (InputStream in = c.getInputStream(); OutputStream o = new FileOutputStream(to)) {
            byte[] buf = new byte[64 * 1024];
            int n;
            while ((n = in.read(buf)) > 0) {
                o.write(buf, 0, n);
                got += n;
                if (total > 0) {
                    int pct = (int) (got * 100 / total);
                    if (pct != lastPct) {
                        if (pct / 5 != lastPct / 5) prog("تحميل " + pct + "%");
                        lastPct = pct;
                        pct(pctFrom + (pctTo - pctFrom) * pct / 100);
                    }
                }
            }
        }
        return to;
    }

    /** Progress bar range for the current operation, so several steps share one 0..100 bar. */
    private volatile int pctFrom = 0, pctTo = 100;
    private void pct(int p) { js("window.onPct&&onPct(" + p + ")"); }

    private JSONObject installLauncher() throws Exception {
        Adb x = live();
        prog("أبحث عن آخر نسخة…");
        JSONArray rel = new JSONArray(httpText("https://api.github.com/repos/" + REPO + "/releases?per_page=30"));
        String url = null, tag = null;
        for (int i = 0; i < rel.length() && url == null; i++) {
            JSONObject r = rel.getJSONObject(i);
            if (!r.optString("tag_name").startsWith("build-")) continue;
            JSONArray as = r.optJSONArray("assets");
            for (int j = 0; as != null && j < as.length(); j++) {
                JSONObject asset = as.getJSONObject(j);
                if (asset.optString("name").endsWith(".apk")) { url = asset.getString("browser_download_url"); tag = r.optString("tag_name"); break; }
            }
        }
        if (url == null) throw new Exception("ما لگيت نسخة جاهزة");
        File apk = download(url, new File(getCacheDir(), "launcher.apk"));
        String oldHome = x.sh("cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.HOME | tail -1").trim();
        prog("أثبّت الواجهة على الشاشة…");
        String r = x.install(apk, null);
        if (!r.contains("Success")) {
            x.sh("pm uninstall com.cleantv.launcher");
            r = x.install(apk, null);
            if (!r.contains("Success")) throw new Exception("فشل التثبيت: " + r);
        }
        prog("أضبط الصلاحيات وأجعلها الواجهة الرئيسية…");
        String pk = "com.cleantv.launcher";
        String acc = x.sh("settings get secure enabled_accessibility_services").trim();
        String svc = pk + "/" + pk + ".PowerService";
        if (acc.equals("null") || acc.isEmpty()) acc = svc;
        else if (!acc.contains(svc)) acc = acc + ":" + svc;
        String[] cmds = {
                "pm grant " + pk + " android.permission.READ_MEDIA_IMAGES",
                "pm grant " + pk + " android.permission.READ_MEDIA_AUDIO",
                "pm grant " + pk + " android.permission.READ_EXTERNAL_STORAGE",
                "appops set " + pk + " SYSTEM_ALERT_WINDOW allow",
                "appops set " + pk + " REQUEST_INSTALL_PACKAGES allow",
                "appops set " + pk + " SCHEDULE_EXACT_ALARM allow",
                "settings put secure enabled_accessibility_services " + acc,
                "settings put secure accessibility_enabled 1",
                "settings put secure screensaver_enabled 0",
                "cmd package set-home-activity " + pk + "/.MainActivity",
                "am start -n " + pk + "/.MainActivity"
        };
        for (String c : cmds) { try { x.sh(c); } catch (Throwable ignored) { } }
        // Google's own TV launchers grab the Home button on many TVs, so switch them off (undo is in the log).
        JSONArray off = new JSONArray();
        java.util.Set<String> enabled = new java.util.HashSet<>();
        for (String line : x.sh("pm list packages -e").split("\n")) enabled.add(line.replace("package:", "").trim());
        for (String g : new String[]{"com.google.android.tvlauncher", "com.google.android.apps.tv.launcherx", "com.google.android.leanbacklauncher"}) {
            if (enabled.contains(g)) {
                try { x.sh("pm disable-user --user 0 " + g); off.put(g); } catch (Throwable ignored) { }
            }
        }
        try { x.sh("cmd package set-home-activity " + pk + "/.MainActivity"); } catch (Throwable ignored) { }
        JSONObject o = new JSONObject().put("tag", tag).put("oldHome", oldHome).put("disabled", off);
        return o;
    }

    // ---------------------------------------------------------------- phone-to-TV cast checks
    private boolean probe(String host) {
        try (java.net.Socket s = new java.net.Socket()) { s.connect(new java.net.InetSocketAddress(host, 8687), 2500); return true; }
        catch (Throwable t) { return false; }
    }

    /** Make sure the TV launcher can receive the phone screen before asking for capture permission. */
    private boolean castPrep() throws Exception {
        Adb x = live();
        String v = x.sh("dumpsys package com.cleantv.launcher | grep -m1 versionCode");
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("versionCode=(\\d+)").matcher(v);
        if (!m.find()) throw new Exception("OLD");
        if (Integer.parseInt(m.group(1)) < 11) throw new Exception("OLD");
        if (probe(x.host)) return true;
        prog("أشغّل واجهة مدير الشاشات على الشاشة…");
        x.sh("am start -n com.cleantv.launcher/.MainActivity");
        for (int i = 0; i < 6; i++) {
            Thread.sleep(1000);
            if (probe(x.host)) return true;
        }
        throw new Exception("NOPORT");
    }

    // ---------------------------------------------------------------- launcher config (read / apply)
    private static final String LPK = "com.cleantv.launcher";

    /** Ask the launcher for its saved look via a broadcast; the reply carries base64 JSON. */
    private String cfgGet() throws Exception {
        String r = live().sh("am broadcast -n " + LPK + "/.ConfigReceiver -a com.cleantv.GET_CONFIG");
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("data=\"([A-Za-z0-9+/=_-]*)\"").matcher(r);
        if (!m.find()) {
            if (r.contains("result=0") || !r.contains("result=")) throw new Exception("NOCFG");
            return "{}";
        }
        return new String(Base64.decode(m.group(1), Base64.DEFAULT), StandardCharsets.UTF_8);
    }

    /**
     * Put a photo inside the launcher's own storage. Newer Android blocks the shell from
     * /sdcard/Android/data, so: push to /data/local/tmp and stream it in through the launcher's
     * provider; if this Android has no "content write", send it in broadcast parts instead.
     * Returns the file:// URL the launcher page loads.
     */
    private String pushToLauncher(String name, String dataUrl) throws Exception {
        name = name.replaceAll("[^\\w.-]", "_");
        byte[] b = Base64.decode(dataUrl.substring(dataUrl.indexOf(',') + 1), Base64.DEFAULT);
        Adb x = live();
        String tmp = "/data/local/tmp/mbg_" + name;
        try {
            File f = new File(getCacheDir(), "push.bin");
            try (OutputStream o = new FileOutputStream(f)) { o.write(b); }
            x.push(f, tmp);
            f.delete();
            x.sh("content write --uri content://" + LPK + ".files/bg/" + name + " < " + tmp + " 2>&1; rm -f " + tmp);
            String path = statLauncherFile(x, name, b.length);
            if (path != null) return "file://" + path;
        } catch (Throwable ignored) { try { x.sh("rm -f " + tmp); } catch (Throwable ignored2) { } }
        String b64 = Base64.encodeToString(b, Base64.URL_SAFE | Base64.NO_WRAP);
        int part = 48000, n = (b64.length() + part - 1) / part;
        for (int i = 0; i < n; i++) {
            String chunk = b64.substring(i * part, Math.min(b64.length(), (i + 1) * part));
            String r = x.sh("am broadcast -n " + LPK + "/.ConfigReceiver -a com.cleantv.PUT_FILE --es name " + name + " --ei i " + i + " --ei n " + n + " --es part " + chunk);
            if (!r.contains("result=1")) throw new Exception("NOCFG");
        }
        String path = statLauncherFile(x, name, b.length);
        if (path == null) throw new Exception("ما وصلت الصورة للشاشة");
        return "file://" + path;
    }

    private String statLauncherFile(Adb x, String name, int len) throws Exception {
        String r = x.sh("am broadcast -n " + LPK + "/.ConfigReceiver -a com.cleantv.STAT_FILE --es name " + name);
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("data=\"(\\d+)\\|([^\"]+)\"").matcher(r);
        if (!m.find() || Long.parseLong(m.group(1)) != len) return null;
        return m.group(2);
    }

    private boolean cfgSet(String json) throws Exception {
        String b64 = Base64.encodeToString(json.getBytes(StandardCharsets.UTF_8), Base64.NO_WRAP | Base64.URL_SAFE);
        Adb x = live();
        // send in parts so long configs fit the shell command limit
        int part = 6000, n = (b64.length() + part - 1) / part;
        String r = "";
        for (int i = 0; i < n; i++) {
            String chunk = b64.substring(i * part, Math.min(b64.length(), (i + 1) * part));
            r = x.sh("am broadcast -n " + LPK + "/.ConfigReceiver -a com.cleantv.SET_CONFIG --ei i " + i + " --ei n " + n + " --es part " + chunk);
        }
        if (!r.contains("result=1")) throw new Exception("NOCFG");
        return true;
    }

    private String saveText(String name, String text) throws Exception {
        byte[] data = text.getBytes(StandardCharsets.UTF_8);
        if (Build.VERSION.SDK_INT >= 29) {
            ContentValues v = new ContentValues();
            v.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
            v.put(MediaStore.MediaColumns.MIME_TYPE, "application/json");
            v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/MoamalStudio");
            Uri u = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
            try (OutputStream o = getContentResolver().openOutputStream(u)) { o.write(data); }
            return "التنزيلات ← MoamalStudio ← " + name;
        }
        File d = new File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), name);
        try (OutputStream o = new FileOutputStream(d)) { o.write(data); }
        return d.getAbsolutePath();
    }

    private String pullToDownloads(String path) throws Exception {
        String name = path.substring(path.lastIndexOf('/') + 1);
        File tmp = new File(getCacheDir(), "pull.bin");
        try (OutputStream o = new FileOutputStream(tmp)) {
            final long[] last = {0};
            live().pull(path, o, b -> { if (b - last[0] > 512 * 1024) { last[0] = b; prog("نزلت " + (b / 1048576) + " ميگا"); } });
        }
        String mime = java.net.URLConnection.guessContentTypeFromName(name);
        if (mime == null) mime = "application/octet-stream";
        if (Build.VERSION.SDK_INT >= 29) {
            ContentValues v = new ContentValues();
            v.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
            v.put(MediaStore.MediaColumns.MIME_TYPE, mime);
            v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/MoamalStudio");
            Uri u = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
            try (OutputStream o = getContentResolver().openOutputStream(u); InputStream in = new java.io.FileInputStream(tmp)) {
                byte[] b = new byte[64 * 1024]; int n;
                while ((n = in.read(b)) > 0) o.write(b, 0, n);
            }
        } else {
            tmp.renameTo(new File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), name));
        }
        tmp.delete();
        return "التنزيلات ← MoamalStudio ← " + name;
    }

    // ---------------------------------------------------------------- design gallery
    /** Ready-made designs live as files on the "gallery" release; download counts come from GitHub. */
    private JSONObject gallery() throws Exception {
        JSONObject rel = new JSONObject(httpText("https://api.github.com/repos/" + REPO + "/releases/tags/gallery"));
        JSONArray as = rel.getJSONArray("assets");
        JSONObject files = new JSONObject();
        String indexUrl = null;
        for (int i = 0; i < as.length(); i++) {
            JSONObject x = as.getJSONObject(i);
            String name = x.getString("name");
            files.put(name, new JSONObject().put("url", x.getString("browser_download_url")).put("count", x.optInt("download_count")).put("size", x.optLong("size")));
            if (name.equals("index.json")) indexUrl = x.getString("browser_download_url");
        }
        if (indexUrl == null) throw new Exception("المعرض فارغ");
        JSONObject idx = new JSONObject(httpText(indexUrl));
        return new JSONObject().put("index", idx).put("files", files);
    }

    // ---------------------------------------------------------------- admin: publish to the gallery
    private String gh(String method, String url, String token, byte[] body, String type) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setRequestMethod(method);
        c.setRequestProperty("Authorization", "Bearer " + token);
        c.setRequestProperty("Accept", "application/vnd.github+json");
        c.setRequestProperty("User-Agent", "MoamalStudio");
        c.setConnectTimeout(20000);
        c.setReadTimeout(60000);
        if (body != null) {
            c.setDoOutput(true);
            c.setRequestProperty("Content-Type", type == null ? "application/json" : type);
            c.setFixedLengthStreamingMode(body.length);
            try (OutputStream o = c.getOutputStream()) { o.write(body); }
        }
        int code = c.getResponseCode();
        InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream();
        String txt = in == null ? "" : new String(Adb.readAll(in), StandardCharsets.UTF_8);
        if (code == 401 || code == 403) throw new Exception("رمز GitHub غير صحيح أو ما عنده صلاحية على المشروع");
        if (code >= 400) throw new Exception("خطأ من GitHub " + code);
        return txt;
    }

    private JSONObject galleryRelease(String token) throws Exception {
        return new JSONObject(gh("GET", "https://api.github.com/repos/" + REPO + "/releases/tags/gallery", token, null, null));
    }

    private JSONObject ghCheck(String token) throws Exception {
        JSONObject r;
        try { r = galleryRelease(token); }
        catch (Exception e) { throw new Exception("الرمز غلط أو منتهي. سوّي رمز جديد وانسخه كامل"); }
        JSONObject repo = new JSONObject(gh("GET", "https://api.github.com/repos/" + REPO, token, null, null));
        JSONObject perm = repo.optJSONObject("permissions");
        if (perm != null && !perm.optBoolean("push")) throw new Exception("هذا الحساب ما عنده صلاحية على مشروع clean-tv");
        /* a real write test: a read-only token used to pass here and then fail when publishing */
        try {
            JSONObject same = new JSONObject().put("name", r.optString("name", "gallery"));
            gh("PATCH", "https://api.github.com/repos/" + REPO + "/releases/" + r.getLong("id"), token, same.toString().getBytes(StandardCharsets.UTF_8), "application/json");
        } catch (Exception e) {
            throw new Exception("الرمز يقرا بس وما يگدر ينشر. سوّيه من زر «افتح صفحة الرمز جاهزة» وتأكد إن repo مختار");
        }
        return new JSONObject().put("ok", true).put("assets", r.getJSONArray("assets").length());
    }

    private void replaceAsset(String token, JSONObject rel, String name, byte[] data, String type) throws Exception {
        JSONArray as = rel.getJSONArray("assets");
        for (int i = 0; i < as.length(); i++) {
            JSONObject x = as.getJSONObject(i);
            if (x.getString("name").equals(name)) gh("DELETE", "https://api.github.com/repos/" + REPO + "/releases/assets/" + x.getLong("id"), token, null, null);
        }
        if (data != null) gh("POST", "https://uploads.github.com/repos/" + REPO + "/releases/" + rel.getLong("id") + "/assets?name=" + java.net.URLEncoder.encode(name, "UTF-8"), token, data, type);
    }

    private JSONObject readIndex(JSONObject rel) throws Exception {
        JSONArray as = rel.getJSONArray("assets");
        for (int i = 0; i < as.length(); i++) {
            JSONObject x = as.getJSONObject(i);
            if (x.getString("name").equals("index.json")) return new JSONObject(httpText(x.getString("browser_download_url") + "?t=" + System.currentTimeMillis()));
        }
        return new JSONObject().put("v", 2).put("items", new JSONArray());
    }

    private JSONObject ghPublish(JSONObject a) throws Exception {
        String token = a.getString("token");
        JSONObject item = a.getJSONObject("item");
        String id = item.getString("id");
        prog("أتصل بالمعرض…"); pct(10);
        JSONObject rel = galleryRelease(token);
        prog("أرفع التصميم…"); pct(30);
        replaceAsset(token, rel, id + ".json", a.getString("design").getBytes(StandardCharsets.UTF_8), "application/json");
        JSONArray extra = a.optJSONArray("extra");
        for (int i = 0; extra != null && i < extra.length(); i++) {
            JSONObject e = extra.getJSONObject(i);
            prog("أرفع الخلفية " + (i + 1) + " من " + extra.length() + "…"); pct(10 + 20 * (i + 1) / extra.length());
            String d = e.getString("data");
            replaceAsset(token, rel, e.getString("name"), Base64.decode(d.substring(d.indexOf(',') + 1), Base64.DEFAULT), "image/jpeg");
        }
        String img = a.optString("image", "");
        if (!img.isEmpty()) {
            prog("أرفع الصورة…"); pct(55);
            byte[] jpg = Base64.decode(img.substring(img.indexOf(',') + 1), Base64.DEFAULT);
            replaceAsset(token, rel, id + ".jpg", jpg, "image/jpeg");
        }
        prog("أحدّث قائمة المعرض…"); pct(80);
        JSONObject idx = readIndex(rel);
        JSONArray items = idx.optJSONArray("items");
        if (items == null) items = new JSONArray();
        JSONArray out = new JSONArray();
        int order = 0;
        for (int i = 0; i < items.length(); i++) {
            JSONObject x = items.getJSONObject(i);
            if (!x.optString("id").equals(id)) { out.put(x); order = Math.max(order, x.optInt("order") + 1); }
        }
        item.put("image", id + ".jpg").put("file", id + ".json").put("order", order);
        out.put(item);
        idx.put("items", out).put("updated", new java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.ROOT).format(new java.util.Date()));
        rel = galleryRelease(token);
        replaceAsset(token, rel, "index.json", idx.toString(1).getBytes(StandardCharsets.UTF_8), "application/json");
        pct(100);
        return new JSONObject().put("ok", true).put("count", out.length());
    }

    private JSONObject ghDelete(String token, String id) throws Exception {
        JSONObject rel = galleryRelease(token);
        JSONObject idx = readIndex(rel);
        JSONArray items = idx.optJSONArray("items"), out = new JSONArray();
        for (int i = 0; items != null && i < items.length(); i++) if (!items.getJSONObject(i).optString("id").equals(id)) out.put(items.getJSONObject(i));
        idx.put("items", out);
        replaceAsset(token, rel, "index.json", idx.toString(1).getBytes(StandardCharsets.UTF_8), "application/json");
        rel = galleryRelease(token);
        replaceAsset(token, rel, id + ".json", null, null);
        replaceAsset(token, rel, id + ".jpg", null, null);
        return new JSONObject().put("ok", true).put("count", out.length());
    }

    /** Picture of part of the app screen (the design preview), as a 1280x720 JPEG data URL. */
    private String capture(JSONObject a) throws Exception {
        final Bitmap[] out = new Bitmap[1];
        final Exception[] err = new Exception[1];
        java.util.concurrent.CountDownLatch done = new java.util.concurrent.CountDownLatch(1);
        float d = getResources().getDisplayMetrics().density;
        int x = Math.round((float) a.getDouble("x") * d), y = Math.round((float) a.getDouble("y") * d);
        int w = Math.round((float) a.getDouble("w") * d), h = Math.round((float) a.getDouble("h") * d);
        ui.post(() -> {
            try {
                Bitmap full = Bitmap.createBitmap(web.getWidth(), web.getHeight(), Bitmap.Config.ARGB_8888);
                web.draw(new android.graphics.Canvas(full));
                int cx = Math.max(0, Math.min(x, full.getWidth() - 2)), cy = Math.max(0, Math.min(y, full.getHeight() - 2));
                int cw = Math.min(w, full.getWidth() - cx), ch = Math.min(h, full.getHeight() - cy);
                out[0] = Bitmap.createBitmap(full, cx, cy, cw, ch);
            } catch (Exception e) { err[0] = e; }
            done.countDown();
        });
        done.await(5, java.util.concurrent.TimeUnit.SECONDS);
        if (err[0] != null) throw err[0];
        if (out[0] == null) throw new Exception("ما گدرت آخذ صورة المعاينة");
        Bitmap sc = Bitmap.createScaledBitmap(out[0], 1280, 720, true);
        ByteArrayOutputStream o = new ByteArrayOutputStream();
        sc.compress(Bitmap.CompressFormat.JPEG, 82, o);
        return "data:image/jpeg;base64," + Base64.encodeToString(o.toByteArray(), Base64.NO_WRAP);
    }

    // ---------------------------------------------------------------- updates
    private JSONObject shareStart() throws Exception {
        File apk = new File(getFilesDir(), "share-launcher.apk");
        try {
            JSONObject r = latestRelease("build-");
            File tag = new File(getFilesDir(), "share-launcher.tag");
            String have = tag.exists() ? new String(Adb.readAll(new java.io.FileInputStream(tag)), StandardCharsets.UTF_8) : "";
            if (!apk.exists() || apk.length() < 100000 || !have.equals(r.getString("tag"))) {
                prog("أنزّل واجهة مدير الشاشات للموبايل…");
                File tmp = new File(getFilesDir(), "share-launcher.tmp");
                download(r.getString("url"), tmp);
                if (!tmp.renameTo(apk)) throw new Exception("ما گدرت أحفظ الملف");
                try (OutputStream o = new FileOutputStream(tag)) { o.write(r.getString("tag").getBytes(StandardCharsets.UTF_8)); }
            }
        } catch (Exception e) {
            if (!apk.exists() || apk.length() < 100000) throw new Exception("أحتاج إنترنت بالموبايل مرة وحدة حتى أنزّل الواجهة");
        }
        String ver = "";
        try { android.content.pm.PackageInfo pi = getPackageManager().getPackageArchiveInfo(apk.getAbsolutePath(), 0); if (pi != null && pi.versionName != null) ver = pi.versionName; } catch (Throwable ignored) { }
        ShareServer.start(apk, ver);
        JSONArray ips = new JSONArray();
        for (java.net.NetworkInterface ni : java.util.Collections.list(java.net.NetworkInterface.getNetworkInterfaces())) {
            if (!ni.isUp() || ni.isLoopback()) continue;
            String n = ni.getName() == null ? "" : ni.getName();
            if (n.startsWith("rmnet") || n.startsWith("ccmni") || n.startsWith("v4-") || n.startsWith("tun") || n.startsWith("dummy")) continue;
            for (java.net.InetAddress a : java.util.Collections.list(ni.getInetAddresses()))
                if (a instanceof java.net.Inet4Address && a.isSiteLocalAddress())
                    ips.put(new JSONObject().put("ip", a.getHostAddress()).put("hot", n.startsWith("ap") || n.startsWith("swlan") || n.contains("softap") || n.equals("wlan1") || n.equals("wlan2") || n.startsWith("rndis") || n.startsWith("usb")));
        }
        return new JSONObject().put("ips", ips).put("port", ShareServer.PORT).put("size", apk.length()).put("ver", ShareServer.version);
    }

    private JSONObject latestRelease(String prefix) throws Exception {
        JSONArray rel = new JSONArray(httpText("https://api.github.com/repos/" + REPO + "/releases?per_page=40"));
        for (int i = 0; i < rel.length(); i++) {
            JSONObject r = rel.getJSONObject(i);
            String tag = r.optString("tag_name");
            if (!tag.startsWith(prefix)) continue;
            JSONArray as = r.optJSONArray("assets");
            for (int j = 0; as != null && j < as.length(); j++) {
                JSONObject asset = as.getJSONObject(j);
                if (asset.optString("name").endsWith(".apk")) {
                    return new JSONObject().put("tag", tag).put("num", Integer.parseInt(tag.substring(prefix.length())))
                            .put("url", asset.getString("browser_download_url")).put("size", asset.optLong("size"))
                            .put("notes", r.optString("body")).put("at", r.optString("published_at"));
                }
            }
        }
        throw new Exception("ما لگيت تحديث");
    }

    private static final String INSTALL_ACTION = "com.moamal.studio.INSTALLED";
    private boolean recvReg;
    private final BroadcastReceiver installReceiver = new BroadcastReceiver() {
        @Override public void onReceive(Context c, Intent i) {
            int st = i.getIntExtra(PackageInstaller.EXTRA_STATUS, -999);
            if (st == PackageInstaller.STATUS_PENDING_USER_ACTION) {
                Intent confirm = i.getParcelableExtra(Intent.EXTRA_INTENT);
                if (confirm != null) { confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); try { startActivity(confirm); } catch (Throwable ignored) { } }
            } else if (st != PackageInstaller.STATUS_SUCCESS) {
                js("window.toast&&toast('ما تم التحديث. فعّل «السماح بتثبيت التطبيقات» لمدير الشاشة')");
            }
        }
    };

    private String selfUpdate() throws Exception {
        JSONObject r = latestRelease("studio-");
        File apk = download(r.getString("url"), new File(getCacheDir(), "self.apk"));
        if (!recvReg) {
            IntentFilter f = new IntentFilter(INSTALL_ACTION);
            if (Build.VERSION.SDK_INT >= 33) registerReceiver(installReceiver, f, Context.RECEIVER_NOT_EXPORTED);
            else registerReceiver(installReceiver, f);
            recvReg = true;
        }
        PackageInstaller pi = getPackageManager().getPackageInstaller();
        PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
        int sid = pi.createSession(params);
        try (PackageInstaller.Session session = pi.openSession(sid)) {
            try (InputStream in = new java.io.FileInputStream(apk); OutputStream out = session.openWrite("studio", 0, apk.length())) {
                byte[] buf = new byte[65536]; int n;
                while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                session.fsync(out);
            }
            Intent it = new Intent(INSTALL_ACTION).setPackage(getPackageName());
            int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
            session.commit(PendingIntent.getBroadcast(this, 77, it, flags).getIntentSender());
        }
        return r.getString("tag");
    }

    /** Read a photo with sampling (phone photos are huge), crop it to tw x th and return a JPEG data URL. */
    private String imageDataUrl(Uri u, int tw, int th) throws Exception {
        BitmapFactory.Options o = new BitmapFactory.Options();
        o.inJustDecodeBounds = true;
        try (InputStream in = getContentResolver().openInputStream(u)) { BitmapFactory.decodeStream(in, null, o); }
        int sample = 1;
        while (o.outWidth / (sample * 2) >= tw && o.outHeight / (sample * 2) >= th) sample *= 2;
        BitmapFactory.Options o2 = new BitmapFactory.Options();
        o2.inSampleSize = sample;
        Bitmap bm;
        try (InputStream in = getContentResolver().openInputStream(u)) { bm = BitmapFactory.decodeStream(in, null, o2); }
        if (bm == null) throw new Exception("مو صورة");
        float r = Math.max((float) tw / bm.getWidth(), (float) th / bm.getHeight());
        Bitmap sc = Bitmap.createScaledBitmap(bm, Math.max(tw, Math.round(bm.getWidth() * r)), Math.max(th, Math.round(bm.getHeight() * r)), true);
        Bitmap cr = Bitmap.createBitmap(sc, (sc.getWidth() - tw) / 2, (sc.getHeight() - th) / 2, tw, th);
        ByteArrayOutputStream bo = new ByteArrayOutputStream();
        cr.compress(Bitmap.CompressFormat.JPEG, 80, bo);
        if (sc != bm) sc.recycle();
        bm.recycle();
        return "data:image/jpeg;base64," + Base64.encodeToString(bo.toByteArray(), Base64.NO_WRAP);
    }

    /** Upload a file straight to the TV launcher's server (no ADB needed). */
    private String postFile(String url, String token, File f) throws Exception {
        java.net.HttpURLConnection c = (java.net.HttpURLConnection) new java.net.URL(url).openConnection();
        c.setRequestMethod("POST");
        c.setDoOutput(true);
        c.setConnectTimeout(8000);
        c.setReadTimeout(120000);
        c.setRequestProperty("X-Token", token);
        c.setRequestProperty("Content-Type", "application/octet-stream");
        c.setFixedLengthStreamingMode(f.length());
        long total = f.length(), sent = 0, last = 0;
        try (InputStream in = new java.io.FileInputStream(f); OutputStream o = c.getOutputStream()) {
            byte[] buf = new byte[64 * 1024];
            int n;
            while ((n = in.read(buf)) > 0) {
                o.write(buf, 0, n); sent += n;
                if (sent - last > 512 * 1024) { last = sent; prog("أرسل… " + (sent * 100 / Math.max(1, total)) + "%"); }
            }
        }
        int code = c.getResponseCode();
        InputStream rin = code < 400 ? c.getInputStream() : c.getErrorStream();
        String body = rin == null ? "" : new String(Adb.readAll(rin), StandardCharsets.UTF_8);
        if (code == 401) throw new Exception("DIRECTAUTH");
        if (code >= 400) throw new Exception("HTTP " + code);
        return body.isEmpty() ? "{}" : body;
    }

    // ---------------------------------------------------------------- file picker
    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req == 43) {
            if (res != RESULT_OK || data == null) { js("window.onCast&&onCast(false,'انلغى')"); return; }
            try {
                String ch = castHost != null && !castHost.isEmpty() ? castHost : Adb.get(this).host;
                CastService.start(this, res, data, ch);
                js("window.onCast&&onCast(true,'')");
            } catch (Throwable t) { js("window.onCast&&onCast(false,'خطأ')"); }
            return;
        }
        if (req == 44) {
            String vid = voiceId; voiceId = null;
            if (vid == null) return;
            java.util.ArrayList<String> r = data == null ? null : data.getStringArrayListExtra(android.speech.RecognizerIntent.EXTRA_RESULTS);
            if (res != RESULT_OK || r == null || r.isEmpty()) cb(vid, false, "CANCEL"); else cb(vid, true, r.get(0));
            return;
        }
        if (req != 42 || pickId == null) return;
        String id = pickId, mode = pickMode, dir = pickDir == null || pickDir.isEmpty() ? "/sdcard/Download" : pickDir;
        pickId = null;
        if ("bgimages".equals(mode)) {
            if (res != RESULT_OK || data == null) { cb(id, false, "CANCEL"); return; }
            java.util.List<Uri> us = new java.util.ArrayList<>();
            if (data.getClipData() != null) for (int i = 0; i < data.getClipData().getItemCount(); i++) us.add(data.getClipData().getItemAt(i).getUri());
            else if (data.getData() != null) us.add(data.getData());
            if (us.isEmpty()) { cb(id, false, "CANCEL"); return; }
            work.execute(() -> {
                JSONArray arr = new JSONArray();
                for (int i = 0; i < us.size() && i < 15; i++) {
                    prog("أجهّز الصورة " + (i + 1) + " من " + Math.min(15, us.size()) + "…");
                    try { arr.put(imageDataUrl(us.get(i), 1600, 900)); } catch (Throwable ignored) { }
                }
                cb(id, arr.length() > 0, arr.length() > 0 ? arr : "ما گدرت أقرا الصور");
            });
            return;
        }
        if (res != RESULT_OK || data == null || data.getData() == null) { cb(id, false, "CANCEL"); return; }
        Uri u = data.getData();
        work.execute(() -> {
            try {
                String name = "file.bin";
                try (Cursor c = getContentResolver().query(u, null, null, null, null)) {
                    if (c != null && c.moveToFirst()) {
                        int ix = c.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                        if (ix >= 0) name = c.getString(ix);
                    }
                }
                name = name.replaceAll("[\\\\/:*?\"<>|']", "_");
                File f = new File(getCacheDir(), "up_" + name);
                prog("أجهّز الملف…");
                try (InputStream in = getContentResolver().openInputStream(u); OutputStream o = new FileOutputStream(f)) {
                    byte[] buf = new byte[64 * 1024];
                    int n;
                    while ((n = in.read(buf)) > 0) o.write(buf, 0, n);
                }
                Object result;
                if ("zip".equals(mode)) {
                    prog("أقرا الملف وأدوّر على الواجهات…");
                    File keep = new File(getCacheDir(), "themes.zip");
                    if (keep.exists()) keep.delete();
                    if (!f.renameTo(keep)) keep = f;
                    cb(id, true, ZipThemes.index(keep, name.replaceAll("(?i)\\.zip$", "")));
                    return;
                }
                if ("logo".equals(mode)) {
                    Bitmap bm = BitmapFactory.decodeFile(f.getAbsolutePath());
                    if (bm == null) throw new Exception("الملف مو صورة");
                    float r = Math.min(320f / bm.getWidth(), 320f / bm.getHeight());
                    Bitmap sc = r < 1 ? Bitmap.createScaledBitmap(bm, Math.max(1, Math.round(bm.getWidth() * r)), Math.max(1, Math.round(bm.getHeight() * r)), true) : bm;
                    ByteArrayOutputStream bo = new ByteArrayOutputStream();
                    sc.compress(Bitmap.CompressFormat.PNG, 100, bo);
                    result = "data:image/png;base64," + Base64.encodeToString(bo.toByteArray(), Base64.NO_WRAP);
                } else if ("image".equals(mode) || "bgimage".equals(mode)) {
                    Bitmap bm = BitmapFactory.decodeFile(f.getAbsolutePath());
                    if (bm == null) throw new Exception("الملف مو صورة");
                    int tw = "bgimage".equals(mode) ? 1600 : 1280, th = "bgimage".equals(mode) ? 900 : 720;
                    float r = Math.max((float) tw / bm.getWidth(), (float) th / bm.getHeight());
                    Bitmap sc = Bitmap.createScaledBitmap(bm, Math.round(bm.getWidth() * r), Math.round(bm.getHeight() * r), true);
                    Bitmap cr = Bitmap.createBitmap(sc, (sc.getWidth() - tw) / 2, (sc.getHeight() - th) / 2, tw, th);
                    ByteArrayOutputStream bo = new ByteArrayOutputStream();
                    cr.compress(Bitmap.CompressFormat.JPEG, 82, bo);
                    result = "data:image/jpeg;base64," + Base64.encodeToString(bo.toByteArray(), Base64.NO_WRAP);
                } else if ("dsend".equals(mode) || "dinstall".equals(mode)) {
                    prog(("dinstall".equals(mode) ? "أرسل التطبيق للشاشة: " : "أرسل للشاشة: ") + name);
                    String mime = getContentResolver().getType(u);
                    String url = pickUrl + ("dinstall".equals(mode) ? "/api/install" : "/api/send?name=" + java.net.URLEncoder.encode(name, "UTF-8")
                            + (mime != null ? "&mime=" + java.net.URLEncoder.encode(mime, "UTF-8") : ""));
                    JSONObject r = new JSONObject(postFile(url, pickToken, f));
                    r.put("name", name);
                    if (mime != null) r.put("mime", mime);
                    result = r;
                } else if ("backup".equals(mode)) {
                    result = new String(Adb.readAll(new java.io.FileInputStream(f)), StandardCharsets.UTF_8);
                } else if ("install".equals(mode)) {
                    prog("أثبّت " + name + " على الشاشة…");
                    String r = live().install(f, null);
                    if (!r.contains("Success")) throw new Exception(r);
                    result = name;
                } else {
                    prog("أرسل " + name + " للشاشة…");
                    String to = (dir.endsWith("/") ? dir : dir + "/") + name;
                    live().push(f, to);
                    result = to;
                }
                f.delete();
                cb(id, true, result);
            } catch (Throwable t) {
                cb(id, false, t.getMessage() == null ? "خطأ" : t.getMessage());
            }
        });
    }
}
