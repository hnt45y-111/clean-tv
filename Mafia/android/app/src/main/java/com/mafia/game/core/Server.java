package com.mafia.game.core;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.SocketTimeoutException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Supplier;

/**
 * خادم HTTP + WebSocket على منفذ واحد، بلا مكتبات. يقدّم واجهة اللعبة من الأصول،
 * وواجهة REST مصغّرة، وبروتوكول WebSocket نفسه الذي يستخدمه خادم Node.
 */
public final class Server {
    /** مصدر ملفات الواجهة (أصول أندرويد، أو مجلد على الحاسوب للاختبار) */
    public interface Assets { byte[] read(String path); }

    private final Hub hub; private final Assets assets;
    private final Supplier<List<String>> lan; private final Supplier<Map<String, Object>> wifi;
    private ServerSocket ss; private final ExecutorService pool = Executors.newCachedThreadPool(r -> { Thread t = new Thread(r, "mafia-http"); t.setDaemon(true); return t; });
    private volatile boolean running; public int port;

    public Server(Hub hub, Assets assets, Supplier<List<String>> lan, Supplier<Map<String, Object>> wifi) { this.hub = hub; this.assets = assets; this.lan = lan; this.wifi = wifi; }

    /** يجرّب المنافذ من الأول إلى الأخير حتى يجد منفذاً حراً */
    public int start(int first, int last) throws IOException {
        IOException err = null;
        for (int p = first; p <= last; p++) {
            try { ss = new ServerSocket(); ss.setReuseAddress(true); ss.bind(new InetSocketAddress("0.0.0.0", p)); port = p; break; }
            catch (IOException e) { err = e; ss = null; }
        }
        if (ss == null) throw err != null ? err : new IOException("no_port");
        running = true;
        Thread t = new Thread(() -> { while (running) { try { Socket s = ss.accept(); pool.execute(() -> handle(s)); } catch (IOException e) { if (!running) break; } } }, "mafia-accept");
        t.setDaemon(true); t.start();
        return port;
    }
    public void stop() { running = false; try { if (ss != null) ss.close(); } catch (IOException ignored) { } pool.shutdownNow(); hub.shutdown(); }

    // ---------- HTTP ----------
    private static String readLine(InputStream in) throws IOException {
        ByteArrayOutputStream b = new ByteArrayOutputStream(); int c;
        while ((c = in.read()) != -1) { if (c == '\n') break; if (c != '\r') b.write(c); if (b.size() > 8192) throw new IOException("line"); }
        if (c == -1 && b.size() == 0) return null;
        return new String(b.toByteArray(), StandardCharsets.UTF_8);
    }

    private void handle(Socket s) {
        try {
            s.setSoTimeout(15000);
            InputStream in = s.getInputStream(); OutputStream out = s.getOutputStream();
            String line = readLine(in); if (line == null) { s.close(); return; }
            String[] rl = line.split(" "); if (rl.length < 2) { s.close(); return; }
            String method = rl[0]; String target = rl[1];
            Map<String, String> hd = new LinkedHashMap<>();
            for (String h; (h = readLine(in)) != null && !h.isEmpty(); ) { int i = h.indexOf(':'); if (i > 0) hd.put(h.substring(0, i).trim().toLowerCase(Locale.ROOT), h.substring(i + 1).trim()); }
            String path = target; int q = path.indexOf('?'); if (q >= 0) path = path.substring(0, q);
            boolean loop = isLoopback(s.getInetAddress());
            if ("websocket".equalsIgnoreCase(hd.get("upgrade")) && path.equals("/ws")) { websocket(s, in, out, hd, loop); return; }
            byte[] body = new byte[0];
            int len = 0; try { len = Integer.parseInt(hd.getOrDefault("content-length", "0")); } catch (NumberFormatException ignored) { }
            if (len > 300_000) { respond(out, 413, "application/json", "{\"error\":\"too_large\"}".getBytes(StandardCharsets.UTF_8)); s.close(); return; }
            if (len > 0) { body = new byte[len]; int off = 0; while (off < len) { int r = in.read(body, off, len - off); if (r < 0) break; off += r; } }
            if (path.startsWith("/api/")) api(out, method, path, hd, body, loop); else serveStatic(out, path);
            out.flush(); s.close();
        } catch (Exception e) { try { s.close(); } catch (IOException ignored) { } }
    }
    static boolean isLoopback(InetAddress a) { return a != null && a.isLoopbackAddress(); }

