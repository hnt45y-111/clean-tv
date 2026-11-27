package com.cleantv.launcher;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;

/** Some TV systems start their own launcher at power-on and ignore the home setting: bring this launcher to the front a few seconds after boot. */
public class BootReceiver extends BroadcastReceiver {

    /** Starts the launcher at 4 s and again at 12 s (the system launcher may come up after the first try). Skips the second if the user is already inside it. */
    static void bringFront(final Context ctx) {
        final Context c = ctx.getApplicationContext();
        Tawasul.keepAlive(c); // the messages listener comes up with the system, whether or not the launcher is brought to the front
        if (Media.prefs(c).getBoolean("noBootOpen", false)) return;
        Handler h = new Handler(Looper.getMainLooper());
        int[] delays = {4000, 12000};
        for (final int d : delays) {
            h.postDelayed(new Runnable() {
                @Override public void run() {
                    if (SystemClock.elapsedRealtime() > 240000) return; // only right after power-on
                    if (MainActivity.foreground) return;
                    try {
                        Intent i = new Intent(c, MainActivity.class);
                        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
                        c.startActivity(i);
                    } catch (Throwable ignored) { }
                }
            }, d);
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        bringFront(context);
    }
}
