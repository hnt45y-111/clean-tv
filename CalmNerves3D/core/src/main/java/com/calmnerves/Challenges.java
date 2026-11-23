package com.calmnerves;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.graphics.Color;
import com.badlogic.gdx.math.Interpolation;
import com.badlogic.gdx.math.MathUtils;
import com.badlogic.gdx.scenes.scene2d.Actor;
import com.badlogic.gdx.scenes.scene2d.Group;
import com.badlogic.gdx.scenes.scene2d.actions.Actions;
import com.badlogic.gdx.scenes.scene2d.ui.Image;
import com.badlogic.gdx.utils.Align;
import java.util.*;

/** Registry + the 12 challenge types. */
public class Challenges {
    public static final String[] IDS = {"dontpress", "riddle", "shell", "gauge", "memory", "math", "odd", "colortrap", "rhythm", "reverse", "spot"};
    static final int[] WEIGHT = {3, 4, 2, 3, 3, 3, 2, 2, 2, 2, 2}, MIN_LEVEL = {1, 1, 3, 4, 3, 2, 2, 3, 5, 6, 7};
    public static Challenge create(String id) {
        switch (id) {
            case "dontpress": return new DontPress(); case "riddle": return new Riddle(false); case "reverse": return new Riddle(true); case "shell": return new Shell(); case "gauge": return new Gauge();
            case "memory": return new Memory(); case "math": return new MathQ(); case "odd": return new Odd(); case "colortrap": return new ColorTrap(); case "rhythm": return new Rhythm(); case "spot": return new Spot(); default: return new Boss();
        }
    }
    public static String pick(int level, Random rnd, String last) {
        int tot = 0; for (int i = 0; i < IDS.length; i++) if (MIN_LEVEL[i] <= level && !IDS[i].equals(last)) tot += WEIGHT[i];
        int r = rnd.nextInt(tot); for (int i = 0; i < IDS.length; i++) if (MIN_LEVEL[i] <= level && !IDS[i].equals(last)) { r -= WEIGHT[i]; if (r < 0) return IDS[i]; } return "riddle";
    }
    public static final String[] ICONS = {"ic_ball", "ic_car", "ic_star", "ic_gift", "ic_crown", "em_heart", "em_sun1", "em_sun2"};

    // 1. Don't Press: wait it out while fake dialogs try to trick you
    static class DontPress extends Challenge {
        boolean alive = true;
        public float time() { return 6 + d * .8f + (ownTime > 0 ? 0 : 2); } public boolean survive() { return true; }
        public void build() {
            Group big = new Group(); Image bi = tex("bigred", 800); big.setSize(bi.getWidth(), bi.getHeight()); big.addActor(bi);
            Image t = Txt.label(I18n.t("dontPress"), 116, Color.WHITE, 12, 700); t.setPosition(big.getWidth() / 2 - t.getWidth() / 2, big.getHeight() * .46f - t.getHeight() / 2 + 30); big.addActor(t);
            big.setPosition(14, PH / 2 - big.getHeight() / 2); big.setTransform(true); big.setOrigin(Align.center); big.addAction(Actions.forever(Actions.sequence(Actions.scaleTo(1.025f, 1.025f, .6f, Interpolation.sine), Actions.scaleTo(1, 1, .6f, Interpolation.sine))));
            gs.press(big, () -> { if (alive) { alive = false; fail(); } }); root.addActor(big);
            gs.say(I18n.t("sure"));
            root.addAction(Actions.sequence(Actions.delay(.9f, Actions.run(this::dialog)), Actions.forever(Actions.delay(Math.max(1.5f, 3.4f - d * .17f), Actions.run(this::dialog)))));
            if (ownTime > 0) root.addAction(Actions.delay(ownTime, Actions.run(() -> { if (alive) win(); })));
        }
        void dialog() {
            if (!alive) return; boolean prize = rnd.nextBoolean(); Group dlg = new Group(); dlg.setSize(PW, PH); Image dim = new Image(Gfx.white()); dim.setSize(PW, PH); dim.setColor(0, 0, 0, .35f); dlg.addActor(dim);
            Image box = new Image(Gfx.panel(780, 380, 40, 0x1a1058ff, 0x8a5cffff, 5)); box.setSize(780, 380); box.setPosition(24, PH / 2 - 190); dlg.addActor(box);
            Image q = Txt.label(prize ? I18n.t("prize") : I18n.t("sure"), 52, Color.WHITE, 5, 700); q.setPosition(PW / 2 - q.getWidth() / 2, PH / 2 + 50); dlg.addActor(q);
            boolean yesFirst = rnd.nextBoolean(); Group yes = sbtn("btn_green", 340, 120, I18n.t("yes"), 62, null), no = sbtn("btn_orange", 340, 120, I18n.t("no"), 62, null);
            yes.setPosition(yesFirst ? 50 : 438, PH / 2 - 150); no.setPosition(yesFirst ? 438 : 50, PH / 2 - 150); dlg.addActor(yes); dlg.addActor(no);
            gs.press(yes, () -> { if (alive) { alive = false; fail(); } dlg.remove(); }); gs.press(no, dlg::remove);
            dlg.setTransform(true); dlg.setOrigin(Align.center); dlg.setScale(.5f); dlg.addAction(Actions.scaleTo(1, 1, .25f, Interpolation.swingOut)); root.addActor(dlg); dlg.addAction(Actions.delay(1.7f, Actions.removeActor()));
        }
        public void dispose() { alive = false; }
    }

