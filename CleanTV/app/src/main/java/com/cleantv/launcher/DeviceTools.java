package com.cleantv.launcher;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.PowerManager;
import android.provider.MediaStore;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Locale;
import java.util.Map;
import java.util.TimeZone;

/** Usage report, app lock, the daily sleep / wake schedule, and files sent from the phone. */
final class DeviceTools {
    private DeviceTools() { }

    // ---------------------------------------------------------------- usage (minutes per app per day)
    private static String curPkg = "";
    private static long curSince = 0;

    static String today() {
        SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        f.setTimeZone(TimeZone.getTimeZone("Asia/Baghdad"));
        return f.format(new Date());
    }

    /** Called when the app on screen changes, and every few seconds while it stays. */
    static synchronized void usageTick(Context c, String pkg) {
        long now = System.currentTimeMillis();
        PowerManager pm = (PowerManager) c.getSystemService(Context.POWER_SERVICE);
        boolean on = pm == null || pm.isInteractive();
        if (curSince > 0 && curPkg.length() > 0 && on && !SaverActivity.showing) {
            long d = Math.min(now - curSince, 5 * 60000L);
            if (d > 0) add(c, curPkg, d);
        }
        if (pkg != null && pkg.length() > 0) curPkg = pkg;
        curSince = now;
    }

    private static void add(Context c, String pkg, long ms) {
        SharedPreferences p = Media.prefs(c);
        try {
            JSONObject all = new JSONObject(p.getString("usage", "{}"));
            String d = today();
            JSONObject day = all.optJSONObject(d);
            if (day == null) day = new JSONObject();
            day.put(pkg, day.optLong(pkg, 0) + ms);
            all.put(d, day);
            // keep two weeks
            if (all.length() > 15) {
                String oldest = null;
                for (Iterator<String> it = all.keys(); it.hasNext(); ) { String k = it.next(); if (oldest == null || k.compareTo(oldest) < 0) oldest = k; }
                if (oldest != null) all.remove(oldest);
            }
            p.edit().putString("usage", all.toString()).apply();
        } catch (Throwable ignored) { }
    }

    static String usage(Context c) { return Media.prefs(c).getString("usage", "{}"); }

    // ---------------------------------------------------------------- app lock
    private static final Map<String, Long> unlocked = new HashMap<>();

    static boolean isLocked(Context c, String pkg) {
        if (pkg == null || pkg.length() == 0 || pkg.equals(c.getPackageName())) return false;
        String list = "," + Media.prefs(c).getString("lockPkgs", "") + ",";
        if (!list.contains("," + pkg + ",")) return false;
        Long u = unlocked.get(pkg);
        return u == null || u < System.currentTimeMillis();
    }

    static void unlock(String pkg, int minutes) { unlocked.put(pkg, System.currentTimeMillis() + minutes * 60000L); }

    /** An app on the lock list came to the front: cover it with the launcher's PIN prompt. */
    static void guard(Context c, String pkg) {
        if (!isLocked(c, pkg) || MainActivity.foreground) return;
        try {
            Intent i = new Intent(c, MainActivity.class);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
            i.putExtra("lockPkg", pkg);
            c.startActivity(i);
        } catch (Throwable ignored) { }
    }

    // ---------------------------------------------------------------- daily sleep / wake
    static final int REQ_SLEEP = 8801, REQ_WAKE = 8802;

    /** "HH:MM" or "" to cancel. */
    static void schedule(Context c, String kind, String hhmm) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        Intent it = new Intent(c, AlertReceiver.class).setAction(AlertReceiver.ACTION).putExtra("type", kind);
        PendingIntent pi = PendingIntent.getBroadcast(c, "wake".equals(kind) ? REQ_WAKE : REQ_SLEEP, it, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        am.cancel(pi);
        Media.prefs(c).edit().putString("sched_" + kind, hhmm == null ? "" : hhmm).apply();
        if (hhmm == null || !hhmm.matches("\\d{1,2}:\\d{2}")) return;
        String[] p = hhmm.split(":");
        Calendar cal = Calendar.getInstance(TimeZone.getTimeZone("Asia/Baghdad"));
        cal.set(Calendar.HOUR_OF_DAY, Integer.parseInt(p[0]));
        cal.set(Calendar.MINUTE, Integer.parseInt(p[1]));
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);
        if (cal.getTimeInMillis() <= System.currentTimeMillis() + 5000) cal.add(Calendar.DAY_OF_MONTH, 1);
        try { am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cal.getTimeInMillis(), pi); }
        catch (SecurityException se) { am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cal.getTimeInMillis(), pi); }
    }

    /** Re-arm both alarms for tomorrow (after one fires, and after a restart). */
    static void rearm(Context c) {
        SharedPreferences p = Media.prefs(c);
        schedule(c, "sleep", p.getString("sched_sleep", ""));
        schedule(c, "wake", p.getString("sched_wake", ""));
    }

    @SuppressWarnings("deprecation")
    static void wakeScreen(Context c) {
        try {
            PowerManager pm = (PowerManager) c.getSystemService(Context.POWER_SERVICE);
            PowerManager.WakeLock wl = pm.newWakeLock(PowerManager.FULL_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP | PowerManager.ON_AFTER_RELEASE, "cleantv:wake");
            wl.acquire(10000);
        } catch (Throwable ignored) { }
        try {
            Intent i = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
            c.startActivity(i);
        } catch (Throwable ignored) { }
    }

    // ---------------------------------------------------------------- files from the phone
    /** Save into the TV's Downloads folder; returns {path, uri}. */
    static JSONObject saveDownload(Context c, String name, byte[] data, String mime) throws Exception {
        name = name.replaceAll("[\\\\/:*?\"<>|]", "_");
        if (Build.VERSION.SDK_INT >= 29) {
            ContentValues v = new ContentValues();
            v.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
            if (mime != null) v.put(MediaStore.MediaColumns.MIME_TYPE, mime);
            v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
            Uri u = c.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
            if (u == null) throw new Exception("no space");
            try (OutputStream o = c.getContentResolver().openOutputStream(u)) { o.write(data); }
            return new JSONObject().put("uri", u.toString()).put("path", "/sdcard/Download/" + name);
        }
        File d = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
        d.mkdirs();
        File f = new File(d, name);
        try (FileOutputStream o = new FileOutputStream(f)) { o.write(data); }
        return new JSONObject().put("uri", Uri.fromFile(f).toString()).put("path", f.getAbsolutePath());
    }

    static boolean openUri(Context c, String uri, String mime) {
        try {
            if (uri.startsWith("file://") && Build.VERSION.SDK_INT >= 24) android.os.StrictMode.setVmPolicy(new android.os.StrictMode.VmPolicy.Builder().build());
            Intent i = new Intent(Intent.ACTION_VIEW);
            i.setDataAndType(Uri.parse(uri), mime == null || mime.isEmpty() ? "*/*" : mime);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            c.startActivity(i);
            return true;
        } catch (Throwable t) { return false; }
    }
}