    private static void respond(OutputStream out, int status, String type, byte[] body) throws IOException {
        String head = "HTTP/1.1 " + status + " " + (status == 200 ? "OK" : status == 404 ? "Not Found" : "Error") + "\r\nContent-Type: " + type + "\r\nContent-Length: " + body.length
                + "\r\nCache-Control: no-cache\r\nX-Content-Type-Options: nosniff\r\nConnection: close\r\n\r\n";
        out.write(head.getBytes(StandardCharsets.UTF_8)); out.write(body);
    }
    private static void json(OutputStream out, int status, Object body) throws IOException { respond(out, status, "application/json; charset=utf-8", Json.stringify(body).getBytes(StandardCharsets.UTF_8)); }

    private void api(OutputStream out, String method, String p, Map<String, String> hd, byte[] body, boolean loop) throws IOException {
        try {
            if (method.equals("GET") && p.equals("/api/config")) {
                // معلومات نقطة الاتصال (الاسم وكلمة المرور) لهاتف الراوي فقط
                Map<String, Object> w = loop && wifi != null ? wifi.get() : null;
                json(out, 200, Json.obj("googleClientId", "", "version", 1L, "local", true, "isHost", loop,
                        "wifi", w == null ? null : w.get("wifi"), "hotspotError", w == null ? null : w.get("error"))); return;
            }
            if (method.equals("GET") && p.equals("/api/lan")) { json(out, 200, Json.obj("addresses", lan == null ? new ArrayList<>() : lan.get())); return; }
            if (method.equals("GET") && p.equals("/api/health")) { json(out, 200, Json.obj("ok", true, "rooms", (long) hub.roomCount())); return; }
            Map<String, Object> b = body.length > 0 ? Json.map(Json.parse(new String(body, StandardCharsets.UTF_8))) : new LinkedHashMap<>();
            if (method.equals("POST") && p.equals("/api/auth/guest")) { json(out, 200, hub.guest(b.get("name"))); return; }
            String tok = hd.getOrDefault("authorization", "").replaceFirst("(?i)^Bearer\\s+", "");
            if (method.equals("POST") && p.equals("/api/auth/logout")) { hub.logout(tok); json(out, 200, Json.obj("ok", true)); return; }
            if (p.startsWith("/api/auth/")) { json(out, 404, Json.obj("error", "local_only")); return; }
            Hub.User u = hub.byToken(tok); if (u == null) { json(out, 401, Json.obj("error", "unauthorized")); return; }
            if (method.equals("GET") && p.equals("/api/me")) { json(out, 200, Json.obj("user", Hub.publicUser(u))); return; }
            if (method.equals("PATCH") && p.equals("/api/me")) {
                if (b.containsKey("avatar") || b.containsKey("frame")) { json(out, 400, Json.obj("error", "local_only")); return; }
                json(out, 200, Json.obj("user", hub.rename(u, b.get("name")))); return;
            }
            json(out, 404, Json.obj("error", "not_found"));
        } catch (GameError e) { json(out, 400, Json.obj("error", e.code)); }
        catch (IllegalArgumentException e) { json(out, 400, Json.obj("error", "bad_json")); }
    }

