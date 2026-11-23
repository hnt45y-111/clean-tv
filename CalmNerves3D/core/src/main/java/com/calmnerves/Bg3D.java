package com.calmnerves;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.Input;
import com.badlogic.gdx.graphics.*;
import com.badlogic.gdx.graphics.g2d.SpriteBatch;
import com.badlogic.gdx.math.MathUtils;
import com.badlogic.gdx.math.Matrix4;
import com.badlogic.gdx.utils.Array;

/** Real 3D backdrop: perspective camera + layers at different depths (gradient, rotating sunburst, stars, skyline, characters).
 *  The camera follows the phone's tilt (accelerometer) or the mouse, so everything shifts with true parallax. */
public class Bg3D {
    public static class Layer { public Texture tex; public float x, y, w, h, z = 60; public boolean hero = true; public float alpha = 1, pop = 0; }
    private final SpriteBatch sb; private final PerspectiveCamera cam = new PerspectiveCamera(40, 1, 1); private final Matrix4 m = new Matrix4();
    private Texture grad, rays, sky, star; private float t, tx, ty, ttx, tty, tapShake;
    private final float[] sx = new float[70], sy = new float[70], sz = new float[70], sp = new float[70];
    public final Array<Layer> layers = new Array<>(); public int world = 0;
    static final int[][] PAL = {{0x1c1060ff, 0x070320ff}, {0x2a1050ff, 0x0d041cff}, {0x10206aff, 0x040824ff}, {0x3a1048ff, 0x14041cff}, {0x10306aff, 0x04101fff}, {0x4a1030ff, 0x18040eff}};

    public Bg3D(SpriteBatch sb) {
        this.sb = sb; java.util.Random r = new java.util.Random(7);
        for (int i = 0; i < sx.length; i++) { sx[i] = r.nextFloat(); sy[i] = r.nextFloat(); sz[i] = -80 - r.nextFloat() * 360; sp[i] = r.nextFloat() * 6; }
        setWorld(0);
        // sunburst rays: per-pixel (no out-of-bounds triangles) so it is safe on every ABI
        Pixmap p = new Pixmap(512, 512, Pixmap.Format.RGBA8888); p.setBlending(Pixmap.Blending.None); int rc = Color.rgba8888(.8f, .75f, 1, .10f);
        for (int y = 0; y < 512; y++) for (int x = 0; x < 512; x++) { double a = Math.atan2(y - 256, x - 256) + Math.PI; p.drawPixel(x, y, ((int) (a / (Math.PI / 12)) % 2 == 0 && Math.hypot(x - 256, y - 256) < 256) ? rc : 0); }
        rays = tex(p);
        p = new Pixmap(512, 160, Pixmap.Format.RGBA8888); java.util.Random q = new java.util.Random(3); int x = 0;
        while (x < 512) { int w = Math.min(24 + q.nextInt(40), 512 - x), h = 40 + q.nextInt(100); p.setColor(0x12083aff); p.fillRectangle(x, 160 - h, w, h); p.setColor(0xffd25acc); for (int k = 0; k < 3; k++) if (q.nextInt(3) == 0) { int wx = x + 5 + q.nextInt(Math.max(1, w - 12)); if (wx + 4 < 512) p.fillRectangle(wx, 160 - h + 8 + q.nextInt(Math.max(1, h - 16)), 4, 5); } x += w + 2 + q.nextInt(6); }
        sky = tex(p);
        p = new Pixmap(48, 48, Pixmap.Format.RGBA8888); for (int i = 0; i < 24; i++) { p.setColor(1, 1, 1, (1 - i / 24f) * .9f); p.drawLine(24 - i, 24, 24 + i, 24); p.drawLine(24, 24 - i, 24, 24 + i); } p.setColor(1, 1, 1, 1); p.fillCircle(24, 24, 3); star = tex(p);
    }
    private Texture tex(Pixmap p) { Texture t = new Texture(p, true); t.setFilter(Texture.TextureFilter.MipMapLinearLinear, Texture.TextureFilter.Linear); p.dispose(); return t; }
    public void setWorld(int w) {
        world = w; if (grad != null) grad.dispose(); int[] c = PAL[Math.floorMod(w, PAL.length)]; Pixmap p = new Pixmap(4, 256, Pixmap.Format.RGBA8888);
        Color a = new Color(c[0]), b = new Color(c[1]), o = new Color();
        for (int y = 0; y < 256; y++) { o.set(a).lerp(b, y / 255f); p.setColor(o); p.drawLine(0, y, 3, y); }
        grad = new Texture(p); grad.setFilter(Texture.TextureFilter.Linear, Texture.TextureFilter.Linear); p.dispose();
    }
    public void bump() { tapShake = 1; }
    public void update(float dt) {
        t += dt;
        if (Gdx.app.getType() == com.badlogic.gdx.Application.ApplicationType.Android && Gdx.input.isPeripheralAvailable(Input.Peripheral.Accelerometer)) {
            ttx = MathUtils.clamp(-Gdx.input.getAccelerometerX() / 4.5f, -1, 1); tty = MathUtils.clamp((Gdx.input.getAccelerometerZ() - 4f) / 5f, -1, 1);
        } else { ttx = (Gdx.input.getX() / (float) Gdx.graphics.getWidth() - .5f) * 2; tty = (Gdx.input.getY() / (float) Gdx.graphics.getHeight() - .5f) * 2; }
        tx += (ttx - tx) * Math.min(1, dt * 5); ty += (tty - ty) * Math.min(1, dt * 5); tapShake = Math.max(0, tapShake - dt * 3);
    }
    public float tx() { return tx; } public float ty() { return ty; }

