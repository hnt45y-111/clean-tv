package com.moamal.studio;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.SharedPreferences;
import android.provider.Settings;

import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;

import javax.crypto.Mac;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * Offline accounts. Each account is bound to one phone's device code and carries its own expiry inside the
 * password, signed with HMAC, so no server is needed.
 */
final class Accounts {
    private static final String AL = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    private static final long EPOCH = 1767225600000L; // 2026-01-01 UTC
    private static final String LIFE = "ZZZ";
    private static final String[] K = { "c799bc34fe78dac6", "0a6a6568a98e41af", "d33a047c649cedfe", "a8f3902ddea9fa7c" };
    private static final String AH = "56e115dda623ea459df69551963626f36fee9232b3f3321eb3a75c118587e566";

    private Accounts() { }

    static SharedPreferences p(Context c) { return c.getSharedPreferences("acct", 0); }

    @SuppressLint("HardwareIds")
    static String deviceCode(Context c) {
        String id = Settings.Secure.getString(c.getContentResolver(), Settings.Secure.ANDROID_ID);
        if (id == null) id = "x";
        byte[] h = sha("mdr-dev:" + id);
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < 8; i++) {
            if (i == 4) b.append('-');
            b.append(AL.charAt((h[i] & 0xff) % 32));
        }
        return b.toString();
    }

    private static byte[] sha(String s) {
        try { return MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)); }
        catch (Exception e) { return new byte[32]; }
    }

    private static String sig(String code, String user, String exp) {
        try {
            Mac m = Mac.getInstance("HmacSHA256");
            m.init(new SecretKeySpec(hex(K[0] + K[1] + K[2] + K[3]), "HmacSHA256"));
            byte[] h = m.doFinal((norm(code) + "|" + user.trim().toLowerCase(Locale.ROOT) + "|" + exp).getBytes(StandardCharsets.UTF_8));
            StringBuilder b = new StringBuilder();
            for (int i = 0; i < 7; i++) b.append(AL.charAt((h[i] & 0xff) % 32));
            return b.toString();
        } catch (Exception e) { return "-"; }
    }

    private static String norm(String code) {
        return code == null ? "" : code.toUpperCase(Locale.ROOT).replaceAll("[^0-9A-Z]", "");
    }

    private static byte[] hex(String s) {
        byte[] b = new byte[s.length() / 2];
        for (int i = 0; i < b.length; i++) b[i] = (byte) Integer.parseInt(s.substring(i * 2, i * 2 + 2), 16);
        return b;
    }

    private static String encDay(long day) {
        char[] c = new char[3];
        for (int i = 2; i >= 0; i--) { c[i] = AL.charAt((int) (day % 32)); day /= 32; }
        return new String(c);
    }

    private static long decDay(String s) {
        long d = 0;
        for (char ch : s.toCharArray()) {
            int v = AL.indexOf(ch);
            if (v < 0) return -1;
            d = d * 32 + v;
        }
        return d;
    }

    private static long today() { return (System.currentTimeMillis() - EPOCH) / 86400000L; }

    /** Admin only: build the password for a given phone code, username and number of days (0 = lifetime). */
    static String generate(String code, String user, int days) {
        String exp = days <= 0 ? LIFE : encDay(today() + days);
        String pw = exp + sig(code, user, exp);
        return pw.substring(0, 5) + "-" + pw.substring(5);
    }

    /** Admin only: lifetime activation code for «مدير الشاشات أوتو» on a given phone (must match Acct.autoCode there). */
    static String autoCode(String dev) {
        try {
            Mac m = Mac.getInstance("HmacSHA256");
            m.init(new SecretKeySpec(hex(K[0] + K[1] + K[2] + K[3]), "HmacSHA256"));
            byte[] h = m.doFinal(("auto|" + norm(dev) + "|life").getBytes(StandardCharsets.UTF_8));
            StringBuilder b = new StringBuilder();
            for (int i = 0; i < 10; i++) { if (i == 5) b.append('-'); b.append(AL.charAt((h[i] & 0xff) % 32)); }
            return b.toString();
        } catch (Exception e) { return ""; }
    }

    static boolean isAdmin(String user, String pass) {
        try {
            if (!"mhmd21".equals(user.trim())) return false;
            PBEKeySpec spec = new PBEKeySpec(pass.toCharArray(), ("mdr-salt-7f3:" + user.trim()).getBytes(StandardCharsets.UTF_8), 20000, 256);
            byte[] h = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
            StringBuilder b = new StringBuilder();
            for (byte x : h) b.append(String.format("%02x", x));
            return MessageDigest.isEqual(b.toString().getBytes(), AH.getBytes());
        } catch (Exception e) { return false; }
    }

    /** Check a username/password typed on the login page. */
    static JSONObject login(Context c, String user, String pass) throws Exception {
        JSONObject r = new JSONObject();
        if (isAdmin(user, pass)) {
            p(c).edit().putString("user", user.trim()).putString("role", "admin").putLong("exp", -1).apply();
            return session(c);
        }
        String pw = norm(pass);
        if (pw.length() != 10) return r.put("ok", false).put("msg", "اسم المستخدم أو كلمة المرور غير صحيحة");
        String exp = pw.substring(0, 3);
        if (!sig(deviceCode(c), user, exp).equals(pw.substring(3)))
            return r.put("ok", false).put("msg", "اسم المستخدم أو كلمة المرور غير صحيحة، أو الحساب مخصّص لجهاز آخر");
        long expDay = LIFE.equals(exp) ? -1 : decDay(exp);
        if (expDay >= 0 && today() > expDay) return r.put("ok", false).put("msg", "انتهت مدة هذا الحساب");
        p(c).edit().putString("user", user.trim()).putString("role", "user").putLong("exp", expDay).apply();
        return session(c);
    }

    /** Current login state; also guards against the clock being turned back. */
    static JSONObject session(Context c) throws Exception {
        SharedPreferences sp = p(c);
        JSONObject r = new JSONObject();
        String user = sp.getString("user", null);
        long now = System.currentTimeMillis(), seen = sp.getLong("seen", 0);
        if (now > seen) sp.edit().putLong("seen", now).apply();
        if (user == null) return r.put("ok", false);
        String role = sp.getString("role", "user");
        long exp = sp.getLong("exp", -1);
        boolean tamper = seen - now > 2 * 86400000L;
        if (!"admin".equals(role) && (tamper || (exp >= 0 && today() > exp))) {
            sp.edit().remove("user").apply();
            return r.put("ok", false).put("msg", tamper ? "تاريخ الجهاز غير صحيح، صحّح التاريخ وسجّل مرة ثانية" : "انتهت مدة الحساب، تواصل معنا للتجديد");
        }
        r.put("ok", true).put("user", user).put("admin", "admin".equals(role));
        if (exp >= 0) r.put("expAt", EPOCH + (exp + 1) * 86400000L);
        return r;
    }

    static void logout(Context c) { p(c).edit().remove("user").remove("role").remove("exp").apply(); }
}