    private static final Map<String, String> MIME = new LinkedHashMap<>();
    static {
        MIME.put("html", "text/html; charset=utf-8"); MIME.put("js", "text/javascript; charset=utf-8"); MIME.put("mjs", "text/javascript; charset=utf-8");
        MIME.put("css", "text/css; charset=utf-8"); MIME.put("json", "application/json"); MIME.put("svg", "image/svg+xml"); MIME.put("png", "image/png");
        MIME.put("webmanifest", "application/manifest+json"); MIME.put("woff2", "font/woff2"); MIME.put("ico", "image/x-icon");
    }
    private void serveStatic(OutputStream out, String path) throws IOException {
        String rel; try { rel = URLDecoder.decode(path, "UTF-8"); } catch (Exception e) { rel = path; }
        while (rel.startsWith("/")) rel = rel.substring(1);
        if (rel.contains("..") || rel.contains("\\")) { respond(out, 400, "text/plain", new byte[0]); return; }
        if (rel.isEmpty() || rel.endsWith("/")) rel = rel + "index.html";
        byte[] data = assets.read(rel);
        if (data == null) { rel = "index.html"; data = assets.read(rel); }
        if (data == null) { respond(out, 404, "text/plain", "not found".getBytes(StandardCharsets.UTF_8)); return; }
        int dot = rel.lastIndexOf('.'); String ext = dot >= 0 ? rel.substring(dot + 1) : "";
        respond(out, 200, MIME.getOrDefault(ext, "application/octet-stream"), data);
    }

