package com.calmnerves;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.graphics.Color;
import com.badlogic.gdx.graphics.Pixmap;
import com.badlogic.gdx.graphics.Texture;
import com.badlogic.gdx.utils.ObjectMap;

public class Assets {
    private final ObjectMap<String, Texture> map = new ObjectMap<>();
    public Texture tex(String name) {
        Texture t = map.get(name);
        if (t == null) { t = new Texture(Gdx.files.internal("img/" + name + ".png"), true); t.setFilter(Texture.TextureFilter.MipMapLinearLinear, Texture.TextureFilter.Linear); map.put(name, t); }
        return t;
    }
    /** Avatar colour variants: hue rotation of the reference character art. */
    public Texture hue(String name, float deg) {
        if (deg == 0) return tex(name);
        String key = name + "@" + deg; Texture t = map.get(key);
        if (t == null) {
            Pixmap src = new Pixmap(Gdx.files.internal("img/" + name + ".png")); Pixmap p = new Pixmap(src.getWidth(), src.getHeight(), Pixmap.Format.RGBA8888); float[] hsv = new float[3]; Color c = new Color();
            for (int y = 0; y < src.getHeight(); y++) for (int x = 0; x < src.getWidth(); x++) {
                c.set(src.getPixel(x, y)); if (c.a == 0) { p.drawPixel(x, y, 0); continue; }
                c.toHsv(hsv); if (hsv[1] > .15f) hsv[0] = (hsv[0] + deg + 360) % 360; Color o = new Color().fromHsv(hsv); o.a = c.a; p.drawPixel(x, y, Color.rgba8888(o));
            }
            src.dispose(); t = new Texture(p, true); t.setFilter(Texture.TextureFilter.MipMapLinearLinear, Texture.TextureFilter.Linear); p.dispose(); map.put(key, t);
        }
        return t;
    }
    public void dispose() { for (Texture t : map.values()) t.dispose(); }
}
