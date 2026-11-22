package com.moamal.studio.wd;

import android.app.ActivityManager;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Environment;
import android.os.StatFs;

import com.moamal.studio.MainActivity;
import com.msm.widgets.Act;
import com.msm.widgets.BaseProvider;
import com.msm.widgets.WApp;
import com.msm.widgets.Wd;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/** «مدير الشاشة»: seven widgets with real numbers from this phone (storage, memory, battery) and ready shortcuts into the app. */
public class StudioWidgets implements WApp {
    public int accent() { return 0xFFD9822B; }

    public Act[] catalog(Context c) {
        return new Act[]{
            Act.route("phone", "هذا الموبايل", "phone", "phone"), Act.route("phone_clean", "تنظيف سريع", "broom", "phone:clean"),
            Act.route("phone_bloat", "التطبيقات الزايدة", "trash", "phone:bloat"), Act.route("phone_speed", "سرعة الحركة", "rocket", "phone:anim"),
            Act.route("phone_ads", "حاجب الإعلانات", "shield", "phone:ads"), Act.route("phone_bat", "البطارية", "clock", "phone:bat"),
            Act.route("phone2", "موبايل ثاني", "devices", "phone2"), Act.route("devices", "أجهزتي", "devices", "devices"),
            Act.route("tv", "جهّز الشاشة", "tv", "clean"), Act.route("design", "صمّم الواجهة", "layers", "design"),
            Act.route("remote", "الريموت", "remote", "remote"), Act.route("more", "المزيد", "more", "more")
        };
    }
    public String[] defaults(Context c, String id) { return new String[]{"phone_clean", "phone_speed", "phone_ads", "tv", "design", "remote"}; }
    public String[] iconDefaults(Context c) { return new String[]{"phone_clean", "tv", "design"}; }

    public Map<String, String> data(Context c) {
        Map<String, String> m = new HashMap<>();
        try {
            StatFs sf = new StatFs(Environment.getDataDirectory().getPath());
            long tot = sf.getTotalBytes(), free = sf.getAvailableBytes();
            int st = tot > 0 ? (int) Math.round(100.0 * (tot - free) / tot) : 0;
            m.put("st", String.valueOf(st)); m.put("free", String.format(Locale.US, "%.1f", free / 1073741824.0));
            ActivityManager am = (ActivityManager) c.getSystemService(Context.ACTIVITY_SERVICE);
            ActivityManager.MemoryInfo mi = new ActivityManager.MemoryInfo(); am.getMemoryInfo(mi);
            int ram = mi.totalMem > 0 ? (int) Math.round(100.0 * (mi.totalMem - mi.availMem) / mi.totalMem) : 0;
            m.put("ram", String.valueOf(ram));
            Intent b = c.registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
            int bat = 0;
            if (b != null) { int lv = b.getIntExtra("level", -1), sc = b.getIntExtra("scale", 100); if (lv >= 0 && sc > 0) bat = lv * 100 / sc; }
            m.put("bat", String.valueOf(bat));
            double score = 100 - Math.max(0, st - 55) * 0.9 - Math.max(0, ram - 60) * 0.7 - (bat < 20 ? 12 : 0);
            m.put("score", String.valueOf((int) Math.max(5, Math.min(100, Math.round(score)))));
        } catch (Throwable ignored) { }
        return m;
    }

    public Intent open(Context c, String route) {
        return new Intent(c, MainActivity.class).setAction(Intent.ACTION_VIEW).putExtra("msm_route", route)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    }
    public boolean send(Context c, Act a) { return false; }

    private static final WApp APP = new StudioWidgets();

    public static class Health extends BaseProvider {
        protected WApp app() { return APP; }
        protected Wd def() { return new Wd("health", "صحة الموبايل", Wd.RING, 250, 110, new String[]{"phone", "phone_clean"}, "صحة الموبايل (تقديري)", "نظّف وسرّع"); }
    }
    public static class Clean extends BaseProvider {
        protected WApp app() { return APP; }
        protected Wd def() { return new Wd("clean", "نظّف وسرّع", Wd.BUTTON, 250, 70, new String[]{"phone_clean"}, "نظّف وسرّع", "فاضي {free} GB من التخزين", "sparkle"); }
    }
    public static class Grid extends BaseProvider {
        protected WApp app() { return APP; }
        protected Wd def() { return new Wd("grid", "اختصاراتي", Wd.GRID, 250, 110, null); }
    }
    public static class Devices extends BaseProvider {
        protected WApp app() { return APP; }
        protected Wd def() { return new Wd("devices", "أجهزتي", Wd.LIST, 250, 180, new String[]{"phone", "phone2", "tv"}, "نظّفه وسرّعه", "على نفس الواي فاي أو بكيبل", "تنظيف وتصميم الواجهة"); }
    }
    public static class Nav extends BaseProvider {
        protected WApp app() { return APP; }
        protected Wd def() { return new Wd("nav", "شريط سريع", Wd.STRIP, 250, 110, new String[]{"devices", "tv", "design", "remote", "more"}); }
    }
    public static class Storage extends BaseProvider {
        protected WApp app() { return APP; }
        protected Wd def() { return new Wd("storage", "التخزين", Wd.STAT, 110, 110, new String[]{"phone_clean"}, "التخزين", "free", " GB فاضي", "المستعمل", "st", "الرام", "ram"); }
    }
    public static class Tv extends BaseProvider {
        protected WApp app() { return APP; }
        protected Wd def() { return new Wd("tv", "جهّز الشاشة", Wd.BANNER, 250, 110, new String[]{"tv", "design"}, "جهّز شاشتك", "تنظيف وتسريع التلفزيون", "صمّم", "tv"); }
    }
}
