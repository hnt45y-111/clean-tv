package com.calmnerves;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.graphics.Color;
import com.badlogic.gdx.graphics.GL20;
import com.badlogic.gdx.graphics.g2d.Batch;
import com.badlogic.gdx.graphics.glutils.ShapeRenderer;
import com.badlogic.gdx.math.MathUtils;
import com.badlogic.gdx.math.Interpolation;
import com.badlogic.gdx.scenes.scene2d.Actor;
import com.badlogic.gdx.scenes.scene2d.Group;
import com.badlogic.gdx.scenes.scene2d.actions.Actions;
import com.badlogic.gdx.scenes.scene2d.ui.Image;
import com.badlogic.gdx.scenes.scene2d.ui.ScrollPane;
import com.badlogic.gdx.scenes.scene2d.ui.Skin;
import com.badlogic.gdx.utils.Align;

/** Level map: winding glowing trail, numbered nodes, flaming angry boss every 10 levels, level 500 final. Nodes are created lazily while scrolling. */
public class MapScr extends Scr {
    static final int N = 500; static final float STEP = 175, TOP_PAD = 260, BOT_PAD = 260; final float total = N * STEP + TOP_PAD + BOT_PAD;
    Group content = new Group(); ScrollPane sp; final boolean[] made = new boolean[N + 2]; ShapeRenderer sr = new ShapeRenderer();
    public MapScr(CalmGame g) { super(g); }
    float nx(int n) { return 450 + 250 * MathUtils.sin(n * .9f); }
    float ny(int n) { return total - BOT_PAD - (n - 1) * STEP; } // y from content top
    @Override protected void build() {
        content.setSize(W, total);
        content.addActor(new Actor() { // glowing orange trail
            @Override public void draw(Batch b, float pa) {
                b.end(); Gdx.gl.glEnable(GL20.GL_BLEND); sr.setProjectionMatrix(b.getProjectionMatrix()); sr.setTransformMatrix(b.getTransformMatrix());
                sr.begin(ShapeRenderer.ShapeType.Filled);
                float vis0 = Math.max(1, (int) ((total - BOT_PAD - (sp.getScrollY() + sp.getHeight() + 300)) / STEP)), vis1 = Math.min(N - 1, vis0 + 16);
                for (int i = (int) vis0; i <= vis1; i++) { float x1 = nx(i), y1 = total - ny(i), x2 = nx(i + 1), y2 = total - ny(i + 1); sr.setColor(1, .54f, .08f, .30f); sr.rectLine(x1, y1, x2, y2, 30); sr.setColor(1, .84f, .48f, 1); sr.rectLine(x1, y1, x2, y2, 9); }
                sr.end(); b.begin();
            }
        });
        sp = new ScrollPane(content); sp.setScrollingDisabled(true, false); sp.setOverscroll(false, true); sp.setFlingTime(.8f); sp.setSize(W, H - 300); sp.setPosition(0, 0); ui.addActor(sp);
        Group b = back(); b.toFront();
        Group bn = banner(I18n.arr("titles")[Math.min(6, (g.s.level - 1) / 15)], true, W / 2, 58);
        Group tro = round("round_trophy2", 120, () -> g.go(new AchScr(g))); tro.setPosition(W - 26 - 120, H - 26 - tro.getHeight()); ui.addActor(tro);
        sp.layout(); sp.setScrollY(Math.max(0, ny(Math.min(N, g.s.level)) - sp.getHeight() / 2)); sp.updateVisualScroll(); spawn();
    }
    void spawn() {
        float y0 = sp.getScrollY() - 300, y1 = sp.getScrollY() + sp.getHeight() + 300; int made_ = 0;
        for (int n = 1; n <= N; n++) { float y = ny(n); if (y < y0 || y > y1 || made[n]) continue; made[n] = true; node(n); if (++made_ > 6) break; }
    }
    void node(int n) {
        boolean boss = n % 10 == 0, fin = n == N; int st = n < g.s.level ? 1 : n == g.s.level ? 2 : 0; float cx = nx(n), cy = total - ny(n); Group nd = new Group(); nd.setTransform(true);
        if (boss) {
            Image f = img(fin ? "flame2" : "flame", fin ? 240 : 190); f.setPosition(-f.getWidth() / 2, -20); nd.addActor(f); f.setOrigin(Align.center);
            f.addAction(Actions.forever(Actions.sequence(Actions.scaleTo(1.07f, 1.07f, .5f, Interpolation.sine), Actions.scaleTo(1, 1, .5f, Interpolation.sine))));
            Image l = txt("" + n, 54, Color.WHITE, 8, 200); l.setPosition(-l.getWidth() / 2, -60); nd.addActor(l);
            if (fin) { Image s = txt(I18n.t("finalStage"), 32, Color.WHITE, 5, 260); s.setPosition(-s.getWidth() / 2, -110); nd.addActor(s); }
        } else {
            Image p = new Image(Gfx.node(st)); p.setSize(150, 111); p.setPosition(-75, -55); nd.addActor(p); Image l = txt("" + n, 52, Color.WHITE, 7, 130); l.setPosition(-l.getWidth() / 2, -l.getHeight() / 2 + 2); nd.addActor(l);
            if (st == 2) { Image fl = new Image(Gfx.flag()); fl.setSize(72, 96); fl.setPosition(30, 10); nd.addActor(fl); nd.addAction(Actions.forever(Actions.sequence(Actions.scaleTo(1.12f, 1.12f, .6f, Interpolation.sine), Actions.scaleTo(1, 1, .6f, Interpolation.sine)))); }
        }
        nd.setPosition(cx, cy); nd.setSize(150, 111);
        if (n <= g.s.level) press(nd, () -> Modes.campaign(g, n)); else nd.setTouchable(com.badlogic.gdx.scenes.scene2d.Touchable.disabled);
        content.addActor(nd);
    }
    @Override protected void update(float dt) { spawn(); }
    @Override public void dispose() { super.dispose(); sr.dispose(); }
}
