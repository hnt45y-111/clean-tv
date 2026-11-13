package com.moamal.studio;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

/**
 * Reads launcher themes out of a ZIP the user picked: CleanYourTV-style folders (config.json + wallpapers) and our own
 * design files. The ZIP stays in the cache so the pictures of the theme the user chooses are read only then.
 */
final class ZipThemes {
    private static File cur;

    private ZipThemes() { }

    private static boolean img(String n) { return n.endsWith(".jpg") || n.endsWith(".jpeg") || n.endsWith(".png") || n.endsWith(".webp"); }

    private static String dirOf(String n) { int i = n.lastIndexOf('/'); return i < 0 ? "" : n.substring(0, i); }

    /** the theme folder a picture belongs to: pictures in «wallpapers/» belong to the folder above it */
    private static String themeDir(String n) {
        String d = dirOf(n);
        if (d.equals("wallpapers") || d.endsWith("/wallpapers")) d = dirOf(d);
        return d;
    }

    private static boolean css(String n) { return n.endsWith(".css"); }

    /** an icon pack inside a theme: «icons/<package name>.png» (also «app_icons/», «icon-pack/») */
    private static String iconPkg(String n) {
        String l = n.toLowerCase(Locale.ROOT), d = dirOf(l);
        String last = d.substring(d.lastIndexOf('/') + 1);
        if (!(last.equals("icons") || last.equals("app_icons") || last.equals("icon-pack") || last.equals("iconpack")) || !img(l)) return null;
        String b = n.substring(n.lastIndexOf('/') + 1);
        b = b.substring(0, b.lastIndexOf('.'));
        return b.matches("[A-Za-z][\\w]*(\\.[\\w]+)+") ? b : null;
    }

    /** the folder an icon pack or CSS file belongs to */
    private static String extraDir(String n) {
        String d = dirOf(n);
        String last = d.substring(d.lastIndexOf('/') + 1).toLowerCase(Locale.ROOT);
        if (last.equals("icons") || last.equals("app_icons") || last.equals("icon-pack") || last.equals("iconpack") || last.equals("css") || last.equals("styles")) d = dirOf(d);
        return d;
    }

    private static String icon(ZipFile z, ZipEntry e) throws Exception {
        Bitmap bm;
        try (InputStream in = z.getInputStream(e)) { bm = BitmapFactory.decodeStream(in); }
        if (bm == null) return null;
        float r = Math.min(1f, Math.min(192f / bm.getWidth(), 192f / bm.getHeight()));
        Bitmap sc = Bitmap.createScaledBitmap(bm, Math.max(1, Math.round(bm.getWidth() * r)), Math.max(1, Math.round(bm.getHeight() * r)), true);
        ByteArrayOutputStream bo = new ByteArrayOutputStream();
        sc.compress(Bitmap.CompressFormat.PNG, 100, bo);
        if (sc != bm) sc.recycle();
        bm.recycle();
        return "data:image/png;base64," + Base64.encodeToString(bo.toByteArray(), Base64.NO_WRAP);
    }

    private static boolean skip(String n) {
        String l = "/" + n.toLowerCase(Locale.ROOT);
        return l.contains("/__macosx/") || l.contains("/.") || l.contains("/docs/") || l.contains("/tests/") || l.contains("/node_modules/")
                || l.contains("/addons/") || l.contains("/launcher/app/") || l.contains("/build/");
    }

    private static String text(ZipFile z, ZipEntry e, int max) throws Exception {
        if (e == null) return "";
        try (InputStream in = z.getInputStream(e)) {
            byte[] b = Adb.readAll(in);
            String s = new String(b, StandardCharsets.UTF_8);
            return s.length() > max ? s.substring(0, max) : s;
        }
    }

