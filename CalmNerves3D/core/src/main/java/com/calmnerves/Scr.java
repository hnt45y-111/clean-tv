package com.calmnerves;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.Input;
import com.badlogic.gdx.ScreenAdapter;
import com.badlogic.gdx.graphics.Color;
import com.badlogic.gdx.graphics.Texture;
import com.badlogic.gdx.math.Interpolation;
import com.badlogic.gdx.scenes.scene2d.*;
import com.badlogic.gdx.scenes.scene2d.actions.Actions;
import com.badlogic.gdx.scenes.scene2d.ui.Image;
import com.badlogic.gdx.scenes.scene2d.utils.ClickListener;
import com.badlogic.gdx.utils.Align;
import com.badlogic.gdx.utils.viewport.ExtendViewport;

/** Base screen: 900x1950 design space (y measured from the TOP via put()), real-3D backdrop underneath, Scene2D UI on top. */
public abstract class Scr extends ScreenAdapter {
    public static final float W = 900, H = 1950;
    protected final CalmGame g; protected Stage st; protected Group ui = new Group(); protected float ww = W, wh = H;
    protected Scr(CalmGame g) { this.g = g; st = new Stage(new ExtendViewport(W, H), g.batch); ui.setSize(W, H); st.addActor(ui); }
    protected abstract void build();
    protected void onBack() { g.go(new MenuScr(g)); }
    protected int world() { return 0; }
    @Override public void show() {
        g.bg.layers.clear(); g.bg.setWorld(world()); Gdx.input.setCatchKey(Input.Keys.BACK, true); Gdx.input.setInputProcessor(st);
        st.addListener(new InputListener() { public boolean keyDown(InputEvent e, int k) { if (k == Input.Keys.BACK || k == Input.Keys.ESCAPE) { onBack(); return true; } return false; } });
        st.setKeyboardFocus(ui); resize(Gdx.graphics.getWidth(), Gdx.graphics.getHeight()); build();
        for (String m : g.toasts) toast(m); g.toasts.clear();
    }
    @Override public void resize(int w, int h) { st.getViewport().update(w, h, true); ww = st.getViewport().getWorldWidth(); wh = st.getViewport().getWorldHeight(); ui.setPosition((ww - W) / 2, (wh - H) / 2); }
    protected float ox() { return (ww - W) / 2; } protected float oy() { return (wh - H) / 2; }
    protected void update(float dt) { }
    @Override public void render(float dt) {
        update(dt); g.bg.update(dt); st.getViewport().apply(); g.bg.draw(ww, wh, ox(), oy()); st.act(dt); st.draw();
    }
    @Override public void dispose() { st.dispose(); }

    // ---------- helpers ----------
    protected Image img(String n, float w) { Texture t = g.a.tex(n); Image i = new Image(t); i.setSize(w, w * t.getHeight() / t.getWidth()); i.setOrigin(Align.center); return i; }
    protected Image txt(String s, int size, Color c, int outline, float maxW) { return Txt.label(s, size, c, outline, maxW); }
    protected Image txt(String s, int size) { return Txt.label(s, size); }
    /** place actor by centre-x and TOP y (design space). */
    protected <T extends Actor> T put(T a, float cx, float top) { a.setPosition(cx - a.getWidth() / 2, H - top - a.getHeight()); ui.addActor(a); return a; }
    protected Layer3 hero(String tex, float cx, float top, float w) { return hero(g.a.tex(tex), cx, top, w); }
    protected Layer3 hero(Texture t, float cx, float top, float w) {
        Bg3D.Layer l = new Bg3D.Layer(); l.tex = t; l.w = w; l.h = w * t.getHeight() / t.getWidth(); l.x = cx - w / 2; l.y = H - top - l.h; g.bg.layers.add(l); return new Layer3(l);
    }
    public static class Layer3 { public final Bg3D.Layer l; Layer3(Bg3D.Layer l) { this.l = l; } }