    public void draw(float ww, float wh, float ox, float oy) {
        float dist = (wh / 2f) / (float) Math.tan(Math.toRadians(20));
        cam.fieldOfView = 40; cam.viewportWidth = ww; cam.viewportHeight = wh; cam.near = 10; cam.far = 6000;
        cam.position.set(ww / 2 + tx * 40, wh / 2 - ty * 40, dist); cam.up.set(0, 1, 0); cam.lookAt(ww / 2, wh / 2, 0); cam.update();
        sb.setProjectionMatrix(cam.combined); sb.begin(); sb.setColor(1, 1, 1, 1);
        float k = (dist + 700) / dist; quad(grad, ww / 2, wh / 2, -700, ww * k * 1.05f, wh * k * 1.05f, 0);
        quad(rays, ww / 2, wh * .62f, -500, wh * 1.9f, wh * 1.9f, t * 4f);
        for (int i = 0; i < sx.length; i++) { float a = .35f + .65f * (.5f + .5f * MathUtils.sin(t * 2 + sp[i])); sb.setColor(1, 1, 1, a); float z = sz[i], s = 18 + (i % 4) * 7; quad(star, (sx[i] * 1.3f - .15f) * ww, sy[i] * wh, z, s, s, 0); }
        sb.setColor(1, 1, 1, 1); quad(sky, ww / 2, 120, -200, ww * 1.5f, 480, 0);
        for (Layer l : layers) if (l.tex != null) {
            float br = 1 + .018f * MathUtils.sin(t * 2.1f) + l.pop * .12f;
            m.idt().translate(ox + l.x + l.w / 2, oy + l.y + l.h / 2, l.z).rotate(0, 1, 0, tx * 13).rotate(1, 0, 0, -ty * 10).rotate(0, 0, 1, tapShake * MathUtils.sin(t * 60) * 2).scale(br, br, 1);
            sb.setTransformMatrix(m); sb.setColor(1, 1, 1, l.alpha); sb.draw(l.tex, -l.w / 2, -l.h / 2, l.w, l.h);
            if (l.pop > 0) l.pop = Math.max(0, l.pop - Gdx.graphics.getDeltaTime() * 3);
        }
        sb.setTransformMatrix(m.idt()); sb.setColor(1, 1, 1, 1); sb.end();
    }
    private void quad(Texture tx, float cx, float cy, float z, float w, float h, float rot) {
        m.idt().translate(cx, cy, z).rotate(0, 0, 1, rot); sb.setTransformMatrix(m); sb.draw(tx, -w / 2, -h / 2, w, h);
    }
    public void dispose() { grad.dispose(); rays.dispose(); sky.dispose(); star.dispose(); }
}
