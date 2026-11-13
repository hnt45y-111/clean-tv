package com.moamal.studio;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;
import android.os.Build;
import android.util.Base64;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.math.BigInteger;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.security.PrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.util.ArrayDeque;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/**
 * ADB over a USB cable (the phone is the USB host through an OTG cable, the screen is in device mode with
 * USB debugging on). Plain ADB protocol: CNXN / AUTH / OPEN / WRTE / OKAY / CLSE over the two bulk endpoints.
 * One stream at a time, which is all the app needs (commands, file push, app install).
 */
final class UsbAdb {
    private static final int CNXN = 0x4e584e43, AUTH = 0x48545541, OPEN = 0x4e45504f, OKAY = 0x59414b4f, CLSE = 0x45534c43, WRTE = 0x45545257;
    private static final int VERSION = 0x01000001, MAXDATA = 256 * 1024;
    private static final String ACTION = "com.moamal.studio.USB_PERMISSION";
    private static final byte[] SHA1_PREFIX = { 0x30, 0x21, 0x30, 0x09, 0x06, 0x05, 0x2b, 0x0e, 0x03, 0x02, 0x1a, 0x05, 0x00, 0x04, 0x14 };

    private static UsbAdb inst;
    private UsbDeviceConnection conn;
    private UsbInterface intf;
    private UsbEndpoint in, out;
    private int maxData = 4096, nextId = 1;
    String model = "";

    static synchronized UsbAdb get() { if (inst == null) inst = new UsbAdb(); return inst; }
    static boolean active() { return inst != null && inst.conn != null; }

    /** Find the screen on the cable, ask Android for permission, and do the ADB handshake (the screen asks to allow). */
    interface Status { void say(String text); }
    static volatile boolean cancel;

