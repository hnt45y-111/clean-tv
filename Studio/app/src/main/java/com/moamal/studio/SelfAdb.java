package com.moamal.studio;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.RemoteInput;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.os.Build;
import android.os.Bundle;

import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** Connects the app to the phone it runs on (Android 11+ wireless debugging), Shizuku-style:
 *  the pairing code is typed into a notification reply while the Settings pairing dialog stays open. */
final class SelfAdb {
    static volatile int pairPort = 0, connPort = 0;
    static volatile String last = "";
    private static final String CH = "selfpair";
    private static final int NID = 4471;
    private static NsdManager nsd;
    private static final List<NsdManager.DiscoveryListener> ls = new ArrayList<>();

    private SelfAdb() { }

    static Set<String> myIps() {
        Set<String> s = new HashSet<>();
        s.add("127.0.0.1");
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces()))
                for (InetAddress a : Collections.list(ni.getInetAddresses()))
                    if (a instanceof Inet4Address) s.add(a.getHostAddress());
        } catch (Throwable ignored) { }
        return s;
    }

    static synchronized void discover(Context c) {
        stop();
        nsd = (NsdManager) c.getApplicationContext().getSystemService(Context.NSD_SERVICE);
        for (final String t : new String[]{"_adb-tls-pairing._tcp.", "_adb-tls-connect._tcp."}) {
            NsdManager.DiscoveryListener l = new NsdManager.DiscoveryListener() {
                public void onStartDiscoveryFailed(String a, int b) { }
                public void onStopDiscoveryFailed(String a, int b) { }
                public void onDiscoveryStarted(String a) { }
                public void onDiscoveryStopped(String a) { }
                public void onServiceLost(NsdServiceInfo i) { }
                public void onServiceFound(NsdServiceInfo info) {
                    try {
                        nsd.resolveService(info, new NsdManager.ResolveListener() {
                            public void onResolveFailed(NsdServiceInfo i, int code) { }
                            public void onServiceResolved(NsdServiceInfo i) {
                                if (i.getHost() == null || !myIps().contains(i.getHost().getHostAddress())) return;
                                if (t.contains("pairing")) pairPort = i.getPort(); else connPort = i.getPort();
                            }
                        });
                    } catch (Throwable ignored) { }
                }
            };
            try { nsd.discoverServices(t, NsdManager.PROTOCOL_DNS_SD, l); ls.add(l); } catch (Throwable ignored) { }
        }
    }

    static synchronized void stop() {
        if (nsd != null) for (NsdManager.DiscoveryListener l : ls) try { nsd.stopServiceDiscovery(l); } catch (Throwable ignored) { }
        ls.clear();
    }

    static void notifyAsk(Context c, String text) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(new NotificationChannel(CH, "ربط هذا الموبايل", NotificationManager.IMPORTANCE_HIGH));
        RemoteInput ri = new RemoteInput.Builder("code").setLabel("رمز الإقران (٦ أرقام)").build();
        int fl = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
        PendingIntent pi = PendingIntent.getBroadcast(c, 7, new Intent(c, PairReceiver.class), fl);
        Notification.Action act = new Notification.Action.Builder(android.R.drawable.ic_menu_edit, "اكتب الرمز", pi).addRemoteInput(ri).build();
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, CH) : new Notification.Builder(c);
        b.setSmallIcon(android.R.drawable.stat_sys_data_bluetooth).setContentTitle("ربط هذا الموبايل")
                .setContentText(text).setStyle(new Notification.BigTextStyle().bigText(text)).addAction(act).setOngoing(true).setAutoCancel(false);
        nm.notify(NID, b.build());
    }

    static void notifyDone(Context c, String text) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, CH) : new Notification.Builder(c);
        b.setSmallIcon(android.R.drawable.stat_sys_data_bluetooth).setContentTitle("ربط هذا الموبايل").setContentText(text).setAutoCancel(true).setTimeoutAfter(15000);
        nm.notify(NID, b.build());
    }

    static void cancel(Context c) { try { ((NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE)).cancel(NID); } catch (Throwable ignored) { } }

    /** The reply from the notification: pair with the code, tell the page. */
    public static class PairReceiver extends BroadcastReceiver {
        @Override public void onReceive(final Context c, Intent i) {
            Bundle r = RemoteInput.getResultsFromIntent(i);
            CharSequence cs = r == null ? null : r.getCharSequence("code");
            final String code = cs == null ? "" : cs.toString().replaceAll("[^0-9]", "");
            final PendingResult pr = goAsync();
            new Thread(() -> {
                String msg; boolean ok = false;
                try {
                    if (code.length() != 6) msg = "الرمز لازم ٦ أرقام";
                    else {
                        for (int k = 0; k < 10 && pairPort == 0; k++) Thread.sleep(300);
                        if (pairPort == 0) msg = "ما لگيت نافذة الإقران. افتح «إقران جهاز برمز الإقران» وخليها مفتوحة";
                        else { ok = Adb.get(c).pair("127.0.0.1", pairPort, code); msg = ok ? "تم الربط ✓ ارجع للتطبيق" : "الرمز غلط أو انتهى. اطلب رمز جديد"; }
                    }
                } catch (Throwable t) { msg = "ما صار الربط: " + (t.getMessage() == null ? t.getClass().getSimpleName() : t.getMessage()); }
                last = ok ? "ok" : msg;
                if (ok) notifyDone(c, msg); else notifyAsk(c, msg + "\nجرّب مرة ثانية.");
                MainActivity.jsStatic("window.onSelfPaired&&onSelfPaired(" + ok + "," + org.json.JSONObject.quote(msg) + ")");
                pr.finish();
            }).start();
        }
    }
}
