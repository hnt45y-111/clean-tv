package com.calmnerves;

import com.badlogic.gdx.graphics.Color;
import com.badlogic.gdx.scenes.scene2d.Group;
import com.badlogic.gdx.scenes.scene2d.ui.Image;
import java.util.List;

/** Tournament that renews every 2 days: everyone plays the same seeded run, the best score is kept, top 3 win stars. Needs the online service (Config). */
public class TournamentScr extends Scr {
    public static int tid() { return (int) (System.currentTimeMillis() / 86400000L / 2); }
    public static long endMs(int tid) { return (tid + 1L) * 2 * 86400000L; }
    final int tid = tid(); Image clock; String clockStr = ""; Group rows; Image status;
    public TournamentScr(CalmGame g) { super(g); }
    @Override protected void build() {
        back(); banner(I18n.t("tournament"), true, W / 2, 70);
        put(txt(I18n.t("prizes"), 32, Color.WHITE, 4, 840), W / 2, 395);
        if (g.s.tourPlayed == tid) put(txt(I18n.t("yourBest", "s", g.s.tourBest), 44, Color.GOLD, 5, 700), W / 2, 460);
        rows = new Group(); rows.setSize(820, 900); put(rows, W / 2, 540);
        Group play = btn("btn_green", 560, I18n.t("play"), 66, 0, () -> Modes.tournamentRun(g)); put(play, W / 2, 1640); pop(play, .2f);
        if (!Config.online()) { put(txt(I18n.t("notReady"), 40, new Color(1, .8f, .5f, 1), 4, 760), W / 2, 760); play.setTouchable(com.badlogic.gdx.scenes.scene2d.Touchable.disabled); play.setColor(1, 1, 1, .4f); return; }
        status = txt("...", 40); put(status, W / 2, 760);
        Online.top(tid, this::fill, () -> { status.remove(); status = txt(I18n.t("noServer"), 40, new Color(1, .8f, .5f, 1), 4, 760); put(status, W / 2, 760); });
        Modes.claim(g);
    }
    void fill(List<Online.Row> list) {
        if (status != null) status.remove(); rows.clearChildren(); int mine = -1;
        for (int i = 0; i < list.size() && i < 10; i++) {
            Online.Row r = list.get(i); boolean me = r.pid.equals(g.s.pid); if (me) mine = i + 1; Group row = new Group(); row.setSize(820, 80);
            row.addActor(panelImg(820, 76, 24, me ? 0x3a6a14ff : 0x1c1260f0, i < 3 ? 0xffc21aff : 0x4a3aa8ff, 4));
            Image n = txt((i + 1) + ".", 44, i < 3 ? Color.GOLD : Color.WHITE, 5, 100); n.setPosition(30, 38 - n.getHeight() / 2); row.addActor(n);
            Image nm = txt(r.name, 42, Color.WHITE, 5, 440); nm.setPosition(130, 38 - nm.getHeight() / 2); row.addActor(nm);
            Image sc = txt("" + r.score, 46, Color.GOLD, 5, 230); sc.setPosition(790 - sc.getWidth(), 38 - sc.getHeight() / 2); row.addActor(sc); row.setPosition(0, 900 - (i + 1) * 88); rows.addActor(row);
        }
        if (mine > 0) put(txt(I18n.t("yourRank", "r", mine), 44, Color.GOLD, 5, 700), W / 2, 1560);
    }
    @Override protected void update(float dt) {
        long left = Math.max(0, endMs(tid) - System.currentTimeMillis()) / 1000; String s = String.format(java.util.Locale.US, "%dd %02d:%02d:%02d", left / 86400, left / 3600 % 24, left / 60 % 60, left % 60);
        if (!s.equals(clockStr)) { clockStr = s; if (clock != null) clock.remove(); clock = txt(I18n.t("endsIn", "t", s), 40, new Color(.6f, 1, .6f, 1), 4, 800); put(clock, W / 2, 335); }
    }
}
