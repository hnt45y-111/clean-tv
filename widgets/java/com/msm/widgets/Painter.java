package com.msm.widgets;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.RadialGradient;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** Draws every widget as one bitmap in the app's black-and-red look; clicks come from a separate grid of invisible zones. */
public final class Painter {
    private Painter() { }

    public static final class Frame {
        public Bitmap bmp;
        public int cols, rows;
        /** the action behind each zone, indexed row * cols + col (left to right on screen); null = nothing */
        public Act[] zones;
    }

    static final int WHITE = 0xFFFFFFFF, MUTED = 0xFFB8B8C6, GREEN = 0xFF2DFF8C, AMBER = 0xFFFFB13C, RED = 0xFFFF2A45;

    static Paint paint(int color) { Paint p = new Paint(Paint.ANTI_ALIAS_FLAG); p.setColor(color); return p; }
    static Paint text(float dp, boolean bold, int color) {
        Paint p = paint(color); p.setTextSize(dp); p.setTypeface(bold ? Typeface.DEFAULT_BOLD : Typeface.DEFAULT); p.setSubpixelText(true); return p;
    }
    /** western digits to Arabic-Indic */
    public static String ar(String s) {
        if (s == null) return "";
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < s.length(); i++) { char ch = s.charAt(i); b.append(ch >= '0' && ch <= '9' ? (char) ('٠' + (ch - '0')) : ch); }
        return b.toString();
    }
    /** a text that fits {@code maxW}: shrinks first, then cuts */
    static void drawFit(Canvas c, String s, float x, float y, float maxW, float dp, boolean bold, int color, Paint.Align al) {
        Paint p = text(dp, bold, color); p.setTextAlign(al);
        while (p.measureText(s) > maxW && p.getTextSize() > 9) p.setTextSize(p.getTextSize() - 1);
        if (p.measureText(s) > maxW) { int n = p.breakText(s, true, maxW - p.measureText("…"), null); s = s.substring(0, Math.max(0, n)) + "…"; }
        c.drawText(s, x, y, p);
    }
    static String fill(String s, Map<String, String> d) {
        if (s == null) return "";
        int i;
        while ((i = s.indexOf('{')) >= 0) {
            int j = s.indexOf('}', i);
            if (j < 0) break;
            String k = s.substring(i + 1, j), v = d.get(k);
            s = s.substring(0, i) + (v == null ? "" : v) + s.substring(j + 1);
        }
        return s;
    }

    static Act find(Context c, WApp app, String id) { for (Act a : app.catalog(c)) if (a.id.equals(id)) return a; return null; }
    static int dark(int c) { return 0xFF000000 | (((c >> 16 & 255) * 55 / 100) << 16) | (((c >> 8 & 255) * 55 / 100) << 8) | ((c & 255) * 55 / 100); }

    /** the card behind every widget */
    static void base(Canvas c, float w, float h, int accent) {
        RectF r = new RectF(0, 0, w, h);
        Paint bg = new Paint(Paint.ANTI_ALIAS_FLAG);
        bg.setShader(new LinearGradient(0, 0, w, h, 0xFF191920, 0xFF0A0A0F, Shader.TileMode.CLAMP));
        c.drawRoundRect(r, 26, 26, bg);
        Paint glow = new Paint(Paint.ANTI_ALIAS_FLAG);
        glow.setShader(new RadialGradient(w * .88f, h * .08f, Math.max(w, h) * .75f, (accent & 0x00FFFFFF) | 0x55000000, 0x00000000, Shader.TileMode.CLAMP));
        c.drawRoundRect(r, 26, 26, glow);
        Paint b = paint(0x24FFFFFF); b.setStyle(Paint.Style.STROKE); b.setStrokeWidth(1.2f);
        c.drawRoundRect(new RectF(.6f, .6f, w - .6f, h - .6f), 26, 26, b);
    }

    public static Frame draw(Context ctx, WApp app, Wd wd, int wdp, int hdp, int widgetId) {
        float dens = ctx.getResources().getDisplayMetrics().density;
        float sc = Math.min(dens, 720f / Math.max(wdp, hdp));
        int pw = Math.max(8, Math.round(wdp * sc)), ph = Math.max(8, Math.round(hdp * sc));
        Bitmap bmp = Bitmap.createBitmap(pw, ph, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(bmp);
        c.scale(sc, sc);
        float w = wdp, h = hdp;
        int acc = app.accent();
        Map<String, String> d = app.data(ctx);
        base(c, w, h, acc);
        Frame f = new Frame(); f.bmp = bmp;
        switch (wd.type) {
            case Wd.GRID: grid(ctx, c, f, app, wd, w, h, acc, WStore.get(ctx, widgetId, app.defaults(ctx, wd.id))); break;
            case Wd.RING: ring(ctx, c, f, app, wd, w, h, acc, d); break;
            case Wd.BUTTON: button(ctx, c, f, app, wd, w, h, acc, d); break;
            case Wd.LIST: list(ctx, c, f, app, wd, w, h, acc, d); break;
            case Wd.PAD: pad(ctx, c, f, app, wd, w, h, acc); break;
            case Wd.STRIP: strip(ctx, c, f, app, wd, w, h, acc); break;
            case Wd.STAT: stat(ctx, c, f, app, wd, w, h, acc, d); break;
            case Wd.BANNER: banner(ctx, c, f, app, wd, w, h, acc, d); break;
            default: clock(ctx, c, f, app, wd); break;
        }
        return f;
    }

    /* ---- grid of ready shortcuts: bigger widget = more cells; the extra cells are suggestions from the app's list ---- */
    static void grid(Context ctx, Canvas c, Frame f, WApp app, Wd wd, float w, float h, int acc, String[] chosen) {
        int cols = Math.max(2, Math.min(5, (int) (w / 78))), rows = Math.max(1, Math.min(4, (int) (h / 74)));
        f.cols = cols; f.rows = rows; f.zones = new Act[cols * rows];
        List<Act> items = new ArrayList<>(); List<Boolean> mine = new ArrayList<>();
        for (String id : chosen) { Act a = find(ctx, app, id); if (a != null && items.size() < cols * rows) { items.add(a); mine.add(true); } }
        for (Act a : app.catalog(ctx)) {
            if (items.size() >= cols * rows) break;
            boolean has = false; for (Act x : items) if (x.id.equals(a.id)) has = true;
            if (!has) { items.add(a); mine.add(false); }
        }
        float cw = w / cols, ch = h / rows;
        for (int i = 0; i < items.size(); i++) {
            int r = i / cols, k = i % cols, col = cols - 1 - k;     // first item on the right: Arabic reading order
            Act a = items.get(i); boolean own = mine.get(i);
            f.zones[r * cols + col] = a;
            float x = col * cw, y = r * ch, in = 5;
            RectF cell = new RectF(x + in, y + in, x + cw - in, y + ch - in);
            Paint fill = paint(own ? 0x1FFFFFFF : 0x10FFFFFF); c.drawRoundRect(cell, 18, 18, fill);
            Paint st = paint(own ? (acc & 0x00FFFFFF) | 0xAA000000 : 0x30FFFFFF); st.setStyle(Paint.Style.STROKE); st.setStrokeWidth(own ? 1.6f : 1f);
            c.drawRoundRect(cell, 18, 18, st);
            float isz = Math.min(cell.width(), cell.height()) * (ch >= 62 ? .40f : .55f);
            boolean lab = ch >= 62;
            float cy = lab ? cell.top + cell.height() * .40f : cell.centerY();
            Icons.draw(c, a.icon, cell.centerX(), cy, isz, own ? WHITE : MUTED, 1.9f);
            if (lab) drawFit(c, a.label, cell.centerX(), cell.bottom - cell.height() * .15f, cell.width() - 8, 11.5f, true, own ? WHITE : MUTED, Paint.Align.CENTER);
            if (!own) {   /* a small + : a ready shortcut waiting to be chosen */
                float bx = cell.left + 12, by = cell.top + 12;
                c.drawCircle(bx, by, 8, paint(acc)); Icons.draw(c, "plus", bx, by, 11, WHITE, 2.2f);
            }
        }
    }

    /* ---- health ring (right) + three bars and a button (left) ---- */
    static void ring(Context ctx, Canvas c, Frame f, WApp app, Wd wd, float w, float h, int acc, Map<String, String> d) {
        f.cols = 2; f.rows = 1; f.zones = new Act[2];
        f.zones[1] = find(ctx, app, wd.acts[0]); f.zones[0] = find(ctx, app, wd.acts[1]);
        int score = parse(d.get("score"), 70);
        int col = score >= 75 ? GREEN : score >= 50 ? AMBER : RED;
        float rad = Math.min(h * .31f, w * .2f), cx = w * .74f, cy = h * .43f;
        Paint bgp = paint(0x20FFFFFF); bgp.setStyle(Paint.Style.STROKE); bgp.setStrokeWidth(rad * .22f); c.drawCircle(cx, cy, rad, bgp);
        Paint fg = paint(col); fg.setStyle(Paint.Style.STROKE); fg.setStrokeWidth(rad * .22f); fg.setStrokeCap(Paint.Cap.ROUND);
        c.drawArc(new RectF(cx - rad, cy - rad, cx + rad, cy + rad), -90, 360f * score / 100f, false, fg);
        Paint n = text(rad * .78f, true, col); n.setTextAlign(Paint.Align.CENTER); c.drawText(ar(String.valueOf(score)), cx, cy + rad * .27f, n);
        drawFit(c, wd.txt.length > 0 ? wd.txt[0] : "", cx, h - 10, w * .46f, 12, true, MUTED, Paint.Align.CENTER);
        String[] names = {"التخزين", "الرام", "البطارية"}, keys = {"st", "ram", "bat"};
        float lx = 14, lw = w * .46f, y0 = h * .09f, gap = h * .165f;
        for (int i = 0; i < 3; i++) {
            float y = y0 + i * gap; int v = parse(d.get(keys[i]), 0);
            drawFit(c, names[i], lx + lw, y + 11, lw * .6f, 12, true, WHITE, Paint.Align.RIGHT);
            drawFit(c, ar(v + "٪".replace("٪", "%")), lx, y + 11, lw * .4f, 12, true, MUTED, Paint.Align.LEFT);
            RectF bar = new RectF(lx, y + 17, lx + lw, y + 23);
            c.drawRoundRect(bar, 3, 3, paint(0x22FFFFFF));
            boolean bad = i == 2 ? v < 25 : v > 85, mid = i == 2 ? v < 45 : v > 70;
            c.drawRoundRect(new RectF(bar.left, bar.top, bar.left + bar.width() * v / 100f, bar.bottom), 3, 3, paint(bad ? RED : mid ? AMBER : GREEN));
        }
        RectF btn = new RectF(lx, h - 36, lx + lw, h - 10);
        Paint bp = new Paint(Paint.ANTI_ALIAS_FLAG); bp.setShader(new LinearGradient(btn.left, 0, btn.right, 0, acc, dark(acc), Shader.TileMode.CLAMP));
        c.drawRoundRect(btn, 13, 13, bp);
        drawFit(c, wd.txt.length > 1 ? wd.txt[1] : "", btn.centerX(), btn.centerY() + 4.5f, btn.width() - 10, 13, true, WHITE, Paint.Align.CENTER);
    }

    /* ---- one big button ---- */
    static void button(Context ctx, Canvas c, Frame f, WApp app, Wd wd, float w, float h, int acc, Map<String, String> d) {
        f.cols = 1; f.rows = 1; f.zones = new Act[]{find(ctx, app, wd.acts[0])};
        RectF r = new RectF(8, 8, w - 8, h - 8);
        Paint bp = new Paint(Paint.ANTI_ALIAS_FLAG); bp.setShader(new LinearGradient(0, r.top, w, r.bottom, acc, dark(acc), Shader.TileMode.CLAMP));
        c.drawRoundRect(r, 22, 22, bp);
        Paint hi = paint(0x22FFFFFF); c.drawCircle(w * .2f, h * .1f, h * .8f, hi);
        float isz = Math.min(h * .5f, 54);
        Icons.draw(c, wd.txt.length > 2 ? wd.txt[2] : "sparkle", w - 14 - isz / 2 - 6, h / 2, isz, WHITE, 2.2f);
        float tx = w - 14 - isz - 22;
        drawFit(c, fill(wd.txt[0], d), tx, h / 2 - 2, tx - 24, 20, true, WHITE, Paint.Align.RIGHT);
        drawFit(c, fill(wd.txt.length > 1 ? wd.txt[1] : "", d), tx, h / 2 + 20, tx - 24, 12.5f, false, 0xE6FFFFFF, Paint.Align.RIGHT);
    }

    /* ---- rows ---- */
    static void list(Context ctx, Canvas c, Frame f, WApp app, Wd wd, float w, float h, int acc, Map<String, String> d) {
        int n = wd.acts.length; f.cols = 1; f.rows = n; f.zones = new Act[n];
        float rh = h / n;
        for (int i = 0; i < n; i++) {
            Act a = find(ctx, app, wd.acts[i]); f.zones[i] = a; if (a == null) continue;
            RectF r = new RectF(8, i * rh + 5, w - 8, (i + 1) * rh - 5);
            c.drawRoundRect(r, 18, 18, paint(i == 0 ? (acc & 0x00FFFFFF) | 0x33000000 : 0x14FFFFFF));
            Paint st = paint(i == 0 ? (acc & 0x00FFFFFF) | 0xAA000000 : 0x28FFFFFF); st.setStyle(Paint.Style.STROKE); st.setStrokeWidth(1.2f); c.drawRoundRect(r, 18, 18, st);
            float isz = Math.min(r.height() * .55f, 30);
            Icons.draw(c, a.icon, r.right - 14 - isz / 2, r.centerY(), isz, WHITE, 2f);
            String sub = wd.txt.length > i ? fill(wd.txt[i], d) : "";
            float tx = r.right - 24 - isz;
            drawFit(c, a.label, tx, r.centerY() - (sub.length() > 0 ? 1 : -5), tx - 40, 16, true, WHITE, Paint.Align.RIGHT);
            if (sub.length() > 0) drawFit(c, sub, tx, r.centerY() + 15, tx - 40, 11.5f, false, MUTED, Paint.Align.RIGHT);
            Icons.draw(c, "left", r.left + 18, r.centerY(), 16, MUTED, 2f);
        }
    }

    /* ---- direction pad: back / up / home · left / ok / right · vol- / down / vol+ ---- */
    static void pad(Context ctx, Canvas c, Frame f, WApp app, Wd wd, float w, float h, int acc) {
        f.cols = 3; f.rows = 3; f.zones = new Act[9];
        float cw = w / 3, ch = h / 3;
        for (int i = 0; i < 9 && i < wd.acts.length; i++) {
            Act a = find(ctx, app, wd.acts[i]); f.zones[i] = a; if (a == null) continue;
            int r = i / 3, col = i % 3; float cx = col * cw + cw / 2, cy = r * ch + ch / 2;
            boolean centre = i == 4, side = (i % 2 == 1) && !centre;
            float rad = Math.min(cw, ch) * (centre ? .42f : side ? .36f : .30f);
            Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
            if (centre) p.setShader(new LinearGradient(cx - rad, cy - rad, cx + rad, cy + rad, acc, dark(acc), Shader.TileMode.CLAMP)); else p.setColor(side ? 0x26FFFFFF : 0x14FFFFFF);
            c.drawCircle(cx, cy, rad, p);
            if (!centre) { Paint st = paint(side ? 0x44FFFFFF : 0x22FFFFFF); st.setStyle(Paint.Style.STROKE); st.setStrokeWidth(1f); c.drawCircle(cx, cy, rad, st); }
            Icons.draw(c, a.icon, cx, cy, rad * (centre ? 1.0f : 1.0f), WHITE, 2.1f);
        }
    }

    /* ---- a row of round icon buttons ---- */
    static void strip(Context ctx, Canvas c, Frame f, WApp app, Wd wd, float w, float h, int acc) {
        int n = wd.acts.length; f.cols = n; f.rows = 1; f.zones = new Act[n];
        float cw = w / n; boolean lab = h >= 70;
        for (int i = 0; i < n; i++) {
            Act a = find(ctx, app, wd.acts[i]); int col = n - 1 - i; f.zones[col] = a; if (a == null) continue;
            float cx = col * cw + cw / 2, cy = lab ? h * .40f : h / 2, rad = Math.min(cw * .36f, lab ? h * .27f : h * .34f);
            Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
            if (i == 0) p.setShader(new LinearGradient(cx - rad, cy - rad, cx + rad, cy + rad, acc, dark(acc), Shader.TileMode.CLAMP)); else p.setColor(0x22FFFFFF);
            c.drawCircle(cx, cy, rad, p);
            Icons.draw(c, a.icon, cx, cy, rad * 1.05f, WHITE, 2f);
            if (lab) drawFit(c, a.label, cx, h - 12, cw - 4, 11.5f, true, i == 0 ? WHITE : MUTED, Paint.Align.CENTER);
        }
    }

    /* ---- big number with two bars: txt = title, bigKey, unit, label1, key1, label2, key2 ---- */
    static void stat(Context ctx, Canvas c, Frame f, WApp app, Wd wd, float w, float h, int acc, Map<String, String> d) {
        f.cols = 1; f.rows = 1; f.zones = new Act[]{find(ctx, app, wd.acts[0])};
        drawFit(c, wd.txt[0], w - 16, 24, w - 32, 13.5f, true, MUTED, Paint.Align.RIGHT);
        String big = ar(fill("{" + wd.txt[1] + "}", d));
        Paint bp = text(Math.min(h * .30f, 40), true, WHITE); bp.setTextAlign(Paint.Align.RIGHT);
        c.drawText(big, w - 16, h * .44f, bp);
        drawFit(c, wd.txt[2].trim(), w - 16, h * .44f + 17, w - 32, 12, false, MUTED, Paint.Align.RIGHT);
        for (int i = 0; i < 2; i++) {
            float y = h * .62f + i * (h * .16f); int v = parse(d.get(wd.txt[4 + i * 2]), 0);
            drawFit(c, wd.txt[3 + i * 2], w - 16, y + 9, w * .5f, 11.5f, true, WHITE, Paint.Align.RIGHT);
            drawFit(c, ar(v + "%"), 16, y + 9, w * .3f, 11.5f, true, MUTED, Paint.Align.LEFT);
            RectF bar = new RectF(16, y + 13, w - 16, y + 18);
            c.drawRoundRect(bar, 2.5f, 2.5f, paint(0x22FFFFFF));
            boolean bad = v > 85, mid = v > 70;
            c.drawRoundRect(new RectF(bar.left, bar.top, bar.left + bar.width() * v / 100f, bar.bottom), 2.5f, 2.5f, paint(bad ? RED : mid ? AMBER : acc));
        }
    }

    /* ---- banner: icon + title + subtitle on the right, a pill button on the left. txt = title, subtitle, button, icon ---- */
    static void banner(Context ctx, Canvas c, Frame f, WApp app, Wd wd, float w, float h, int acc, Map<String, String> d) {
        f.cols = 2; f.rows = 1; f.zones = new Act[2];
        f.zones[1] = find(ctx, app, wd.acts[0]); f.zones[0] = find(ctx, app, wd.acts[1]);
        float isz = Math.min(h * .42f, 40);
        c.drawCircle(w - 18 - isz * .7f, h * .36f, isz * .72f, paint(0x26FFFFFF));
        Icons.draw(c, wd.txt.length > 3 ? wd.txt[3] : "link", w - 18 - isz * .7f, h * .36f, isz, WHITE, 2.1f);
        float tx = w - 18 - isz * 1.5f - 8;
        drawFit(c, fill(wd.txt[0], d), w - 16, h * .74f, w * .56f, 17, true, WHITE, Paint.Align.RIGHT);
        drawFit(c, fill(wd.txt[1], d), w - 16, h * .74f + 17, w * .56f, 11.5f, false, MUTED, Paint.Align.RIGHT);
        RectF btn = new RectF(14, h * .26f, w * .38f, h * .26f + 36);
        Paint bp = new Paint(Paint.ANTI_ALIAS_FLAG); bp.setShader(new LinearGradient(btn.left, 0, btn.right, 0, acc, dark(acc), Shader.TileMode.CLAMP));
        c.drawRoundRect(btn, 18, 18, bp);
        drawFit(c, wd.txt[2], btn.centerX(), btn.centerY() + 5, btn.width() - 10, 13, true, WHITE, Paint.Align.CENTER);
        if (tx < 0) tx = 0;
    }

    /* ---- clock: only the card; the numbers are live TextClocks on top ---- */
    static void clock(Context ctx, Canvas c, Frame f, WApp app, Wd wd) {
        f.cols = 1; f.rows = 1; f.zones = new Act[]{find(ctx, app, wd.acts[0])};
    }

    static int parse(String s, int def) { try { return Integer.parseInt(s.trim()); } catch (Throwable t) { return def; } }
}
