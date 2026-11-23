package com.calmnerves;

import com.badlogic.gdx.graphics.Color;
import com.badlogic.gdx.graphics.Pixmap;
import com.badlogic.gdx.graphics.Texture;
import com.badlogic.gdx.utils.ObjectMap;

/** Procedural textures (panels, map nodes, flag) drawn once and cached. */
public class Gfx {
    private static final ObjectMap<String, Texture> cache = new ObjectMap<>();
    private static Texture mk(String key, Pixmap p) { Texture t = new Texture(p, true); t.setFilter(Texture.TextureFilter.MipMapLinearLinear, Texture.TextureFilter.Linear); p.dispose(); cache.put(key, t); return t; }
    private static void rr(Pixmap p, int x, int y, int w, int h, int r, int col) {
        p.setColor(col); if (w - 2 * r > 0) p.fillRectangle(x + r, y, w - 2 * r, h); if (h - 2 * r > 0) p.fillRectangle(x, y + r, w, h - 2 * r);
        p.fillCircle(x + r, y + r, r); p.fillCircle(x + w - r - 1, y + r, r); p.fillCircle(x + r, y + h - r - 1, r); p.fillCircle(x + w - r - 1, y + h - r - 1, r);
    }
    /** rounded panel with border, drawn at 2x for smooth edges */
    public static Texture panel(float w, float h, float r, int fill, int border, float bw) {
        String key = "p" + w + h + r + fill + border + bw; Texture t = cache.get(key); if (t != null) return t;
        int W = (int) (w * 2), H = (int) (h * 2), R = (int) (r * 2), B = (int) (bw * 2); Pixmap p = new Pixmap(W, H, Pixmap.Format.RGBA8888);
        if (B > 0) rr(p, 0, 0, W, H, R, border); rr(p, B, B, W - 2 * B, H - 2 * B, Math.max(1, R - B), fill); return mk(key, p);
    }
    /** dark glossy map node plate; state 0 locked, 1 done, 2 current */
    public static Texture node(int state) {
        String key = "n" + state; Texture t = cache.get(key); if (t != null) return t;
        Pixmap p = new Pixmap(256, 190, Pixmap.Format.RGBA8888);
        int rim = state == 2 ? 0x8cf12aff : state == 1 ? 0x5cc8ffff : 0xff9a2acc, in1 = state == 2 ? 0x2fae10ff : state == 1 ? 0x2a6cc8ff : 0x20203aff, in2 = state == 2 ? 0xb8ff5aff : state == 1 ? 0x7fe8ffff : 0x4a4a6aff;
        p.setColor(0x0a0820ff); fillEll(p, 128, 96, 120, 78); p.setColor(rim); fillEll(p, 128, 90, 118, 76); p.setColor(0x120a30ff); fillEll(p, 128, 90, 108, 68);
        for (int i = 0; i < 12; i++) { Color c = new Color(in1).lerp(new Color(in2), i / 11f); p.setColor(c); fillEll(p, 128, 90 - i * 2, 100 - i * 5, 62 - i * 3); }
        return mk(key, p);
    }
    private static void fillEll(Pixmap p, int cx, int cy, int rx, int ry) { for (int y = -ry; y <= ry; y++) { int hw = (int) (rx * Math.sqrt(1 - (y * y) / (double) (ry * ry))); p.fillRectangle(cx - hw, cy + y, hw * 2, 1); } }
    public static Texture white() { Texture t = cache.get("white"); if (t != null) return t; Pixmap p = new Pixmap(4, 4, Pixmap.Format.RGBA8888); p.setColor(Color.WHITE); p.fill(); t = new Texture(p); p.dispose(); cache.put("white", t); return t; }
    public static Texture dot() { Texture t = cache.get("dot"); if (t != null) return t; Pixmap p = new Pixmap(64, 64, Pixmap.Format.RGBA8888); for (int r = 30; r > 0; r--) { p.setColor(1, 1, 1, r > 22 ? (30 - r) / 8f : 1f); p.fillCircle(32, 32, r); } return mk("dot", p); }
    public static Texture cup() {
        Texture t = cache.get("cup"); if (t != null) return t; Pixmap p = new Pixmap(240, 280, Pixmap.Format.RGBA8888);
        for (int y = 0; y < 270; y++) { int hw = 56 + 56 * y / 270; for (int x = -hw; x <= hw; x++) { float k = (x + hw) / (2f * hw); Color c = new Color(0x3a8fe0ff).lerp(new Color(0xbfe4ffff), 1 - Math.abs(k - .3f) * 1.4f).lerp(new Color(0x0e3a7aff), y / 270f * .5f); boolean edge = x < -hw + 6 || x > hw - 6 || y < 6 || y > 262; p.setColor(edge ? 0x1a0a3aff : Color.rgba8888(c)); p.drawPixel(120 + x, 6 + y); } }
        p.setColor(0x1a0a3aff); p.fillRectangle(52, 262, 136, 10); p.setColor(0xff4a3aff); p.fillRectangle(60, 244, 120, 14); return mk("cup", p);
    }
    public static Texture ring() { Texture t = cache.get("ring"); if (t != null) return t; Pixmap p = new Pixmap(128, 128, Pixmap.Format.RGBA8888); p.setColor(0x6a3a00ff); p.fillCircle(64, 64, 58); p.setColor(0xffc21aff); p.fillCircle(64, 64, 52); p.setColor(0xffe97aff); p.fillCircle(52, 52, 36); p.setBlending(Pixmap.Blending.None); p.setColor(0, 0, 0, 0); p.fillCircle(64, 64, 30); return mk("ring", p); }
    public static Texture flag() {
        Texture t = cache.get("flag"); if (t != null) return t; Pixmap p = new Pixmap(96, 128, Pixmap.Format.RGBA8888);
        p.setColor(0x1a0a3aff); p.fillRectangle(14, 6, 8, 118); p.setColor(0xff3b3bff); p.fillTriangle(22, 8, 90, 32, 22, 60); p.setColor(0x1a0a3aff); p.drawLine(22, 8, 90, 32); p.drawLine(90, 32, 22, 60); return mk("flag", p);
    }
}