    private static String pic(ZipFile z, ZipEntry e, int tw, int th, boolean crop) throws Exception {
        BitmapFactory.Options o = new BitmapFactory.Options();
        o.inJustDecodeBounds = true;
        try (InputStream in = z.getInputStream(e)) { BitmapFactory.decodeStream(in, null, o); }
        int sample = 1;
        while (o.outWidth / (sample * 2) >= tw && o.outHeight / (sample * 2) >= th) sample *= 2;
        BitmapFactory.Options o2 = new BitmapFactory.Options();
        o2.inSampleSize = sample;
        Bitmap bm;
        try (InputStream in = z.getInputStream(e)) { bm = BitmapFactory.decodeStream(in, null, o2); }
        if (bm == null) return null;
        float r = crop ? Math.max((float) tw / bm.getWidth(), (float) th / bm.getHeight()) : Math.min((float) tw / bm.getWidth(), (float) th / bm.getHeight());
        r = Math.min(r, crop ? 99f : 1f);
        Bitmap sc = Bitmap.createScaledBitmap(bm, Math.max(1, Math.round(bm.getWidth() * r)), Math.max(1, Math.round(bm.getHeight() * r)), true);
        Bitmap out = sc;
        if (crop && (sc.getWidth() > tw || sc.getHeight() > th))
            out = Bitmap.createBitmap(sc, Math.max(0, (sc.getWidth() - tw) / 2), Math.max(0, (sc.getHeight() - th) / 2), Math.min(tw, sc.getWidth()), Math.min(th, sc.getHeight()));
        ByteArrayOutputStream bo = new ByteArrayOutputStream();
        out.compress(Bitmap.CompressFormat.JPEG, crop ? 82 : 72, bo);
        if (out != sc) out.recycle();
        if (sc != bm) sc.recycle();
        bm.recycle();
        return "data:image/jpeg;base64," + Base64.encodeToString(bo.toByteArray(), Base64.NO_WRAP);
    }

    /** list the themes and design files inside the ZIP (with a small preview picture each) */
    static JSONObject index(File f, String zipName) throws Exception {
        cur = f;
        JSONObject res = new JSONObject();
        JSONArray themes = new JSONArray(), designs = new JSONArray();
        try (ZipFile z = new ZipFile(f)) {
            Map<String, ZipEntry> cfgs = new LinkedHashMap<>();
            Map<String, List<ZipEntry>> pics = new LinkedHashMap<>();
            List<ZipEntry> jsons = new ArrayList<>();
            Map<String, Integer> icons = new LinkedHashMap<>();
            Map<String, StringBuilder> styles = new LinkedHashMap<>();
            Enumeration<? extends ZipEntry> en = z.entries();
            while (en.hasMoreElements()) {
                ZipEntry e = en.nextElement();
                String n = e.getName();
                if (e.isDirectory() || skip(n)) continue;
                String l = n.toLowerCase(Locale.ROOT);
                if (iconPkg(n) != null) { String d = extraDir(n); Integer c = icons.get(d); icons.put(d, c == null ? 1 : c + 1); continue; }
                if (css(l) && e.getSize() < 200_000) { String d = extraDir(n); StringBuilder sb = styles.get(d); if (sb == null) styles.put(d, sb = new StringBuilder()); if (sb.length() < 60_000) sb.append(text(z, e, 60_000)).append('\n'); continue; }
                if (l.equals("config.json") || l.endsWith("/config.json")) cfgs.put(dirOf(n), e);
                else if (l.endsWith(".json") && e.getSize() < 400_000) jsons.add(e);
                else if (img(l) && e.getSize() < 25_000_000) {
                    String d = themeDir(n);
                    List<ZipEntry> li = pics.get(d);
                    if (li == null) pics.put(d, li = new ArrayList<>());
                    li.add(e);
                }
            }
            int k = 0;
            for (Map.Entry<String, ZipEntry> c : cfgs.entrySet()) {
                if (k++ >= 80) break;
                String d = c.getKey();
                String name = d.isEmpty() ? zipName : d.substring(d.lastIndexOf('/') + 1);
                List<ZipEntry> li = pics.get(d);
                ZipEntry shot = null; int count = 0;
                if (li != null) for (ZipEntry p : li) {
                    String b = p.getName().substring(p.getName().lastIndexOf('/') + 1).toLowerCase(Locale.ROOT);
                    if (b.startsWith("screenshot")) shot = p; else count++;
                }
                if (shot == null && li != null && !li.isEmpty()) shot = li.get(0);
                String pre = d.isEmpty() ? "" : d + "/";
                JSONObject t = new JSONObject().put("path", d).put("name", name).put("count", count)
                        .put("config", text(z, c.getValue(), 200_000))
                        .put("captions", text(z, z.getEntry(pre + "wallpapers/captions.txt"), 8000))
                        .put("credits", text(z, z.getEntry(pre + "CREDITS.md"), 3000));
                try { if (shot != null) t.put("shot", pic(z, shot, 480, 270, false)); } catch (Throwable ignored) { }
                extras(t, d, icons, styles);
                themes.put(t);
            }
            if (cfgs.isEmpty() && (!icons.isEmpty() || !styles.isEmpty()) && pics.isEmpty()) {
                // only an icon pack or a style sheet: still a look the user can apply
                JSONObject t = new JSONObject().put("path", "*").put("name", zipName).put("count", 0).put("config", "{}");
                extras(t, "*", icons, styles);
                themes.put(t);
            }
            if (cfgs.isEmpty() && !pics.isEmpty()) {
                // no theme folders: a plain pack of pictures becomes one wallpaper design
                List<ZipEntry> all = new ArrayList<>();
                for (List<ZipEntry> li : pics.values()) all.addAll(li);
                if (!all.isEmpty()) {
                    JSONObject t = new JSONObject().put("path", "*").put("name", zipName).put("count", Math.min(30, all.size())).put("config", "{}");
                    try { t.put("shot", pic(z, all.get(0), 480, 270, false)); } catch (Throwable ignored) { }
                    extras(t, "*", icons, styles);
                    themes.put(t);
                }
            }
            for (ZipEntry e : jsons) {
                if (designs.length() >= 20) break;
                String s = text(z, e, 400_000);
                if (s.contains("moamal-design") || (s.contains("\"settings\"") && s.contains("\"layout\"")) || s.contains("\"carcfg\""))
                    designs.put(new JSONObject().put("name", e.getName().substring(e.getName().lastIndexOf('/') + 1)).put("text", s));
            }
        }
        return res.put("themes", themes).put("designs", designs);
    }

