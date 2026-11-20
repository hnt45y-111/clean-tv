package com.cleantv.mobile;

import android.annotation.SuppressLint;
import android.content.Context;
import android.provider.Settings;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/** One-time (lifetime) activation, bound to this phone. The code is made by the admin inside «مدير الشاشة» (Accounts.mobileCode there: the two must stay identical). */
final class Acct {
    private static final String AL = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    private static final String[] K = { "c799bc34fe78dac6", "0a6a6568a98e41af", "d33a047c649cedfe", "a8f3902ddea9fa7c" };

    private Acct() { }

    @SuppressLint("HardwareIds")
    static String deviceCode(Context c) {
        String id = Settings.Secure.getString(c.getContentResolver(), Settings.Secure.ANDROID_ID);
        if (id == null) id = "x";
        byte[] h;
        try { h = MessageDigest.getInstance("SHA-256").digest(("msm-mobile-dev:" + id).getBytes(StandardCharsets.UTF_8)); }
        catch (Exception e) { h = new byte[32]; }
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < 8; i++) { if (i == 4) b.append('-'); b.append(AL.charAt((h[i] & 0xff) % 32)); }
        return b.toString();
    }

    static String norm(String s) { return s == null ? "" : s.toUpperCase(Locale.ROOT).replaceAll("[^0-9A-Z]", ""); }

    static String mobileCode(String dev) {
        try {
            byte[] k = new byte[32]; String hx = K[0] + K[1] + K[2] + K[3];
            for (int i = 0; i < 32; i++) k[i] = (byte) Integer.parseInt(hx.substring(i * 2, i * 2 + 2), 16);
            Mac m = Mac.getInstance("HmacSHA256");
            m.init(new SecretKeySpec(k, "HmacSHA256"));
            byte[] h = m.doFinal(("mobile|" + norm(dev) + "|life").getBytes(StandardCharsets.UTF_8));
            StringBuilder b = new StringBuilder();
            for (int i = 0; i < 10; i++) { if (i == 5) b.append('-'); b.append(AL.charAt((h[i] & 0xff) % 32)); }
            return b.toString();
        } catch (Exception e) { return "-"; }
    }

    static boolean active(Context c) {
        String s = c.getSharedPreferences("mobile", 0).getString("act", "");
        return !s.isEmpty() && s.equals(norm(mobileCode(deviceCode(c))));
    }

    static boolean activate(Context c, String code) {
        if (!norm(code).equals(norm(mobileCode(deviceCode(c))))) return false;
        c.getSharedPreferences("mobile", 0).edit().putString("act", norm(code)).apply();
        return true;
    }
}