    // 2 + 10. Riddle with gliding answers; "reverse" mirrors the whole play area
    static class Riddle extends Challenge {
        final boolean rev; Riddle(boolean r) { rev = r; }
        public float time() { return timerSec(rev ? 16 : 15); }
        public void build() {
            Bank.Q q = Bank.pick(rnd, maxD(), gs.g.s, "riddle", "iraq", "gen", "football", "geo", "food", "hist", "math"); int l = I18n.idx();
            gs.prompt((rev ? I18n.t("reverse") + "\n" : "") + q.t[l]); gs.react("think"); answers(q.a[l], true);
            if (rev) { root.setTransform(true); root.setOrigin(Align.center); root.setScaleX(-1); for (Actor a : answerBtns) { Group gb = (Group) a; for (Actor c : gb.getChildren()) if (c instanceof Image && c.getWidth() < 790) { c.setOrigin(Align.center); c.setScaleX(-1); } } }
        }
        
    }

    // 3. Shell game (Mheibes)
    static class Shell extends Challenge {
        Group[] cups = new Group[3]; int[] pos = {0, 1, 2}; int ring; boolean busy = true;
        public float time() { return timerSec(20); }
        public void build() {
            ring = rnd.nextInt(3); gs.prompt(I18n.t("shell"));
            for (int i = 0; i < 3; i++) {
                Group c = new Group(); c.setSize(240, 280); Image rg = tex("ic_star", 1); if (i == ring) { rg = new Image(Gfx.ring()); rg.setSize(100, 100); rg.setPosition(70, 0); c.addActor(rg); } Image cup = new Image(Gfx.cup()); cup.setSize(240, 280); c.addActor(cup); c.setPosition(cx(i), 150); root.addActor(c); cups[i] = c; final int k = i;
                gs.press(c, () -> { if (busy) return; busy = true; c.addAction(Actions.moveBy(0, 120, .25f)); if (k == ring) win(); else { cups[ring].addAction(Actions.moveBy(0, 120, .25f)); fail(); } });
            }
            cups[ring].addAction(Actions.sequence(Actions.moveBy(0, 120, .3f), Actions.delay(.7f), Actions.moveBy(0, -120, .3f), Actions.run(this::shuffle)));
        }
        float cx(int slot) { return 20 + slot * 280; }
        void shuffle() {
            int n = 5 + d; float sp = Math.max(.18f, .5f - d * .04f); List<com.badlogic.gdx.scenes.scene2d.Action> seq = new ArrayList<>();
            for (int s = 0; s < n; s++) {
                final int a = rnd.nextInt(3), b = (a + 1 + rnd.nextInt(2)) % 3;
                seq.add(Actions.run(() -> { int ca = -1, cb = -1; for (int i = 0; i < 3; i++) { if (pos[i] == a) ca = i; if (pos[i] == b) cb = i; } pos[ca] = b; pos[cb] = a; for (int i = 0; i < 3; i++) cups[i].addAction(Actions.moveTo(cx(pos[i]), 150, sp, Interpolation.swing)); gs.g.snd.play("tick"); }));
                seq.add(Actions.delay(sp + .06f));
            }
            seq.add(Actions.run(() -> { busy = false; })); root.addAction(Actions.sequence(seq.toArray(new com.badlogic.gdx.scenes.scene2d.Action[0])));
        }
    }

