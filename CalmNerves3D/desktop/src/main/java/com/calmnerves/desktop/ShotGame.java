package com.calmnerves.desktop;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.graphics.Pixmap;
import com.badlogic.gdx.graphics.PixmapIO;
import com.badlogic.gdx.utils.BufferUtils;
import com.badlogic.gdx.utils.ScreenUtils;
import com.calmnerves.*;
import java.util.*;

/** Test driver: walks through every screen / challenge type and saves screenshots (run under xvfb). */
public class ShotGame extends CalmGame {
    private final List<Object[]> steps = new ArrayList<>(); private float t; private int i;
    public ShotGame(TextRenderer tr, Platform p) { super(tr, p); }
    private void step(float wait, String name, Runnable r) { steps.add(new Object[]{wait, name, r}); }
    private void ch(String name, String type, boolean boss, int level) {
        step(.2f, null, () -> { GameScr.Opts o = new GameScr.Opts(); o.level = level; o.seed = 5; o.type = type; o.boss = boss; o.noPU = false; o.title = name; go(new GameScr(this, o, r -> { }));});
        step(1.6f, name, null);
    }
    @Override public void create() {
        super.create();
        step(1.8f, "menu", null);
        step(.1f, null, () -> go(new MapScr(this))); step(1.5f, "map", null);
        step(.1f, null, () -> go(new SettingsScr(this))); step(1.2f, "settings", null);
        step(.1f, null, () -> go(new ProfileScr(this))); step(1.2f, "profile", null);
        step(.1f, null, () -> go(new AchScr(this))); step(1.2f, "ach", null);
        step(.1f, null, () -> go(new DailyScr(this))); step(1.2f, "daily", null);
        step(.1f, null, () -> go(new DiffScr(this))); step(1.5f, "diff", null);
        for (String id : Challenges.IDS) ch(id, id, false, 12);
        ch("boss", null, true, 10);
        step(.1f, null, () -> { s.tutorialDone = false; Modes.campaign(this, 1); }); step(1.8f, "tutorial1", null);
        step(.1f, null, () -> go(new ResultScr(this, true, 3, 5, 485, 1.3f, () -> { }))); step(2.6f, "result_win", null);
        step(.1f, null, () -> go(new ResultScr(this, false, 3, 5, 0, 1f, () -> { }))); step(1.6f, "result_lose", null);
        step(.1f, null, () -> { setLang("en"); go(new MenuScr(this)); }); step(2f, "menu_en", null);
        step(.1f, null, () -> Gdx.app.exit());
    }
    @Override public void render() {
        super.render(); if (i >= steps.size()) return; t += Gdx.graphics.getDeltaTime(); Object[] st = steps.get(i);
        if (t >= (float) st[0]) {
            t = 0; i++; if (st[2] != null) ((Runnable) st[2]).run();
            if (st[1] != null) { byte[] px = ScreenUtils.getFrameBufferPixels(0, 0, Gdx.graphics.getBackBufferWidth(), Gdx.graphics.getBackBufferHeight(), true); Pixmap pm = new Pixmap(Gdx.graphics.getBackBufferWidth(), Gdx.graphics.getBackBufferHeight(), Pixmap.Format.RGBA8888); BufferUtils.copy(px, 0, pm.getPixels(), px.length); PixmapIO.writePNG(Gdx.files.absolute("/tmp/shots3d/" + st[1] + ".png"), pm); pm.dispose(); }
        }
    }
}
