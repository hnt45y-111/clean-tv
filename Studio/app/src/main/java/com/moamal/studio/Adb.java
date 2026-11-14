package com.moamal.studio;

import android.content.Context;
import android.os.Build;
import android.sun.security.x509.AlgorithmId;
import android.sun.security.x509.CertificateAlgorithmId;
import android.sun.security.x509.CertificateExtensions;
import android.sun.security.x509.CertificateIssuerName;
import android.sun.security.x509.CertificateSerialNumber;
import android.sun.security.x509.CertificateSubjectName;
import android.sun.security.x509.CertificateValidity;
import android.sun.security.x509.CertificateVersion;
import android.sun.security.x509.CertificateX509Key;
import android.sun.security.x509.KeyIdentifier;
import android.sun.security.x509.PrivateKeyUsageExtension;
import android.sun.security.x509.SubjectKeyIdentifierExtension;
import android.sun.security.x509.X500Name;
import android.sun.security.x509.X509CertImpl;
import android.sun.security.x509.X509CertInfo;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.SecureRandom;
import java.security.cert.Certificate;
import java.security.cert.CertificateFactory;
import java.security.spec.PKCS8EncodedKeySpec;
import java.util.Date;
import java.util.Random;
import java.util.concurrent.TimeUnit;

import io.github.muntashirakon.adb.AbsAdbConnectionManager;
import io.github.muntashirakon.adb.AdbStream;

/** ADB client that talks to a TV over the network (wireless debugging or TCP 5555). */
public class Adb extends AbsAdbConnectionManager {
    private static Adb inst;
    private final PrivateKey key;
    private final Certificate cert;
    String host = "";
    int port = 0;

    static synchronized Adb get(Context c) throws Exception {
        if (inst == null) inst = new Adb(c.getApplicationContext());
        return inst;
    }

    private Adb(Context c) throws Exception {
        setApi(Build.VERSION.SDK_INT);
        setTimeout(25, TimeUnit.SECONDS);
        File kf = new File(c.getFilesDir(), "adb.key"), cf = new File(c.getFilesDir(), "adb.crt");
        PrivateKey k = null;
        Certificate ce = null;
        if (kf.exists() && cf.exists()) {
            try {
                k = KeyFactory.getInstance("RSA").generatePrivate(new PKCS8EncodedKeySpec(readAll(new FileInputStream(kf))));
                try (InputStream in = new FileInputStream(cf)) {
                    ce = CertificateFactory.getInstance("X.509").generateCertificate(in);
                }
            } catch (Throwable t) { k = null; ce = null; }
        }
        if (k == null || ce == null) {
            KeyPairGenerator g = KeyPairGenerator.getInstance("RSA");
            g.initialize(2048, new SecureRandom());
            KeyPair kp = g.generateKeyPair();
            PublicKey pub = kp.getPublic();
            k = kp.getPrivate();
            String alg = "SHA512withRSA";
            Date nb = new Date(), na = new Date(System.currentTimeMillis() + 3650L * 86400000L);
            CertificateExtensions ext = new CertificateExtensions();
            ext.set("SubjectKeyIdentifier", new SubjectKeyIdentifierExtension(new KeyIdentifier(pub).getIdentifier()));
            X500Name name = new X500Name("CN=Moamal Studio");
            ext.set("PrivateKeyUsage", new PrivateKeyUsageExtension(nb, na));
            X509CertInfo info = new X509CertInfo();
            info.set("version", new CertificateVersion(2));
            info.set("serialNumber", new CertificateSerialNumber(new Random().nextInt() & Integer.MAX_VALUE));
            info.set("algorithmID", new CertificateAlgorithmId(AlgorithmId.get(alg)));
            info.set("subject", new CertificateSubjectName(name));
            info.set("key", new CertificateX509Key(pub));
            info.set("validity", new CertificateValidity(nb, na));
            info.set("issuer", new CertificateIssuerName(name));
            info.set("extensions", ext);
            X509CertImpl impl = new X509CertImpl(info);
            impl.sign(k, alg);
            ce = impl;
            try (OutputStream o = new FileOutputStream(kf)) { o.write(k.getEncoded()); }
            try (OutputStream o = new FileOutputStream(cf)) { o.write(ce.getEncoded()); }
        }
        key = k;
        cert = ce;
    }

