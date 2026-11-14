package com.cleantv.launcher;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** Receives scheduled alarms: adhan, match alerts, live score, kids timer. */
public class AlertReceiver extends BroadcastReceiver {

    static final String ACTION = "com.cleantv.launcher.ALERT";
    private static volatile String liveId = "";

    @Override
    public void onReceive(Context context, Intent intent) {
        final Context c = context.getApplicationContext();
        String type = intent.getStringExtra("type");
        String title = intent.getStringExtra("title");
        String sub = intent.getStringExtra("sub");
        if (type == null) return;
        switch (type) {
            case "adhan": {
                String mode = Media.prefs(c).getString("adhanMode", "sound");
                if ("off".equals(mode)) return;
                boolean shown = false;
                try {
                    Intent a = new Intent(c, AdhanActivity.class);
                    a.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                    a.putExtra("title", title);
                    a.putExtra("sub", sub);
                    a.putExtra("sound", "sound".equals(mode));
                    c.startActivity(a);
                    shown = true;
                } catch (Throwable ignored) { }
                if (!shown) {
                    Overlay.showBanner(c, title, sub, "sound".equals(mode) ? 150000 : 30000);
                    Media.playAdhan(c);
                }
                break;
            }
            case "match_pre":
                Overlay.showBanner(c, title, sub, 25000);
                break;
            case "match_live":
                startLive(c, intent.getStringExtra("slug"), intent.getStringExtra("id"), title);
                break;
            case "kids":
                Overlay.showBanner(c, title, sub, 20000);
                try {
                    Intent i = new Intent(c, MainActivity.class);
                    i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
                    i.putExtra("kidsTimeUp", true);
                    c.startActivity(i);
                } catch (Throwable ignored) { }
                break;
            case "sleep":
                Overlay.showBanner(c, "الشاشة تنطفي بعد دقيقة", "حسب جدول التشغيل اللي حددته · اضغط أي زر حتى تلغيه", 55000);
                PowerService.lastInput = 0;
                new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(new Runnable() {
                    @Override public void run() {
                        if (System.currentTimeMillis() - PowerService.lastInput < 58000) { Overlay.hideBanner(c); return; }
                        if (!PowerService.sleep()) PowerService.powerDialog();
                    }
                }, 60000);
                DeviceTools.rearm(c);
                break;
            case "wake":
                DeviceTools.wakeScreen(c);
                DeviceTools.rearm(c);
                break;
            default:
                break;
        }
    }

    // ---------- scheduling ----------
    static void schedule(Context ctx, String json) {
        Context c = ctx.getApplicationContext();
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        SharedPreferences p = Media.prefs(c);
        int old = p.getInt("alarmCount", 0);
        for (int i = 0; i < old; i++) {
            PendingIntent pi = pending(c, i, new Intent(c, AlertReceiver.class).setAction(ACTION));
            am.cancel(pi);
        }
        int n = 0;
        try {
            JSONArray arr = new JSONArray(json);
            long now = System.currentTimeMillis();
            for (int i = 0; i < arr.length() && n < 60; i++) {
                JSONObject o = arr.getJSONObject(i);
                long at = o.optLong("at", 0);
                if (at <= now) continue;
                Intent it = new Intent(c, AlertReceiver.class).setAction(ACTION);
                it.putExtra("type", o.optString("type"));
                it.putExtra("title", o.optString("title"));
                it.putExtra("sub", o.optString("sub"));
                it.putExtra("slug", o.optString("slug"));
                it.putExtra("id", o.optString("id"));
                PendingIntent pi = pending(c, n, it);
                try {
                    if (Build.VERSION.SDK_INT >= 23) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
                    else am.setExact(AlarmManager.RTC_WAKEUP, at, pi);
                } catch (SecurityException se) {
                    if (Build.VERSION.SDK_INT >= 23) am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
                    else am.set(AlarmManager.RTC_WAKEUP, at, pi);
                }
                n++;
            }
        } catch (Throwable ignored) { }
        p.edit().putInt("alarmCount", n).apply();
    }

    private static PendingIntent pending(Context c, int code, Intent it) {
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        return PendingIntent.getBroadcast(c, 9000 + code, it, flags);
    }

    // ---------- live score corner ----------
    static void startLive(final Context c, final String slug, final String id, final String title) {
        if (slug == null || id == null || slug.length() == 0 || id.length() == 0) return;
        liveId = id;
        new Thread(new Runnable() {
            @Override
            public void run() {
                long end = System.currentTimeMillis() + 160L * 60000L;
                while (System.currentTimeMillis() < end && id.equals(liveId)) {
                    String txt = null;
                    boolean done = false;
                    try {
                        String s = get("https://site.api.espn.com/apis/site/v2/sports/soccer/" + slug + "/summary?event=" + id);
                        JSONObject comp = new JSONObject(s).getJSONObject("header").getJSONArray("competitions").getJSONObject(0);
                        JSONObject st = comp.getJSONObject("status");
                        JSONObject type = st.getJSONObject("type");
                        String state = type.optString("state");
                        JSONArray cs = comp.getJSONArray("competitors");
                        String hs = "", as = "", hn = "", an = "";
                        for (int k = 0; k < cs.length(); k++) {
                            JSONObject x = cs.getJSONObject(k);
                            String nm = x.getJSONObject("team").optString("abbreviation", x.getJSONObject("team").optString("displayName"));
                            if ("home".equals(x.optString("homeAway"))) { hs = x.optString("score", "0"); hn = nm; }
                            else { as = x.optString("score", "0"); an = nm; }
                        }
                        if ("in".equals(state)) txt = "⚽ " + hn + " " + hs + " - " + as + " " + an + "   " + st.optString("displayClock", "");
                        else if ("post".equals(state)) { txt = "انتهت: " + hn + " " + hs + " - " + as + " " + an; done = true; }
                    } catch (Throwable ignored) { }
                    if (txt != null) Overlay.showCorner(c, txt);
                    try { Thread.sleep(done ? 90000 : 120000); } catch (InterruptedException e) { break; }
                    if (done) break;
                }
                if (id.equals(liveId)) Overlay.hideCorner(c);
            }
        }).start();
    }

    static String get(String url) throws Exception {
        HttpURLConnection con = (HttpURLConnection) new URL(url).openConnection();
        con.setConnectTimeout(10000);
        con.setReadTimeout(15000);
        con.setRequestProperty("User-Agent", "CleanTV/4.0 (personal Android TV launcher)");
        try {
            BufferedReader r = new BufferedReader(new InputStreamReader(con.getInputStream(), StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = r.readLine()) != null) sb.append(line);
            r.close();
            return sb.toString();
        } finally {
            con.disconnect();
        }
    }
}
