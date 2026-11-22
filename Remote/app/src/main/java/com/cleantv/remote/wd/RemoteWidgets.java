package com.cleantv.remote.wd;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import com.cleantv.remote.MainActivity;
import com.msm.widgets.Act;
import com.msm.widgets.BaseProvider;
import com.msm.widgets.WApp;
import com.msm.widgets.Wd;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.Map;

/** «هوائي»: seven widgets that really drive the TV from the home screen (volume, pad, power, channels, media, shortcuts, status). */
public class RemoteWidgets implements WApp {
    public int accent() { return 0xFFD9822B; }

    public Act[] catalog(Context c) {
        return new Act[]{
            Act.key("vol_up", "رفع الصوت", "volup", "vup"), Act.key("vol_dn", "خفض الصوت", "voldn", "vdn"), Act.key("mute", "كتم", "mute", "mute"),
            Act.key("power", "الطاقة", "power", "power"), Act.key("home", "الرئيسية", "home", "home"), Act.key("back", "رجوع", "back", "back"),
            Act.key("ok", "موافق", "ok", "ok"), Act.key("up", "فوق", "up", "up"), Act.key("down", "تحت", "down", "down"),
            Act.key("left", "يسار", "left", "left"), Act.key("right", "يمين", "right", "right"),
            Act.key("play", "تشغيل / إيقاف", "play", "play"), Act.key("next", "التالي", "next", "next"), Act.key("prev", "السابق", "prev", "prev"),
            Act.key("shuffle", "قناة عشوائية", "shuffle", "shuffle"), Act.cmd("live", "قنواتي على التلفاز", "live", "live"),
            Act.cmd("bgnext", "الخلفية التالية", "layers", "bgNext"), Act.key("settings", "إعدادات التلفاز", "settings", "settings"),
            Act.route("remote", "افتح الريموت", "remote", "remote"), Act.route("apps", "تطبيقات التلفاز", "more", "apps"),
            Act.route("look", "المظهر", "layers", "look"), Act.route("quran", "القرآن", "play", "quran")
        };
    }
    public String[] defaults(Context c, String id) { return new String[]{"vol_up", "mute", "live", "power", "home", "shuffle"}; }
    public String[] iconDefaults(Context c) { return new String[]{"mute", "live", "shuffle"}; }

    public Map<String, String> data(Context c) {
        SharedPreferences p = MainActivity.prefs(c);
        Map<String, String> m = new HashMap<>();
        String name = p.getString("tvName", "");
        boolean paired = p.getString("tvToken", "").length() > 0 && p.getString("tvBase", "").length() > 0;
        m.put("tv", name.length() > 0 ? name : "التلفاز");
        m.put("state", !paired ? "غير مربوط" : p.getBoolean("tvUp", true) ? "متصل" : "غير متصل");
        return m;
    }

    public Intent open(Context c, String route) {
        return new Intent(c, MainActivity.class).setAction(Intent.ACTION_VIEW).putExtra("msm_route", route)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    }

    public boolean send(Context c, Act a) {
        SharedPreferences p = MainActivity.prefs(c);
        String base = p.getString("tvBase", ""), token = p.getString("tvToken", "");
        if (base.length() == 0 || token.length() == 0) return false;
        try {
            JSONObject body = new JSONObject();
            String path;
            if (a.kind == Act.KEY) { path = "/api/key"; body.put("k", a.arg); } else { path = "/api/cmd"; body.put("type", a.arg); }
            HttpURLConnection con = (HttpURLConnection) new URL(base + path).openConnection();
            con.setConnectTimeout(4000); con.setReadTimeout(4000); con.setRequestMethod("POST"); con.setDoOutput(true);
            con.setRequestProperty("X-Token", token); con.setRequestProperty("Content-Type", "application/json");
            OutputStream o = con.getOutputStream(); o.write(body.toString().getBytes("UTF-8")); o.close();
            int code = con.getResponseCode(); con.disconnect();
            p.edit().putBoolean("tvUp", code == 200).apply();
            return code == 200;
        } catch (Throwable t) { p.edit().putBoolean("tvUp", false).apply(); return false; }
    }

    private static final WApp APP = new RemoteWidgets();

    /* the seven widgets */
    public static class Pad extends BaseProvider {
        protected WApp app() { return APP; }
        protected Wd def() { return new Wd("pad", "ريموت", Wd.PAD, 250, 250, new String[]{"back", "up", "home", "left", "ok", "right", "vol_dn", "down", "vol_up"}); }
    }
    public static class Volume extends BaseProvider {
        protected WApp app() { return APP; }
        protected Wd def() { return new Wd("volume", "الصوت", Wd.STRIP, 250, 80, new String[]{"vol_up", "mute", "vol_dn"}); }
    }
    public static class Power extends BaseProvider {
        protected WApp app() { return APP; }
        protected Wd def() { return new Wd("power", "الطاقة", Wd.BUTTON, 250, 80, new String[]{"power"}, "طاقة التلفاز", "اضغط لقائمة الإيقاف", "power"); }
    }
    public static class Channels extends BaseProvider {
        protected WApp app() { return APP; }
        protected Wd def() { return new Wd("channels", "قنواتي", Wd.LIST, 250, 190, new String[]{"live", "shuffle", "bgnext"}, "يفتح القنوات على التلفاز", "كل مرة قناة جديدة", "غيّر صورة الخلفية"); }
    }
    public static class Media extends BaseProvider {
        protected WApp app() { return APP; }
        protected Wd def() { return new Wd("media", "الوسائط", Wd.STRIP, 250, 110, new String[]{"play", "next", "prev", "home", "back"}); }
    }
    public static class Grid extends BaseProvider {
        protected WApp app() { return APP; }
        protected Wd def() { return new Wd("grid", "اختصاراتي", Wd.GRID, 250, 150, null); }
    }
    public static class Status extends BaseProvider {
        protected WApp app() { return APP; }
        protected Wd def() { return new Wd("status", "حالة التلفاز", Wd.BANNER, 250, 110, new String[]{"remote", "settings"}, "{tv}", "{state}", "إعدادات", "tv"); }
        @Override
        public void onUpdate(final Context ctx, final AppWidgetManager m, final int[] ids) {
            final PendingResult pr = goAsync();
            new Thread(new Runnable() {
                public void run() {
                    try {
                        SharedPreferences p = MainActivity.prefs(ctx);
                        String base = p.getString("tvBase", "");
                        if (base.length() > 0) {
                            boolean up = false;
                            try { HttpURLConnection con = (HttpURLConnection) new URL(base + "/api/info").openConnection(); con.setConnectTimeout(2500); con.setReadTimeout(2500); up = con.getResponseCode() == 200; con.disconnect(); } catch (Throwable ignored) { }
                            p.edit().putBoolean("tvUp", up).apply();
                        }
                        Status.super.onUpdate(ctx, m, ids);
                    } catch (Throwable ignored) { }
                    pr.finish();
                }
            }).start();
        }
    }
}
