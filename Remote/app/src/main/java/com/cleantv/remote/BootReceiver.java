package com.cleantv.remote;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Re-arms the saved notifications after the phone restarts. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        if (!Intent.ACTION_BOOT_COMPLETED.equals(i.getAction())) return;
        String saved = MainActivity.prefs(c).getString("alerts", "[]");
        AlertReceiver.schedule(c, saved);
    }
}
