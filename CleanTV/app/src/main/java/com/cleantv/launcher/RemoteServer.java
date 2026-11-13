package com.cleantv.launcher;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;

import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Collections;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/** Tiny HTTP server on the home network so the phone app (or a browser) can control the TV. */
public class RemoteServer extends Thread {
    static final int PORT = 8686;
    static volatile String state = "{}";
    private static RemoteServer running;
    private static String pairCode = "";
    private static long pairUntil = 0;

    private final Context ctx;
    private ServerSocket server;

    private RemoteServer(Context c) {
        super("CleanTV-remote");
        ctx = c.getApplicationContext();
        setDaemon(true);
    }

    static synchronized void start(Context c) {
        if (running != null) return;
        running = new RemoteServer(c);
        running.start();
        CastServer.start(c);
    }

    static String ip() {
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                for (InetAddress a : Collections.list(ni.getInetAddresses())) {
                    if (a instanceof Inet4Address && !a.isLoopbackAddress()) return a.getHostAddress();
                }
            }
        } catch (Throwable ignored) { }
        return "";
    }

    static String url() { String i = ip(); return i.length() > 0 ? "http://" + i + ":" + PORT : ""; }

    /** Shows a fresh pairing code on the TV for three minutes. */
    static synchronized String startPairing() {
        pairCode = String.valueOf(100000 + new SecureRandom().nextInt(900000));
        pairUntil = System.currentTimeMillis() + 3 * 60000L;
        final String js = "window.showPair && window.showPair(" + JSONObject.quote(pairCode) + "," + JSONObject.quote(url()) + ")";
        if (MainActivity.foreground) MainActivity.js(js);
        else {
            Context c = running != null ? running.ctx : null;
            if (c != null) {
                try { c.startActivity(new android.content.Intent(c, MainActivity.class).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK | android.content.Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)); } catch (Throwable ignored) { }
                if (Overlay.allowed(c)) Overlay.showBanner(c, "رمز ربط الموبايل: " + pairCode, "اكتبه بتطبيق مدير الشاشة", 60000);
            }
            new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> MainActivity.js(js), 1600);
        }
        return pairCode;
    }

    private SharedPreferences prefs() { return Media.prefs(ctx); }

    private boolean tokenOk(String t) {
        if (t == null || t.length() < 16) return false;
        String all = prefs().getString("remoteTokens", "");
        for (String s : all.split(",")) if (s.equals(t)) return true;
        return false;
    }

    private String newToken() {
        byte[] b = new byte[16];
        new SecureRandom().nextBytes(b);
        StringBuilder sb = new StringBuilder();
        for (byte x : b) sb.append(String.format(Locale.US, "%02x", x));
        String t = sb.toString();
        String all = prefs().getString("remoteTokens", "");
        String[] parts = all.length() == 0 ? new String[0] : all.split(",");
        StringBuilder keep = new StringBuilder();
        int start = Math.max(0, parts.length - 7); // keep the last few paired devices
        for (int i = start; i < parts.length; i++) keep.append(parts[i]).append(",");
        keep.append(t);
        prefs().edit().putString("remoteTokens", keep.toString()).apply();
        return t;
    }

    private void register() {
        try {
            NsdServiceInfo info = new NsdServiceInfo();
            info.setServiceName("مدير الشاشات");
            info.setServiceType("_cleantv._tcp.");
            info.setPort(PORT);
            NsdManager nsd = (NsdManager) ctx.getSystemService(Context.NSD_SERVICE);
            nsd.registerService(info, NsdManager.PROTOCOL_DNS_SD, new NsdManager.RegistrationListener() {
                public void onRegistrationFailed(NsdServiceInfo s, int e) { }
                public void onUnregistrationFailed(NsdServiceInfo s, int e) { }
                public void onServiceRegistered(NsdServiceInfo s) { }
                public void onServiceUnregistered(NsdServiceInfo s) { }
            });
        } catch (Throwable ignored) { }
    }

    @Override
    public void run() {
        try {
            server = new ServerSocket(PORT);
            register();
            while (!isInterrupted()) {
                final Socket s = server.accept();
                new Thread(new Runnable() { public void run() { handle(s); } }).start();
            }
        } catch (Throwable ignored) {
            running = null;
        }
    }

    // ---------------- HTTP ----------------
    private static String readLine(InputStream in) throws Exception {
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        int c;
        while ((c = in.read()) != -1) {
            if (c == '\n') break;
            if (c != '\r') b.write(c);
            if (b.size() > 8192) break;
        }
        return b.toString("UTF-8");
    }

    private void handle(Socket s) {
        try {
            s.setSoTimeout(20000);
            InputStream in = new BufferedInputStream(s.getInputStream());
            OutputStream out = s.getOutputStream();
            // Browsers often try HTTPS first: drop TLS handshakes at once so they fall back to plain http quickly
            in.mark(4);
            int first = in.read();
            if (first == 0x16 || first == -1) { s.close(); return; }
            in.reset();
            String line = readLine(in);
            if (line == null || line.length() == 0) { s.close(); return; }
            String[] parts = line.split(" ");
            String method = parts[0], target = parts.length > 1 ? parts[1] : "/";
            Map<String, String> h = new HashMap<>();
            String l;
            while ((l = readLine(in)).length() > 0) {
                int k = l.indexOf(':');
                if (k > 0) h.put(l.substring(0, k).trim().toLowerCase(Locale.US), l.substring(k + 1).trim());
            }
            int len = 0;
            try { len = Integer.parseInt(h.containsKey("content-length") ? h.get("content-length") : "0"); } catch (Throwable ignored) { }
            if (len > 20 * 1024 * 1024) { send(out, 413, "application/json", "{\"error\":\"too big\"}".getBytes(StandardCharsets.UTF_8)); s.close(); return; }
            byte[] body = new byte[Math.max(0, len)];
            int off = 0;
            while (off < len) { int n = in.read(body, off, len - off); if (n < 0) break; off += n; }

            String path = target, query = "";
            int q = target.indexOf('?');
            if (q >= 0) { path = target.substring(0, q); query = target.substring(q + 1); }
            Map<String, String> qs = parseQuery(query);
            String token = h.containsKey("x-token") ? h.get("x-token") : qs.get("t");

            if ("OPTIONS".equals(method)) { send(out, 204, "text/plain", new byte[0]); s.close(); return; }
            byte[] res;
            int code = 200;
            String type = "application/json; charset=utf-8";

            if (path.startsWith("/api/")) {
                String api = path.substring(5);
                boolean authed = tokenOk(token);
                if (api.equals("info")) {
                    JSONObject o = new JSONObject();
                    o.put("name", "مدير الشاشات");
                    o.put("app", "cleantv");
                    o.put("paired", authed);
                    res = o.toString().getBytes(StandardCharsets.UTF_8);
                } else if (api.equals("pair/start")) {
                    startPairing();
                    res = "{\"ok\":true}".getBytes(StandardCharsets.UTF_8);
                } else if (api.equals("pair")) {
                    JSONObject b = json(body);
                    String c = b.optString("code");
                    if (pairCode.length() > 0 && c.equals(pairCode) && System.currentTimeMillis() < pairUntil) {
                        pairCode = "";
                        String t = newToken();
                        MainActivity.js("window.hidePair && window.hidePair(); window.remoteCmd && window.remoteCmd({type:'paired'})");
                        res = new JSONObject().put("token", t).toString().getBytes(StandardCharsets.UTF_8);
                    } else { code = 403; res = "{\"error\":\"wrong code\"}".getBytes(StandardCharsets.UTF_8); }
                } else if (!authed) {
                    code = 401; res = "{\"error\":\"pair first\"}".getBytes(StandardCharsets.UTF_8);
                } else {
                    res = api(api, body, qs);
                    if (res == null) { code = 404; res = "{\"error\":\"unknown\"}".getBytes(StandardCharsets.UTF_8); }
                }
            } else {
                // static files for the browser remote page
                String p = path.equals("/") ? "remote/index.html" : path.substring(1);
                if (p.contains("..")) p = "remote/index.html";
                if (!p.startsWith("remote/") && !p.startsWith("fonts/")) p = "remote/" + p;
                try {
                    InputStream a = ctx.getAssets().open(p);
                    ByteArrayOutputStream bo = new ByteArrayOutputStream();
                    byte[] buf = new byte[16384];
                    int n;
                    while ((n = a.read(buf)) > 0) bo.write(buf, 0, n);
                    a.close();
                    res = bo.toByteArray();
                    type = mime(p);
                } catch (Throwable t) { code = 404; res = "not found".getBytes(StandardCharsets.UTF_8); type = "text/plain"; }
            }
            send(out, code, type, res);
            s.close();
        } catch (Throwable t) {
            try { s.close(); } catch (Throwable ignored) { }
        }
    }

    private byte[] api(String api, byte[] body, Map<String, String> qs) throws Exception {
        JSONObject b = json(body);
        PowerService.lastInput = System.currentTimeMillis();
        switch (api) {
            case "state":
                return state.getBytes(StandardCharsets.UTF_8);
            case "apps": {
                String a = MainActivity.appsJson();
                return (a == null ? "[]" : a).getBytes(StandardCharsets.UTF_8);
            }
            case "info2": {
                JSONObject o = new JSONObject();
                o.put("brand", android.os.Build.BRAND).put("model", android.os.Build.MODEL).put("android", android.os.Build.VERSION.RELEASE)
                        .put("sdk", android.os.Build.VERSION.SDK_INT).put("isTv", TvControls.isTv(ctx)).put("mode", prefs().getString("mode", "tv"))
                        .put("a11y", PowerService.instance != null).put("overlay", Overlay.allowed(ctx)).put("fg", PowerService.foregroundPkg)
                        .put("launcherFg", MainActivity.foreground);
                try { o.put("version", ctx.getPackageManager().getPackageInfo(ctx.getPackageName(), 0).versionCode); } catch (Throwable ignored) { }
                return o.toString().getBytes(StandardCharsets.UTF_8);
            }
            case "health": {
                // the phone's «فحص الشاشة» over Wi-Fi: the same numbers it reads over ADB
                JSONObject o = new JSONObject();
                StringBuilder mem = new StringBuilder();
                try {
                    android.app.ActivityManager am = (android.app.ActivityManager) ctx.getSystemService(Context.ACTIVITY_SERVICE);
                    android.app.ActivityManager.MemoryInfo mi = new android.app.ActivityManager.MemoryInfo(); am.getMemoryInfo(mi);
                    mem.append("MemTotal: ").append(mi.totalMem / 1024).append(" kB\nMemAvailable: ").append(mi.availMem / 1024).append(" kB\n");
                    o.put("procs", String.valueOf(am.getRunningAppProcesses() == null ? 0 : am.getRunningAppProcesses().size()));
                } catch (Throwable ignored) { }
                o.put("mem", mem.toString());
                StringBuilder tp = new StringBuilder();
                for (int i = 0; i < 6; i++) {
                    try (java.io.BufferedReader r = new java.io.BufferedReader(new java.io.FileReader("/sys/class/thermal/thermal_zone" + i + "/temp"))) { String l = r.readLine(); if (l != null) tp.append(l.trim()).append('\n'); } catch (Throwable ignored) { }
                }
                o.put("temps", tp.toString());
                o.put("uptime", String.valueOf(android.os.SystemClock.elapsedRealtime() / 1000.0));
                try {
                    android.net.wifi.WifiManager wm = (android.net.wifi.WifiManager) ctx.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
                    o.put("rssi", "rssi=" + wm.getConnectionInfo().getRssi());
                } catch (Throwable t) { o.put("rssi", ""); }
                try {
                    android.os.StatFs sf = new android.os.StatFs(android.os.Environment.getDataDirectory().getPath());
                    long tot = sf.getBlockCountLong() * sf.getBlockSizeLong() / 1024, free = sf.getAvailableBlocksLong() * sf.getBlockSizeLong() / 1024;
                    o.put("df", "/data " + tot + " " + (tot - free) + " " + free);
                } catch (Throwable t) { o.put("df", ""); }
                o.put("abi", android.os.Build.SUPPORTED_ABIS.length > 0 ? android.os.Build.SUPPORTED_ABIS[0] : "");
                return o.toString().getBytes(StandardCharsets.UTF_8);
            }
            case "config/get":
                return prefs().getString("cfgJson", "{}").getBytes(StandardCharsets.UTF_8);
            case "config/set": {
                String j = new String(body, StandardCharsets.UTF_8);
                new JSONObject(j);
                ConfigReceiver.apply(ctx, j);
                if (!MainActivity.foreground) try { ctx.startActivity(new android.content.Intent(ctx, MainActivity.class).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK | android.content.Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)); } catch (Throwable ignored) { }
                return "{\"ok\":true}".getBytes(StandardCharsets.UTF_8);
            }
            case "file": {
                File f = new File(ConfigReceiver.bgDir(ctx), ConfigReceiver.safe(qs.get("name")));
                try (FileOutputStream fo = new FileOutputStream(f)) { fo.write(body); }
                return new JSONObject().put("ok", true).put("path", f.getAbsolutePath()).toString().getBytes(StandardCharsets.UTF_8);
            }
            case "send": {
                String name = qs.containsKey("name") ? qs.get("name") : "file.bin", mime = qs.get("mime");
                JSONObject r = DeviceTools.saveDownload(ctx, name, body, mime);
                if ("1".equals(qs.get("open"))) r.put("opened", DeviceTools.openUri(ctx, r.optString("uri"), mime));
                return r.put("ok", true).toString().getBytes(StandardCharsets.UTF_8);
            }
            case "install": {
                File f = new File(ctx.getCacheDir(), "phone.apk");
                try (FileOutputStream fo = new FileOutputStream(f)) { fo.write(body); }
                boolean ok = MainActivity.installFromPhone(f);
                return ("{\"ok\":" + ok + "}").getBytes(StandardCharsets.UTF_8);
            }
            case "view":
                return ("{\"ok\":" + DeviceTools.openUri(ctx, b.optString("uri"), b.optString("mime")) + "}").getBytes(StandardCharsets.UTF_8);
            case "cast/show":
                try { ctx.startActivity(new android.content.Intent(ctx, CastActivity.class).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)); } catch (Throwable t) { return "{\"ok\":false}".getBytes(StandardCharsets.UTF_8); }
                return "{\"ok\":true}".getBytes(StandardCharsets.UTF_8);
            case "media":
                return MediaListener.info(ctx).getBytes(StandardCharsets.UTF_8);
            case "notify": {
                String title = b.optString("title"), text = b.optString("text"), app = b.optString("app");
                String head = app.length() > 0 ? app + " · " + title : title;
                if (Overlay.allowed(ctx)) Overlay.showBanner(ctx, head, text, 8000);
                else MainActivity.js("window.toastMsg && window.toastMsg(" + JSONObject.quote(head + (text.length() > 0 ? ": " + text : "")) + ")");
                return "{\"ok\":true}".getBytes(StandardCharsets.UTF_8);
            }
            case "usage":
                return ("{\"usage\":" + DeviceTools.usage(ctx) + ",\"apps\":" + (MainActivity.appsJson() == null ? "[]" : MainActivity.appsJson()) + "}").getBytes(StandardCharsets.UTF_8);
            case "open": {
                String w = b.optString("what");
                String act = "wifi".equals(w) ? android.provider.Settings.ACTION_WIFI_SETTINGS : "a11y".equals(w) ? android.provider.Settings.ACTION_ACCESSIBILITY_SETTINGS
                        : "overlay".equals(w) && android.os.Build.VERSION.SDK_INT >= 23 ? android.provider.Settings.ACTION_MANAGE_OVERLAY_PERMISSION : android.provider.Settings.ACTION_SETTINGS;
                try {
                    android.content.Intent i = new android.content.Intent(act).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
                    if ("overlay".equals(w)) i.setData(android.net.Uri.parse("package:" + ctx.getPackageName()));
                    ctx.startActivity(i);
                } catch (Throwable t) { return "{\"ok\":false}".getBytes(StandardCharsets.UTF_8); }
                return "{\"ok\":true}".getBytes(StandardCharsets.UTF_8);
            }
            case "key": {
                String k = b.optString("k");
                android.media.AudioManager am = (android.media.AudioManager) ctx.getSystemService(Context.AUDIO_SERVICE);
                if ("vup".equals(k) || "vdn".equals(k) || "mute".equals(k)) {
                    am.adjustStreamVolume(android.media.AudioManager.STREAM_MUSIC, "vup".equals(k) ? android.media.AudioManager.ADJUST_RAISE : "vdn".equals(k) ? android.media.AudioManager.ADJUST_LOWER : android.media.AudioManager.ADJUST_TOGGLE_MUTE, android.media.AudioManager.FLAG_SHOW_UI);
                    return "{\"ok\":true}".getBytes(StandardCharsets.UTF_8);
                }
                if ("play".equals(k) || "next".equals(k) || "prev".equals(k) || "stop".equals(k)) {
                    boolean ok = MediaListener.control(ctx, "play".equals(k) ? "toggle" : k);
                    return ("{\"ok\":" + ok + "}").getBytes(StandardCharsets.UTF_8);
                }
                if ("settings".equals(k)) { try { ctx.startActivity(new android.content.Intent(android.provider.Settings.ACTION_SETTINGS).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)); } catch (Throwable ignored) { } return "{\"ok\":true}".getBytes(StandardCharsets.UTF_8); }
                if ("power".equals(k)) return ("{\"ok\":" + PowerService.powerDialog() + "}").getBytes(StandardCharsets.UTF_8);
                if ("home".equals(k) && PowerService.instance == null) {
                    try { ctx.startActivity(new android.content.Intent(ctx, MainActivity.class).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK | android.content.Intent.FLAG_ACTIVITY_CLEAR_TOP)); } catch (Throwable ignored) { }
                    return "{\"ok\":true}".getBytes(StandardCharsets.UTF_8);
                }
                boolean ok = MainActivity.foreground ? false : PowerService.key(k);
                if (!ok && MainActivity.foreground) {
                    String map = "{\"up\":\"ArrowUp\",\"down\":\"ArrowDown\",\"left\":\"ArrowLeft\",\"right\":\"ArrowRight\",\"ok\":\"ok\",\"back\":\"back\"}";
                    String name = new JSONObject(map).optString(k, "");
                    if (name.length() > 0) { MainActivity.js("window.remoteKey && window.remoteKey(" + JSONObject.quote(name) + ")"); ok = true; }
                    else if ("home".equals(k)) { MainActivity.js("window.onHomePressed && window.onHomePressed()"); ok = true; }
                }
                if (!ok) ok = PowerService.key(k);
                return ("{\"ok\":" + ok + "}").getBytes(StandardCharsets.UTF_8);
            }
            case "text": {
                String t = b.optString("text");
                boolean submit = b.optBoolean("submit", true);
                boolean ok;
                if (MainActivity.foreground) {
                    MainActivity.js("window.remoteCmd && window.remoteCmd({type:'search',value:" + JSONObject.quote(t) + "})");
                    ok = true;
                } else ok = PowerService.setText(t, submit);
                return ("{\"ok\":" + ok + "}").getBytes(StandardCharsets.UTF_8);
            }
            case "launch": {
                boolean ok = MainActivity.launchPkg(b.optString("pkg"));
                return ("{\"ok\":" + ok + "}").getBytes(StandardCharsets.UTF_8);
            }
            case "upload": {
                if (body.length < 1000) return "{\"ok\":false}".getBytes(StandardCharsets.UTF_8);
                File dir = new File(ctx.getFilesDir(), "mybg");
                dir.mkdirs();
                File f = new File(dir, "phone_" + System.currentTimeMillis() + ".jpg");
                FileOutputStream fo = new FileOutputStream(f);
                fo.write(body);
                fo.close();
                boolean pin = "1".equals(qs.get("pin"));
                MainActivity.js("window.remoteCmd && window.remoteCmd({type:'image',pin:" + pin + ",path:" + JSONObject.quote("file://" + f.getAbsolutePath()) + "})");
                return "{\"ok\":true}".getBytes(StandardCharsets.UTF_8);
            }
            case "wall/from": {
                // a photo sent as a file (it landed in Downloads): copy it into the wallpaper folder and show it
                boolean ok = false; String path = "";
                try {
                    File f = new File(ConfigReceiver.wallDir(ctx), "phone_" + System.currentTimeMillis() + ".jpg");
                    String u = b.optString("uri");
                    try (InputStream in = u.startsWith("content:") ? ctx.getContentResolver().openInputStream(android.net.Uri.parse(u)) : new java.io.FileInputStream(u.replace("file://", ""));
                         FileOutputStream fo = new FileOutputStream(f)) {
                        byte[] buf = new byte[65536]; int n; while ((n = in.read(buf)) > 0) fo.write(buf, 0, n);
                    }
                    ok = f.length() > 1000; path = "file://" + f.getAbsolutePath();
                    if (ok && MainActivity.foreground) MainActivity.js("window.remoteCmd && window.remoteCmd({type:'image',pin:true,path:" + JSONObject.quote(path) + "})");
                    else if (ok) prefs().edit().putString("pendingWall", path).apply();
                    else f.delete();
                } catch (Throwable ignored) { }
                return new JSONObject().put("ok", ok).put("path", path).toString().getBytes(StandardCharsets.UTF_8);
            }
            case "assist": {
                // voice search from the phone: hand the words to Google Assistant / Google search on this screen
                String q = b.optString("q");
                String[] acts = { "android.search.action.GLOBAL_SEARCH", android.content.Intent.ACTION_WEB_SEARCH };
                boolean ok = false;
                for (String act : acts) {
                    if (ok) break;
                    try {
                        android.content.Intent it = new android.content.Intent(act).putExtra(android.app.SearchManager.QUERY, q)
                                .addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK | android.content.Intent.FLAG_ACTIVITY_CLEAR_TOP);
                        ctx.startActivity(it); ok = true;
                    } catch (Throwable ignored) { }
                }
                if (!ok && MainActivity.foreground) { MainActivity.js("window.remoteCmd && window.remoteCmd({type:'search',value:" + JSONObject.quote(q) + "})"); ok = true; }
                return ("{\"ok\":" + ok + "}").getBytes(StandardCharsets.UTF_8);
            }
            case "adhan/stop":
                Media.stopAdhan(ctx);
                return "{\"ok\":true}".getBytes(StandardCharsets.UTF_8);
            case "cmd": {
                String t = b.optString("type");
                String allowed = ",theme,bgSources,bgInterval,bgNext,surah,quran,clickSound,saverApps,update,toast,";
                if (!allowed.contains("," + t + ",")) return null;
                MainActivity.js("window.remoteCmd && window.remoteCmd(" + b.toString() + ")");
                return "{\"ok\":true}".getBytes(StandardCharsets.UTF_8);
            }
            default:
                return null;
        }
    }

    private static JSONObject json(byte[] body) {
        try { return new JSONObject(new String(body, StandardCharsets.UTF_8)); } catch (Throwable t) { return new JSONObject(); }
    }

    private static Map<String, String> parseQuery(String q) {
        Map<String, String> m = new HashMap<>();
        if (q == null || q.length() == 0) return m;
        for (String p : q.split("&")) {
            int i = p.indexOf('=');
            try {
                if (i > 0) m.put(URLDecoder.decode(p.substring(0, i), "UTF-8"), URLDecoder.decode(p.substring(i + 1), "UTF-8"));
            } catch (Throwable ignored) { }
        }
        return m;
    }

    private static String mime(String p) {
        String l = p.toLowerCase(Locale.US);
        if (l.endsWith(".html")) return "text/html; charset=utf-8";
        if (l.endsWith(".js")) return "application/javascript; charset=utf-8";
        if (l.endsWith(".css")) return "text/css; charset=utf-8";
        if (l.endsWith(".ttf")) return "font/ttf";
        if (l.endsWith(".png")) return "image/png";
        if (l.endsWith(".svg")) return "image/svg+xml";
        if (l.endsWith(".json")) return "application/json";
        return "application/octet-stream";
    }

    private static void send(OutputStream out, int code, String type, byte[] body) throws Exception {
        String status = code == 200 ? "OK" : code == 204 ? "No Content" : code == 401 ? "Unauthorized" : code == 403 ? "Forbidden" : code == 404 ? "Not Found" : "Error";
        String head = "HTTP/1.1 " + code + " " + status + "\r\n"
                + "Content-Type: " + type + "\r\n"
                + "Content-Length: " + body.length + "\r\n"
                + "Access-Control-Allow-Origin: *\r\n"
                + "Access-Control-Allow-Headers: Content-Type, X-Token\r\n"
                + "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n"
                + "Cache-Control: no-store\r\n"
                + "Connection: close\r\n\r\n";
        out.write(head.getBytes(StandardCharsets.UTF_8));
        out.write(body);
        out.flush();
    }
}
