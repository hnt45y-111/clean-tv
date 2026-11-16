package com.cleantv.launcher;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * The IPTV server address. It is not typed anywhere and it is not in the code: it ships as its own file
 * (assets/srv.dat, masked so it is not plain text). Write it with Studio/tools/set_server.py (same file, same key).
 */
final class Srv {
    private static String cache;

    private Srv() { }

    static String get(android.content.Context c) {
        if (cache != null) return cache;
        try (InputStream in = c.getAssets().open("srv.dat")) {
            ByteArrayOutputStream o = new ByteArrayOutputStream();
            byte[] b = new byte[512];
            for (int n; (n = in.read(b)) > 0; ) o.write(b, 0, n);
            byte[] d = android.util.Base64.decode(new String(o.toByteArray(), StandardCharsets.UTF_8).trim(), android.util.Base64.DEFAULT);
            byte[] m = "msm-srv-2026".getBytes(StandardCharsets.UTF_8);
            for (int i = 0; i < d.length; i++) d[i] = (byte) (d[i] ^ m[i % m.length]);
            cache = new String(d, StandardCharsets.UTF_8).trim();
        } catch (Exception e) { cache = ""; }
        return cache;
    }
}
