package com.mafia.game;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.location.LocationManager;
import android.net.wifi.SoftApConfiguration;
import android.net.wifi.WifiConfiguration;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;

import com.mafia.game.core.Hub;
import com.mafia.game.core.Json;
import com.mafia.game.core.Server;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * خدمة أمامية تجعل هاتف الراوي «غرفة اللعب»: خادم اللعبة على المنفذ 8080 + نقطة اتصال محلية.
 * تبقى تعمل والشاشة مطفأة أو التطبيق في الخلفية، وتتوقف من الإشعار.
 */
public class HostService extends Service {
    public static final String STOP = "com.mafia.game.STOP";
    static volatile boolean running; static volatile int port;
    static volatile Map<String, Object> wifi; static volatile String hotspotError;

    private Server server; private WifiManager.LocalOnlyHotspotReservation reservation;
    private PowerManager.WakeLock wake; private WifiManager.WifiLock wifiLock;
    private final Map<String, byte[]> assetCache = new ConcurrentHashMap<>();

    @Override public IBinder onBind(Intent i) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && STOP.equals(intent.getAction())) { stopSelf(); return START_NOT_STICKY; }
        Notification n = notification();
        if (Build.VERSION.SDK_INT >= 34) startForeground(1, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        else startForeground(1, n);
        if (running) return START_STICKY;
        running = true;
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        wake = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "mafia:host"); wake.acquire();
        WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
        wifiLock = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "mafia:wifi"); wifiLock.acquire();
        new Thread(() -> {
            try {
                Hub hub = new Hub(new File(getFilesDir(), "room.json")); hub.restore();
                server = new Server(hub, this::asset, HostService::lanAddresses, () -> Json.obj("wifi", wifi, "error", hotspotError));
                port = server.start(8080, 8099);
            } catch (Exception e) { port = -1; }
        }, "mafia-start").start();
        startHotspot(wm);
        return START_STICKY;
    }

    private byte[] asset(String path) {
        byte[] c = assetCache.get(path); if (c != null) return c;
        try (InputStream in = getAssets().open("web/" + path)) {
            ByteArrayOutputStream b = new ByteArrayOutputStream(); byte[] buf = new byte[16384]; int r;
            while ((r = in.read(buf)) > 0) b.write(buf, 0, r);
            byte[] data = b.toByteArray(); assetCache.put(path, data); return data;
        } catch (Exception e) { return null; }
    }

    private void startHotspot(WifiManager wm) {
        hotspotError = null; wifi = null;
        try {
            wm.startLocalOnlyHotspot(new WifiManager.LocalOnlyHotspotCallback() {
                @Override public void onStarted(WifiManager.LocalOnlyHotspotReservation r) { reservation = r; wifi = describe(r); hotspotError = wifi == null ? "failed" : null; }
                @Override public void onStopped() { wifi = null; hotspotError = "failed"; }
                @Override public void onFailed(int reason) { wifi = null; hotspotError = reason == ERROR_INCOMPATIBLE_MODE || reason == ERROR_TETHERING_DISALLOWED ? "incompatible" : "failed"; }
            }, new Handler(Looper.getMainLooper()));
        } catch (SecurityException e) {
            LocationManager lm = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
            boolean locOn = Build.VERSION.SDK_INT >= 33 || (lm != null && lm.isLocationEnabled());
            hotspotError = locOn ? "permission" : "location";
        } catch (IllegalStateException e) { hotspotError = "incompatible"; }
    }

    @SuppressWarnings("deprecation")
    private static Map<String, Object> describe(WifiManager.LocalOnlyHotspotReservation r) {
        String ssid = null, pass = null, sec = "WPA";
        if (Build.VERSION.SDK_INT >= 30) {
            SoftApConfiguration c = r.getSoftApConfiguration(); ssid = c.getSsid(); pass = c.getPassphrase();
            int t = c.getSecurityType();
            if (t == SoftApConfiguration.SECURITY_TYPE_WPA3_SAE) sec = "SAE"; else if (t == SoftApConfiguration.SECURITY_TYPE_OPEN) sec = "nopass";
        } else {
            WifiConfiguration c = r.getWifiConfiguration(); if (c != null) { ssid = c.SSID; pass = c.preSharedKey; }
        }
        if (ssid == null) return null;
        return Json.obj("ssid", unquote(ssid), "pass", pass == null ? null : unquote(pass), "security", sec);
    }
    private static String unquote(String s) { return s.length() >= 2 && s.startsWith("\"") && s.endsWith("\"") ? s.substring(1, s.length() - 1) : s; }

    /** عناوين الهاتف على الشبكات المحلية؛ عنوان نقطة الاتصال أولاً (هو ما يوضع في باركود الغرفة) */
    static List<String> lanAddresses() {
        List<String[]> found = new ArrayList<>();
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                String name = ni.getName();
                for (InetAddress a : Collections.list(ni.getInetAddresses())) {
                    if (!(a instanceof Inet4Address) || a.isLoopbackAddress()) continue;
                    String ip = a.getHostAddress(); int score;
                    if (name.startsWith("ap") || name.startsWith("swlan") || name.startsWith("softap")) score = 0;
                    else if (name.startsWith("wlan") && ip.endsWith(".1")) score = 1;
                    else if (name.startsWith("wlan") || name.startsWith("eth")) score = 2;
                    else if (name.startsWith("rmnet") || name.startsWith("ccmni") || name.startsWith("tun") || name.startsWith("dummy")) score = 9;
                    else score = 5;
                    if (a.isSiteLocalAddress() && score > 0) score = Math.max(0, score - 0); else if (!a.isSiteLocalAddress()) score += 3;
                    found.add(new String[] { String.valueOf(score), ip });
                }
            }
        } catch (Exception ignored) { }
        Collections.sort(found, (x, y) -> Integer.parseInt(x[0]) - Integer.parseInt(y[0]));
        List<String> out = new ArrayList<>(); for (String[] f : found) out.add(f[1]);
        return out;
    }

    private Notification notification() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        nm.createNotificationChannel(new NotificationChannel("host", "غرفة اللعب", NotificationManager.IMPORTANCE_LOW));
        PendingIntent open = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE);
        PendingIntent stop = PendingIntent.getService(this, 1, new Intent(this, HostService.class).setAction(STOP), PendingIntent.FLAG_IMMUTABLE);
        return new Notification.Builder(this, "host").setSmallIcon(R.drawable.ic_app).setContentTitle("غرفة مافيا تعمل")
                .setContentText("هاتفك يستضيف اللعبة الآن — اضغط للعودة").setContentIntent(open).setOngoing(true)
                .addAction(new Notification.Action.Builder(null, "إيقاف الغرفة", stop).build()).build();
    }

    @Override
    public void onDestroy() {
        running = false; port = 0; wifi = null;
        if (server != null) server.stop();
        if (reservation != null) reservation.close();
        if (wake != null && wake.isHeld()) wake.release();
        if (wifiLock != null && wifiLock.isHeld()) wifiLock.release();
        super.onDestroy();
    }
}