    synchronized boolean connect(Context c, PrivateKey key, RSAPublicKey pub, String name, Status st) throws Exception {
        close();
        cancel = false;
        if (st == null) st = t -> { };
        UsbManager um = (UsbManager) c.getSystemService(Context.USB_SERVICE);
        if (um == null) throw new Exception("هذا الموبايل ما يدعم الكيبل (USB OTG)");
        UsbDevice dev = null; UsbInterface ui = null;
        for (UsbDevice d : um.getDeviceList().values()) {
            for (int i = 0; i < d.getInterfaceCount(); i++) {
                UsbInterface x = d.getInterface(i);
                if (x.getInterfaceClass() == 0xff && x.getInterfaceSubclass() == 0x42 && x.getInterfaceProtocol() == 0x01) { dev = d; ui = x; break; }
            }
            if (dev != null) break;
        }
        if (dev == null) {
            java.util.Collection<UsbDevice> all = um.getDeviceList().values();
            if (all.isEmpty()) throw new Exception("ما مربوط أي جهاز بالكيبل. تأكد إن طرف الـ OTG بهذا الموبايل. وإذا الكيبل Type-C من الطرفين: بالجهاز الثاني افتح إشعار USB واختار «التحكم بالـ USB: الجهاز المتصل»");
            UsbDevice d0 = all.iterator().next();
            String nm = Build.VERSION.SDK_INT >= 21 && d0.getProductName() != null ? d0.getProductName() : "الجهاز";
            throw new Exception("لگيت «" + nm + "» على الكيبل بس «تصحيح USB» مو مشغّل بيه. شغّله من خيارات المطوّر وجرّب مرة ثانية");
        }
        st.say("لگيت " + (Build.VERSION.SDK_INT >= 21 && dev.getProductName() != null ? "«" + dev.getProductName() + "»" : "الجهاز") + " على الكيبل");
        if (!um.hasPermission(dev)) { st.say("اسمح للتطبيق يستعمل الكيبل من الرسالة اللي طلعت بالموبايل"); askPermission(c, um, dev); }
        if (!um.hasPermission(dev)) throw new Exception("ما سمحت للتطبيق يستعمل الكيبل");
        UsbEndpoint ei = null, eo = null;
        for (int i = 0; i < ui.getEndpointCount(); i++) {
            UsbEndpoint e = ui.getEndpoint(i);
            if (e.getType() != UsbConstants.USB_ENDPOINT_XFER_BULK) continue;
            if (e.getDirection() == UsbConstants.USB_DIR_IN) ei = e; else eo = e;
        }
        if (ei == null || eo == null) throw new Exception("منفذ الكيبل ما يدعم ADB");
        UsbDeviceConnection dc = um.openDevice(dev);
        if (dc == null || !dc.claimInterface(ui, true)) { if (dc != null) dc.close(); throw new Exception("ما گدرت أفتح الكيبل"); }
        conn = dc; intf = ui; in = ei; out = eo; rlen = 0;
        try {
            st.say("أتصل بالجهاز…");
            send(CNXN, VERSION, MAXDATA, ("host::" + name + "\0").getBytes(StandardCharsets.UTF_8));
            boolean sentKey = false;
            long until = System.currentTimeMillis() + 60000; // time for the person to press «Allow» on the screen
            int quiet = 0;
            while (System.currentTimeMillis() < until) {
                if (cancel) throw new Exception("انلغى الاتصال");
                Msg m = read(2000);
                if (m == null && ++quiet == 4 && !sentKey) {
                    // nothing back: some devices only answer a fresh hello
                    send(CNXN, VERSION, MAXDATA, ("host::" + name + "\0").getBytes(StandardCharsets.UTF_8));
                }
                if (m == null) continue;
                if (m.cmd == CNXN) {
                    maxData = Math.max(1024, Math.min(m.a1, MAXDATA));
                    String banner = new String(m.data, StandardCharsets.UTF_8);
                    int p = banner.indexOf("ro.product.model=");
                    if (p >= 0) { int e = banner.indexOf(';', p); model = banner.substring(p + 17, e < 0 ? banner.length() : e); }
                    return true;
                }
                if (m.cmd == AUTH && m.a0 == 1) {
                    if (!sentKey) {
                        // first try the signature (works when this phone was allowed before)
                        java.security.Signature sg = java.security.Signature.getInstance("NONEwithRSA");
                        sg.initSign(key);
                        sg.update(SHA1_PREFIX);
                        sg.update(m.data);
                        byte[] sig = sg.sign();
                        send(AUTH, 2, 0, sig);
                        sentKey = true;
                        Msg r = read(1500);
                        if (r != null && r.cmd == CNXN) { maxData = Math.max(1024, Math.min(r.a1, MAXDATA)); return true; }
                        // not known yet: send our public key, the screen shows «Allow USB debugging?»
                        send(AUTH, 3, 0, (androidKey(pub) + " " + name + "\0").getBytes(StandardCharsets.UTF_8));
                        st.say("على الجهاز الثاني طلعت رسالة «السماح بتصحيح USB»: اختار «السماح دائماً» واضغط موافق");
                    }
                }
            }
            throw new Exception(sentKey ? "ما وصلت الموافقة من الجهاز الثاني. اضغط «السماح» عليه وجرّب مرة ثانية" : "الجهاز ما رد على الكيبل. شيل الكيبل ورجّعه، وتأكد إن «تصحيح USB» مشغّل");
        } catch (Exception e) { close(); throw e; }
    }

    private static void askPermission(Context c, UsbManager um, UsbDevice dev) throws InterruptedException {
        final CountDownLatch done = new CountDownLatch(1);
        BroadcastReceiver r = new BroadcastReceiver() { @Override public void onReceive(Context x, Intent i) { done.countDown(); } };
        IntentFilter f = new IntentFilter(ACTION);
        if (Build.VERSION.SDK_INT >= 33) c.registerReceiver(r, f, Context.RECEIVER_NOT_EXPORTED); else c.registerReceiver(r, f);
        int fl = Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0;
        um.requestPermission(dev, PendingIntent.getBroadcast(c, 77, new Intent(ACTION).setPackage(c.getPackageName()), fl));
        for (int i = 0; i < 45 && !cancel && !um.hasPermission(dev); i++) done.await(1, TimeUnit.SECONDS);
        try { c.unregisterReceiver(r); } catch (Throwable ignored) { }
    }

