package com.cleantv.remote;

import android.app.Activity;
import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageInstaller;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/** Phone companion for «مدير الشاشات»: finds the TV on Wi-Fi and hosts the remote UI. */
public class MainActivity extends Activity {
    static final String CHANNEL = "tv_alerts";
    private static final String INSTALL_ACTION = "com.cleantv.remote.INSTALL_STATUS";
    private WebView web;
    private ValueCallback<Uri[]> fileCb;
    private NsdManager nsd;
    private NsdManager.DiscoveryListener discovery;
    private WifiManager.MulticastLock lock;

    public static SharedPreferences prefs(Context c) { return c.getSharedPreferences("remote", MODE_PRIVATE); }

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().setStatusBarColor(Color.rgb(21, 24, 27));
        getWindow().setNavigationBarColor(Color.rgb(35, 40, 45));
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(21, 24, 27));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView w, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (fileCb != null) fileCb.onReceiveValue(null);
                fileCb = cb;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                i.setType("image/*");
                i.addCategory(Intent.CATEGORY_OPENABLE);
                try { startActivityForResult(Intent.createChooser(i, "اختار صورة"), 51); }
                catch (Throwable t) { fileCb = null; return false; }
                return true;
            }
        });
        web.addJavascriptInterface(new Bridge(), "Native");
        setContentView(web);
        web.loadUrl("file:///android_asset/index.html");
        route(getIntent());
        try { com.msm.widgets.Shortcuts.publish(this, new com.cleantv.remote.wd.RemoteWidgets(), com.msm.widgets.ActActivity.class, com.msm.widgets.PickActivity.class); } catch (Throwable ignored) { }

        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "تنبيهات التلفاز", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("الأذان والمباريات ووقت مشاهدة مؤمل");
            ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(ch);
        }
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 3);
        }
        IntentFilter f = new IntentFilter(INSTALL_ACTION);
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(installReceiver, f, Context.RECEIVER_NOT_EXPORTED);
        else registerReceiver(installReceiver, f);
    }

    /** a widget or an icon shortcut asked to open a place inside the app */
    @Override
    protected void onNewIntent(Intent i) { super.onNewIntent(i); setIntent(i); route(i); }

    private void route(Intent i) {
        String r = i == null ? null : i.getStringExtra("msm_route");
        if (r == null || web == null) return;
        i.removeExtra("msm_route");
        web.evaluateJavascript("(function(){var r=" + JSONObject.quote(r) + ",n=0;function g(){try{if(window.__route&&window.__route(r)!==false)return;}catch(e){}if(++n<40)setTimeout(g,300)}g()})()", null);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.evaluateJavascript("window.onAppResume && window.onAppResume()", null);
    }

    @Override
    protected void onDestroy() {
        stopDiscovery();
        try { unregisterReceiver(installReceiver); } catch (Throwable ignored) { }
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        if (web != null) web.evaluateJavascript("(window.onBack && window.onBack()) ? 1 : 0", new ValueCallback<String>() {
            @Override
            public void onReceiveValue(String v) { if (!"1".equals(v)) moveTaskToBack(true); }
        });
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req == 51 && fileCb != null) {
            Uri[] r = null;
            if (res == RESULT_OK && data != null && data.getData() != null) r = new Uri[]{data.getData()};
            fileCb.onReceiveValue(r);
            fileCb = null;
        }
    }

    private void js(final String code) {
        runOnUiThread(new Runnable() { public void run() { if (web != null) web.evaluateJavascript(code, null); } });
    }

    // ---------------- discovery ----------------
    private void stopDiscovery() {
        try { if (nsd != null && discovery != null) nsd.stopServiceDiscovery(discovery); } catch (Throwable ignored) { }
        discovery = null;
        try { if (lock != null && lock.isHeld()) lock.release(); } catch (Throwable ignored) { }
    }

    private void startDiscovery() {
        stopDiscovery();
        try {
            WifiManager wm = (WifiManager) getApplicationContext().getSystemService(WIFI_SERVICE);
            lock = wm.createMulticastLock("cleantv");
            lock.setReferenceCounted(false);
            lock.acquire();
        } catch (Throwable ignored) { }
        nsd = (NsdManager) getSystemService(NSD_SERVICE);
        discovery = new NsdManager.DiscoveryListener() {
            public void onStartDiscoveryFailed(String t, int e) { js("window.onDiscoverError && window.onDiscoverError()"); }
            public void onStopDiscoveryFailed(String t, int e) { }
            public void onDiscoveryStarted(String t) { }
            public void onDiscoveryStopped(String t) { }
            public void onServiceLost(NsdServiceInfo s) { }
            public void onServiceFound(NsdServiceInfo s) {
                try {
                    nsd.resolveService(s, new NsdManager.ResolveListener() {
                        public void onResolveFailed(NsdServiceInfo i, int e) { }
                        public void onServiceResolved(NsdServiceInfo i) {
                            if (i.getHost() == null) return;
                            String url = "http://" + i.getHost().getHostAddress() + ":" + i.getPort();
                            js("window.onTvFound && window.onTvFound(" + JSONObject.quote(i.getServiceName()) + "," + JSONObject.quote(url) + ")");
                        }
                    });
                } catch (Throwable ignored) { }
            }
        };
        try { nsd.discoverServices("_cleantv._tcp.", NsdManager.PROTOCOL_DNS_SD, discovery); }
        catch (Throwable t) { js("window.onDiscoverError && window.onDiscoverError()"); }
    }

    // ---------------- self update ----------------
    private final BroadcastReceiver installReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context c, Intent i) {
            int st = i.getIntExtra(PackageInstaller.EXTRA_STATUS, -999);
            if (st == PackageInstaller.STATUS_PENDING_USER_ACTION) {
                Intent confirm = i.getParcelableExtra(Intent.EXTRA_INTENT);
                if (confirm != null) { confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); try { startActivity(confirm); } catch (Throwable ignored) { } }
            } else if (st != PackageInstaller.STATUS_SUCCESS) js("window.onUpdateStatus && window.onUpdateStatus('fail')");
        }
    };

    private void installApk(File apk) throws Exception {
        PackageInstaller pi = getPackageManager().getPackageInstaller();
        PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
        int id = pi.createSession(params);
        PackageInstaller.Session session = pi.openSession(id);
        InputStream in = new FileInputStream(apk);
        OutputStream out = session.openWrite("remote", 0, apk.length());
        byte[] buf = new byte[65536];
        int n;
        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        session.fsync(out);
        out.close();
        in.close();
        Intent it = new Intent(INSTALL_ACTION).setPackage(getPackageName());
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
        session.commit(PendingIntent.getBroadcast(this, 77, it, flags).getIntentSender());
        session.close();
    }

    static String httpGet(String url) {
        HttpURLConnection con = null;
        try {
            con = (HttpURLConnection) new URL(url).openConnection();
            con.setConnectTimeout(10000);
            con.setReadTimeout(20000);
            con.setRequestProperty("User-Agent", "MoamalRemote/1.0");
            InputStream in = con.getInputStream();
            java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream();
            byte[] buf = new byte[16384];
            int n;
            while ((n = in.read(buf)) > 0) bo.write(buf, 0, n);
            in.close();
            return bo.toString("UTF-8");
        } catch (Throwable t) {
            return "";
        } finally {
            if (con != null) con.disconnect();
        }
    }

    // ---------------- bridge ----------------
    public class Bridge {
        /** the page tells us which TV it is paired with, so the home-screen widgets can drive it without opening the app */
        @JavascriptInterface public void saveLink(String base, String token, String name) {
            prefs(MainActivity.this).edit().putString("tvBase", base == null ? "" : base).putString("tvToken", token == null ? "" : token).putString("tvName", name == null ? "" : name).apply();
        }
        @JavascriptInterface public void discover() { runOnUiThread(new Runnable() { public void run() { startDiscovery(); } }); }
        @JavascriptInterface public void stopDiscover() { runOnUiThread(new Runnable() { public void run() { stopDiscovery(); } }); }

        @JavascriptInterface
        public void vibrate(int ms) {
            try {
                Vibrator v = (Vibrator) getSystemService(VIBRATOR_SERVICE);
                if (v != null) v.vibrate(VibrationEffect.createOneShot(Math.max(5, ms), VibrationEffect.DEFAULT_AMPLITUDE));
            } catch (Throwable ignored) { }
        }

        @JavascriptInterface
        public int version() {
            try { return (int) getPackageManager().getPackageInfo(getPackageName(), 0).getLongVersionCode(); } catch (Throwable t) { return 0; }
        }

        /** Schedules phone notifications from the TV's upcoming alerts. */
        @JavascriptInterface
        public void scheduleAlerts(String json) { AlertReceiver.schedule(MainActivity.this, json); }

        @JavascriptInterface
        public void checkUpdate(final String cbId) {
            new Thread(new Runnable() {
                public void run() {
                    String res = httpGet("https://api.github.com/repos/hnt45y-111/clean-tv/releases?per_page=30");
                    js("window.__cb && window.__cb(" + JSONObject.quote(cbId) + "," + JSONObject.quote(res) + ")");
                }
            }).start();
        }

        @JavascriptInterface
        public void installUpdate(final String url) {
            new Thread(new Runnable() {
                public void run() {
                    try {
                        File out = new File(getCacheDir(), "update.apk");
                        HttpURLConnection con = (HttpURLConnection) new URL(url).openConnection();
                        con.setInstanceFollowRedirects(true);
                        con.setConnectTimeout(15000);
                        con.setReadTimeout(60000);
                        InputStream in = con.getInputStream();
                        OutputStream os = new FileOutputStream(out);
                        byte[] buf = new byte[65536];
                        int n;
                        while ((n = in.read(buf)) > 0) os.write(buf, 0, n);
                        os.close();
                        in.close();
                        con.disconnect();
                        if (Build.VERSION.SDK_INT >= 26 && !getPackageManager().canRequestPackageInstalls()) {
                            js("window.onUpdateStatus && window.onUpdateStatus('permission')");
                            Intent i = new Intent(android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getPackageName()));
                            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            startActivity(i);
                            return;
                        }
                        installApk(out);
                    } catch (Throwable t) {
                        js("window.onUpdateStatus && window.onUpdateStatus('fail')");
                    }
                }
            }).start();
        }
    }
}
