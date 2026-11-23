package com.calmnerves;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.utils.Array;
import com.badlogic.gdx.utils.IntArray;
import com.badlogic.gdx.utils.JsonReader;
import com.badlogic.gdx.utils.JsonValue;
import java.util.Random;

/** Question bank (assets/data/questions.json). A question never repeats until the whole filtered pool is exhausted. */
public class Bank {
    public static class Q { public String c; public int d, id; public String[] t = new String[5]; public String[][] a = new String[5][4]; }
    public static final Array<Q> all = new Array<>();
    public static void init() {
        JsonValue r = new JsonReader().parse(Gdx.files.internal("data/questions.json")); int n = 0;
        for (JsonValue q = r.child; q != null; q = q.next, n++) {
            Q o = new Q(); o.id = n; o.c = q.getString("c"); o.d = q.getInt("d");
            for (int l = 0; l < 5; l++) { o.t[l] = q.get("t").getString(l); for (int k = 0; k < 4; k++) o.a[l][k] = q.get("a").get(l).getString(k); }
            all.add(o);
        }
    }
    public static Q pick(Random rnd, int maxD, Store s, String... cats) {
        IntArray pool = new IntArray();
        for (Q q : all) if (q.d <= maxD && ok(q, cats) && !s.seen.contains(q.id)) pool.add(q.id);
        if (pool.size == 0) { // exhausted: forget only this filter's questions
            IntArray keep = new IntArray(); for (int i = 0; i < s.seen.size; i++) { Q q = all.get(s.seen.get(i)); if (!(q.d <= maxD && ok(q, cats))) keep.add(q.id); }
            s.seen = keep; for (Q q : all) if (q.d <= maxD && ok(q, cats)) pool.add(q.id);
        }
        int id = pool.get(rnd.nextInt(pool.size)); s.seen.add(id); return all.get(id);
    }
    private static boolean ok(Q q, String[] cats) { if (cats.length == 0) return true; for (String c : cats) if (c.equals(q.c)) return true; return false; }
}