    /** Android's own public-key format (mincrypt RSAPublicKey), base64. */
    static String androidKey(RSAPublicKey pub) {
        BigInteger n = pub.getModulus(), r32 = BigInteger.ONE.shiftLeft(32);
        int words = n.bitLength() / 32;
        BigInteger n0inv = r32.subtract(n.mod(r32).modInverse(r32));
        BigInteger rr = BigInteger.ONE.shiftLeft(words * 32 * 2).mod(n);
        ByteBuffer b = ByteBuffer.allocate(4 + 4 + words * 4 * 2 + 4).order(ByteOrder.LITTLE_ENDIAN);
        b.putInt(words).putInt(n0inv.intValue());
        for (int i = 0; i < words; i++) b.putInt(n.shiftRight(32 * i).mod(r32).intValue());
        for (int i = 0; i < words; i++) b.putInt(rr.shiftRight(32 * i).mod(r32).intValue());
        b.putInt(pub.getPublicExponent().intValue());
        return Base64.encodeToString(b.array(), Base64.NO_WRAP);
    }

    synchronized boolean alive() {
        if (conn == null) return false;
        try { byte[] r = exec("shell:echo ok"); return new String(r, StandardCharsets.UTF_8).contains("ok"); }
        catch (Throwable t) { close(); return false; }
    }

    synchronized void close() {
        try { if (conn != null) { conn.releaseInterface(intf); conn.close(); } } catch (Throwable ignored) { }
        conn = null; intf = null; in = null; out = null;
    }

    /* ---------------- packets ---------------- */
    private static final class Msg { int cmd, a0, a1; byte[] data; }

    private void send(int cmd, int a0, int a1, byte[] data) throws IOException {
        int len = data == null ? 0 : data.length, sum = 0;
        for (int i = 0; i < len; i++) sum += data[i] & 0xff;
        ByteBuffer h = ByteBuffer.allocate(24).order(ByteOrder.LITTLE_ENDIAN);
        h.putInt(cmd).putInt(a0).putInt(a1).putInt(len).putInt(sum).putInt(~cmd);
        bulkOut(h.array(), 24);
        if (len > 0) bulkOut(data, len);
    }

    private void bulkOut(byte[] b, int len) throws IOException {
        int off = 0;
        while (off < len) {
            int n = Math.min(len - off, 16384);
            byte[] part = off == 0 && n == len ? b : java.util.Arrays.copyOfRange(b, off, off + n);
            int w = conn == null ? -1 : conn.bulkTransfer(out, part, n, 5000);
            if (w < 0) { throw new IOException("انقطع الكيبل"); }
            off += w;
        }
    }

    /* Incoming bytes are buffered: newer Android sends the header and the data in one USB transfer, and a
       24-byte read buffer used to drop the rest (that is why the approval never arrived). */
    private byte[] rbuf = new byte[1 << 18];
    private int rlen = 0;
    private final byte[] tbuf = new byte[16384];

    private boolean fill(int ms) throws IOException {
        if (conn == null) throw new IOException("انقطع الكيبل");
        int n = conn.bulkTransfer(in, tbuf, tbuf.length, ms);
        if (n <= 0) return false;
        if (rlen + n > rbuf.length) rbuf = java.util.Arrays.copyOf(rbuf, Math.max(rbuf.length * 2, rlen + n));
        System.arraycopy(tbuf, 0, rbuf, rlen, n);
        rlen += n;
        return true;
    }

    /** One packet, or null after ms without anything. */
    private Msg read(int ms) throws IOException {
        if (rlen < 24 && !fill(ms) && rlen == 0) return null;
        long until = System.currentTimeMillis() + 10000;
        while (rlen < 24) { if (!fill(1000) && System.currentTimeMillis() > until) throw new IOException("انقطع الكيبل"); }
        ByteBuffer b = ByteBuffer.wrap(rbuf, 0, 24).order(ByteOrder.LITTLE_ENDIAN);
        Msg m = new Msg();
        m.cmd = b.getInt(); m.a0 = b.getInt(); m.a1 = b.getInt();
        int len = b.getInt();
        if (len < 0 || len > (16 << 20)) { rlen = 0; throw new IOException("رد غريب من الكيبل"); }
        while (rlen < 24 + len) { if (!fill(2000) && System.currentTimeMillis() > until) throw new IOException("انقطع الكيبل"); }
        m.data = java.util.Arrays.copyOfRange(rbuf, 24, 24 + len);
        int rest = rlen - 24 - len;
        System.arraycopy(rbuf, 24 + len, rbuf, 0, rest);
        rlen = rest;
        return m;
    }