    @Override protected PrivateKey getPrivateKey() { return key; }
    @Override protected Certificate getCertificate() { return cert; }
    @Override protected String getDeviceName() { return "MoamalStudio"; }

    PrivateKey usbKey() { return key; }
    java.security.interfaces.RSAPublicKey usbPub() { return (java.security.interfaces.RSAPublicKey) cert.getPublicKey(); }

    /** Connect over the USB cable instead of Wi-Fi. */
    synchronized boolean openUsb(Context c, UsbAdb.Status st) throws Exception {
        try { disconnect(); } catch (Throwable ignored) { }
        host = "usb"; port = 0; // while the cable connects, nothing tries to reconnect the old Wi-Fi screen
        try {
            boolean ok = UsbAdb.get().connect(c, key, usbPub(), "MoamalStudio", st);
            if (!ok) host = "";
            return ok;
        } catch (Exception e) { host = ""; throw e; }
    }

    /** Connect to host:port, dropping any previous TV. */
    synchronized boolean open(String h, int p) throws Exception {
        if (UsbAdb.active()) UsbAdb.get().close();
        if (isConnected() && h.equals(host) && p == port) return true;
        try { disconnect(); } catch (Throwable ignored) { }
        host = h;
        port = p;
        return connect(h, p);
    }

    boolean alive() {
        if (UsbAdb.active()) return true;
        try { return isConnected(); } catch (Throwable t) { return false; }
    }

    /** Drop the (possibly half-dead) socket and connect again to the same screen. */
    private final Object reLock = new Object();
    private long reAt = 0;

    boolean reconnect() throws Exception {
        synchronized (reLock) {
            if (host.isEmpty() || "usb".equals(host)) return false;
            // several commands can fail together: reconnect once, the others reuse it
            if (System.currentTimeMillis() - reAt < 4000 && alive()) return true;
            String h = host; int p = port;
            try { disconnect(); } catch (Throwable ignored) { }
            host = h; port = p;
            boolean ok = connect(h, p);
            reAt = System.currentTimeMillis();
            return ok;
        }
    }

    /** True when the screen really answers (a socket can look connected after the phone slept). */
    boolean healthy(long ms) {
        if (UsbAdb.active()) return UsbAdb.get().alive();
        if (!alive()) return false;
        java.util.concurrent.FutureTask<String> t = new java.util.concurrent.FutureTask<>(() -> new String(rawExec("shell:echo ok"), StandardCharsets.UTF_8));
        Thread th = new Thread(t, "adb-probe"); th.setDaemon(true); th.start();
        try { return t.get(ms, TimeUnit.MILLISECONDS).contains("ok"); }
        catch (Throwable e) { t.cancel(true); return false; }
    }

    /** Run a shell command and return its text output. */
    String sh(String cmd) throws Exception {
        return new String(execBytes("shell:" + cmd), StandardCharsets.UTF_8);
    }

    /** Run a raw (no pty) command and return the raw bytes, for binary output like screenshots. */
    byte[] exec(String cmd) throws Exception {
        return execBytes("exec:" + cmd);
    }

    /* Opening a stream on a stale socket used to hang or fail until the app was killed: open it with a time
       limit, and on failure reconnect once and try again. */
    private byte[] execBytes(String dest) throws Exception {
        if (UsbAdb.active()) return UsbAdb.get().exec(dest);
        try { return rawExec(dest, 8000); }
        catch (java.util.concurrent.TimeoutException | IOException | IllegalStateException e) {
            if (!reconnect()) throw new Exception("انقطع الاتصال بالشاشة");
            return rawExec(dest);
        }
    }

    private byte[] rawExec(String dest, long openMs) throws Exception {
        java.util.concurrent.FutureTask<AdbStream> t = new java.util.concurrent.FutureTask<>(() -> openStream(dest));
        Thread th = new Thread(t, "adb-open"); th.setDaemon(true); th.start();
        AdbStream s;
        try { s = t.get(openMs, TimeUnit.MILLISECONDS); }
        catch (java.util.concurrent.ExecutionException e) {
            Throwable c = e.getCause();
            if (c instanceof Exception) throw (Exception) c;
            throw e;
        } catch (InterruptedException e) { t.cancel(true); throw new IOException(e); }
        catch (java.util.concurrent.TimeoutException e) { t.cancel(true); throw e; }
        return drainAll(s);
    }

