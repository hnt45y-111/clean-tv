package com.calmnerves;

/** Sawtooth difficulty: inside every world of 10 levels, 1..9 each harder than the one before, the 10th (boss) is the hardest of that world;
 *  the next world restarts a bit lower than that boss but each world is overall tougher (level 20 > level 10 ...). */
public class Difficulty {
    public static float hard(int level) { int w = (level - 1) / 10, p = (level - 1) % 10 + 1; float base = w * 1.2f; return p == 10 ? base + 4.05f + 1.5f : base + p * .45f; }
    /** integer scale 0..10 used by challenges; the player's chosen difficulty shifts it */
    public static int d(int level, int userIdx) { return Math.max(0, Math.min(10, Math.round(hard(level) + (userIdx - 1) * .8f))); }
    /** moves earned for winning a level: grows with its difficulty, never below 2; bosses pay double */
    public static int moves(int level) { int m = Math.max(2, Math.round(hard(level) + 1)); return level % 10 == 0 ? m * 2 : m; }
}
