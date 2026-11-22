package com.msm.widgets;

/** A widget definition: its look (type), its title and how many zones it needs. */
public final class Wd {
    public static final int GRID = 0, RING = 1, BUTTON = 2, LIST = 3, PAD = 4, STRIP = 5, STAT = 6, BANNER = 7, CLOCK = 8;
    public final String id, title;
    public final int type;
    /** ready shortcuts used by non-grid widgets, in zone order (ids from the app catalog) */
    public final String[] acts;
    /** extra texts the painter needs (titles, subtitles, data keys) */
    public final String[] txt;
    public final int defW, defH;

    public Wd(String id, String title, int type, int defW, int defH, String[] acts, String... txt) {
        this.id = id; this.title = title; this.type = type; this.defW = defW; this.defH = defH; this.acts = acts; this.txt = txt;
    }
}
