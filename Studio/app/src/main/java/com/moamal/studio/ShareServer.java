package com.moamal.studio;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;

/** Serves the launcher APK from the phone so a car screen or box can install it by typing a short address
 *  like 192.168.43.1:8080 (the phone is the hotspot). */
final class ShareServer extends Thread {
    static final int PORT = 8080;
    private static ShareServer running;
    private final File apk;
    private ServerSocket ss;

    private ShareServer(File apk) { super("studio-share"); this.apk = apk; setDaemon(true); }

    static String version = "";

    static synchronized void start(File apk, String ver) throws Exception {
        version = ver == null ? "" : ver;
        stopNow();
        ShareServer s = new ShareServer(apk);
        s.ss = new ServerSocket();
        s.ss.setReuseAddress(true);
        s.ss.bind(new java.net.InetSocketAddress(PORT));
        running = s; s.start();
    }

    static synchronized void stopNow() {
        if (running != null) { try { running.ss.close(); } catch (Throwable ignored) { } running = null; }
    }

    static boolean on() { return running != null; }

    @Override public void run() {
        while (!ss.isClosed()) {
            try {
                final Socket so = ss.accept();
                new Thread(() -> serve(so)).start();
            } catch (Throwable e) { if (ss.isClosed()) return; }
        }
    }