    // 4. Nerve gauge: stop the needle inside a shrinking green zone x3; red decoy button tries to trick you
    static class Gauge extends Challenge {
        Image zone, needle, dots[] = new Image[3]; float w, c, p, dir = 1; int hits; boolean alive = true; final float TW = 800;
        public float time() { return timerSec(18); }
        public void build() {
            gs.prompt(I18n.t("gauge")); w = Math.max(10, 30 - d * 2.2f); Image track = new Image(Gfx.panel(TW, 110, 55, 0x10083aff, 0x6a4cd8ff, 6)); track.setSize(TW, 110); track.setPosition(14, 420); root.addActor(track);
            zone = new Image(Gfx.panel(100, 90, 20, 0x5ed21aff, 0xb8ff5aff, 3)); root.addActor(zone); zone.setY(430); zone.setHeight(90); setZone();
            needle = new Image(Gfx.white()); needle.setSize(14, 150); needle.setY(400); root.addActor(needle);
            for (int i = 0; i < 3; i++) { dots[i] = new Image(Gfx.panel(60, 60, 30, 0x2a1a6aff, 0x6a4cd8ff, 4)); dots[i].setSize(60, 60); dots[i].setPosition(PW / 2 - 130 + i * 90, 300); root.addActor(dots[i]); }
            Group stop = sbtn("btn_green", 460, 150, I18n.t("stop"), 70, this::stop); stop.setPosition(PW / 2 - 230, 60); root.addActor(stop);
            Group decoy = sbtn("btn_orange", 330, 100, I18n.t("safeBtn"), 38, () -> { if (alive) { alive = false; gs.g.snd.play("wrong"); fail(); } }); decoy.setColor(1, .45f, .45f, 1); decoy.setPosition(rnd.nextBoolean() ? 20 : PW - 350, 190); root.addActor(decoy);
        }
        void setZone() { c = 15 + rnd.nextFloat() * 70; zone.setWidth(TW * w / 100f - 12); zone.setX(14 + TW * (c - w / 2) / 100f + 6); }
        void stop() {
            if (!alive) return;
            if (Math.abs(p - c) <= w / 2) { dots[hits].setDrawable(new com.badlogic.gdx.scenes.scene2d.utils.TextureRegionDrawable(Gfx.panel(60, 60, 30, 0x8cf12aff, 0x1a0a3aff, 4))); hits++; gs.g.snd.play("correct"); if (hits >= 3) { alive = false; win(); } else { w = Math.max(8, w - 6); setZone(); } }
            else { alive = false; fail(); }
        }
        public void update(float dt) { if (!alive) return; p += dir * (60 + d * 14 + hits * 14) * dt; if (p > 100) { p = 100; dir = -1; } if (p < 0) { p = 0; dir = 1; } needle.setX(14 + TW * p / 100f - 7); }
        public void dispose() { alive = false; }
    }