    private byte[] rawExec(String dest) throws Exception {
        return drainAll(openStream(dest));
    }

    private byte[] drainAll(AdbStream s) throws Exception {
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            drain(s, out, null);
            return out.toByteArray();
        } finally {
            try { s.close(); } catch (Throwable ignored) { }
        }
    }

    interface Progress { void at(long bytes); }

    private static java.lang.reflect.Field fPending, fQueue, fBuf;
    static {
        try {
            fPending = AdbStream.class.getDeclaredField("mPendingClose"); fPending.setAccessible(true);
            fQueue = AdbStream.class.getDeclaredField("mReadQueue"); fQueue.setAccessible(true);
            fBuf = AdbStream.class.getDeclaredField("mReadBuffer"); fBuf.setAccessible(true);
        } catch (Throwable t) { fPending = null; }
    }

    /**
     * True when the TV already closed the stream and every byte has been read. libadb 3.1.1 waits forever in this
     * state, so we check it ourselves before each blocking read.
     */
    static boolean finished(AdbStream s) {
        if (s.isClosed()) return true;
        if (fPending == null) return false;
        try {
            if (!fPending.getBoolean(s)) return false;
            java.util.Queue<?> q = (java.util.Queue<?>) fQueue.get(s);
            ByteBuffer b = (ByteBuffer) fBuf.get(s);
            return q.isEmpty() && !b.hasRemaining();
        } catch (Throwable t) { return false; }
    }

    /** Copy everything the stream sends into out until the TV closes it. */
    static long drain(AdbStream s, OutputStream out, Progress p) throws IOException {
        byte[] buf = new byte[64 * 1024];
        long total = 0;
        while (!finished(s)) {
            int n;
            try { n = s.read(buf, 0, buf.length); }
            catch (IOException e) { break; }
            if (n < 0) break;
            if (n > 0) {
                out.write(buf, 0, n);
                total += n;
                if (p != null) p.at(total);
            }
        }
        return total;
    }

    /** Open a long-running stream (live video). */
    AdbStream stream(String dest) throws Exception {
        if (UsbAdb.active()) throw new Exception("البث المباشر يحتاج اتصال واي فاي، مو كيبل");
        return openStream(dest);
    }

    /** Stream an APK into "cmd package install". Returns the installer's reply. */
    String install(File apk, String extra) throws Exception {
        long size = apk.length();
        if (UsbAdb.active()) {
            UsbAdb.Stream u = UsbAdb.get().open("exec:cmd package install -r -d " + (extra == null ? "" : extra) + " -S " + size);
            try {
                OutputStream o = u.out();
                try (InputStream in = new FileInputStream(apk)) { byte[] buf = new byte[60 * 1024]; int n; while ((n = in.read(buf)) > 0) o.write(buf, 0, n); }
                return new String(readAll(u.in()), StandardCharsets.UTF_8).trim();
            } finally { u.close(); }
        }
        AdbStream s = openStream("exec:cmd package install -r -d " + (extra == null ? "" : extra) + " -S " + size);
        try {
            OutputStream o = s.openOutputStream();
            try (InputStream in = new FileInputStream(apk)) {
                byte[] buf = new byte[chunk()];
                int n;
                while ((n = in.read(buf)) > 0) o.write(buf, 0, n);
            }
            o.flush();
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            drain(s, out, null);
            return new String(out.toByteArray(), StandardCharsets.UTF_8).trim();
        } finally {
            try { s.close(); } catch (Throwable ignored) { }
        }
    }

    /** Send a file to the TV using the ADB sync protocol. */
    void push(File src, String remote) throws Exception {
        if (UsbAdb.active()) {
            UsbAdb.Stream u = UsbAdb.get().open("sync:");
            try { pushVia(u.out(), u.in(), src, remote, 60 * 1024); } finally { u.close(); }
            return;
        }
        AdbStream s = openStream("sync:");
        try { pushVia(s.openOutputStream(), s.openInputStream(), src, remote, chunk()); }
        finally { try { s.close(); } catch (Throwable ignored) { } }
    }

    private void pushVia(OutputStream o, InputStream i, File src, String remote, int chunk) throws Exception {
        {
            byte[] spec = (remote + ",33188").getBytes(StandardCharsets.UTF_8);
            o.write(hdr("SEND", spec.length));
            o.write(spec);
            try (InputStream in = new FileInputStream(src)) {
                byte[] buf = new byte[chunk];
                int n;
                while ((n = in.read(buf)) > 0) {
                    o.write(hdr("DATA", n));
                    o.write(buf, 0, n);
                }
            }
            o.write(hdr("DONE", (int) (System.currentTimeMillis() / 1000)));
            o.flush();
            byte[] r = readN(i, 8);
            String id = new String(r, 0, 4, StandardCharsets.US_ASCII);
            if (!"OKAY".equals(id)) {
                int len = le(r, 4);
                throw new IOException(new String(readN(i, len), StandardCharsets.UTF_8));
            }
            o.write(hdr("QUIT", 0));
            o.flush();
        }
    }

    /** Fetch a file from the TV using the ADB sync protocol. */
    byte[] pull(String remote) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        pull(remote, out, null);
        return out.toByteArray();
    }

    void pull(String remote, OutputStream out, Progress p) throws Exception {
        if (UsbAdb.active()) {
            UsbAdb.Stream u = UsbAdb.get().open("sync:");
            try { pullVia(u.out(), u.in(), remote, out, p); } finally { u.close(); }
            return;
        }
        AdbStream s = openStream("sync:");
        try { pullVia(s.openOutputStream(), s.openInputStream(), remote, out, p); }
        finally { try { s.close(); } catch (Throwable ignored) { } }
    }

    private void pullVia(OutputStream o, InputStream i, String remote, OutputStream out, Progress p) throws Exception {
        {
            byte[] spec = remote.getBytes(StandardCharsets.UTF_8);
            o.write(hdr("RECV", spec.length));
            o.write(spec);
            o.flush();
            long got = 0;
            while (true) {
                byte[] h = readN(i, 8);
                String id = new String(h, 0, 4, StandardCharsets.US_ASCII);
                int len = le(h, 4);
                if ("DATA".equals(id)) { out.write(readN(i, len)); got += len; if (p != null) p.at(got); }
                else if ("DONE".equals(id)) break;
                else throw new IOException(new String(readN(i, len), StandardCharsets.UTF_8));
            }
            o.write(hdr("QUIT", 0));
            o.flush();
        }
    }

    /** Largest payload the TV accepts in one packet, so each write waits for its own READY. */
    private int chunk() {
        int m = 4096;
        try { m = getAdbConnection().getMaxData(); } catch (Throwable ignored) { }
        return Math.max(1024, Math.min(m - 8, 60 * 1024));
    }

    private static byte[] hdr(String id, int v) {
        ByteBuffer b = ByteBuffer.allocate(8).order(ByteOrder.LITTLE_ENDIAN);
        b.put(id.getBytes(StandardCharsets.US_ASCII));
        b.putInt(v);
        return b.array();
    }

    private static int le(byte[] b, int off) {
        return ByteBuffer.wrap(b, off, 4).order(ByteOrder.LITTLE_ENDIAN).getInt();
    }

    private static byte[] readN(InputStream in, int n) throws IOException {
        byte[] b = new byte[n];
        int got = 0;
        while (got < n) {
            int r = in.read(b, got, n - got);
            if (r < 0) throw new IOException("انقطع الاتصال");
            got += r;
        }
        return b;
    }

    static byte[] readAll(InputStream in) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[32 * 1024];
        try {
            int n;
            while ((n = in.read(buf)) >= 0) {
                if (n > 0) out.write(buf, 0, n);
            }
        } catch (IOException e) {
            if (out.size() == 0 && !"Stream closed.".equals(e.getMessage())) throw e;
        } finally {
            try { in.close(); } catch (Throwable ignored) { }
        }
        return out.toByteArray();
    }
}
