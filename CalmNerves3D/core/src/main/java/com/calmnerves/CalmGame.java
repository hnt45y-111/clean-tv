package com.calmnerves;

import com.badlogic.gdx.Game;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.graphics.Texture;
import com.badlogic.gdx.graphics.g2d.SpriteBatch;
import com.badlogic.gdx.graphics.OrthographicCamera;
import com.badlogic.gdx.graphics.Pixmap;
import com.badlogic.gdx.graphics.Color;

public class CalmGame extends Game {
    public Store s; public Assets a; public Snd snd; public SpriteBatch batch; public Bg3D bg; public final Platform plat; public final java.util.List<String> toasts = new java.util.ArrayList<>(); private final TextRenderer tr;
    private Scr pending; private float curtain; private int phase; private Texture white; private com.badlogic.gdx.graphics.g2d.TextureRegion starReg; private final OrthographicCamera oc = new OrthographicCamera();
    public CalmGame(TextRenderer tr, Platform p) { this.tr = tr; this.plat = p; }
    @Override public void create() {
        Dbg.mark("1-start"); Txt.R = tr; s = new Store(); Dbg.mark("2-store"); I18n.init(); I18n.lang = s.lang; Dbg.mark("3-i18n"); Bank.init(); Dbg.mark("4-bank"); a = new Assets(); batch = new SpriteBatch(); Dbg.mark("5-batch"); snd = new Snd(s); Dbg.mark("6-sound"); bg = new Bg3D(batch); Dbg.mark("7-bg3d");
        Pixmap p = new Pixmap(2, 2, Pixmap.Format.RGBA8888); p.setColor(Color.WHITE); p.fill(); white = new Texture(p); p.dispose(); starReg = new com.badlogic.gdx.graphics.g2d.TextureRegion(a.tex("star"));
        setScreen(new MenuScr(this)); Dbg.mark("8-menu-built");
    }
    private int frames;
    /** screen change behind a sliding star curtain */
    public void go(Scr next) { if (phase != 0) { pending = next; return; } pending = next; phase = 1; curtain = 0; }
    public void setLang(String l) { s.lang = l; I18n.lang = l; Txt.clear(); s.save(); }
    @Override public void render() {
        float dt = Math.min(Gdx.graphics.getDeltaTime(), 1 / 20f);
        if (phase == 1) { curtain += dt / .28f; if (curtain >= 1) { curtain = 1; phase = 2; Scr old = (Scr) getScreen(); Txt.clear(); setScreen(pending); if (old != null) old.dispose(); } }
        else if (phase == 2) { curtain -= dt / .28f; if (curtain <= 0) { curtain = 0; phase = 0; } }
        super.render(); if (++frames == 45) Dbg.mark("OK");
        if (phase != 0) {
            float W = Gdx.graphics.getWidth(), H = Gdx.graphics.getHeight(), k = com.badlogic.gdx.math.Interpolation.pow2.apply(curtain);
            float px = phase == 1 ? -W + W * k : W * (1 - k);               // closing: slide in from the left, opening: slide out to the right
            oc.setToOrtho(false, W, H); batch.setProjectionMatrix(oc.combined); batch.begin();
            batch.setColor(0.106f, 0.071f, 0.314f, 1); batch.draw(white, px, 0, W, H);
            float sz = W * .32f; batch.setColor(1, 1, 1, 1); batch.draw(starReg, px + W / 2 - sz / 2, H / 2 - sz / 2, sz / 2, sz / 2, sz, sz, 1, 1, curtain * 360);
            batch.end();
        }
    }
    @Override public void dispose() { super.dispose(); a.dispose(); snd.dispose(); bg.dispose(); Txt.clear(); }
}