    /** a theme's own CSS and the number of icons in its icon pack («*»: everything in the ZIP) */
    private static void extras(JSONObject t, String d, Map<String, Integer> icons, Map<String, StringBuilder> styles) throws Exception {
        int ni = 0; StringBuilder cs = new StringBuilder();
        for (Map.Entry<String, Integer> e : icons.entrySet()) if ("*".equals(d) || e.getKey().equals(d) || e.getKey().isEmpty()) ni += e.getValue();
        for (Map.Entry<String, StringBuilder> e : styles.entrySet()) if ("*".equals(d) || e.getKey().equals(d) || e.getKey().isEmpty()) cs.append(e.getValue());
        t.put("icons", ni);
        if (cs.length() > 0) t.put("css", cs.length() > 60_000 ? cs.substring(0, 60_000) : cs.toString());
    }

    /** the icon pack of one theme from the last ZIP: package name → picture */
    static JSONObject icons(String path, int max) throws Exception {
        if (cur == null || !cur.exists()) throw new Exception("اختار ملف الـ ZIP مرة ثانية");
        JSONObject out = new JSONObject();
        try (ZipFile z = new ZipFile(cur)) {
            Enumeration<? extends ZipEntry> en = z.entries();
            while (en.hasMoreElements() && out.length() < max) {
                ZipEntry e = en.nextElement();
                String n = e.getName(), pkg = iconPkg(n);
                if (e.isDirectory() || skip(n) || pkg == null || e.getSize() > 4_000_000) continue;
                String d = extraDir(n);
                if (!("*".equals(path) || d.equals(path) || d.isEmpty())) continue;
                try { String u = icon(z, e); if (u != null) out.put(pkg, u); } catch (Throwable ignored) { }
            }
        }
        return out;
    }

    /** the wallpapers of one theme from the last ZIP, ready to send to the screen */
    static JSONArray images(String path, int max) throws Exception {
        if (cur == null || !cur.exists()) throw new Exception("اختار ملف الـ ZIP مرة ثانية");
        JSONArray out = new JSONArray();
        try (ZipFile z = new ZipFile(cur)) {
            Enumeration<? extends ZipEntry> en = z.entries();
            List<ZipEntry> li = new ArrayList<>();
            while (en.hasMoreElements()) {
                ZipEntry e = en.nextElement();
                String n = e.getName(), l = n.toLowerCase(Locale.ROOT);
                if (e.isDirectory() || skip(n) || !img(l) || e.getSize() > 25_000_000 || iconPkg(n) != null) continue;
                if (l.substring(l.lastIndexOf('/') + 1).startsWith("screenshot")) continue;
                if ("*".equals(path) || themeDir(n).equals(path)) li.add(e);
            }
            java.util.Collections.sort(li, (a, b) -> a.getName().compareTo(b.getName()));
            for (ZipEntry e : li) {
                if (out.length() >= max) break;
                try {
                    String d = pic(z, e, 1600, 900, true);
                    if (d != null) out.put(new JSONObject().put("name", e.getName().substring(e.getName().lastIndexOf('/') + 1)).put("data", d));
                } catch (Throwable ignored) { }
            }
        }
        return out;
    }
}
