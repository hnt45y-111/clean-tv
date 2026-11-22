package com.msm.widgets;

/** One ready-made shortcut: it either opens the app at a place (route) or sends a command (to the TV). */
public final class Act {
    public static final int ROUTE = 0, KEY = 1, CMD = 2;
    public final String id, label, icon, arg;
    public final int kind;

    private Act(String id, String label, String icon, int kind, String arg) { this.id = id; this.label = label; this.icon = icon; this.kind = kind; this.arg = arg; }

    /** opens the app and goes to {@code route} */
    public static Act route(String id, String label, String icon, String route) { return new Act(id, label, icon, ROUTE, route); }
    /** sends a key to the TV (needs the app to be paired once) */
    public static Act key(String id, String label, String icon, String key) { return new Act(id, label, icon, KEY, key); }
    /** sends a command to the TV: arg is the command type */
    public static Act cmd(String id, String label, String icon, String type) { return new Act(id, label, icon, CMD, type); }
}
