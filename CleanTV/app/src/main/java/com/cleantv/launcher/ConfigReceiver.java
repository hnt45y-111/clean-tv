package com.cleantv.launcher;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Base64;

import org.json.JSONObject;

import java.nio.charset.StandardCharsets;

/**
 * Lets the phone app (over ADB shell, which holds DUMP) read and replace the launcher's look.
 * GET_CONFIG answers with base64 JSON; SET_CONFIG arrives in parts and is applied when complete.
 * PUT_FILE / STAT_FILE carry photos into the launcher's own storage.
 */
public class ConfigReceiver extends BroadcastReceiver {
    static java.io.File bgDir(Context c) { java.io.File d = new java.io.File(c.getFilesDir(), "bg"); d.mkdirs(); return d; }
    /** The app's own wallpaper folder: photos sent from the phone live here and are a wallpaper source («صوري»). */
    static java.io.File wallDir(Context c) { java.io.File d = new java.io.File(c.getFilesDir(), "mybg"); d.mkdirs(); return d; }
    static boolean copy(java.io.File a, java.io.File b) {
        try (java.io.InputStream in = new java.io.FileInputStream(a); java.io.OutputStream o = new java.io.FileOutputStream(b)) {
            byte[] buf = new byte[65536]; int n; while ((n = in.read(buf)) > 0) o.write(buf, 0, n); a.delete(); return true;
        } catch (Throwable t) { return false; }
    }
    static String safe(String n) { return n == null ? "x.jpg" : n.replaceAll("[^\\w.-]", "_"); }

    /** Photos from the phone app: PUT_FILE arrives in base64 parts, STAT_FILE answers "size|path". */
    private void files(Context c, Intent i, String a) {
        java.io.File f = new java.io.File(bgDir(c), safe(i.getStringExtra("name")));
        if ("com.cleantv.STAT_FILE".equals(a)) {
            setResultCode(1);
            setResultData((f.exists() ? f.length() : -1) + "|" + f.getAbsolutePath());
            return;
        }
        int idx = i.getIntExtra("i", 0);
        String part = i.getStringExtra("part");
        if (part == null) { setResultCode(0); return; }
        try (java.io.FileOutputStream o = new java.io.FileOutputStream(f, idx > 0)) {
            o.write(Base64.decode(part, Base64.URL_SAFE | Base64.NO_WRAP));
            setResultCode(1);
        } catch (Throwable t) { setResultCode(2); }
    }

    /** Park a new look and reload the page so it applies (right now if open, or when the launcher next opens). */
    static void apply(Context c, String json) {
        Media.prefs(c).edit().putString("pendingCfg", json).commit();
        MainActivity.reloadForConfig();
    }

    @Override
    public void onReceive(Context c, Intent i) {
        SharedPreferences p = Media.prefs(c);
        String a = i.getAction();
        if ("com.cleantv.GET_CONFIG".equals(a)) {
            String cfg = p.getString("cfgJson", "{}");
            setResultCode(1);
            setResultData(Base64.encodeToString(cfg.getBytes(StandardCharsets.UTF_8), Base64.NO_WRAP));
            return;
        }
        if ("com.cleantv.PUT_FILE".equals(a) || "com.cleantv.STAT_FILE".equals(a)) { files(c, i, a); return; }
        if ("com.cleantv.WALLPAPER".equals(a)) {
            // a photo the phone sent over ADB: move it into the wallpaper folder (mybg) and show it now
            java.io.File src = new java.io.File(bgDir(c), safe(i.getStringExtra("name")));
            java.io.File dir = wallDir(c), dst = new java.io.File(dir, "phone_" + System.currentTimeMillis() + ".jpg");
            boolean ok = src.exists() && (src.renameTo(dst) || copy(src, dst));
            setResultCode(ok ? 1 : 2);
            if (ok) {
                String js = "window.remoteCmd && window.remoteCmd({type:'image',pin:" + i.getBooleanExtra("pin", true) + ",path:" + JSONObject.quote("file://" + dst.getAbsolutePath()) + "})";
                if (MainActivity.foreground) MainActivity.js(js);
                else Media.prefs(c).edit().putString("pendingWall", "file://" + dst.getAbsolutePath()).apply();
            }
            return;
        }
        if (!"com.cleantv.SET_CONFIG".equals(a)) return;
        int idx = i.getIntExtra("i", 0), n = i.getIntExtra("n", 1);
        String part = i.getStringExtra("part");
        if (part == null) { setResultCode(0); return; }
        p.edit().putString("cfgPart" + idx, part).commit();
        setResultCode(1);
        if (idx != n - 1) return;
        StringBuilder sb = new StringBuilder();
        for (int k = 0; k < n; k++) sb.append(p.getString("cfgPart" + k, ""));
        SharedPreferences.Editor e = p.edit();
        for (int k = 0; k < n; k++) e.remove("cfgPart" + k);
        try {
            String json = new String(Base64.decode(sb.toString(), Base64.URL_SAFE | Base64.NO_WRAP), StandardCharsets.UTF_8);
            new JSONObject(json);
            e.commit();
            apply(c, json);
        } catch (Throwable t) {
            e.commit();
            setResultCode(2);
        }
    }
}