    // 5. Memory sequence + distracting emoji
    static class Memory extends Challenge {
        public float time() { return timerSec(18); }
        public void build() {
            final int n = 3 + Math.min(2, d / 3); List<String> ic = new ArrayList<>(Arrays.asList(ICONS)); Collections.shuffle(ic, rnd); final List<String> seq = ic.subList(0, n + 1); final int nth = 1 + rnd.nextInt(n);
            gs.prompt(I18n.t("memorize")); gs.promptParch(false); final Group grid = new Group(); grid.setSize(PW, PH); root.addActor(grid);
            float sz = 230; for (int i = 0; i < n; i++) { Group t = tile(seq.get(i), sz, true); t.setPosition(PW / 2 + (i % 3 - 1) * 255 - sz / 2 + (n == 4 && i == 3 ? 0 : 0), PH - 300 - (i / 3) * 255); if (n == 5 && i >= 3) t.setX(PW / 2 + (i - 3 - .5f) * 255 - sz / 2); if (n == 4 && i == 3) t.setX(PW / 2 - sz / 2); grid.addActor(t); }
            root.addAction(Actions.forever(Actions.delay(.7f, Actions.run(() -> { Image e = tex(new String[]{"em_heart", "em_sun1", "em_sun2"}[rnd.nextInt(3)], 100); e.setPosition(rnd.nextInt(700), 20 + rnd.nextInt(60)); e.getColor().a = .9f; e.addAction(Actions.sequence(Actions.parallel(Actions.moveBy(0, 300, 1.4f), Actions.fadeOut(1.4f)), Actions.removeActor())); root.addActor(e); }))));
            root.addAction(Actions.delay(Math.max(1.0f, 2.8f - d * .2f), Actions.run(() -> {
                grid.clearChildren(); gs.prompt(I18n.t("whichWasNth", "n", nth)); gs.promptParch(true); final String correct = seq.get(nth - 1); List<String> wrong = new ArrayList<>(seq.subList(0, n)); wrong.remove(correct); wrong.add(seq.get(n)); Collections.shuffle(wrong, rnd);
                List<String> opts = new ArrayList<>(); opts.add(correct); opts.addAll(wrong.subList(0, 3)); Collections.shuffle(opts, rnd); final boolean[] done = {false};
                for (int i = 0; i < 4; i++) { final String o = opts.get(i); Group t = tile(o, 250, true); t.setPosition(PW / 2 + (i % 2 - .5f) * 290 - 125, PH - 290 - (i / 2) * 290); gs.press(t, () -> { if (done[0]) return; done[0] = true; if (o.equals(correct)) win(); else fail(); }); if (!o.equals(correct)) wrongBtns.add(t); grid.addActor(t); }
            })));
        }
        public void dispose() { gs.promptParch(false); }
    }

    // 6. Quick math
    static class MathQ extends Challenge {
        public float time() { return timerSec(10); }
        public void build() {
            int m = 10 + d * 6 + level / 5, a = 2 + rnd.nextInt(m), b = 2 + rnd.nextInt(m); String op = d > 1 ? new String[]{"+", "-", "×"}[rnd.nextInt(3)] : new String[]{"+", "-"}[rnd.nextInt(2)];
            if (op.equals("-") && b > a) { int t = a; a = b; b = t; } if (op.equals("×")) { a = 2 + rnd.nextInt(9); b = 2 + rnd.nextInt(9); }
            int r = op.equals("+") ? a + b : op.equals("-") ? a - b : a * b; List<Integer> w = new ArrayList<>(); w.add(r); int k = 0; int[] dl = {-3, -2, -1, 1, 2, 3, 10, -10};
            while (w.size() < 4 && k++ < 80) { int x = r + dl[rnd.nextInt(dl.length)]; if (x >= 0 && !w.contains(x)) w.add(x); }
            gs.prompt(a + " " + op + " " + b + " = ؟".replace("؟", "?")); String[] lab = new String[4]; for (int i = 0; i < 4; i++) lab[i] = "" + w.get(i); answers(lab, d > 1);
        }
    }

