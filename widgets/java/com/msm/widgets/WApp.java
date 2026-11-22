package com.msm.widgets;

import android.content.Context;
import android.content.Intent;

import java.util.Map;

/** What each app tells the widget kit: its colour, its ready shortcuts, its numbers, and how to open it. */
public interface WApp {
    /** brand colour (ARGB) */
    int accent();
    /** every ready shortcut the user can choose from */
    Act[] catalog(Context c);
    /** the shortcuts a configurable widget starts with */
    String[] defaults(Context c, String widgetId);
    /** the ids shown in the long-press menu of the app icon by default (max 4) */
    String[] iconDefaults(Context c);
    /** live numbers and texts used by the widgets (storage, last channel, TV state…) */
    Map<String, String> data(Context c);
    /** the intent that opens the app and takes it to {@code route} */
    Intent open(Context c, String route);
    /** runs a TV command (KEY / CMD acts); runs on a background thread. Returns true if it worked. */
    boolean send(Context c, Act a);
}
