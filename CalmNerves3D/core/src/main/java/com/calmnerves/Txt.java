package com.calmnerves;

import com.badlogic.gdx.graphics.Color;
import com.badlogic.gdx.graphics.Pixmap;
import com.badlogic.gdx.graphics.Texture;
import com.badlogic.gdx.graphics.g2d.TextureRegion;
import com.badlogic.gdx.scenes.scene2d.ui.Image;
import com.badlogic.gdx.utils.Align;
import com.badlogic.gdx.utils.Array;
import com.badlogic.gdx.utils.ObjectMap;

/** Text -> texture cache. Rendered at SS x for crispness, shown at 1/SS size. */
public class Txt {
    public static TextRenderer R;
    static final float SS = 1.6f;
    static final ObjectMap<String, TextureRegion> cache = new ObjectMap<>();
    static final Array<Texture> textures = new Array<>();
    public static final Color WHITE = Color.WHITE, INK = new Color(0x1a0a3aff), GOLD = new Color(0xffd21fff), BROWN = new Color(0x3a1c08ff), DARK = new Color(0x2a0f3eff);

    public static Image label(String s, int size, Color c, int outline, float maxW) {
        String key = s + '|' + size + '|' + c + '|' + outline + '|' + maxW;
        TextureRegion r = cache.get(key);
        if (r == null) {
            Pixmap p = R.render(s, Math.round(size * SS), Color.rgba8888(c), Math.round(outline * SS), Color.rgba8888(INK), Math.round(maxW * SS), true);
            Texture t = new Texture(p, true); t.setFilter(Texture.TextureFilter.MipMapLinearLinear, Texture.TextureFilter.Linear); p.dispose();
            textures.add(t); r = new TextureRegion(t); cache.put(key, r);
        }
        Image i = new Image(r); i.setSize(r.getRegionWidth() / SS, r.getRegionHeight() / SS); i.setOrigin(Align.center); i.setTouchable(com.badlogic.gdx.scenes.scene2d.Touchable.disabled); return i;
    }
    public static Image label(String s, int size) { return label(s, size, WHITE, size / 12, 0); }
    public static void clear() { cache.clear(); for (Texture t : textures) t.dispose(); textures.clear(); }
}
