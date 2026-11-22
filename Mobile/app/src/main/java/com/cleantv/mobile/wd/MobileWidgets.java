package com.cleantv.mobile.wd;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import com.cleantv.mobile.MainActivity;
import com.msm.widgets.Act;
import com.msm.widgets.BaseProvider;
import com.msm.widgets.WApp;
import com.msm.widgets.Wd;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.HashMap;
import java.util.Map;

/** «قنواتي موبايل»: seven widgets (resume, favourites, shortcuts, quick bar, clock, movies, quiet mode) in the black-and-red look. */
public class MobileWidgets implements WApp {
    public int accent() { return 0xFFFF2A45; }

    static SharedPreferences p(Context c) { return c.getSharedPreferences("mobile", Context.MODE_PRIVATE); }

    static String favName(Context c, int i) {
        try { JSONArray a = new JSONArray(p(c).getString("w_fav", "[]")); if (i < a.length()) return a.getString(i); } catch (Throwable ignored) { }
        return "";
    }

    public Act[] catalog(Context c) {
        String f0 = favName(c, 0), f1 = favName(c, 1), f2 = favName(c, 2);
        return new Act[]{
            Act.route("resume", "كمّل المشاهدة", "play", "resume"), Act.route("live", "قنواتي", "live", "live"), Act.route("vod", "الأفلام", "film", "vod"),
            Act.route("fav", "المفضلة", "star", "fav"), Act.route("random", "قناة عشوائية", "shuffle", "random"), Act.route("search", "بحث", "search", "search"),
            Act.route("quiet", "وضع الهدوء", "moon", "quiet"), Act.route("set", "الإعدادات", "settings", "set"),
            Act.route("fav0", f0.length() > 0 ? f0 : "مفضلة ١", "star", "fav:0"), Act.route("fav1", f1.length() > 0 ? f1 : "مفضلة ٢", "star", "fav:1"),
            Act.route("fav2", f2.length() > 0 ? f2 : "مفضلة ٣", "star", "fav:2")
        };
    }
    public String[] defaults(Context c, String id) { return new String[]{"resume", "random", "fav", "vod", "search", "quiet"}; }
    public String[] iconDefaults(Context c) { return new String[]{"resume", "random", "fav"}; }

    public Map<String, String> data(Context c) {
        SharedPreferences s = p(c);
        Map<String, String> m = new HashMap<>();
        String lc = s.getString("w_lastch", ""), lv = s.getString("w_lastvod", "");
        m.put("last", lc.length() > 0 ? lc : "ما شاهدت قناة بعد");
        m.put("lastvod", lv.length() > 0 ? "آخر شي: " + lv : "تصفّح وتابع من حيث وقفت");
        m.put("quiet", "1".equals(s.getString("quietOn", "0")) ? "شغّال: يخفّض الصوت بالليل" : "متوقف · اضغط للتشغيل");
        String nm = "";
        try { nm = new JSONObject(s.getString("settings", "{}")).optString("ownerName", ""); } catch (Throwable ignored) { }
        int h = Calendar.getInstance().get(Calendar.HOUR_OF_DAY);
        String g = h >= 4 && h < 11 ? "صباح الخير" : h >= 11 && h < 17 ? "طاب يومك" : h >= 17 && h < 20 ? "مساء الخير" : "ليلة طيبة";
        m.put("greet", nm.length() > 0 ? g + " " + nm : g);
        return m;
    }

    public Intent open(Context c, String route) {
        return new Intent(c, MainActivity.class).setAction(Intent.ACTION_VIEW).putExtra("msm_route", route)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    }
    public boolean send(Context c, Act a) { return false; }

    /* the app calls this when what the widgets show has changed (last channel, favourites, quiet mode) */
    private static long last = 0;
    public static void refreshAll(Context c) {
        long now = System.currentTimeMillis();
        if (now - last < 1500) return;
        last = now;
        try {
            Class<?>[] all = {Resume.class, Favs.class, Grid.class, Nav.class, Clock.class, Movies.class, Quiet.class};
            AppWidgetManager m = AppWidgetManager.getInstance(c);
            for (Class<?> k : all) {
                int[] ids = m.getAppWidgetIds(new ComponentName(c, k));
                if (ids != null && ids.length > 0) c.sendBroadcast(new Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE).setComponent(new ComponentName(c, k)).putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids));
            }
        } catch (Throwable ignored) { }
    }

    private static final WApp APP = new MobileWidgets();

    public static class Resume extends BaseProvider {
        protected WApp app() { return APP; }
        protected Wd def() { return new Wd("resume", "كمّل المشاهدة", Wd.BANNER, 250, 110, new String[]{"resume", "random"}, "{last}", "كمّل من حيث وقفت", "عشوائي", "play"); }
    }
    public static class Favs extends BaseProvider {
        protected WApp app() { return APP; }
        protected Wd def() { return new Wd("favs", "مفضلتي", Wd.LIST, 250, 180, new String[]{"fav0", "fav1", "fav2"}, "من مفضلتك", "من مفضلتك", "من مفضلتك"); }
    }
    public static class Grid extends BaseProvider {
        protected WApp app() { return APP; }
        protected Wd def() { return new Wd("grid", "اختصاراتي", Wd.GRID, 250, 110, null); }
    }
    public static class Nav extends BaseProvider {
        protected WApp app() { return APP; }
        protected Wd def() { return new Wd("nav", "شريط سريع", Wd.STRIP, 250, 110, new String[]{"live", "vod", "fav", "set"}); }
    }
    public static class Clock extends BaseProvider {
        protected WApp app() { return APP; }
        protected Wd def() { return new Wd("clock", "ساعة وتحية", Wd.CLOCK, 180, 110, new String[]{"live"}); }
    }
    public static class Movies extends BaseProvider {
        protected WApp app() { return APP; }
        protected Wd def() { return new Wd("movies", "الأفلام", Wd.BUTTON, 250, 70, new String[]{"vod"}, "الأفلام والمسلسلات", "{lastvod}", "film"); }
    }
    public static class Quiet extends BaseProvider {
        protected WApp app() { return APP; }
        protected Wd def() { return new Wd("quiet", "وضع الهدوء", Wd.BUTTON, 250, 70, new String[]{"quiet"}, "وضع الهدوء", "{quiet}", "moon"); }
    }
}