    // 7. Odd one out
    static class Odd extends Challenge {
        public float time() { return timerSec(12); }
        public void build() {
            String[][] pairs = {{"em_sun1", "em_sun2"}, {"flame", "flame2"}, {"ic_star", "ic_star"}, {"ic_crown", "ic_crown"}}; int pi = rnd.nextInt(4); String[] pr = pairs[pi];
            final int n = 3 + Math.min(2, d / 3 + (level > 20 ? 1 : 0)), odd = rnd.nextInt(n * n); float cell = Math.min(760f, PH - 30) / n - 14, ox = PW / 2 - (n * (cell + 14) - 14) / 2;
            gs.prompt(I18n.t("odd")); for (int i = 0; i < n * n; i++) {
                final int k = i; boolean o = i == odd; Group t = new Group(); t.setSize(cell, cell); Image bg = new Image(Gfx.panel(cell, cell, cell * .14f, 0x14106aff, 0x6a4cd8ff, 4)); bg.setSize(cell, cell); t.addActor(bg);
                Image ic = tex(o ? pr[1] : pr[0], cell * .72f); ic.setPosition(cell * .14f, cell * .14f); if (o && pi == 2) ic.setColor(1, .6f, .75f, 1); if (o && pi == 3) { ic.setOrigin(Align.center); ic.setScaleX(-1); } t.addActor(ic);
                t.setPosition(ox + (i % n) * (cell + 14), PH - 20 - cell - (i / n) * (cell + 14)); gs.press(t, () -> { if (k == odd) win(); else fail(); }); root.addActor(t);
            }
        }
    }

    // 8. Color trap: tap the colour of the word, not the word
    static class ColorTrap extends Challenge {
        public float time() { return timerSec(10); }
        public void build() {
            int wi = rnd.nextInt(6), ci = (wi + 1 + rnd.nextInt(5)) % 6; gs.prompt(""); Image w = Txt.label(I18n.color(wi), 150, new Color(I18n.colorHex(ci)), 14, 760); w.setPosition(PW / 2 - w.getWidth() / 2, PH - 190); root.addActor(w);
            Image h = Txt.label(I18n.t("colortrap"), 38, new Color(1, 1, 1, .85f), 4, 780); h.setPosition(PW / 2 - h.getWidth() / 2, PH - 270); root.addActor(h);
            List<Integer> idx = new ArrayList<>(); for (int i = 0; i < 6; i++) if (i != ci && i != wi) idx.add(i); Collections.shuffle(idx, rnd); idx = new ArrayList<>(idx.subList(0, 3)); idx.add(ci); Collections.shuffle(idx, rnd);
            for (int i = 0; i < 4; i++) { final int c = idx.get(i); Group s = new Group(); s.setSize(380, 190); Image bg = new Image(Gfx.panel(380, 190, 44, I18n.colorHex(c), 0x1a0a3aff, 7)); bg.setSize(380, 190); s.addActor(bg); s.setPosition(24 + (i % 2) * 404, 190 - (i / 2) * 210 - 40 + 40); if (c != ci) wrongBtns.add(s); gs.press(s, () -> { if (c == ci) win(); else fail(); }); root.addActor(s); }
        }
    }

    // 9. Tap rhythm
    static class Rhythm extends Challenge {
        float per, t, cd = 1.2f; int hits; boolean alive = true; Image ring, dots[] = new Image[4]; float pulse;
        public float time() { return timerSec(14); }
        public void build() {
            per = Math.max(.45f, .8f - d * .04f); gs.prompt(I18n.t("rhythm")); ring = new Image(Gfx.dot()); ring.setSize(280, 280); ring.setPosition(PW / 2 - 140, PH - 330); ring.setColor(1, .76f, .1f, .5f); ring.setOrigin(Align.center); root.addActor(ring);
            for (int i = 0; i < 4; i++) { dots[i] = new Image(Gfx.panel(60, 60, 30, 0x2a1a6aff, 0x6a4cd8ff, 4)); dots[i].setSize(60, 60); dots[i].setPosition(PW / 2 - 165 + i * 90, 200); root.addActor(dots[i]); }
            Group b = sbtn("btn_orange", 500, 150, I18n.t("tap"), 70, this::tap); b.setPosition(PW / 2 - 250, 20); root.addActor(b);
        }
        void tap() { if (!alive || t < 0) return; float el = t % per, off = Math.min(el, per - el); if (off < Math.max(.07f, .17f - d * .01f)) { dots[hits].setDrawable(new com.badlogic.gdx.scenes.scene2d.utils.TextureRegionDrawable(Gfx.panel(60, 60, 30, 0x8cf12aff, 0x1a0a3aff, 4))); hits++; gs.g.snd.play("correct"); if (hits >= 4) { alive = false; win(); } } else { alive = false; fail(); } }
        public void update(float dt) {
            if (cd > 0) { cd -= dt; if (cd <= 0) t = 0; else { t = -1; return; } } float before = t; t += dt;
            if ((int) (before / per) != (int) (t / per) || before == 0) { pulse = 1; gs.g.snd.play("tick"); } pulse = Math.max(0, pulse - dt * 3); ring.setScale(1 + pulse * .4f); ring.setColor(1, .76f, .1f, .35f + pulse * .5f);
        }
        public void dispose() { alive = false; }
    }

