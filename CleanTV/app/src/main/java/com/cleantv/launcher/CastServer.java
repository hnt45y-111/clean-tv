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

    private void serve(Socket s) {
        last = null;
        try {
            s.setTcpNoDelay(true);
            Intent i = new Intent(ctx, CastActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            try { ctx.startActivity(i); } catch (Throwable ignored) { }
            DataInputStream in = new DataInputStream(new BufferedInputStream(s.getInputStream(), 256 * 1024));
            BitmapFactory.Options o = new BitmapFactory.Options();
            while (true) {
                int len = in.readInt();
                if (len <= 0 || len > 8 * 1024 * 1024) break;
                byte[] b = new byte[len];
                in.readFully(b);
                Bitmap bm = BitmapFactory.decodeByteArray(b, 0, len, o);
                if (bm == null) continue;
                last = bm;
                CastActivity a = CastActivity.current;
                if (a != null) a.show(bm);
            }
        } catch (Throwable ignored) {
        } finally {
            try { s.close(); } catch (Throwable ignored) { }
            if (active == s) {
                active = null;
                CastActivity a = CastActivity.current;
                if (a != null) a.finish();
            }
        }
    }
}
