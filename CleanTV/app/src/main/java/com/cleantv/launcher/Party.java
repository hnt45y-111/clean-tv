package com.cleantv.launcher;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;

/**
 * «مشاهدة جماعية»: two TVs on the same home network watch together. Each TV has a room code; the other TV is linked by
 * its address and code. When one starts a channel or a film, changes the channel or pauses, the other does the same.
 * Messages go straight from TV to TV (no server in between), and a TV only accepts them with its own room code.
 */
final class Party {
    private Party() { }

    static String room(Context c) {
        SharedPreferences p = Media.prefs(c);
        String r = p.getString("partyRoom", "");
        if (r.length() != 6) { r = String.valueOf(100000 + new SecureRandom().nextInt(900000)); p.edit().putString("partyRoom", r).apply(); }
        return r;
    }
    static String peerIp(Context c) { return Media.prefs(c).getString("partyPeerIp", ""); }
    static boolean on(Context c) { return peerIp(c).length() > 0; }
    static void link(Context c, String ip, String peerRoom) {
        Media.prefs(c).edit().putString("partyPeerIp", ip.trim()).putString("partyPeerRoom", peerRoom.trim()).apply();
    }
    static void off(Context c) { Media.prefs(c).edit().remove("partyPeerIp").remove("partyPeerRoom").apply(); }

    /** sends one message to the linked TV, in the background; a TV that is off simply does not answer */
    static void send(final Context c, final JSONObject msg) {
        final String ip = peerIp(c), pr = Media.prefs(c).getString("partyPeerRoom", "");
        if (ip.length() == 0) return;
        new Thread(new Runnable() { public void run() {
            try {
                msg.put("room", pr);
                msg.put("from", Media.prefs(c).getString("partyName", "الشاشة الثانية"));
                msg.put("backIp", RemoteServer.ip()); msg.put("backRoom", room(c));
                HttpURLConnection h = (HttpURLConnection) new URL("http://" + ip + ":" + RemoteServer.PORT + "/api/party").openConnection();
                h.setConnectTimeout(4000); h.setReadTimeout(6000); h.setDoOutput(true); h.setRequestMethod("POST");
                h.setRequestProperty("Content-Type", "application/json");
                try (OutputStream o = h.getOutputStream()) { o.write(msg.toString().getBytes(StandardCharsets.UTF_8)); }
                h.getResponseCode(); h.disconnect();
            } catch (Throwable ignored) { }
        } }).start();
    }
}
