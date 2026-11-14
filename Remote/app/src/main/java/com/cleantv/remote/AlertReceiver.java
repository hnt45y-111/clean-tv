package com.cleantv.remote;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

/** Local notifications on the phone: adhan, match alerts, kids viewing time. */
public class AlertReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context c, Intent i) {
        String title = i.getStringExtra("title"), sub = i.getStringExtra("sub");
        if (title == null) return;
        Intent open = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent pi = PendingIntent.getActivity(c, 1, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification n = new Notification.Builder(c, MainActivity.CHANNEL)
                .setSmallIcon(R.drawable.ic_app)
                .setContentTitle(title)
                .setContentText(sub == null ? "" : sub)
                .setAutoCancel(true)
                .setContentIntent(pi)
                .build();
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        try { nm.notify((int) (System.currentTimeMillis() % 100000), n); } catch (Throwable ignored) { }
    }

    static void schedule(Context ctx, String json) {
        Context c = ctx.getApplicationContext();
        SharedPreferences p = MainActivity.prefs(c);
        p.edit().putString("alerts", json).apply();
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        int old = p.getInt("alertCount", 0);
        for (int i = 0; i < old; i++) am.cancel(pending(c, i, new Intent(c, AlertReceiver.class)));
        int n = 0;
        try {
            JSONArray arr = new JSONArray(json);
            long now = System.currentTimeMillis();
            for (int i = 0; i < arr.length() && n < 40; i++) {
                JSONObject o = arr.getJSONObject(i);
                long at = o.optLong("at", 0);
                if (at <= now) continue;
                Intent it = new Intent(c, AlertReceiver.class);
                it.putExtra("title", o.optString("title"));
                it.putExtra("sub", o.optString("sub"));
                PendingIntent pi = pending(c, n, it);
                try { am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi); }
                catch (SecurityException se) { am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi); }
                n++;
            }
        } catch (Throwable ignored) { }
        p.edit().putInt("alertCount", n).apply();
    }

    private static PendingIntent pending(Context c, int code, Intent it) {
        return PendingIntent.getBroadcast(c, 500 + code, it, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
