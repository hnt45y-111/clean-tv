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
            Enumeration<? extends ZipEntry> en = z.entries();
            while (en.hasMoreElements()) {
                ZipEntry e = en.nextElement();
                String n = e.getName();
                if (e.isDirectory() || skip(n)) continue;
                String l = n.toLowerCase(Locale.ROOT);
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
                themes.put(t);
            }
            if (cfgs.isEmpty()) {
                // no theme folders: a plain pack of pictures becomes one wallpaper design
                List<ZipEntry> all = new ArrayList<>();
                for (List<ZipEntry> li : pics.values()) all.addAll(li);
                if (!all.isEmpty()) {
                    JSONObject t = new JSONObject().put("path", "*").put("name", zipName).put("count", Math.min(30, all.size())).put("config", "{}");
                    try { t.put("shot", pic(z, all.get(0), 480, 270, false)); } catch (Throwable ignored) { }
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
                if (e.isDirectory() || skip(n) || !img(l) || e.getSize() > 25_000_000) continue;
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
