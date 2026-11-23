package com.calmnerves.android;

import android.content.res.AssetManager;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.text.Layout;
import android.text.StaticLayout;
import android.text.TextPaint;
import com.badlogic.gdx.graphics.Pixmap;
import com.calmnerves.TextRenderer;
import java.nio.ByteBuffer;

/** Android text: StaticLayout shapes Arabic (joins + RTL) with the Cairo font; drawn to a bitmap and handed to libGDX. */
public class AndroidText implements TextRenderer {
    private final Typeface tf;
    public AndroidText(AssetManager am) { tf = Typeface.createFromAsset(am, "fonts/cairo.ttf"); }
    private static int argb(int rgba) { return (rgba >>> 8) | ((rgba & 0xFF) << 24); }
    @Override public Pixmap render(String text, int size, int color, int outline, int outlineColor, int maxW, boolean center) {
        TextPaint p = new TextPaint(Paint.ANTI_ALIAS_FLAG); p.setTypeface(tf); p.setTextSize(size);
        int w = maxW;
        if (w <= 0) { float m = 1; for (String line : text.split("\n")) m = Math.max(m, Layout.getDesiredWidth(line.isEmpty() ? " " : line, p)); w = (int) Math.ceil(m) + 2; }
        StaticLayout sl = StaticLayout.Builder.obtain(text, 0, text.length(), p, w).setAlignment(center ? Layout.Alignment.ALIGN_CENTER : Layout.Alignment.ALIGN_NORMAL).build();
        int pad = outline + 4, W = w + pad * 2, H = Math.max(2, sl.getHeight() + pad * 2);
        Bitmap bm = Bitmap.createBitmap(W, H, Bitmap.Config.ARGB_8888); Canvas cv = new Canvas(bm); cv.translate(pad, pad);
        if (outline > 0) { p.setStyle(Paint.Style.STROKE); p.setStrokeWidth(outline * 2f); p.setStrokeJoin(Paint.Join.ROUND); p.setColor(argb(outlineColor)); sl.draw(cv); p.setStyle(Paint.Style.FILL); }
        p.setColor(argb(color)); sl.draw(cv);
        int[] px = new int[W * H]; bm.getPixels(px, 0, W, 0, 0, W, H); bm.recycle();
        Pixmap pm = new Pixmap(W, H, Pixmap.Format.RGBA8888); ByteBuffer bb = pm.getPixels();
        for (int a : px) bb.put((byte) (a >> 16)).put((byte) (a >> 8)).put((byte) a).put((byte) (a >>> 24));
        bb.rewind(); return pm;
    }
}
