package com.calmnerves;

import com.badlogic.gdx.graphics.Color;
import com.badlogic.gdx.scenes.scene2d.Group;
import com.badlogic.gdx.scenes.scene2d.ui.Image;

/** Base for bonus games: they spend "moves" (earned by winning levels, more on harder levels) and pay out stars. */
public abstract class BonusScr extends Scr {
    protected Image movesImg, starsImg;
    protected BonusScr(CalmGame g) { super(g); }
    protected abstract String title(); protected abstract String desc(); protected abstract void buildGame();
    @Override protected void onBack() { g.go(new ArenaScr(g)); }
    @Override protected void build() { back(); banner(title(), false, W / 2, 48); put(txt(desc(), 38, new Color(1, 1, 1, .85f), 4, 780), W / 2, 210); hud(); buildGame(); }
    protected void hud() {
        if (movesImg != null) movesImg.remove(); if (starsImg != null) starsImg.remove();
        movesImg = txt(I18n.t("moves") + ": " + g.s.moves, 50, Color.GOLD, 6, 400); put(movesImg, 230, 290);
        starsImg = txt("★ " + g.s.stars, 50, Color.GOLD, 6, 400); put(starsImg, W - 190, 290);
    }
    /** false (with a message) when out of moves */
    protected boolean spend() { if (g.s.moves <= 0) { toast(I18n.t("noMoves")); return false; } g.s.moves--; g.s.save(); hud(); return true; }
    protected void reward(int n, float x, float y) { if (n <= 0) return; g.s.stars += n; g.s.save(); hud(); g.snd.play("correct"); Fx.burst(ui, x, y, 10 + n, null); Fx.popText(this, ui, "+" + n + " ★", false); }
    protected Group tileBtn(String icon, float size) { Group t = new Group(); t.setSize(size, size); Image bg = new Image(Gfx.panel(size, size, size * .16f, 0x14106aff, 0xffb52eff, 5)); bg.setSize(size, size); t.addActor(bg); Image ic = img(icon, size * .74f); ic.setPosition(size * .13f, size * .13f); t.addActor(ic); return t; }
}