    /** glossy button built from reference art with a live text label; squash & bounce on press. */
    protected Group btn(String asset, float w, String label, int size, float textOffsetX, Runnable r) {
        Image bg = img(asset, w); Group b = new Group(); b.setSize(bg.getWidth(), bg.getHeight()); b.addActor(bg);
        if (label != null && !label.isEmpty()) { Image t = txt(label, size, Color.WHITE, Math.max(4, size / 9), w * .62f); t.setPosition(b.getWidth() / 2 - t.getWidth() / 2 + textOffsetX, b.getHeight() / 2 - t.getHeight() / 2 + 2); b.addActor(t); }
        b.setOrigin(Align.center); press(b, r); return b;
    }
    protected void press(Group b, Runnable r) {
        b.setTransform(true); b.setOrigin(Align.center);
        b.addListener(new ClickListener() {
            @Override public boolean touchDown(InputEvent e, float x, float y, int p, int bt) { b.clearActions(); b.addAction(Actions.scaleTo(.92f, .86f, .06f)); return super.touchDown(e, x, y, p, bt); }
            @Override public void touchUp(InputEvent e, float x, float y, int p, int bt) { b.addAction(Actions.scaleTo(1, 1, .35f, Interpolation.bounceOut)); super.touchUp(e, x, y, p, bt); }
            @Override public void clicked(InputEvent e, float x, float y) { g.snd.play("tap"); g.snd.vib(12); g.bg.bump(); if (r != null) r.run(); }
        });
    }
    protected Group round(String asset, float w, Runnable r) { Image i = img(asset, w); Group b = new Group(); b.setSize(i.getWidth(), i.getHeight()); b.addActor(i); press(b, r); return b; }
    protected Group back() { Group b = round("round_back", 110, this::onBack); b.setPosition(26, H - 26 - b.getHeight()); ui.addActor(b); return b; }
    protected Group banner(String text, boolean crowned, float cx, float top) {
        Image bn = img(crowned ? "banner_map" : "banner_stage", crowned ? 640 : 400); Group gp = new Group(); gp.setSize(bn.getWidth(), bn.getHeight()); gp.addActor(bn);
        Image t = crowned ? txt(text, 50, Color.WHITE, 7, 0) : txt(text, 46, new Color(0x5a2a05ff), 0, 0); float fit = Math.min(1f, bn.getWidth() * (crowned ? .8f : .82f) / t.getWidth()); t.setScale(fit);
        t.setPosition(gp.getWidth() / 2 - t.getWidth() / 2, gp.getHeight() * (crowned ? .46f : .5f) - t.getHeight() / 2); gp.addActor(t);
        if (crowned) { Image c = img("crown", 210); c.setPosition(gp.getWidth() / 2 - c.getWidth() / 2, gp.getHeight() - 28); gp.addActor(c); c.addAction(Actions.forever(Actions.sequence(Actions.moveBy(0, 8, 1.2f, Interpolation.sine), Actions.moveBy(0, -8, 1.2f, Interpolation.sine)))); }
        put(gp, cx, crowned ? top + 75 : top); gp.setTransform(true); gp.setOrigin(Align.center); gp.setScale(1, 0); gp.addAction(Actions.scaleTo(1, 1, .6f, Interpolation.bounceOut)); return gp;
    }
    protected void pop(Actor a, float delay) { if (a instanceof Group) ((Group) a).setTransform(true); a.setOrigin(Align.center); a.setScale(0); a.addAction(Actions.delay(delay, Actions.scaleTo(1, 1, .5f, Interpolation.swingOut))); }
    protected Image panelImg(float w, float h, float r, int fill, int border, float bw) { Image i = new Image(Gfx.panel(w, h, r, fill, border, bw)); i.setSize(w, h); return i; }
    /** pill-shaped selectable chip */
    protected Group chip(String label, boolean sel, float w, Runnable r) {
        Group c = new Group(); c.setSize(w, 84); c.addActor(panelImg(w, 84, 42, sel ? 0x4cc21aff : 0x2a1a7aff, sel ? 0x1a0a3aff : 0x6a4cd8ff, 4));
        Image t = txt(label, 38, sel ? new Color(0x0a2a00ff) : Color.WHITE, sel ? 0 : 4, w - 24); t.setPosition(w / 2 - t.getWidth() / 2, 42 - t.getHeight() / 2); c.addActor(t); press(c, r); return c;
    }
    protected Group toggle(boolean on, java.util.function.Consumer<Boolean> r) {
        Group c = new Group(); c.setSize(150, 80); Image bgi = panelImg(150, 80, 40, on ? 0x3fbf1aff : 0x555555ff, 0x1a0a3aff, 4); c.addActor(bgi);
        Image knob = panelImg(64, 64, 32, 0xffffffff, 0xdddddd, 0); knob.setPosition(on ? 80 : 8, 8); c.addActor(knob);
        final boolean[] v = {on}; press(c, () -> { v[0] = !v[0]; r.accept(v[0]); bgi.setDrawable(new com.badlogic.gdx.scenes.scene2d.utils.TextureRegionDrawable(Gfx.panel(150, 80, 40, v[0] ? 0x3fbf1aff : 0x555555ff, 0x1a0a3aff, 4))); knob.addAction(Actions.moveTo(v[0] ? 80 : 8, 8, .15f)); });
        return c;
    }
    protected void toast(String s) { Image t = txt(s, 44, Color.WHITE, 6, 780); put(t, W / 2, 250); t.addAction(Actions.sequence(Actions.moveBy(0, 40, 1.6f), Actions.fadeOut(.4f), Actions.removeActor())); }
}