    // 11. Spot the difference
    static class Spot extends Challenge {
        public float time() { return timerSec(16); }
        public void build() {
            List<String> ic = new ArrayList<>(Arrays.asList(ICONS)); Collections.shuffle(ic, rnd); final int diff = rnd.nextInt(9); String repl = ic.get(8 % ic.size()); gs.prompt(I18n.t("spot")); float cell = 124;
            for (int side = 0; side < 2; side++) for (int i = 0; i < 9; i++) {
                final int k = i; String name = ic.get(i % 8); if (i == 8) name = ic.get(0); boolean odd = side == 1 && i == diff; if (odd) name = ic.get((i + 3) % 8).equals(name) ? ic.get((i + 4) % 8) : ic.get((i + 3) % 8);
                Group t = tile(name, cell, false); t.setPosition(10 + side * 424 + (i % 3) * (cell + 8) , PH - 20 - cell - (i / 3) * (cell + 8) - 150); if (side == 1) gs.press(t, () -> { if (k == diff) win(); else fail(); }); root.addActor(t);
            }
        }
    }

    // BOSS: Nerve Explosion. Chain of mechanics that grows with difficulty: math -> gauge -> [shell] -> [rhythm] -> don't press
    static class Boss extends Challenge {
        int step; Challenge sub;
        String[] steps() { List<String> l = new ArrayList<>(Arrays.asList("math", "gauge")); if (d >= 4) l.add("shell"); if (d >= 6) l.add("rhythm"); if (d >= 8) l.add("riddle"); l.add("dontpress"); return l.toArray(new String[0]); }
        public float time() { return Math.max(18, 30 - d * 1.2f + steps().length * 2); } public boolean survive() { return false; }
        public void build() { gs.g.snd.play("boss"); run(); }
        void next() { step++; gs.sub(); run(); }
        void run() {
            if (sub != null) sub.dispose(); sub = null; root.clearActions(); root.clearChildren(); root.setScale(1); root.setRotation(0); wrongBtns.clear(); answerBtns.clear(); String[] st = steps(); String id = st[step];
            if (id.equals("math")) {
                int a = 3 + rnd.nextInt(12 + d * 3), b = 3 + rnd.nextInt(12 + d * 3), r = a + b; int[] val = {r, r + 1, r - 2}; List<Integer> ord = new ArrayList<>(Arrays.asList(0, 1, 2)); Collections.shuffle(ord, rnd);
                String[] taunts = {I18n.t("hurry"), I18n.t("chooseNow"), I18n.t("dontThink")}, asset = {"btn_purple", "btn_green", "btn_orange"};
                gs.prompt(a + " + " + b + " = ?"); for (int k = 0; k < 3; k++) { final int i = ord.get(k); Group bt = sbtn(asset[k], 660, 170, taunts[k] + "  " + val[i], 56, () -> { if (i == 0) next(); else fail(); }); bt.setTransform(true); bt.setOrigin(Align.center); bt.setRotation(k == 1 ? 6 : -6); bt.setPosition(k == 1 ? 150 : 30, PH - 190 - k * 200); if (i != 0) wrongBtns.add(bt); root.addActor(bt); }
            } else {
                Challenge c = id.equals("dontpress") ? new DontPress() : create(id); if (c instanceof DontPress) { c.ownTime = 3 + d * .15f; gs.react("furious"); }
                c.onWin = id.equals("dontpress") ? this::win : this::next; c.onFail = this::fail; c.attach(gs, root, rnd, level, d); c.build(); sub = c;
            }
        }
        public void update(float dt) { if (sub != null) sub.update(dt); }
        public void dispose() { if (sub != null) sub.dispose(); }
    }
}
