package com.cleantv.launcher;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.Ringtone;
import android.media.RingtoneManager;

import org.json.JSONArray;
import org.json.JSONObject;

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
                        JSONArray msgs = post(app, "inbox", req);
                        back = 3000;
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

    /** POST to the relay; returns msgs of an inbox answer (never null for inbox), or null on a non-200 answer. */
    private static JSONArray post(Context c, String route, JSONObject body) throws Exception {
        HttpURLConnection h = (HttpURLConnection) new URL(BASE + "/" + route).openConnection();
        h.setRequestMethod("POST"); h.setDoOutput(true); h.setConnectTimeout(15000); h.setReadTimeout(40000);
        h.setRequestProperty("Content-Type", "application/json");
        try (OutputStream o = h.getOutputStream()) { o.write(body.toString().getBytes(StandardCharsets.UTF_8)); }
        int code = h.getResponseCode();
        if (code != 200) { if (code == 401 || code == 400) Thread.sleep(15000); throw new Exception("http " + code); }
        StringBuilder sb = new StringBuilder();
        try (InputStream in = h.getInputStream()) { byte[] b = new byte[8192]; int n; while ((n = in.read(b)) > 0) sb.append(new String(b, 0, n, StandardCharsets.UTF_8)); }
        JSONArray a = new JSONObject(sb.toString()).optJSONArray("msgs");
        return a == null ? new JSONArray() : a;
    }

    private static void incoming(Context app, JSONArray msgs) throws Exception {
        SharedPreferences p = sp(app);
        JSONArray q = new JSONArray(p.getString("tw_q", "[]"));
        String last = p.getString("tw_since", ""), from = "";
        for (int i = 0; i < msgs.length(); i++) {
            JSONObject m = msgs.getJSONObject(i);
            q.put(m); last = m.optString("ts", last); from = m.optString("from", from);
        }
        while (q.length() > 200) q.remove(0);
        p.edit().putString("tw_q", q.toString()).putString("tw_since", last).apply();
        try { Ringtone r = RingtoneManager.getRingtone(app, RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)); if (r != null) r.play(); } catch (Throwable ignored) { }
        if (MainActivity.foreground) {
            MainActivity.drainSoon();
        } else if (p.getBoolean("tw_auto", true)) {
            // an accessibility service may start an activity from the background where an ordinary app may not
            Context ctx = PowerService.instance != null ? PowerService.instance : app;
            Intent i = new Intent(app, MainActivity.class).putExtra("tw_open", from)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            try { ctx.startActivity(i); } catch (Throwable ignored) { }
        }
    }
}