    /* ---------------- streams ---------------- */
    final class Stream {
        final int local; int remote; boolean closed;
        final ArrayDeque<byte[]> q = new ArrayDeque<>();
        byte[] cur; int pos;
        Stream(int l) { local = l; }

        /** Handle one packet for this stream. Returns false when nothing came in time. */
        boolean pump(int ms) throws IOException {
            Msg m = UsbAdb.this.read(ms);
            if (m == null) return false;
            if (m.a1 != local && m.cmd != CNXN) return true; // another (old) stream
            if (m.cmd == WRTE) { if (m.data.length > 0) q.add(m.data); send(OKAY, local, m.a0, null); }
            else if (m.cmd == CLSE) { closed = true; }
            else if (m.cmd == OKAY) { remote = m.a0; okays++; }
            return true;
        }
        int okays;

        void write(byte[] b, int off, int len) throws IOException {
            while (len > 0) {
                int n = Math.min(len, maxData);
                int want = okays + 1;
                send(WRTE, local, remote, java.util.Arrays.copyOfRange(b, off, off + n));
                long until = System.currentTimeMillis() + 30000;
                while (okays < want) {
                    if (closed) throw new IOException("الشاشة سدّت الاتصال");
                    if (!pump(1000) && System.currentTimeMillis() > until) throw new IOException("الشاشة ما ترد على الكيبل");
                }
                off += n; len -= n;
            }
        }

        int read(byte[] b, int off, int len) throws IOException {
            long until = System.currentTimeMillis() + 120000;
            while (cur == null || pos >= cur.length) {
                cur = q.poll(); pos = 0;
                if (cur != null) break;
                if (closed) return -1;
                if (pump(1000)) until = System.currentTimeMillis() + 120000;
                else if (System.currentTimeMillis() > until) throw new IOException("الشاشة ما ترد على الكيبل");
            }
            int n = Math.min(len, cur.length - pos);
            System.arraycopy(cur, pos, b, off, n); pos += n;
            return n;
        }

        InputStream in() {
            return new InputStream() {
                @Override public int read() throws IOException { byte[] x = new byte[1]; int n = Stream.this.read(x, 0, 1); return n < 0 ? -1 : x[0] & 0xff; }
                @Override public int read(byte[] b, int o, int l) throws IOException { return Stream.this.read(b, o, l); }
            };
        }

        OutputStream out() {
            return new OutputStream() {
                @Override public void write(int x) throws IOException { Stream.this.write(new byte[] { (byte) x }, 0, 1); }
                @Override public void write(byte[] b, int o, int l) throws IOException { Stream.this.write(b, o, l); }
            };
        }

        void close() { if (!closed) { try { send(CLSE, local, remote, null); } catch (Throwable ignored) { } closed = true; } }
    }

    /** Open a service ("shell:…", "exec:…", "sync:") and wait until the screen accepts it. */
    synchronized Stream open(String dest) throws IOException {
        if (conn == null) throw new IOException("الكيبل مو متصل");
        Stream s = new Stream(nextId++);
        send(OPEN, s.local, 0, (dest + "\0").getBytes(StandardCharsets.UTF_8));
        long until = System.currentTimeMillis() + 15000;
        while (s.okays == 0) {
            if (s.closed) throw new IOException("الشاشة رفضت الأمر");
            if (!s.pump(1000) && System.currentTimeMillis() > until) throw new IOException("الشاشة ما ترد على الكيبل");
        }
        s.okays = 0;
        return s;
    }

    /** Run a command and collect everything it prints. */
    synchronized byte[] exec(String dest) throws IOException {
        Stream s;
        try { s = open(dest); } catch (IOException e) { if (String.valueOf(e.getMessage()).contains("انقطع")) close(); throw e; }
        try {
            ByteArrayOutputStream o = new ByteArrayOutputStream();
            byte[] buf = new byte[65536]; int n;
            InputStream i = s.in();
            while ((n = i.read(buf, 0, buf.length)) >= 0) o.write(buf, 0, n);
            return o.toByteArray();
        } catch (IOException e) { if (String.valueOf(e.getMessage()).contains("انقطع")) close(); throw e; }
        finally { s.close(); }
    }

    int maxData() { return maxData; }
}
