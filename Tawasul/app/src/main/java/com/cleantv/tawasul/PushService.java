package com.cleantv.tawasul;

import android.content.Context;
import android.content.SharedPreferences;

import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/** Instant notifications: the relay sends a data push the moment a message arrives. The notification is built here, so tapping it opens that chat. */
public class PushService extends FirebaseMessagingService {

    @Override
    public void onMessageReceived(RemoteMessage m) {
        Map<String, String> d = m.getData();
        if (d == null || d.isEmpty()) return;
        // while the app is open the page already shows it
        if (MainActivity.visible || !MainActivity.prefs(this).getBoolean("notif", true)) return;
        PollJob.show(this, d.get("from"), d.get("fromName"), d.get("kind") == null ? "text" : d.get("kind"), d.get("text"), d.get("name"), 1);
    }

    @Override
    public void onNewToken(String token) { send(getApplicationContext(), token); }

    /** Fetches this phone's push token and tells the relay (called when the page gives the host the account). */
    static void sync(final Context c) {
        try {
            FirebaseMessaging.getInstance().getToken().addOnCompleteListener(t -> { if (t.isSuccessful() && t.getResult() != null) send(c, t.getResult()); });
        } catch (Throwable ignored) { }
    }

    static void send(final Context c, final String fcm) {
        final SharedPreferences sp = MainActivity.prefs(c);
        final String code = sp.getString("code", ""), token = sp.getString("token", "");
        if (code.length() != 10 || token.length() < 20 || fcm == null) return;
        if (fcm.equals(sp.getString("fcmSent", "")) && code.equals(sp.getString("fcmFor", ""))) return;
        new Thread(() -> {
            try {
                JSONObject req = new JSONObject().put("code", code).put("token", token).put("fcm", fcm);
                HttpURLConnection h = (HttpURLConnection) new URL(PollJob.BASE + "/push-token").openConnection();
                h.setRequestMethod("POST"); h.setDoOutput(true); h.setConnectTimeout(15000); h.setReadTimeout(20000);
                h.setRequestProperty("Content-Type", "application/json");
                try (OutputStream o = h.getOutputStream()) { o.write(req.toString().getBytes(StandardCharsets.UTF_8)); }
                if (h.getResponseCode() == 200) sp.edit().putString("fcmSent", fcm).putString("fcmFor", code).apply();
            } catch (Throwable ignored) { }
        }).start();
    }
}
