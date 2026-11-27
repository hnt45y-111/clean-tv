package com.cleantv.tawasul;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** Every 15 minutes (the least Android allows) asks the relay for new messages and posts a notification; the page picks them up when it opens. */
public class PollJob extends JobService {
    static final String BASE = "https://pegjfuculkrkwitihfqg.supabase.co/functions/v1/tawasul";
    static final String CH = "msgs";

    static void schedule(Context c) {
        try {
            JobScheduler js = (JobScheduler) c.getSystemService(Context.JOB_SCHEDULER_SERVICE);
            if (js == null) return;
            for (JobInfo j : js.getAllPendingJobs()) if (j.getId() == 1) return;
            js.schedule(new JobInfo.Builder(1, new ComponentName(c, PollJob.class))
                    .setPeriodic(15 * 60 * 1000L).setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setPersisted(true).build());
        } catch (Throwable ignored) { }
    }

    @Override public boolean onStartJob(final JobParameters p) {
        new Thread(() -> { try { check(getApplicationContext()); } catch (Throwable ignored) { } jobFinished(p, false); }).start();
        return true;
    }
    @Override public boolean onStopJob(JobParameters p) { return true; }

    static void check(Context c) throws Exception {
        SharedPreferences sp = MainActivity.prefs(c);
        String code = sp.getString("code", ""), token = sp.getString("token", "");
        if (code.length() != 10 || token.length() < 20) return;
        JSONObject req = new JSONObject().put("code", code).put("token", token).put("wait", 0);
        String since = sp.getString("bgSince", "");
        if (since.length() > 0) req.put("since", since);
        HttpURLConnection h = (HttpURLConnection) new URL(BASE + "/inbox").openConnection();
        h.setRequestMethod("POST"); h.setDoOutput(true); h.setConnectTimeout(15000); h.setReadTimeout(25000);
        h.setRequestProperty("Content-Type", "application/json");
        try (OutputStream o = h.getOutputStream()) { o.write(req.toString().getBytes(StandardCharsets.UTF_8)); }
        if (h.getResponseCode() != 200) return;
        StringBuilder sb = new StringBuilder();
        try (InputStream in = h.getInputStream()) { byte[] b = new byte[8192]; int n; while ((n = in.read(b)) > 0) sb.append(new String(b, 0, n, StandardCharsets.UTF_8)); }
        JSONArray msgs = new JSONObject(sb.toString()).optJSONArray("msgs");
        if (msgs == null || msgs.length() == 0) return;
        JSONArray queue = new JSONArray(sp.getString("queue", "[]"));
        String last = since;
        for (int i = 0; i < msgs.length(); i++) {
            JSONObject m = msgs.getJSONObject(i);
            queue.put(m);
            last = m.optString("ts", last);
        }
        while (queue.length() > 200) queue.remove(0);
        sp.edit().putString("queue", queue.toString()).putString("bgSince", last).apply();
        if (!MainActivity.visible && sp.getBoolean("notif", true)) notify(c, msgs);
    }

    static void notify(Context c, JSONArray msgs) throws Exception {
        JSONObject m = msgs.getJSONObject(msgs.length() - 1);
        show(c, m.optString("from", ""), m.optString("fromName", ""), m.optString("kind", "text"), m.optString("text", ""), m.optString("name", ""), msgs.length());
    }

    /** One notification per app: a newer message replaces the older one (the same id), so the push and the 15 minute check never double up. */
    static void show(Context c, String from, String fromName, String kind, String body, String fileName, int count) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(new NotificationChannel(CH, "الرسائل", NotificationManager.IMPORTANCE_HIGH));
        String who = fromName != null && fromName.length() > 0 ? fromName : "رسالة جديدة", text;
        if ("image".equals(kind)) text = "📷 صورة"; else if ("audio".equals(kind)) text = "🎤 رسالة صوتية"; else if ("file".equals(kind)) text = "📎 " + (fileName == null || fileName.length() == 0 ? "ملف" : fileName); else text = body == null ? "" : body;
        if (count > 1) text = count + " رسائل جديدة · " + text;
        Intent i = new Intent(c, MainActivity.class).putExtra("open", from == null ? "" : from).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(c, 0, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, CH) : new Notification.Builder(c);
        b.setSmallIcon(android.R.drawable.stat_notify_chat).setContentTitle(who).setContentText(text).setContentIntent(pi).setAutoCancel(true);
        nm.notify(7, b.build());
    }
}
