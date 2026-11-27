package com.cleantv.launcher;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;

/** Holds the process alive so «تواصل» keeps listening for messages while other apps are on the screen. */
public class TawasulService extends Service {
    @Override public IBinder onBind(Intent i) { return null; }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        try {
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (Build.VERSION.SDK_INT >= 26 && nm != null) nm.createNotificationChannel(new NotificationChannel("tw_keep", "استقبال الرسائل", NotificationManager.IMPORTANCE_MIN));
            Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, "tw_keep") : new Notification.Builder(this);
            b.setSmallIcon(android.R.drawable.stat_notify_chat).setContentTitle("تواصل جاهز لاستقبال الرسائل").setOngoing(true);
            startForeground(30, b.build());
        } catch (Throwable ignored) { }
        Tawasul.start(this);
        return START_STICKY;
    }
}
