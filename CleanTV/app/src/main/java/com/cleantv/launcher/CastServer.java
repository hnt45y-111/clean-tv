package com.cleantv.launcher;

import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;

import java.io.BufferedInputStream;
import java.io.DataInputStream;
import java.net.ServerSocket;
import java.net.Socket;

/** Receives the phone screen (length-prefixed JPEG frames) on port 8687 and shows it in CastActivity. */
public class CastServer extends Thread {
    static final int PORT = 8687;
    private static CastServer running;
    private static volatile Socket active;
    static volatile Bitmap last;
    private final Context ctx;

    private CastServer(Context c) {
        super("CleanTV-cast");
        ctx = c.getApplicationContext();
        setDaemon(true);
    }

    static synchronized void start(Context c) {
        if (running != null) return;
        running = new CastServer(c);
        running.start();
    }

    static void stopCurrent() {
        Socket s = active;
        if (s != null) try { s.close(); } catch (Throwable ignored) { }
    }

    @Override
    public void run() {
        try (ServerSocket ss = new ServerSocket(PORT)) {
            while (true) {
                final Socket s = ss.accept();
                stopCurrent();
                active = s;
                new Thread(new Runnable() { public void run() { serve(s); } }).start();
            }
        } catch (Throwable ignored) { }
    }

    private void serve(final Socket s) {
        last = null;
        final java.util.concurrent.atomic.AtomicReference<byte[]> slot = new java.util.concurrent.atomic.AtomicReference<byte[]>();
        final Object wake = new Object();
        final boolean[] alive = { true };
        try {
            s.setTcpNoDelay(true);
            s.setReceiveBufferSize(96 * 1024);
            Intent i = new Intent(ctx, CastActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            try { ctx.startActivity(i); } catch (Throwable ignored) { }
            /* decoding runs on its own thread and always takes the newest picture, so the socket is read at full speed and nothing queues up */
            Thread dec = new Thread(new Runnable() {
                public void run() {
                    Bitmap[] pool = new Bitmap[2];
                    int turn = 0;
                    while (alive[0]) {
                        byte[] b = slot.getAndSet(null);
                        if (b == null) {
                            synchronized (wake) { try { wake.wait(200); } catch (InterruptedException e) { return; } }
                            continue;
                        }
                        BitmapFactory.Options o = new BitmapFactory.Options();
                        o.inPreferredConfig = Bitmap.Config.RGB_565;
                        o.inMutable = true;
                        if (pool[turn] != null) o.inBitmap = pool[turn];
                        Bitmap bm = null;
                        try { bm = BitmapFactory.decodeByteArray(b, 0, b.length, o); } catch (Throwable t) {
                            try { o.inBitmap = null; bm = BitmapFactory.decodeByteArray(b, 0, b.length, o); } catch (Throwable ignored) { }
                        }
                        if (bm == null) continue;
                        pool[turn] = bm;
                        turn ^= 1;
                        last = bm;
                        CastActivity a = CastActivity.current;
                        if (a != null) a.show(bm);
                    }
                }
            }, "CleanTV-cast-decode");
            dec.setDaemon(true);
            dec.start();
            DataInputStream in = new DataInputStream(new BufferedInputStream(s.getInputStream(), 64 * 1024));
            while (true) {
                int len = in.readInt();
                if (len <= 0 || len > 8 * 1024 * 1024) break;
                byte[] b = new byte[len];
                in.readFully(b);
                slot.set(b);
                synchronized (wake) { wake.notify(); }
            }
        } catch (Throwable ignored) {
        } finally {
            alive[0] = false;
            synchronized (wake) { wake.notifyAll(); }
            try { s.close(); } catch (Throwable ignored) { }
            if (active == s) {
                active = null;
                CastActivity a = CastActivity.current;
                if (a != null) a.finish();
            }
        }
    }
}
