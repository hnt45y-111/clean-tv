package com.cleantv.launcher;

import android.Manifest;
import android.app.Activity;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.pm.PackageInstaller;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.drawable.Drawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.Settings;
import android.util.Base64;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public class MainActivity extends Activity {

    private WebView web;
    static volatile MainActivity self;
    static volatile boolean foreground = false;

    String pageUrl() {
        boolean car = "car".equals(Media.prefs(this).getString("mode", "tv"));
        if (car) CarSensors.start(this);
        return "file:///android_asset/" + (car ? "car.html" : "index.html");
    }

    /** A new look arrived from the phone: reload the page so it picks it up from pendingCfg. */
    static boolean reloadForConfig() {
        final MainActivity m = self;
        if (m == null || m.isFinishing() || m.web == null) return false;
        m.runOnUiThread(() -> { try { m.web.loadUrl(m.pageUrl()); } catch (Throwable ignored) { } });
        return true;
    }

    static void js(final String code) {
        MainActivity m = self;
        if (m != null) m.callJs(code);
    }

    static String appsJson() {
        MainActivity m = self;
        if (m == null) return null;
        if (m.appsCache == null) m.appsCache = m.buildApps();
        return m.appsCache;
    }

    static boolean launchPkg(String pkg) {
        MainActivity m = self;
        if (m == null || pkg == null) return false;
        if (pkg.contains("/")) return startComp(m, pkg);
        PackageManager pm = m.getPackageManager();
        Intent i = pm.getLeanbackLaunchIntentForPackage(pkg);
        if (i == null) i = pm.getLaunchIntentForPackage(pkg);
        if (i == null) return false;
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try { m.startActivity(i); return true; } catch (Throwable t) { return false; }
    }
    static boolean startComp(Context c, String pc) {
        try {
            String[] x = pc.split("/", 2);
            String cls = x[1].startsWith(".") ? x[0] + x[1] : x[1];
            Intent i = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
                    .setComponent(new android.content.ComponentName(x[0], cls)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            c.startActivity(i); return true;
        } catch (Throwable t) {
            try { Intent i = c.getPackageManager().getLaunchIntentForPackage(pc.split("/")[0]); if (i == null) return false; i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); c.startActivity(i); return true; } catch (Throwable t2) { return false; }
        }
    }
    private volatile String appsCache = null;
    private volatile boolean appsDirty = true;

    private final BroadcastReceiver pkgReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            appsDirty = true;
            appsCache = null;
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);

        web = new WebView(this);
        web.setBackgroundColor(Color.BLACK);
        web.setFocusable(true);
        web.setFocusableInTouchMode(true);
        web.setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowFileAccessFromFileURLs(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        if (Build.VERSION.SDK_INT >= 23) s.setOffscreenPreRaster(true);

        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient());
        web.addJavascriptInterface(new Bridge(), "Android");
        setContentView(web);
        web.loadUrl(pageUrl());
        web.requestFocus();
        try { DeviceTools.rearm(this); } catch (Throwable ignored) { }

        IntentFilter f = new IntentFilter();
        f.addAction(Intent.ACTION_PACKAGE_ADDED);
        f.addAction(Intent.ACTION_PACKAGE_REMOVED);
        f.addAction(Intent.ACTION_PACKAGE_CHANGED);
        f.addAction(Intent.ACTION_PACKAGE_REPLACED);
        f.addDataScheme("package");
        registerReceiver(pkgReceiver, f);

        Media.onQuranEnd = new Runnable() {
            @Override
            public void run() { callJs("window.onQuranEnded && window.onQuranEnded()"); }
        };
        IntentFilter inf = new IntentFilter(INSTALL_ACTION);
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(installReceiver, inf, Context.RECEIVER_NOT_EXPORTED);
        else registerReceiver(installReceiver, inf);
        handleIntent(getIntent());
        self = this;
        RemoteServer.start(this);
        MediaListener.registerMeta(this);
    }

    private void handleIntent(Intent i) {
        if (i != null && i.getStringExtra("lockPkg") != null && web != null) {
            final String lp = i.getStringExtra("lockPkg");
            web.postDelayed(() -> web.evaluateJavascript("window.onLockedApp && window.onLockedApp(" + org.json.JSONObject.quote(lp) + ")", null), 700);
        }
        if (i != null && i.getBooleanExtra("kidsTimeUp", false) && web != null) {
            web.postDelayed(new Runnable() {
                @Override
                public void run() { web.evaluateJavascript("window.onKidsTimeUp && window.onKidsTimeUp()", null); }
            }, 800);
        }
    }

    private static final String INSTALL_ACTION = "com.cleantv.launcher.INSTALL_STATUS";

    private final BroadcastReceiver installReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            int status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, -999);
            if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
                Intent confirm = intent.getParcelableExtra(Intent.EXTRA_INTENT);
                if (confirm != null) {
                    confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    try { startActivity(confirm); } catch (Throwable ignored) { }
                }
            } else if (status != PackageInstaller.STATUS_SUCCESS) {
                callJs("window.onUpdateStatus && window.onUpdateStatus('fail')");
            }
        }
    };

    /** An APK sent from the phone without ADB: the TV asks to confirm the install. */
    static boolean installFromPhone(final File apk) {
        final MainActivity m = self;
        if (m == null) return false;
        m.runOnUiThread(() -> { try { m.installApk(apk); } catch (Throwable t) { m.callJs("window.toastMsg && window.toastMsg('ما گدرت أنصب التطبيق')"); } });
        return true;
    }

    private void installApk(File apk) throws Exception {
        PackageInstaller pi = getPackageManager().getPackageInstaller();
        PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
        int id = pi.createSession(params);
        PackageInstaller.Session session = pi.openSession(id);
        java.io.FileInputStream in = new java.io.FileInputStream(apk);
        OutputStream out = session.openWrite("cleantv", 0, apk.length());
        byte[] buf = new byte[65536];
        int n;
        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        session.fsync(out);
        out.close();
        in.close();
        Intent it = new Intent(INSTALL_ACTION).setPackage(getPackageName());
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
        PendingIntent p = PendingIntent.getBroadcast(this, 4242, it, flags);
        session.commit(p.getIntentSender());
        session.close();
    }

    @Override
    protected void onDestroy() {
        if (self == this) self = null;
        try { unregisterReceiver(pkgReceiver); } catch (Throwable ignored) { }
        try { unregisterReceiver(installReceiver); } catch (Throwable ignored) { }
        super.onDestroy();
    }

    @Override
    protected void onPause() {
        foreground = false;
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        foreground = true;
        PowerService.lastInput = System.currentTimeMillis();
        if (web != null && Media.prefs(this).getString("pendingCfg", null) != null) web.loadUrl(pageUrl());
        else if (web != null) {
            web.requestFocus();
            web.evaluateJavascript("window.onAppResume && window.onAppResume()", null);
            String pw = Media.prefs(this).getString("pendingWall", null);
            if (pw != null) {
                Media.prefs(this).edit().remove("pendingWall").apply();
                web.evaluateJavascript("window.remoteCmd && window.remoteCmd({type:'image',pin:true,path:" + org.json.JSONObject.quote(pw) + "})", null);
            }
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleIntent(intent);
        if (web != null) web.evaluateJavascript("window.onHomePressed && window.onHomePressed()", null);
    }

    private static final int PICK_IMAGE = 41;

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != PICK_IMAGE) return;
        if (resultCode != RESULT_OK || data == null || data.getData() == null) {
            callJs("window.onImagePicked && window.onImagePicked('')");
            return;
        }
        final Uri uri = data.getData();
        new Thread(new Runnable() {
            @Override
            public void run() {
                String path = "";
                try {
                    File dir = new File(getFilesDir(), "mybg");
                    dir.mkdirs();
                    File out = new File(dir, "my_" + System.currentTimeMillis() + ".jpg");
                    InputStream in = getContentResolver().openInputStream(uri);
                    OutputStream os = new FileOutputStream(out);
                    byte[] buf = new byte[65536];
                    int n;
                    while ((n = in.read(buf)) > 0) os.write(buf, 0, n);
                    os.close();
                    in.close();
                    path = "file://" + out.getAbsolutePath();
                } catch (Throwable ignored) { }
                callJs("window.onImagePicked && window.onImagePicked(" + JSONObject.quote(path) + ")");
            }
        }).start();
    }

    @Override
    public void onBackPressed() {
        if (web != null) web.evaluateJavascript("window.onBackKey && window.onBackKey()", null);
    }

    private void callJs(final String js) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (web != null) web.evaluateJavascript(js, null);
            }
        });
    }

    private static Bitmap render(Drawable d, int w, int h, int bg) {
        Bitmap bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(bmp);
        if (bg != 0) c.drawColor(bg);
        d.setBounds(0, 0, w, h);
        d.draw(c);
        return bmp;
    }

    private static String encode(Bitmap bmp, boolean jpeg) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        bmp.compress(jpeg ? Bitmap.CompressFormat.JPEG : Bitmap.CompressFormat.PNG, jpeg ? 88 : 100, out);
        return (jpeg ? "data:image/jpeg;base64," : "data:image/png;base64,")
                + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
    }

    private static String dominant(Bitmap bmp) {
        try {
            long r = 0, g = 0, b = 0, n = 0;
            int w = bmp.getWidth(), h = bmp.getHeight();
            for (int y = 0; y < h; y += 6) {
                for (int x = 0; x < w; x += 6) {
                    int p = bmp.getPixel(x, y);
                    if (Color.alpha(p) < 200) continue;
                    int rr = Color.red(p), gg = Color.green(p), bb = Color.blue(p);
                    int mx = Math.max(rr, Math.max(gg, bb)), mn = Math.min(rr, Math.min(gg, bb));
                    if (mx - mn < 25) continue; // skip greys/white
                    r += rr; g += gg; b += bb; n++;
                }
            }
            if (n == 0) return "#3a4256";
            return String.format(Locale.US, "#%02x%02x%02x", (int) (r / n), (int) (g / n), (int) (b / n));
        } catch (Throwable t) {
            return "#3a4256";
        }
    }

    private String buildApps() {
        PackageManager pm = getPackageManager();
        Map<String, JSONObject> apps = new LinkedHashMap<>();
        String self = getPackageName();
        boolean carMode = "car".equals(Media.prefs(this).getString("mode", "tv"));
        try {
            Intent tv = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LEANBACK_LAUNCHER);
            Intent ph = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
            List<ResolveInfo> tvList = pm.queryIntentActivities(tv, 0);
            List<ResolveInfo> phList = pm.queryIntentActivities(ph, 0);
            for (int pass = 0; pass < 2; pass++) {
                for (ResolveInfo ri : (pass == 0 ? tvList : phList)) {
                    ActivityInfo ai = ri.activityInfo;
                    if (ai == null) continue;
                    String pkg = ai.packageName;
                    if (pkg.equals(self)) continue;
                    String key = pkg;
                    if (apps.containsKey(pkg)) {
                        // car head units put Bluetooth music, radio, etc. as extra icons of one package: keep them apart
                        if (!carMode || pass == 0) continue;
                        key = pkg + "/" + ai.name;
                        if (apps.containsKey(key)) continue;
                    }
                    JSONObject o = new JSONObject();
                    o.put("pkg", key);
                    if (!key.equals(pkg)) o.put("cls", ai.name);
                    o.put("label", String.valueOf(ri.loadLabel(pm)));
                    Drawable banner = null;
                    try { banner = ai.loadBanner(pm); } catch (Throwable ignored) { }
                    if (banner == null) {
                        try { banner = ai.applicationInfo.loadBanner(pm); } catch (Throwable ignored) { }
                    }
                    if (banner != null) {
                        Bitmap b = render(banner, 320, 180, Color.rgb(27, 33, 48));
                        o.put("banner", encode(b, true));
                        o.put("bcolor", dominant(b));
                        b.recycle();
                    }
                    Drawable ic = null;
                    try { ic = ri.loadIcon(pm); } catch (Throwable ignored) { }
                    if (ic != null) {
                        Bitmap b = render(ic, 160, 160, 0);
                        o.put("icon", encode(b, false));
                        o.put("color", dominant(b));
                        b.recycle();
                    }
                    apps.put(key, o);
                }
            }
        } catch (Throwable ignored) { }
        JSONArray arr = new JSONArray();
        for (JSONObject o : apps.values()) arr.put(o);
        return arr.toString();
    }

    private static final String[] IMG_EXT = {".jpg", ".jpeg", ".png", ".webp"};

    private void scan(File dir, List<String> out, int depth) {
        if (dir == null || !dir.isDirectory() || depth > 2 || out.size() >= 300) return;
        File[] files = dir.listFiles();
        if (files == null) return;
        Arrays.sort(files);
        for (File f : files) {
            if (out.size() >= 300) return;
            if (f.isDirectory()) {
                if (!f.getName().startsWith(".")) scan(f, out, depth + 1);
                continue;
            }
            String n = f.getName().toLowerCase(Locale.US);
            if (f.length() < 30 * 1024) continue; // skip thumbnails/icons
            for (String e : IMG_EXT) {
                if (n.endsWith(e)) { out.add("file://" + f.getAbsolutePath()); break; }
            }
        }
    }

    public class Bridge {

        @JavascriptInterface
        public void getAppsAsync(final String cbId) {
            new Thread(new Runnable() {
                @Override
                public void run() {
                    String res = appsCache;
                    if (res == null) {
                        res = buildApps();
                        appsCache = res;
                    }
                    appsDirty = false;
                    callJs("window.__cb(" + JSONObject.quote(cbId) + "," + JSONObject.quote(res) + ")");
                }
            }).start();
        }

        @JavascriptInterface
        public boolean appsChanged() {
            return appsDirty;
        }

        @JavascriptInterface
        public boolean launch(String pkg) {
            if (pkg != null && pkg.contains("/")) return startComp(MainActivity.this, pkg);
            PackageManager pm = getPackageManager();
            Intent i = pm.getLeanbackLaunchIntentForPackage(pkg);
            if (i == null) i = pm.getLaunchIntentForPackage(pkg);
            if (i == null) return false;
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try { startActivity(i); return true; } catch (Throwable t) { return false; }
        }

        @JavascriptInterface
        public void setLocks(String csv) { Media.prefs(MainActivity.this).edit().putString("lockPkgs", csv == null ? "" : csv).apply(); }

        @JavascriptInterface
        public void unlockApp(String pkg, int minutes) { DeviceTools.unlock(pkg, minutes); }

        @JavascriptInterface
        public void schedule(String kind, String hhmm) { DeviceTools.schedule(MainActivity.this, kind, hhmm); }

        @JavascriptInterface
        public void openSettings() {
            try {
                Intent i = new Intent(Settings.ACTION_SETTINGS);
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(i);
            } catch (Throwable ignored) { }
        }

        @JavascriptInterface
        public String listBgAssets() {
            JSONArray arr = new JSONArray();
            try {
                String[] names = getAssets().list("bg");
                if (names != null) {
                    Arrays.sort(names);
                    for (String n : names) {
                        String l = n.toLowerCase(Locale.US);
                        if (l.endsWith(".jpg") || l.endsWith(".jpeg") || l.endsWith(".png") || l.endsWith(".webp")) {
                            arr.put("bg/" + n);
                        }
                    }
                }
            } catch (Throwable ignored) { }
            return arr.toString();
        }

        @JavascriptInterface
        public boolean hasImagesPermission() {
            String p = Build.VERSION.SDK_INT >= 33 ? "android.permission.READ_MEDIA_IMAGES" : Manifest.permission.READ_EXTERNAL_STORAGE;
            return checkSelfPermission(p) == PackageManager.PERMISSION_GRANTED;
        }

        @JavascriptInterface
        public void requestImagesPermission() {
            final String p = Build.VERSION.SDK_INT >= 33 ? "android.permission.READ_MEDIA_IMAGES" : Manifest.permission.READ_EXTERNAL_STORAGE;
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try { requestPermissions(new String[]{p}, 7); } catch (Throwable ignored) { }
                }
            });
        }

        @JavascriptInterface
        public String listMyImages() {
            List<String> out = new ArrayList<>();
            File root = Environment.getExternalStorageDirectory();
            scan(new File(root, "Pictures"), out, 0);
            scan(new File(root, "Download"), out, 0);
            scan(new File(root, "DCIM"), out, 0);
            JSONArray arr = new JSONArray();
            for (String s : out) arr.put(s);
            return arr.toString();
        }

        @JavascriptInterface
        public void publishState(String json) { RemoteServer.state = json == null ? "{}" : json; }

        @JavascriptInterface
        public void remoteStartPairing() { RemoteServer.startPairing(); }

        @JavascriptInterface
        public String remoteUrl() { return RemoteServer.url(); }

        @JavascriptInterface
        public void scheduleAlarms(String json) { AlertReceiver.schedule(MainActivity.this, json); }

        @JavascriptInterface
        public void setPref(String k, String v) { Media.prefs(MainActivity.this).edit().putString(k, v).apply(); }

        /** Screensaver on the launcher: lower the panel brightness (works on car units / boxes that honour it; TVs ignore it safely). */
        @JavascriptInterface
        public void saverDim(final boolean on) {
            runOnUiThread(() -> {
                try {
                    android.view.WindowManager.LayoutParams lp = getWindow().getAttributes();
                    lp.screenBrightness = on ? 0.12f : android.view.WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE;
                    getWindow().setAttributes(lp);
                } catch (Throwable ignored) { }
            });
        }

        @JavascriptInterface
        public void writeConfig(String json) { Media.prefs(MainActivity.this).edit().putString("cfgJson", json).apply(); }

        @JavascriptInterface
        public String pendingConfig() {
            String v = Media.prefs(MainActivity.this).getString("pendingCfg", null);
            if (v != null) Media.prefs(MainActivity.this).edit().remove("pendingCfg").apply();
            return v;
        }

        @JavascriptInterface
        public boolean hasOverlay() { return Overlay.allowed(MainActivity.this); }

        @JavascriptInterface
        public void openOverlaySettings() {
            try {
                Intent i = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getPackageName()));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(i);
            } catch (Throwable t) { openSettings(); }
        }

        @JavascriptInterface
        public void testAdhan(String title) {
            try {
                Intent a = new Intent(MainActivity.this, AdhanActivity.class);
                a.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                a.putExtra("title", title);
                a.putExtra("sub", "تجربة صوت الأذان");
                a.putExtra("sound", true);
                startActivity(a);
            } catch (Throwable t) {
                Overlay.showBanner(MainActivity.this, title, "تجربة صوت الأذان", 20000);
                Media.playAdhan(MainActivity.this);
            }
        }

        @JavascriptInterface
        public void stopAdhan() { Media.stopAdhan(MainActivity.this); }

        @JavascriptInterface
        public boolean adhanPlaying() { return Media.adhanPlaying(); }

        @JavascriptInterface
        public void showBanner(String title, String sub) { Overlay.showBanner(MainActivity.this, title, sub, 15000); }

        @JavascriptInterface
        public String listAudio() {
            JSONArray arr = new JSONArray();
            File root = Environment.getExternalStorageDirectory();
            String[] dirs = {"Download", "Music", "Ringtones", "Notifications", "Alarms"};
            for (String d : dirs) {
                File[] fs = new File(root, d).listFiles();
                if (fs == null) continue;
                for (File f : fs) {
                    String n = f.getName().toLowerCase(Locale.US);
                    if (n.endsWith(".mp3") || n.endsWith(".ogg") || n.endsWith(".m4a") || n.endsWith(".wav") || n.endsWith(".aac")) {
                        try {
                            JSONObject o = new JSONObject();
                            o.put("path", f.getAbsolutePath());
                            o.put("name", f.getName());
                            arr.put(o);
                        } catch (Throwable ignored) { }
                    }
                }
            }
            return arr.toString();
        }

        @JavascriptInterface
        public void quranPlay(String url, String title) { Media.quranPlay(MainActivity.this, url, title); }

        @JavascriptInterface
        public void quranToggle() { Media.quranToggle(); }

        @JavascriptInterface
        public void quranStop() { Media.quranStop(); }

        @JavascriptInterface
        public String quranStatus() {
            try {
                JSONObject o = new JSONObject();
                o.put("state", Media.quranState);
                o.put("title", Media.quranTitle);
                return o.toString();
            } catch (Throwable t) { return "{}"; }
        }

        @JavascriptInterface
        public int buildNumber() {
            try {
                BufferedReader r = new BufferedReader(new InputStreamReader(getAssets().open("build.txt"), StandardCharsets.UTF_8));
                String l = r.readLine();
                r.close();
                return Integer.parseInt(l.trim());
            } catch (Throwable t) { return 0; }
        }

        @JavascriptInterface
        public void installUpdate(final String url) {
            new Thread(new Runnable() {
                @Override
                public void run() {
                    try {
                        File out = new File(getCacheDir(), "update.apk");
                        HttpURLConnection con = (HttpURLConnection) new URL(url).openConnection();
                        con.setInstanceFollowRedirects(true);
                        con.setConnectTimeout(15000);
                        con.setReadTimeout(60000);
                        con.setRequestProperty("User-Agent", "CleanTV/4.0");
                        InputStream in = con.getInputStream();
                        OutputStream os = new FileOutputStream(out);
                        byte[] buf = new byte[65536];
                        int n;
                        while ((n = in.read(buf)) > 0) os.write(buf, 0, n);
                        os.close();
                        in.close();
                        con.disconnect();
                        callJs("window.onUpdateStatus && window.onUpdateStatus('installing')");
                        installApk(out);
                    } catch (Throwable t) {
                        callJs("window.onUpdateStatus && window.onUpdateStatus('fail')");
                    }
                }
            }).start();
        }

        @JavascriptInterface
        public void openMarketSearch(String q) {
            try {
                Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse("market://search?q=" + Uri.encode(q)));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(i);
            } catch (Throwable t) {
                try {
                    Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/search?q=" + Uri.encode(q)));
                    i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(i);
                } catch (Throwable ignored) { }
            }
        }

        @JavascriptInterface
        public void kidsAlarm(long atMs, String title, String sub) {
            AlarmManager am = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
            Intent it = new Intent(MainActivity.this, AlertReceiver.class).setAction(AlertReceiver.ACTION);
            it.putExtra("type", "kids");
            it.putExtra("title", title);
            it.putExtra("sub", sub);
            PendingIntent pi = PendingIntent.getBroadcast(MainActivity.this, 8999, it, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            try { am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMs, pi); }
            catch (SecurityException se) { am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMs, pi); }
        }

        @JavascriptInterface
        public void kidsCancel() {
            AlarmManager am = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
            Intent it = new Intent(MainActivity.this, AlertReceiver.class).setAction(AlertReceiver.ACTION);
            am.cancel(PendingIntent.getBroadcast(MainActivity.this, 8999, it, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        }

        @JavascriptInterface
        public void openWifi() {
            try {
                Intent i = new Intent(Settings.ACTION_WIFI_SETTINGS);
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(i);
            } catch (Throwable t) { openSettings(); }
        }

        @JavascriptInterface
        public boolean powerSleep() { return PowerService.sleep(); }

        /** Top bar «البلوتوث». */
        @JavascriptInterface
        public void openBluetooth() {
            try { Intent i = new Intent(Settings.ACTION_BLUETOOTH_SETTINGS); i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); startActivity(i); }
            catch (Throwable t) { openSettings(); }
        }

        /** Top bar «الشبكة»: all network settings (Wi-Fi, Ethernet, hotspot); falls back to Wi-Fi. */
        @JavascriptInterface
        public void openNetwork() {
            try { Intent i = new Intent(Settings.ACTION_WIRELESS_SETTINGS); i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); startActivity(i); }
            catch (Throwable t) { openWifi(); }
        }

        @JavascriptInterface
        public boolean isMuted() {
            try {
                android.media.AudioManager am = (android.media.AudioManager) getSystemService(AUDIO_SERVICE);
                return android.os.Build.VERSION.SDK_INT >= 23 ? am.isStreamMute(android.media.AudioManager.STREAM_MUSIC) : am.getStreamVolume(android.media.AudioManager.STREAM_MUSIC) == 0;
            } catch (Throwable t) { return false; }
        }

        /** Top bar «تنظيف الذاكرة»: closes apps running in the background; returns the MB freed. */
        @JavascriptInterface
        public int memClean() {
            try {
                android.app.ActivityManager am = (android.app.ActivityManager) getSystemService(ACTIVITY_SERVICE);
                android.app.ActivityManager.MemoryInfo a = new android.app.ActivityManager.MemoryInfo(); am.getMemoryInfo(a);
                java.util.HashSet<String> pk = new java.util.HashSet<>();
                java.util.List<android.app.ActivityManager.RunningAppProcessInfo> ps = am.getRunningAppProcesses();
                if (ps != null) for (android.app.ActivityManager.RunningAppProcessInfo p : ps) if (p.pkgList != null) java.util.Collections.addAll(pk, p.pkgList);
                for (android.content.pm.ApplicationInfo ai : getPackageManager().getInstalledApplications(0)) {
                    if ((ai.flags & android.content.pm.ApplicationInfo.FLAG_SYSTEM) == 0) pk.add(ai.packageName);
                }
                pk.remove(getPackageName());
                for (String p : pk) { try { am.killBackgroundProcesses(p); } catch (Throwable ignored) { } }
                System.gc();
                android.app.ActivityManager.MemoryInfo b = new android.app.ActivityManager.MemoryInfo(); am.getMemoryInfo(b);
                return (int) Math.max(0, (b.availMem - a.availMem) / 1048576L);
            } catch (Throwable t) { return -1; }
        }

        @JavascriptInterface
        public String getMode() { return Media.prefs(MainActivity.this).getString("mode", "tv"); }

        @JavascriptInterface
        public void setMode(String m) {
            String v = "car".equals(m) ? "car" : "tv";
            if (v.equals(getMode())) return;
            Media.prefs(MainActivity.this).edit().putString("mode", v).commit();
            runOnUiThread(() -> web.loadUrl(pageUrl()));
        }

        @JavascriptInterface
        public String media() { return MediaListener.info(MainActivity.this); }

        @JavascriptInterface
        public boolean notifAllowed() {
            try {
                String l = android.provider.Settings.Secure.getString(getContentResolver(), "enabled_notification_listeners");
                return l != null && l.contains(getPackageName());
            } catch (Throwable t) { return false; }
        }

        @JavascriptInterface
        public void openNotifAccess() {
            try { startActivity(new Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); }
            catch (Throwable t) { try { startActivity(new Intent(android.provider.Settings.ACTION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); } catch (Throwable ignored) { } }
        }

        @JavascriptInterface
        public boolean hasLocation() { return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED; }

        @JavascriptInterface
        public void askLocation() {
            runOnUiThread(() -> { try { requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, 9); } catch (Throwable ignored) { } });
        }

        @JavascriptInterface
        public boolean dial(String num) {
            try {
                Intent i = new Intent(Intent.ACTION_DIAL, android.net.Uri.parse("tel:" + num)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(i); return true;
            } catch (Throwable t) { return false; }
        }

        @JavascriptInterface
        public boolean openGeo(String q) {
            try { startActivity(new Intent(Intent.ACTION_VIEW, android.net.Uri.parse(q)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); return true; }
            catch (Throwable t) { return false; }
        }

        @JavascriptInterface
        public boolean mediaCmd(String c) { return MediaListener.control(MainActivity.this, c); }

        @JavascriptInterface
        public String loc() { CarSensors.start(MainActivity.this); return CarSensors.state(); }

        @JavascriptInterface
        public void volume(int dir) {
            try {
                android.media.AudioManager am = (android.media.AudioManager) getSystemService(AUDIO_SERVICE);
                am.adjustStreamVolume(android.media.AudioManager.STREAM_MUSIC, dir > 0 ? android.media.AudioManager.ADJUST_RAISE : dir < 0 ? android.media.AudioManager.ADJUST_LOWER : android.media.AudioManager.ADJUST_TOGGLE_MUTE, android.media.AudioManager.FLAG_SHOW_UI);
            } catch (Throwable ignored) { }
        }

        @JavascriptInterface
        public boolean isTv() { return TvControls.isTv(MainActivity.this); }

        @JavascriptInterface
        public String tvInputs() { return TvControls.list(MainActivity.this); }

        @JavascriptInterface
        public boolean tvOpenInput(String id, boolean pass) { return TvControls.openInput(MainActivity.this, id, pass); }

        @JavascriptInterface
        public boolean tvPicture() { return TvControls.openPicture(MainActivity.this); }

        @JavascriptInterface
        public boolean tvSound() { return TvControls.openSound(MainActivity.this); }

        @JavascriptInterface
        public void tvSleep(int minutes) { TvControls.sleepIn(minutes); }

        @JavascriptInterface
        public double tvSleepLeft() { return TvControls.sleepLeftMs(); }

        @JavascriptInterface
        public void tvDim(int pct) { TvControls.dim(MainActivity.this, pct); }

        @JavascriptInterface
        public boolean powerMenu() { return PowerService.powerDialog(); }

        @JavascriptInterface
        public void openAccessibility() {
            try {
                Intent i = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(i);
            } catch (Throwable ignored) { }
        }

        @JavascriptInterface
        public boolean pickImage() {
            try {
                Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                i.setType("image/*");
                i.addCategory(Intent.CATEGORY_OPENABLE);
                if (i.resolveActivity(getPackageManager()) == null) {
                    Intent j = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                    j.setType("image/*");
                    j.addCategory(Intent.CATEGORY_OPENABLE);
                    if (j.resolveActivity(getPackageManager()) == null) return false;
                    i = j;
                }
                final Intent fi = i;
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        try { startActivityForResult(fi, PICK_IMAGE); }
                        catch (Throwable t) { callJs("window.onImagePicked && window.onImagePicked('')"); }
                    }
                });
                return true;
            } catch (Throwable t) {
                return false;
            }
        }

        @JavascriptInterface
        public String listSavedImages() {
            JSONArray arr = new JSONArray();
            File[] fs = new File(getFilesDir(), "mybg").listFiles();
            if (fs != null) { Arrays.sort(fs); for (File f : fs) arr.put("file://" + f.getAbsolutePath()); }
            return arr.toString();
        }

        @JavascriptInterface
        public void deleteSavedImage(String url) {
            try {
                File f = new File(url.replace("file://", ""));
                if (f.getAbsolutePath().startsWith(getFilesDir().getAbsolutePath())) f.delete();
            } catch (Throwable ignored) { }
        }

        @JavascriptInterface
        public void downloadAsync(final String url, final String name, final String cbId) {
            new Thread(new Runnable() {
                @Override
                public void run() {
                    String res = "";
                    HttpURLConnection con = null;
                    try {
                        File dir = new File(getFilesDir(), "daily");
                        dir.mkdirs();
                        File out = new File(dir, name.replaceAll("[^A-Za-z0-9_.-]", "_"));
                        if (out.exists() && out.length() > 20000) {
                            res = "file://" + out.getAbsolutePath();
                        } else {
                            con = (HttpURLConnection) new URL(url).openConnection();
                            con.setConnectTimeout(15000);
                            con.setReadTimeout(30000);
                            con.setRequestProperty("User-Agent", "CleanTV/3.0 (personal Android TV launcher)");
                            InputStream in = con.getInputStream();
                            File tmp = new File(dir, out.getName() + ".part");
                            OutputStream os = new FileOutputStream(tmp);
                            byte[] buf = new byte[65536];
                            int n;
                            while ((n = in.read(buf)) > 0) os.write(buf, 0, n);
                            os.close();
                            in.close();
                            if (tmp.length() > 20000 && tmp.renameTo(out)) res = "file://" + out.getAbsolutePath();
                            else tmp.delete();
                        }
                    } catch (Throwable ignored) {
                    } finally {
                        if (con != null) con.disconnect();
                    }
                    callJs("window.__cb(" + JSONObject.quote(cbId) + "," + JSONObject.quote(res) + ")");
                }
            }).start();
        }

        @JavascriptInterface
        public void cleanDaily(String keepPrefix) {
            File[] fs = new File(getFilesDir(), "daily").listFiles();
            if (fs == null) return;
            for (File f : fs) if (!f.getName().startsWith(keepPrefix)) f.delete();
        }

        @JavascriptInterface
        public void keepScreenOn(final boolean on) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                    else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                }
            });
        }

        @JavascriptInterface
        public void fetchAsync(final String url, final String cbId) {
            new Thread(new Runnable() {
                @Override
                public void run() {
                    String res = httpGet(url);
                    callJs("window.__cb(" + JSONObject.quote(cbId) + "," + JSONObject.quote(res) + ")");
                }
            }).start();
        }

        @JavascriptInterface
        public String httpGet(String url) {
            HttpURLConnection con = null;
            try {
                con = (HttpURLConnection) new URL(url).openConnection();
                con.setConnectTimeout(10000);
                con.setReadTimeout(15000);
                con.setRequestProperty("User-Agent", "CleanTV/3.0 (personal Android TV launcher)");
                BufferedReader r = new BufferedReader(new InputStreamReader(con.getInputStream(), StandardCharsets.UTF_8));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = r.readLine()) != null) sb.append(line);
                r.close();
                return sb.toString();
            } catch (Throwable t) {
                return "";
            } finally {
                if (con != null) con.disconnect();
            }
        }
    }
}
