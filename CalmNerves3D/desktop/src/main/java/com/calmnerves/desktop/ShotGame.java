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
        step(.3f, null, () -> { s.moves = 30; s.level = 23; s.tutorialDone = true; s.avatar = 0; s.typePlays[4] = 9; s.typeWins[4] = 6; s.wins = 12; s.played = 20; s.fastest = 3; });
        step(1.8f, "menu", null);
        step(.1f, null, () -> go(new MapScr(this))); step(1.5f, "map", null);
        step(.1f, null, () -> go(new ProfileScr(this))); step(1.3f, "profile", null);
        step(.1f, null, () -> go(new ArenaScr(this))); step(1.4f, "arena", null);
        step(.1f, null, () -> go(new Match3Scr(this))); step(1.4f, "match3", null);
        step(.1f, null, () -> go(new PairsScr(this))); step(1.4f, "pairs", null);
        step(.1f, null, () -> go(new SimonScr(this))); step(1.4f, "simon", null);
        step(.1f, null, () -> go(new WhackScr(this))); step(2.6f, "whack", null);
        step(.1f, null, () -> go(new TournamentScr(this))); step(1.4f, "tournament", null);
        ch("reverse", "reverse", false, 15); ch("boss", null, true, 10); ch("dontpress", "dontpress", false, 3);
        step(.1f, null, () -> { s.tutorialDone = false; Modes.campaign(this, 1); }); step(1.8f, "tutorial1", null);
        step(.1f, null, () -> { s.tutorialDone = true; GameScr.Opts o = new GameScr.Opts(); o.level = 14; o.seed = 3; o.title = I18n.t("endless") + " · 7"; go(new GameScr(this, o, r -> { })); }); step(1.6f, "steel_title", null);
        step(.1f, null, () -> go(new ResultScr(this, true, 3, 5, 485, 1.3f, () -> { }))); step(2.6f, "result_win", null);
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
