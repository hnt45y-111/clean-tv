package com.moamal.studio;

import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.PixelFormat;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.Image;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.util.DisplayMetrics;
import android.view.WindowManager;

import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.ByteBuffer;

/** Sends the phone screen to the TV launcher (port 8687) as a stream of JPEG frames. */
public class CastService extends Service {
    static final String CH = "cast";
    static volatile boolean on;
    static volatile String error;
    static volatile String stage = "";
    static volatile long frames;
    private MediaProjection mp;
    private VirtualDisplay vd;
    private ImageReader reader;
    private HandlerThread ht;
    private volatile Socket sock;
    private volatile DataOutputStream out;
    private long lastFrame;
    /* newest encoded picture waits here; the sender thread always takes the newest and older ones are dropped, so the picture on the TV never lags behind */
    private final java.util.concurrent.atomic.AtomicReference<byte[]> pending = new java.util.concurrent.atomic.AtomicReference<>();
    private final Object wake = new Object();
    private volatile boolean run;
    private volatile int quality = 60;
    private volatile long sendMs = 20;
    private Bitmap shared;
    private final ByteArrayOutputStream jpgBuf = new ByteArrayOutputStream(160 * 1024);

    static String token = null;

    static void start(Context c, int code, Intent data, String host) {
        Intent i = new Intent(c, CastService.class).putExtra("code", code).putExtra("data", data).putExtra("host", host);
        if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i); else c.startService(i);
    }

    static void stop(Context c) { c.stopService(new Intent(c, CastService.class)); }

    @Override public IBinder onBind(Intent i) { return null; }

    @Override
    public int onStartCommand(Intent i, int flags, int id) {
        if (i == null) { stopSelf(); return START_NOT_STICKY; }
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        nm.createNotificationChannel(new NotificationChannel(CH, "عرض الشاشة", NotificationManager.IMPORTANCE_LOW));
        Intent stopI = new Intent(this, CastService.class).setAction("stop");
        PendingIntent pi = PendingIntent.getService(this, 3, stopI, PendingIntent.FLAG_IMMUTABLE);
        if ("stop".equals(i.getAction())) { stopSelf(); return START_NOT_STICKY; }
        Notification n = new Notification.Builder(this, CH)
                .setSmallIcon(R.drawable.ic_app)
                .setContentTitle("شاشة موبايلك تنعرض على التلفزيون")
                .setContentText("اضغط هنا للإيقاف")
                .setContentIntent(pi)
                .setOngoing(true)
                .build();
        if (Build.VERSION.SDK_INT >= 29) startForeground(7, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION);
        else startForeground(7, n);

        int code = i.getIntExtra("code", Activity.RESULT_CANCELED);
        Intent data = i.getParcelableExtra("data");
        String host = i.getStringExtra("host");
        MediaProjectionManager mpm = (MediaProjectionManager) getSystemService(MEDIA_PROJECTION_SERVICE);
        try {
            mp = mpm.getMediaProjection(code, data);
        } catch (Throwable t) { mp = null; }
        if (mp == null) { error = "ما انسمح بتصوير الشاشة"; stopSelf(); return START_NOT_STICKY; }
        mp.registerCallback(new MediaProjection.Callback() {
            @Override public void onStop() { stopSelf(); }
        }, null);
        error = null;
        frames = 0;
        stage = "connecting";
        on = true;
        ht = new HandlerThread("cast");
        ht.start();
        Handler h = new Handler(ht.getLooper());
        h.post(() -> setup(host, h));
        return START_NOT_STICKY;
    }

    private void setup(String host, Handler h) {
        try {
            Socket s = new Socket();
            s.connect(new InetSocketAddress(host, 8687), 6000);
            s.setTcpNoDelay(true);
            s.setSendBufferSize(96 * 1024);
            sock = s;
            out = new DataOutputStream(new java.io.BufferedOutputStream(s.getOutputStream(), 64 * 1024));
            run = true;
            new Thread(this::sendLoop, "cast-send").start();
            stage = "streaming";
            // open the viewer on the TV through ADB too, in case the TV blocks it from starting by itself
            new Thread(() -> {
                String tk = token;
                if (tk != null && !tk.isEmpty()) {
                    try {
                        java.net.HttpURLConnection c = (java.net.HttpURLConnection) new java.net.URL("http://" + host + ":8686/api/cast/show").openConnection();
                        c.setRequestMethod("POST"); c.setDoOutput(true); c.setConnectTimeout(3000); c.setRequestProperty("X-Token", tk);
                        c.getOutputStream().write("{}".getBytes()); c.getResponseCode(); c.disconnect();
                    } catch (Throwable ignored) { }
                }
                try { Adb.get(this).sh("am start -n com.cleantv.launcher/.CastActivity"); } catch (Throwable ignored) { }
            }).start();
        } catch (Throwable t) {
            error = "الشاشة ما ترد. لازم تكون واجهة مدير الشاشات الجديدة منصّبة على التلفزيون";
            stopSelf();
            return;
        }
        DisplayMetrics dm = new DisplayMetrics();
        ((WindowManager) getSystemService(WINDOW_SERVICE)).getDefaultDisplay().getRealMetrics(dm);
        int w = dm.widthPixels, hgt = dm.heightPixels;
        float sc = Math.min(1f, 1152f / Math.max(w, hgt));
        int ow = Math.round(w * sc / 2) * 2, oh = Math.round(hgt * sc / 2) * 2;
        reader = ImageReader.newInstance(ow, oh, PixelFormat.RGBA_8888, 3);
        reader.setOnImageAvailableListener(r -> frame(r, ow, oh), h);
        vd = mp.createVirtualDisplay("moamal-cast", ow, oh, dm.densityDpi, DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR, reader.getSurface(), null, h);
    }

    private void frame(ImageReader r, int w, int h) {
        Image img;
        try { img = r.acquireLatestImage(); } catch (Throwable t) { return; }
        if (img == null) return;
        long now = System.currentTimeMillis();
        /* up to ~30 pictures a second; if the network is slow the interval grows by itself */
        long gap = Math.max(33, Math.min(160, sendMs + 8));
        if (now - lastFrame < gap) { img.close(); return; }
        lastFrame = now;
        try {
            Image.Plane p = img.getPlanes()[0];
            ByteBuffer buf = p.getBuffer();
            int rowPad = p.getRowStride() - p.getPixelStride() * w;
            int bw = w + rowPad / p.getPixelStride();
            if (shared == null || shared.getWidth() != bw || shared.getHeight() != h) { if (shared != null) shared.recycle(); shared = Bitmap.createBitmap(bw, h, Bitmap.Config.ARGB_8888); }
            shared.copyPixelsFromBuffer(buf);
            img.close();
            jpgBuf.reset();
            Bitmap src = rowPad == 0 ? shared : Bitmap.createBitmap(shared, 0, 0, w, h);
            src.compress(Bitmap.CompressFormat.JPEG, quality, jpgBuf);
            if (src != shared) src.recycle();
            pending.set(jpgBuf.toByteArray());
            synchronized (wake) { wake.notify(); }
        } catch (Throwable t) {
            try { img.close(); } catch (Throwable ignored) { }
        }
    }

    /** writes the newest picture; measures how long the network takes and trades quality for speed when it is slow */
    private void sendLoop() {
        while (run) {
            byte[] jpg = pending.getAndSet(null);
            if (jpg == null) {
                synchronized (wake) { try { wake.wait(200); } catch (InterruptedException e) { return; } }
                continue;
            }
            DataOutputStream d = out;
            if (d == null) continue;
            long t0 = System.nanoTime();
            try {
                d.writeInt(jpg.length);
                d.write(jpg);
                d.flush();
                frames++;
            } catch (Throwable t) {
                error = "انقطع العرض";
                stopSelf();
                return;
            }
            long ms = (System.nanoTime() - t0) / 1000000L;
            sendMs = (sendMs * 3 + ms) / 4;
            if (sendMs > 70 && quality > 38) quality -= 4;
            else if (sendMs < 25 && quality < 68) quality += 2;
        }
    }

    @Override
    public void onDestroy() {
        on = false;
        run = false;
        synchronized (wake) { wake.notifyAll(); }
        stage = "";
        try { if (vd != null) vd.release(); } catch (Throwable ignored) { }
        try { if (reader != null) reader.close(); } catch (Throwable ignored) { }
        try { if (mp != null) mp.stop(); } catch (Throwable ignored) { }
        try { if (sock != null) sock.close(); } catch (Throwable ignored) { }
        if (ht != null) ht.quitSafely();
        super.onDestroy();
    }
}
