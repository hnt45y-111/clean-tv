package com.cleantv.launcher;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.content.SharedPreferences;
import android.media.Ringtone;
import android.media.RingtoneManager;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** «تواصل» on the screen: one background thread asks the relay for new messages (a long poll, so they arrive in about a second).
 *  New messages are queued for the page (chat.js) and, if the user wants, the launcher is brought to the front showing the chat. */
final class Tawasul {
    static final String BASE = "https://pegjfuculkrkwitihfqg.supabase.co/functions/v1/tawasul";
    private static Thread thread;
    private static volatile boolean run;

    static SharedPreferences sp(Context c) { return Media.prefs(c); }

    /** Keeps the process (and so the long poll) alive with a foreground service; if the system refuses, the plain thread still runs. */
    static void keepAlive(Context ctx) {
        final Context app = ctx.getApplicationContext();
        try {
            Intent i = new Intent(app, TawasulService.class);
            if (Build.VERSION.SDK_INT >= 26) app.startForegroundService(i); else app.startService(i);
        } catch (Throwable t) { start(app); }
    }

    static String preview(JSONObject m) {
        String kind = m.optString("kind", "text");
        if ("image".equals(kind)) return "📷 صورة";
        if ("audio".equals(kind)) return "🎤 رسالة صوتية";
        if ("file".equals(kind)) return "📎 " + m.optString("name", "ملف");
        String t = m.optString("text", ""); return t.length() > 80 ? t.substring(0, 80) + "…" : t;
    }

    /** Quiet hours or a muted person: no sound, no banner, no jump to the chat. The page keeps these numbers in the "tw_np" preference. */
    static JSONObject np(Context c) { try { return new JSONObject(sp(c).getString("tw_np", "{}")); } catch (Throwable t) { return new JSONObject(); } }
    private static int minutes(String hhmm) { try { String[] p = hhmm.split(":"); return Integer.parseInt(p[0].trim()) * 60 + Integer.parseInt(p[1].trim()); } catch (Throwable t) { return 0; } }
    static boolean silenced(Context c, String from) {
        try {
            JSONObject np = np(c);
            JSONArray mu = np.optJSONArray("muted");
            if (mu != null && from != null) for (int i = 0; i < mu.length(); i++) if (from.equals(mu.optString(i))) return true;
            JSONObject q = np.optJSONObject("quiet");
            if (q != null && q.optBoolean("on")) {
                int f = minutes(q.optString("from", "23:00")), t = minutes(q.optString("to", "07:00"));
                java.util.Calendar cal = java.util.Calendar.getInstance();
                int now = cal.get(java.util.Calendar.HOUR_OF_DAY) * 60 + cal.get(java.util.Calendar.MINUTE);
                if (f == t) return false;
                return f < t ? (now >= f && now < t) : (now >= f || now < t);
            }
        } catch (Throwable ignored) { }
        return false;
    }

