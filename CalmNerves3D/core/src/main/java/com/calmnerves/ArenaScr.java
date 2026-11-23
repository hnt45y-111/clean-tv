package com.calmnerves;

import com.badlogic.gdx.graphics.Color;
import com.badlogic.gdx.scenes.scene2d.Group;
import com.badlogic.gdx.scenes.scene2d.ui.Image;

/** Bonus Arena hub: four mini-games paid for with moves earned by winning levels. */
public class ArenaScr extends Scr {
    public ArenaScr(CalmGame g) { super(g); }
    @Override protected void build() {
        back(); banner(I18n.t("arena"), true, W / 2, 70);
        put(txt(I18n.t("moves") + ": " + g.s.moves + "    ★ " + g.s.stars, 56, Color.GOLD, 7, 800), W / 2, 330);
        String[][] games = {{"ic_crown", "match3", "match3d"}, {"ic_gift", "pairs", "pairsd"}, {"em_sun1", "simon", "simond"}, {"flame", "whack", "whackd"}};
        for (int i = 0; i < 4; i++) {
            final int k = i; Group c = new Group(); c.setSize(400, 520); c.addActor(panelImg(400, 520, 44, 0x1c1260f0, 0x6a4cd8ff, 6));
            Image ic = img(games[i][0], 190); ic.setPosition(105, 300); c.addActor(ic); Image n = txt(I18n.t(games[i][1]), 46, Color.GOLD, 6, 360); n.setPosition(200 - n.getWidth() / 2, 220); c.addActor(n);
            Image d = txt(I18n.t(games[i][2]), 31, Color.WHITE, 3, 350); d.setPosition(200 - d.getWidth() / 2, 70); c.addActor(d);
            press(c, () -> g.go(k == 0 ? new Match3Scr(g) : k == 1 ? new PairsScr(g) : k == 2 ? new SimonScr(g) : new WhackScr(g)));
            put(c, 235 + (i % 2) * 430, 430 + (i / 2) * 560); pop(c, .1f * i);
        }
        put(txt(I18n.t("noMoves"), 32, new Color(1, 1, 1, .6f), 3, 800), W / 2, 1600);
    }
}