    // ---------- WebSocket (RFC 6455) ----------
    private void websocket(Socket s, InputStream in, OutputStream out, Map<String, String> hd, boolean loop) throws Exception {
        String key = hd.get("sec-websocket-key"); if (key == null) { s.close(); return; }
        String accept = Base64.getEncoder().encodeToString(MessageDigest.getInstance("SHA-1").digest((key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").getBytes(StandardCharsets.UTF_8)));
        out.write(("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " + accept + "\r\n\r\n").getBytes(StandardCharsets.UTF_8)); out.flush();
        s.setSoTimeout(60000); s.setTcpNoDelay(true); // العميل يرسل ping كل 20 ثانية
        WsConn c = new WsConn(s, out, loop);
        try {
            while (true) {
                String msg = c.readText(in); if (msg == null) break;
                onMessage(c, msg);
                if (c.closed) break;
            }
        } catch (SocketTimeoutException | java.io.EOFException ignored) {
        } catch (IOException ignored) {
        } finally { c.close(); if (c.user != null) hub.detach(c); }
    }

    private void onMessage(WsConn c, String raw) {
        Map<String, Object> msg; try { msg = Json.map(Json.parse(raw)); } catch (Exception e) { return; }
        Object t = msg.get("t");
        if (c.user == null) {
            if (!"auth".equals(t)) return;
            Hub.User u = hub.byToken(msg.get("token") == null ? null : String.valueOf(msg.get("token")));
            if (u == null) { c.send(Json.obj("t", "auth_failed")); c.close(); return; }
            c.user = u; hub.attach(c); return;
        }
        Object rid = msg.get("rid"); long uid = c.user.id; Map<String, Object> extra = null;
        try {
            switch (String.valueOf(t)) {
                case "ping": c.send(Json.obj("t", "pong", "serverTime", System.currentTimeMillis())); return;
                case "room:create": hub.createRoom(c, msg); break;
                case "room:join":
                    try { hub.joinRoom(uid, msg.get("key")); }
                    catch (GameError e) { if ((e.code.equals("bad_token") || e.code.equals("room_not_found")) && ++c.joinFails > 8) { reply(c, rid, false, e.code, null); c.close(); return; } throw e; }
                    break;
                case "room:ready": hub.setReady(uid, Json.truthy(msg.get("ready"))); break;
                case "room:settings": hub.updateSettings(uid, Json.map(msg.get("settings"))); break;
                case "room:kick": hub.kick(uid, lng(msg.get("userId"))); break;
                case "room:leave": hub.leave(uid); break;
                case "room:close": hub.close(uid); break;
                case "room:start": hub.startMatch(uid); break;
                case "g": hub.game(uid, msg.get("cmd") == null ? null : String.valueOf(msg.get("cmd")), msg); break;
                case "friends": c.send(Json.obj("t", "friends", "friends", new ArrayList<>(), "incoming", new ArrayList<>(), "outgoing", new ArrayList<>())); break;
                case "report": extra = Json.obj("reports", 0L); break; // لا إدارة بلاغات في الوضع المحلي
                case "mm:find": case "mm:cancel": case "friend:request": case "friend:accept": case "friend:remove": case "friend:decline": case "invite":
                    throw new GameError("local_only");
                default: reply(c, rid, false, "bad_message", null); return;
            }
            reply(c, rid, true, null, extra);
        } catch (GameError e) { reply(c, rid, false, e.code, null); }
        catch (Exception e) { reply(c, rid, false, "server_error", null); }
    }
    private static long lng(Object o) { Double d = Json.num(o); return d == null ? -1 : d.longValue(); }
    private static void reply(WsConn c, Object rid, boolean ok, String error, Map<String, Object> extra) {
        if (rid == null) return;
        Map<String, Object> m = Json.obj("t", "ack", "rid", rid, "ok", ok); if (error != null) m.put("error", error); if (extra != null) m.putAll(extra);
        c.send(m);
    }

    /** اتصال WebSocket: الإرسال عبر خيط مستقل حتى لا يعطّل عميلٌ بطيءٌ بقيةَ اللاعبين */
    final class WsConn implements Hub.Conn {
        final Socket s; final OutputStream out; final boolean loop; volatile boolean closed; Hub.User user; int joinFails;
        final ExecutorService writer = Executors.newSingleThreadExecutor(r -> { Thread t = new Thread(r, "mafia-ws-write"); t.setDaemon(true); return t; });
        WsConn(Socket s, OutputStream out, boolean loop) { this.s = s; this.out = out; this.loop = loop; }
        @Override public long userId() { return user.id; }
        @Override public boolean loopback() { return loop; }
        @Override public void send(Map<String, Object> msg) {
            if (closed) return; final byte[] data = Json.stringify(msg).getBytes(StandardCharsets.UTF_8);
            try { writer.execute(() -> { try { frame(0x1, data); } catch (IOException e) { close(); } }); } catch (Exception ignored) { }
        }
        void frame(int op, byte[] data) throws IOException {
            ByteArrayOutputStream b = new ByteArrayOutputStream(); b.write(0x80 | op);
            if (data.length < 126) b.write(data.length);
            else if (data.length < 65536) { b.write(126); b.write(data.length >> 8); b.write(data.length & 0xff); }
            else { b.write(127); for (int k = 7; k >= 0; k--) b.write((int) (((long) data.length >> (8 * k)) & 0xff)); }
            b.write(data); synchronized (out) { out.write(b.toByteArray()); out.flush(); }
        }
        @Override public void close() {
            if (closed) return; closed = true;
            try { writer.execute(() -> { try { frame(0x8, new byte[0]); } catch (IOException ignored) { } try { s.close(); } catch (IOException ignored) { } }); writer.shutdown(); }
            catch (Exception e) { try { s.close(); } catch (IOException ignored) { } }
        }
        /** يقرأ رسالة نصية كاملة (مع التجزئة)؛ يردّ على ping؛ null عند الإغلاق */
        String readText(InputStream in) throws IOException {
            ByteArrayOutputStream msg = new ByteArrayOutputStream();
            while (true) {
                int b0 = in.read(), b1 = in.read(); if (b0 < 0 || b1 < 0) return null;
                boolean fin = (b0 & 0x80) != 0; int op = b0 & 0x0f; boolean masked = (b1 & 0x80) != 0; long len = b1 & 0x7f;
                if (len == 126) len = (read(in) << 8) | read(in);
                else if (len == 127) { len = 0; for (int k = 0; k < 8; k++) len = (len << 8) | read(in); }
                if (len > 64 * 1024) return null; // حد الرسالة مثل خادم Node
                byte[] mask = new byte[4]; if (masked) readFully(in, mask);
                byte[] data = new byte[(int) len]; readFully(in, data);
                if (masked) for (int k = 0; k < data.length; k++) data[k] ^= mask[k & 3];
                if (op == 0x8) return null;
                if (op == 0x9) { frame(0xA, data); continue; }
                if (op == 0xA) continue;
                msg.write(data);
                if (msg.size() > 64 * 1024) return null;
                if (fin) return new String(msg.toByteArray(), StandardCharsets.UTF_8);
            }
        }
        private int read(InputStream in) throws IOException { int r = in.read(); if (r < 0) throw new java.io.EOFException(); return r; }
        private void readFully(InputStream in, byte[] b) throws IOException { int off = 0; while (off < b.length) { int r = in.read(b, off, b.length - off); if (r < 0) throw new java.io.EOFException(); off += r; } }
    }
}