    private void serve(Socket so) {
        try (Socket s = so) {
            s.setSoTimeout(20000);
            InputStream in = s.getInputStream();
            StringBuilder line = new StringBuilder(); int ch;
            while ((ch = in.read()) > 0 && ch != '\n') line.append((char) ch);
            String path = line.toString().split(" ").length > 1 ? line.toString().split(" ")[1] : "/";
            // drain headers
            int last = 0, cur; while ((cur = in.read()) >= 0) { if (cur == '\n' && last == '\n') break; if (cur != '\r') last = cur; }
            OutputStream o = s.getOutputStream();
            if (path.startsWith("/w.apk") || path.endsWith(".apk")) {
                long len = apk.length();
                o.write(("HTTP/1.1 200 OK\r\nContent-Type: application/vnd.android.package-archive\r\nContent-Length: " + len
                        + "\r\nContent-Disposition: attachment; filename=\"moamal-tv.apk\"\r\nConnection: close\r\n\r\n").getBytes(StandardCharsets.US_ASCII));
                try (FileInputStream f = new FileInputStream(apk)) {
                    byte[] b = new byte[64 * 1024]; int n;
                    while ((n = f.read(b)) > 0) o.write(b, 0, n);
                }
            } else {
                String size = String.format(java.util.Locale.US, "%.1f", apk.length() / 1048576.0);
                String ver = version.isEmpty() ? "" : "الإصدار " + version + " · ";
                String html = "<!doctype html><html lang=ar dir=rtl><head><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>"
                        + "<title>واجهة مدير الشاشات · تحميل</title><style>"
                        + "*{box-sizing:border-box;margin:0;padding:0}"
                        + "html,body{min-height:100%;background:#0B0C10;color:#F2EFE8;font-family:'Tajawal','Noto Kufi Arabic','Segoe UI',sans-serif;-webkit-tap-highlight-color:transparent}"
                        + "body{background:radial-gradient(80% 55% at 100% 0%,rgba(214,180,122,.16),transparent 70%),radial-gradient(70% 50% at 0% 100%,rgba(110,155,255,.10),transparent 70%),#0B0C10;"
                        + "display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center;padding:28px 18px}"
                        + ".w{width:100%;max-width:560px;text-align:center}"
                        + ".mk{width:86px;height:86px;margin:0 auto 18px;border-radius:26px;background:linear-gradient(140deg,#F0DDB2,#D6B47A 50%,#9C7A44);box-shadow:0 18px 50px -14px rgba(214,180,122,.55);position:relative}"
                        + ".mk i{position:absolute;left:20px;right:20px;top:24px;height:30px;border:3px solid #0B0C10;border-radius:7px}"
                        + ".mk b{position:absolute;left:34px;right:34px;bottom:20px;height:3px;background:#0B0C10;border-radius:3px}"
                        + ".hi{font-size:15px;color:#D6B47A;font-weight:700;margin-bottom:8px}"
                        + "h1{font-size:30px;font-weight:800;line-height:1.3;margin-bottom:10px}"
                        + ".sub{font-size:16px;line-height:1.75;color:rgba(242,239,232,.68);margin-bottom:22px}"
                        + ".chip{display:inline-block;padding:7px 14px;border-radius:999px;border:1px solid rgba(214,180,122,.35);color:#F0DDB2;font-size:13.5px;margin-bottom:24px;direction:rtl}"
                        + ".box{display:block;text-decoration:none;color:#0B0C10;border-radius:28px;padding:26px 20px 16px;background:linear-gradient(140deg,#F0DDB2,#D6B47A 55%,#B48C55);"
                        + "box-shadow:0 24px 60px -22px rgba(214,180,122,.7),inset 0 1px 0 rgba(255,255,255,.5)}"
                        + ".box:active{-webkit-transform:scale(.98);transform:scale(.98)}"
                        + ".box svg{width:54px;height:54px;display:block;margin:0 auto 10px}"
                        + ".box strong{display:block;font-size:22px;font-weight:800}"
                        + ".box small{display:block;font-size:13px;font-weight:700;margin-top:8px;opacity:.7}"
                        + ".st{margin-top:22px;text-align:right;border-radius:20px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07);padding:6px 16px}"
                        + ".st div{padding:12px 0;font-size:15px;line-height:1.6;color:rgba(242,239,232,.82);border-bottom:1px solid rgba(255,255,255,.06)}"
                        + ".st div:last-child{border-bottom:0}.st em{font-style:normal;display:inline-block;width:26px;height:26px;line-height:26px;text-align:center;border-radius:50%;background:rgba(214,180,122,.16);color:#D6B47A;font-weight:800;margin-left:10px;font-size:13px}"
                        + ".ft{margin-top:22px;font-size:12.5px;color:rgba(242,239,232,.4)}"
                        + "</style></head><body><div class=w>"
                        + "<div class=mk><i></i><b></b></div>"
                        + "<div class=hi>أهلاً وسهلاً</div>"
                        + "<h1>هلا بيك، هاي «واجهة مدير الشاشات» لشاشتك</h1>"
                        + "<p class=sub>واجهة فخمة للسيارة والتلفزيون: تطبيقاتك، الموسيقى، الخرائط والسرعة، كلها بمكان واحد.</p>"
                        + "<div class=chip>" + ver + size + " ميگا</div>"
                        + "<a class=box href='/w.apk' download='moamal-tv.apk'>"
                        + "<svg viewBox='0 0 24 24' fill='none' stroke='#0B0C10' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M12 3v12'/><path d='M7 10l5 5 5-5'/><path d='M5 20h14'/></svg>"
                        + "<strong>نزّل الواجهة</strong><small>تحميل</small></a>"
                        + "<div class=st><div><em>١</em>اضغط الصندوق وانتظر يخلص التحميل.</div>"
                        + "<div><em>٢</em>افتح الملف من الإشعار أو من «التنزيلات».</div>"
                        + "<div><em>٣</em>إذا طلب «السماح بالتثبيت من هذا المصدر» اسمحله، وبعدها «تثبيت».</div></div>"
                        + "<div class=ft>من تطبيق «مدير الشاشة» · الموبايل لازم يبقى قريب وعلى نفس الشبكة</div>"
                        + "</div></body></html>";
                byte[] b = html.getBytes(StandardCharsets.UTF_8);
                o.write(("HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: " + b.length + "\r\nConnection: close\r\n\r\n").getBytes(StandardCharsets.US_ASCII));
                o.write(b);
            }
            o.flush();
        } catch (Throwable ignored) { }
    }
}
