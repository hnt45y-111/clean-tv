package com.calmnerves;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.utils.JsonReader;
import com.badlogic.gdx.utils.JsonValue;

/** Live-switchable strings (ar/en/tr/fr/es). Data lives in assets/data/strings.json. */
public class I18n {
    public static final String[] LANGS = {"ar", "en", "tr", "fr", "es"};
    public static final String[] LANG_NAMES = {"العربية", "English", "Türkçe", "Français", "Español"};
    public static String lang = "ar";
    private static JsonValue root;
    public static void init() { root = new JsonReader().parse(Gdx.files.internal("data/strings.json")); }
    public static int idx() { for (int i = 0; i < 5; i++) if (LANGS[i].equals(lang)) return i; return 0; }
    public static boolean rtl() { return lang.equals("ar"); }
    private static JsonValue v(String k) { JsonValue v = root.get("str").get(lang).get(k); return v != null ? v : root.get("str").get("en").get(k); }
    public static String t(String k) { JsonValue v = v(k); return v == null ? k : v.asString(); }
    public static String t(String k, String a, Object val) { return t(k).replace("{" + a + "}", String.valueOf(val)); }
    public static String[] arr(String k) { JsonValue v = v(k); String[] r = new String[v.size]; int i = 0; for (JsonValue c = v.child; c != null; c = c.next) r[i++] = c.asString(); return r; }
    public static String sub(String k, String s) { JsonValue v = v(k); return v == null || v.get(s) == null ? s : v.get(s).asString(); }
    public static String color(int i) { return root.get("colors").get(lang).get(i).asString(); }
    public static int colorHex(int i) { return Integer.parseInt(root.get("hex").get(i).asString().substring(1), 16) << 8 | 0xFF; }
}
