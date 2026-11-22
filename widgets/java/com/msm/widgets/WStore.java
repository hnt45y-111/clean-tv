package com.msm.widgets;

import android.content.Context;
import android.content.SharedPreferences;

/** The user's choices for each placed widget, and for the app icon's long-press menu. */
public final class WStore {
    private WStore() { }

    static SharedPreferences p(Context c) { return c.getApplicationContext().getSharedPreferences("msm_widgets", Context.MODE_PRIVATE); }

    public static String[] get(Context c, int widgetId, String[] def) {
        String s = p(c).getString("w" + widgetId, null);
        if (s == null) return def;
        if (s.length() == 0) return new String[0];
        return s.split(",");
    }
    public static void set(Context c, int widgetId, String[] ids) { p(c).edit().putString("w" + widgetId, join(ids)).apply(); }
    public static void drop(Context c, int widgetId) { p(c).edit().remove("w" + widgetId).apply(); }

    public static String[] icon(Context c, String[] def) {
        String s = p(c).getString("icon", null);
        if (s == null) return def;
        if (s.length() == 0) return new String[0];
        return s.split(",");
    }
    public static void setIcon(Context c, String[] ids) { p(c).edit().putString("icon", join(ids)).apply(); }

    static String join(String[] a) {
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < a.length; i++) { if (i > 0) b.append(','); b.append(a[i]); }
        return b.toString();
    }
}