    /** A message arrived while another app is on screen: a card above it, and a notification in the panel (both tap-free: the launcher opens the chat itself if it is allowed to). */
    private static void alert(Context app, JSONObject last, int count) {
        String who = last.optString("fromName", "").length() > 0 ? last.optString("fromName") : "رسالة جديدة";
        String sub = (count > 1 ? count + " رسائل · " : "") + preview(last);
        try { Overlay.showBanner(app, "💬 " + who, sub, 9000); } catch (Throwable ignored) { }
        try {
            NotificationManager nm = (NotificationManager) app.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;
            if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(new NotificationChannel("tw_msgs", "الرسائل", NotificationManager.IMPORTANCE_HIGH));
            Intent i = new Intent(app, MainActivity.class).putExtra("tw_open", last.optString("from", "")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            PendingIntent pi = PendingIntent.getActivity(app, 5, i, PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
            Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(app, "tw_msgs") : new Notification.Builder(app);
            b.setSmallIcon(android.R.drawable.stat_notify_chat).setContentTitle(who).setContentText(sub).setContentIntent(pi).setAutoCancel(true);
            nm.notify(31, b.build());
        } catch (Throwable ignored) { }
    }

    static synchronized void start(final Context ctx) {
        if (thread != null && thread.isAlive()) return;
        final Context app = ctx.getApplicationContext();
        run = true;
        thread = new Thread(new Runnable() {
            @Override public void run() {
                long back = 3000;
                while (run) {
                    try {
                        SharedPreferences p = sp(app);
                        String code = p.getString("tw_code", ""), token = p.getString("tw_token", "");
                        if (code.length() != 10 || token.length() < 20) { Thread.sleep(5000); continue; }
                        JSONObject req = new JSONObject().put("code", code).put("token", token).put("wait", 20);
                        String since = p.getString("tw_since", "");
                        if (since.length() > 0) req.put("since", since);
                        String sg = p.getString("tw_sig", "");
                        if (sg.length() > 0) req.put("sig", sg);
                        JSONObject r = post(app, "inbox", req);
                        back = 3000;
                        JSONArray msgs = r == null ? null : r.optJSONArray("msgs");
                        JSONObject sync = r == null ? null : r.optJSONObject("sync");
                        if (sync != null) handleSync(app, sync);
                        if (msgs != null && msgs.length() > 0) incoming(app, msgs);
                        else Thread.sleep(300);
                    } catch (InterruptedException e) {
                        return;
                    } catch (Throwable t) {
                        try { Thread.sleep(back); } catch (InterruptedException e) { return; }
                        back = Math.min(back * 2, 60000);
                    }
                }
            }
        }, "tawasul");
        thread.setDaemon(true);
        thread.start();
    }

    /** POST to the relay; returns the answer as JSON (throws on a non-200 answer). */
    private static JSONObject post(Context c, String route, JSONObject body) throws Exception {
        HttpURLConnection h = (HttpURLConnection) new URL(BASE + "/" + route).openConnection();
        h.setRequestMethod("POST"); h.setDoOutput(true); h.setConnectTimeout(15000); h.setReadTimeout(40000);
        h.setRequestProperty("Content-Type", "application/json");
        try (OutputStream o = h.getOutputStream()) { o.write(body.toString().getBytes(StandardCharsets.UTF_8)); }
        int code = h.getResponseCode();
        if (code != 200) { if (code == 401 || code == 400) Thread.sleep(15000); throw new Exception("http " + code); }
        StringBuilder sb = new StringBuilder();
        try (InputStream in = h.getInputStream()) { byte[] b = new byte[8192]; int n; while ((n = in.read(b)) > 0) sb.append(new String(b, 0, n, StandardCharsets.UTF_8)); }
        return new JSONObject(sb.toString());
    }

    /** What the relay says besides new messages (delivery marks, pinned notes, deleted ids, typing): kept for the page, which applies it when it is next on screen. */
    private static void handleSync(Context app, JSONObject sync) {
        SharedPreferences p = sp(app);
        String sg = sync.optString("sig", ""), old = p.getString("tw_sig", "");
        if (sg.length() > 0 && !sg.equals(old)) {
            p.edit().putString("tw_sig", sg).putString("tw_sync", sync.toString()).putBoolean("tw_sync_new", true).apply();
            if (MainActivity.foreground) MainActivity.drainSoon();
        }
        JSONObject sn = sync.optJSONObject("snap");
        if (sn != null) { try { snap(app, sn); } catch (Throwable ignored) { } }
    }

    /** A known person asked for a picture of what the screen shows. Only if the owner allowed it (option in «الرسائل»), and only for people in the contact list. */
    private static void snap(final Context app, JSONObject s) {
        final String from = s.optString("from", ""), at = s.optString("at", "");
        final SharedPreferences p = sp(app);
        if (from.length() == 0 || at.equals(p.getString("tw_snap_at", ""))) return;
        p.edit().putString("tw_snap_at", at).apply();
        JSONObject np = np(app);
        boolean known = false; JSONArray cs = np.optJSONArray("contacts");
        if (cs != null) for (int i = 0; i < cs.length(); i++) if (from.equals(cs.optString(i))) known = true;
        if (!np.optBoolean("snap") || !known) return;
        final PowerService ps = PowerService.instance;
        if (ps == null || Build.VERSION.SDK_INT < 30) { sendText(app, from, "ما أكدر أصوّر الشاشة: يحتاج خدمة إمكانية الوصول مفعّلة وأندرويد ١١ أو أحدث."); return; }
        ps.takeShot(new PowerService.ShotCb() { @Override public void done(final android.graphics.Bitmap bmp) {
            new Thread(new Runnable() { @Override public void run() {
                if (bmp == null) { sendText(app, from, "ما قدرت أصوّر الشاشة هسه."); return; }
                try { sendShot(app, from, bmp); try { Overlay.showBanner(app, "📸 لقطة للشاشة", "انرسلت لقطة لما تعرضه الشاشة", 4000); } catch (Throwable ignored) { } }
                catch (Throwable t) { sendText(app, from, "تعذّر إرسال اللقطة."); }
            } }, "tw-snap").start();
        } });
    }
    private static void sendText(Context app, String to, String text) {
        try {
            SharedPreferences p = sp(app);
            post(app, "send", new JSONObject().put("code", p.getString("tw_code", "")).put("token", p.getString("tw_token", "")).put("to", to).put("kind", "text").put("text", text).put("ttl", 86400));
        } catch (Throwable ignored) { }
    }
    private static void sendShot(Context app, String to, android.graphics.Bitmap bmp) throws Exception {
        SharedPreferences p = sp(app);
        String code = p.getString("tw_code", ""), token = p.getString("tw_token", "");
        int w = bmp.getWidth(), h = bmp.getHeight(), max = 1280;
        if (Math.max(w, h) > max) { float k = max / (float) Math.max(w, h); bmp = android.graphics.Bitmap.createScaledBitmap(bmp, Math.round(w * k), Math.round(h * k), true); }
        ByteArrayOutputStream bo = new ByteArrayOutputStream();
        bmp.compress(android.graphics.Bitmap.CompressFormat.JPEG, 80, bo);
        byte[] jpg = bo.toByteArray();
        JSONObject up = post(app, "upload", new JSONObject().put("code", code).put("token", token).put("name", "screen.jpg").put("mime", "image/jpeg").put("size", jpg.length));
        HttpURLConnection h2 = (HttpURLConnection) new URL(up.getString("url")).openConnection();
        h2.setRequestMethod("PUT"); h2.setDoOutput(true); h2.setConnectTimeout(15000); h2.setReadTimeout(60000);
        h2.setRequestProperty("Content-Type", "image/jpeg"); h2.setRequestProperty("cache-control", "max-age=3600");
        try (OutputStream o = h2.getOutputStream()) { o.write(jpg); }
        int rc = h2.getResponseCode();
        if (rc < 200 || rc >= 300) throw new Exception("upload " + rc);
        post(app, "send", new JSONObject().put("code", code).put("token", token).put("to", to).put("kind", "image").put("path", up.getString("path")).put("name", "screen.jpg").put("mime", "image/jpeg").put("size", jpg.length).put("ttl", 86400));
    }

    private static void incoming(Context app, JSONArray msgs) throws Exception {
        SharedPreferences p = sp(app);
        JSONArray q = new JSONArray(p.getString("tw_q", "[]"));
        String last = p.getString("tw_since", ""), from = "";
        // a message already handled is never handled twice (it would ring and pull the launcher to the front again)
        JSONArray seen = new JSONArray(p.getString("tw_seen", "[]"));
        java.util.HashSet<String> have = new java.util.HashSet<String>();
        for (int i = 0; i < seen.length(); i++) have.add(seen.optString(i));
        JSONArray fresh = new JSONArray();
        for (int i = 0; i < msgs.length(); i++) {
            JSONObject m = msgs.getJSONObject(i);
            last = m.optString("ts", last);
            String id = m.optString("id", "");
            if (id.length() > 0 && !have.add(id)) continue;
            if (id.length() > 0) seen.put(id);
            fresh.put(m); q.put(m); from = m.optString("from", from);
        }
        while (seen.length() > 300) seen.remove(0);
        p.edit().putString("tw_seen", seen.toString()).putString("tw_since", last).apply();
        if (fresh.length() == 0) return;
        msgs = fresh;
        while (q.length() > 200) q.remove(0);
        p.edit().putString("tw_q", q.toString()).putString("tw_since", last).apply();
        boolean quiet = silenced(app, from);
        if (!quiet) { try { Ringtone r = RingtoneManager.getRingtone(app, RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)); if (r != null) r.play(); } catch (Throwable ignored) { } }
        if (MainActivity.foreground) {
            MainActivity.drainSoon();
        } else if (!quiet) {
            alert(app, msgs.getJSONObject(msgs.length() - 1), msgs.length());
        }
        if (!quiet && !MainActivity.foreground && p.getBoolean("tw_auto", true)) {
            // an accessibility service may start an activity from the background where an ordinary app may not
            Context ctx = PowerService.instance != null ? PowerService.instance : app;
            Intent i = new Intent(app, MainActivity.class).putExtra("tw_open", from)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            try { ctx.startActivity(i); } catch (Throwable ignored) { }
        }
    }
}
