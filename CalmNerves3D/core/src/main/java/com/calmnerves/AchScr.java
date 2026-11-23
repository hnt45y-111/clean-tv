package com.calmnerves;

import com.badlogic.gdx.graphics.Color;
import com.badlogic.gdx.scenes.scene2d.Group;
import com.badlogic.gdx.scenes.scene2d.ui.Image;
import com.badlogic.gdx.scenes.scene2d.ui.ScrollPane;

public class AchScr extends Scr {
    public static final String[] KEYS = {"first", "ten", "fifty", "streak5", "streak10", "boss1", "stars100", "rich", "daily", "steel"};
    public AchScr(CalmGame g) { super(g); }
    @Override protected void build() {
        back(); banner(I18n.t("achievements"), true, W / 2, 70);
        Group list = new Group(); float rows = 5, h = rows * 290 + 30; list.setSize(840, h);
        for (int i = 0; i < KEYS.length; i++) {
            boolean on = (g.s.achBits >> i & 1) == 1; Group c = new Group(); c.setSize(405, 270); c.addActor(panelImg(405, 270, 36, on ? 0x2a1a7aff : 0x1a1050aa, on ? 0xffc21aff : 0x4a3aa8ff, 5));
            Image ic = img(on ? "ic_crown" : "pu_second", 110); ic.setPosition(147, 140); if (!on) ic.setColor(1, 1, 1, .4f); c.addActor(ic);
            Image n = txt(I18n.sub("achNames", KEYS[i]), 38, Color.WHITE, 5, 370); n.setPosition(202 - n.getWidth() / 2, 95); c.addActor(n);
            Image d = txt(I18n.sub("achDesc", KEYS[i]), 28, new Color(1, 1, 1, .75f), 3, 370); d.setPosition(202 - d.getWidth() / 2, 30); c.addActor(d);
            c.setPosition((i % 2) * 435, h - 20 - (i / 2 + 1) * 290 + 20); list.addActor(c);
        }
        ScrollPane sp = new ScrollPane(list); sp.setScrollingDisabled(true, false); sp.setSize(840, 1550); sp.setPosition(30, 60); ui.addActor(sp);
    }
}
