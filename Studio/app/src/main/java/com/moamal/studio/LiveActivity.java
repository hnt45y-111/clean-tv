package com.moamal.studio;

import android.app.Activity;
import android.content.ContentValues;
import android.content.pm.ActivityInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.SurfaceTexture;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.media.MediaCodec;
import android.media.MediaFormat;
import android.media.MediaMuxer;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.Surface;
import android.view.TextureView;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import io.github.muntashirakon.adb.AdbStream;

/**
 * Live view of the TV: streams H.264 from "screenrecord" over ADB and decodes it on the phone.
 * Swipes send arrow keys, a tap sends OK. Also takes screenshots and records MP4 on the phone.
 */
public class LiveActivity extends Activity implements TextureView.SurfaceTextureListener {
    private TextureView tv;
    private ImageView fallback;
    private TextView status, recBtn;
    private Surface surface;
    private volatile boolean running;
    private volatile AdbStream stream;
    private MediaCodec codec;
    private int vw = 1280, vh = 720, devW = 1920, devH = 1080;
    private boolean touchMode;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final ExecutorService keys = Executors.newSingleThreadExecutor();
    private Thread worker;
    private volatile long frames;

    // recording
    private volatile MediaMuxer muxer;
    private volatile int track = -1;
    private volatile boolean recWant, recStarted;
    private long recT0;
    private File recFile;
    private byte[] sps, pps;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON | WindowManager.LayoutParams.FLAG_FULLSCREEN);
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
        touchMode = getIntent().getBooleanExtra("touch", false);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);
        tv = new TextureView(this);
        tv.setSurfaceTextureListener(this);
        root.addView(tv, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT, Gravity.CENTER));
        fallback = new ImageView(this);
        fallback.setScaleType(ImageView.ScaleType.FIT_CENTER);
        fallback.setVisibility(View.GONE);
        root.addView(fallback, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        View touch = new View(this);
        touch.setOnTouchListener(new View.OnTouchListener() {
            float x0, y0; long t0;
            @Override public boolean onTouch(View v, MotionEvent e) {
                if (e.getAction() == MotionEvent.ACTION_DOWN) { x0 = e.getX(); y0 = e.getY(); t0 = e.getEventTime(); return true; }
                if (e.getAction() == MotionEvent.ACTION_UP && touchMode) {
                    View t = fallback.getVisibility() == View.VISIBLE ? fallback : tv;
                    float[] a = map(x0, y0, t), b2 = map(e.getX(), e.getY(), t);
                    if (a == null || b2 == null) return true;
                    float th = 24 * getResources().getDisplayMetrics().density;
                    long dur = Math.max(80, e.getEventTime() - t0);
                    if (Math.abs(e.getX() - x0) < th && Math.abs(e.getY() - y0) < th)
                        cmd("input tap " + (int) a[0] + " " + (int) a[1]);
                    else cmd("input swipe " + (int) a[0] + " " + (int) a[1] + " " + (int) b2[0] + " " + (int) b2[1] + " " + Math.min(dur, 1500));
                    return true;
                }
                if (e.getAction() == MotionEvent.ACTION_UP) {
                    float dx = e.getX() - x0, dy = e.getY() - y0, th = 60 * getResources().getDisplayMetrics().density;
                    if (Math.abs(dx) < th && Math.abs(dy) < th) { if (e.getEventTime() - t0 < 500) key(23); }
                    else if (Math.abs(dx) > Math.abs(dy)) key(dx > 0 ? 22 : 21);
                    else key(dy > 0 ? 20 : 19);
                    return true;
                }
                return true;
            }
        });
        root.addView(touch, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        status = new TextView(this);
        status.setTextColor(Color.WHITE);
        status.setTextSize(14);
        status.setPadding(dp(14), dp(8), dp(14), dp(8));
        status.setBackground(pill(0x99000000));
        status.setText("أتصل بالشاشة…");
        FrameLayout.LayoutParams sp = new FrameLayout.LayoutParams(-2, -2, Gravity.TOP | Gravity.CENTER_HORIZONTAL);
        sp.topMargin = dp(12);
        root.addView(status, sp);

        LinearLayout bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setGravity(Gravity.CENTER);
        bar.setPadding(dp(6), dp(6), dp(6), dp(6));
        bar.setBackground(pill(0xB3101828));
        bar.addView(btn("✕ إغلاق", v -> finish()));
        bar.addView(btn("↩ رجوع", v -> key(4)));
        bar.addView(btn("⌂ الرئيسية", v -> key(3)));
        bar.addView(btn("📷 صورة", v -> snap()));
        recBtn = btn("⏺ تسجيل", v -> toggleRec());
        bar.addView(recBtn);
        FrameLayout.LayoutParams bp = new FrameLayout.LayoutParams(-2, -2, Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL);
        bp.bottomMargin = dp(14);
        root.addView(bar, bp);
        setContentView(root);
    }

    private int dp(int v) { return (int) (v * getResources().getDisplayMetrics().density); }

    private GradientDrawable pill(int color) {
        GradientDrawable g = new GradientDrawable();
        g.setColor(color);
        g.setCornerRadius(dp(22));
        return g;
    }

    private TextView btn(String t, View.OnClickListener l) {
        TextView b = new TextView(this);
        b.setText(t);
        b.setTextColor(Color.WHITE);
        b.setTextSize(14);
        b.setTypeface(Typeface.DEFAULT_BOLD);
        b.setPadding(dp(14), dp(10), dp(14), dp(10));
        b.setOnClickListener(l);
        return b;
    }

    private void say(String t) { ui.post(() -> { status.setVisibility(t == null ? View.GONE : View.VISIBLE); if (t != null) status.setText(t); }); }

    /** Phone touch point to the screen's own pixels (the video keeps its aspect ratio inside the view). */
    private float[] map(float x, float y, View v) {
        int[] loc = new int[2];
        v.getLocationOnScreen(loc);
        float vwid = v.getWidth(), vhei = v.getHeight();
        if (vwid <= 0 || vhei <= 0) return null;
        float sc = Math.min(vwid / devW, vhei / devH), ox = (vwid - devW * sc) / 2, oy = (vhei - devH * sc) / 2;
        float px = (x - loc[0] - ox) / sc, py = (y - loc[1] - oy) / sc;
        if (px < 0 || py < 0 || px > devW || py > devH) return null;
        return new float[]{px, py};
    }

    private void cmd(String c) {
        keys.execute(() -> { try { Adb.get(this).sh(c); } catch (Throwable ignored) { } });
    }

    private void key(int code) {
        keys.execute(() -> { try { Adb.get(this).sh("input keyevent " + code); } catch (Throwable ignored) { } });
    }

    // ------------------------------------------------------------ surface
    @Override public void onSurfaceTextureAvailable(SurfaceTexture st, int w, int h) {
        surface = new Surface(st);
        start();
    }
    @Override public void onSurfaceTextureSizeChanged(SurfaceTexture st, int w, int h) { fit(); }
    @Override public boolean onSurfaceTextureDestroyed(SurfaceTexture st) { stop(); return true; }
    @Override public void onSurfaceTextureUpdated(SurfaceTexture st) { }

    /** Keep the video's aspect ratio inside the screen. */
    private void fit() {
        ui.post(() -> {
            View p = (View) tv.getParent();
            int pw = p.getWidth(), ph = p.getHeight();
            if (pw == 0 || ph == 0) return;
            float r = (float) vw / vh;
            int w = pw, h = (int) (pw / r);
            if (h > ph) { h = ph; w = (int) (ph * r); }
            FrameLayout.LayoutParams lp = (FrameLayout.LayoutParams) tv.getLayoutParams();
            lp.width = w; lp.height = h; lp.gravity = Gravity.CENTER;
            tv.setLayoutParams(lp);
        });
    }

    @Override
    protected void onDestroy() {
        stop();
        finishRec(false);
        super.onDestroy();
    }

    private void start() {
        running = true;
        worker = new Thread(this::loop, "live");
        worker.start();
    }

    private void stop() {
        running = false;
        AdbStream s = stream;
        if (s != null) try { s.close(); } catch (Throwable ignored) { }
        if (worker != null) worker.interrupt();
    }

    // ------------------------------------------------------------ streaming
    private void loop() {
        Adb adb;
        try {
            adb = Adb.get(this);
            if (!adb.alive() && !adb.host.isEmpty()) adb.open(adb.host, adb.port);
            String size = adb.sh("wm size").trim();
            int w = 1920, h = 1080;
            java.util.regex.Matcher m = java.util.regex.Pattern.compile("(\\d+)x(\\d+)").matcher(size);
            String last = null;
            while (m.find()) last = m.group();
            if (last != null) { String[] p = last.split("x"); w = Integer.parseInt(p[0]); h = Integer.parseInt(p[1]); }
            if (h > w) { int t = w; w = h; h = t; }
            devW = w; devH = h;
            vw = 1280; vh = Math.round(1280f * h / w / 2) * 2;
            fit();
        } catch (Throwable t) { say("ما متصل بالشاشة"); return; }

        int fails = 0;
        while (running) {
            long before = frames;
            try {
                runOnce(adb);
            } catch (Throwable t) {
                if (!running) break;
            }
            if (!running) break;
            if (frames == before) {
                fails++;
                if (fails >= 2) { screenshotMode(adb); return; }
            } else fails = 0;
        }
    }

    private void runOnce(Adb adb) throws Exception {
        say("أشغّل البث…");
        releaseCodec();
        MediaFormat f = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, vw, vh);
        if (Build.VERSION.SDK_INT >= 30) f.setInteger(MediaFormat.KEY_LOW_LATENCY, 1);
        codec = MediaCodec.createDecoderByType(MediaFormat.MIMETYPE_VIDEO_AVC);
        codec.configure(f, surface, null, 0);
        codec.start();
        Thread out = new Thread(this::drainOut, "live-out");
        out.start();
        String cmd = "screenrecord --output-format=h264 --size " + vw + "x" + vh + " --bit-rate 6000000 -";
        AdbStream s = adb.stream("exec:" + cmd);
        stream = s;
        try {
            NalReader r = new NalReader();
            byte[] buf = new byte[64 * 1024];
            while (running && !Adb.finished(s)) {
                int n;
                try { n = s.read(buf, 0, buf.length); } catch (IOException e) { break; }
                if (n < 0) break;
                if (n > 0) r.feed(buf, n);
            }
        } finally {
            try { s.close(); } catch (Throwable ignored) { }
            stream = null;
            out.interrupt();
        }
    }

    private void drainOut() {
        MediaCodec.BufferInfo info = new MediaCodec.BufferInfo();
        MediaCodec c = codec;
        while (running && !Thread.currentThread().isInterrupted()) {
            try {
                int ix = c.dequeueOutputBuffer(info, 50_000);
                if (ix >= 0) {
                    c.releaseOutputBuffer(ix, true);
                    if (frames++ == 0) say(null);
                }
            } catch (Throwable t) { break; }
        }
    }

    private void releaseCodec() {
        MediaCodec c = codec;
        codec = null;
        if (c != null) { try { c.stop(); } catch (Throwable ignored) { } try { c.release(); } catch (Throwable ignored) { } }
    }

    /** Splits the Annex-B byte stream into NAL units and hands each one to the decoder (and the recorder). */
    private class NalReader {
        private final ByteArrayOutputStream cur = new ByteArrayOutputStream();
        private int zeros;
        private boolean started;

        void feed(byte[] b, int n) {
            for (int i = 0; i < n; i++) {
                int v = b[i] & 0xff;
                if (v == 0) { zeros++; continue; }
                if (v == 1 && zeros >= 2) {
                    if (started) nal(cur.toByteArray());
                    cur.reset();
                    started = true;
                    zeros = 0;
                    continue;
                }
                for (; zeros > 0; zeros--) cur.write(0);
                cur.write(v);
            }
        }
    }

    private static final byte[] SC = {0, 0, 0, 1};

    private void nal(byte[] body) {
        if (body.length == 0) return;
        int type = body[0] & 0x1f;
        byte[] withSc = new byte[body.length + 4];
        System.arraycopy(SC, 0, withSc, 0, 4);
        System.arraycopy(body, 0, withSc, 4, body.length);
        if (type == 7) sps = withSc;
        if (type == 8) pps = withSc;
        MediaCodec c = codec;
        if (c != null) {
            try {
                int ix = c.dequeueInputBuffer(100_000);
                if (ix >= 0) {
                    ByteBuffer in = c.getInputBuffer(ix);
                    in.clear();
                    in.put(withSc);
                    int flags = (type == 7 || type == 8) ? MediaCodec.BUFFER_FLAG_CODEC_CONFIG : 0;
                    c.queueInputBuffer(ix, 0, withSc.length, System.nanoTime() / 1000, flags);
                }
            } catch (Throwable ignored) { }
        }
        if (recWant) record(type, withSc);
    }

    // ------------------------------------------------------------ screenshot mode fallback
    private void screenshotMode(Adb adb) {
        say("البث المباشر ما مدعوم بهالشاشة، أعرض صور متتالية");
        ui.post(() -> { fallback.setVisibility(View.VISIBLE); tv.setVisibility(View.INVISIBLE); recBtn.setVisibility(View.GONE); });
        boolean first = true;
        while (running) {
            try {
                byte[] png = adb.exec("screencap -p");
                BitmapFactory.Options o = new BitmapFactory.Options();
                o.inSampleSize = 2;
                Bitmap bm = BitmapFactory.decodeByteArray(png, 0, png.length, o);
                if (bm != null) {
                    ui.post(() -> fallback.setImageBitmap(bm));
                    if (first) { first = false; ui.postDelayed(() -> say(null), 2500); }
                }
            } catch (Throwable t) {
                if (!running) return;
                try { Thread.sleep(800); } catch (InterruptedException e) { return; }
            }
        }
    }

    // ------------------------------------------------------------ snapshot
    private void snap() {
        Bitmap bm = fallback.getVisibility() == View.VISIBLE
                ? ((fallback.getDrawable() instanceof android.graphics.drawable.BitmapDrawable) ? ((android.graphics.drawable.BitmapDrawable) fallback.getDrawable()).getBitmap() : null)
                : tv.getBitmap();
        if (bm == null) { toast("ماكو صورة بعد"); return; }
        new Thread(() -> {
            try {
                ByteArrayOutputStream o = new ByteArrayOutputStream();
                bm.compress(Bitmap.CompressFormat.PNG, 100, o);
                saveMedia(o.toByteArray(), null, "TV_" + System.currentTimeMillis() + ".png", "image/png");
                toast("انحفظت الصورة بالمعرض");
            } catch (Throwable t) { toast("ما انحفظت الصورة"); }
        }).start();
    }

    private void toast(String t) { ui.post(() -> Toast.makeText(this, t, Toast.LENGTH_SHORT).show()); }

    /** Save bytes or a file into the phone gallery (Pictures or Movies / MoamalStudio). */
    void saveMedia(byte[] data, File file, String name, String mime) throws Exception {
        boolean video = mime.startsWith("video");
        if (Build.VERSION.SDK_INT >= 29) {
            ContentValues v = new ContentValues();
            v.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
            v.put(MediaStore.MediaColumns.MIME_TYPE, mime);
            v.put(MediaStore.MediaColumns.RELATIVE_PATH, (video ? Environment.DIRECTORY_MOVIES : Environment.DIRECTORY_PICTURES) + "/MoamalStudio");
            Uri u = getContentResolver().insert(video ? MediaStore.Video.Media.EXTERNAL_CONTENT_URI : MediaStore.Images.Media.EXTERNAL_CONTENT_URI, v);
            try (OutputStream o = getContentResolver().openOutputStream(u)) { write(o, data, file); }
        } else {
            File d = new File(getExternalFilesDir(video ? Environment.DIRECTORY_MOVIES : Environment.DIRECTORY_PICTURES), name);
            try (OutputStream o = new java.io.FileOutputStream(d)) { write(o, data, file); }
        }
    }

    private static void write(OutputStream o, byte[] data, File file) throws IOException {
        if (data != null) { o.write(data); return; }
        try (InputStream in = new FileInputStream(file)) {
            byte[] b = new byte[64 * 1024];
            int n;
            while ((n = in.read(b)) > 0) o.write(b, 0, n);
        }
    }

    // ------------------------------------------------------------ recording
    private void toggleRec() {
        if (!recWant) {
            recWant = true;
            recStarted = false;
            recBtn.setText("⏹ إيقاف التسجيل");
            recBtn.setTextColor(0xFFFF5C7A);
            // restart the stream so the recording begins with a key frame
            AdbStream s = stream;
            if (s != null) try { s.close(); } catch (Throwable ignored) { }
            toast("بدأ التسجيل");
        } else {
            finishRec(true);
        }
    }

    private synchronized void record(int type, byte[] data) {
        try {
            if (!recStarted) {
                if (type != 5 || sps == null || pps == null) return;
                recFile = new File(getCacheDir(), "rec.mp4");
                MediaMuxer mx = new MediaMuxer(recFile.getAbsolutePath(), MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4);
                MediaFormat f = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, vw, vh);
                f.setByteBuffer("csd-0", ByteBuffer.wrap(sps));
                f.setByteBuffer("csd-1", ByteBuffer.wrap(pps));
                track = mx.addTrack(f);
                mx.start();
                muxer = mx;
                recT0 = System.nanoTime() / 1000;
                recStarted = true;
            }
            if (type != 1 && type != 5) return;
            MediaCodec.BufferInfo bi = new MediaCodec.BufferInfo();
            bi.set(0, data.length, System.nanoTime() / 1000 - recT0, type == 5 ? MediaCodec.BUFFER_FLAG_KEY_FRAME : 0);
            muxer.writeSampleData(track, ByteBuffer.wrap(data), bi);
        } catch (Throwable t) {
            recWant = false;
            toast("توقف التسجيل بسبب خطأ");
        }
    }

    private synchronized void finishRec(boolean save) {
        boolean had = recWant;
        recWant = false;
        ui.post(() -> { recBtn.setText("⏺ تسجيل"); recBtn.setTextColor(Color.WHITE); });
        MediaMuxer mx = muxer;
        muxer = null;
        if (mx == null) { if (had && save) toast("ما تسجّل شي"); return; }
        try { mx.stop(); } catch (Throwable ignored) { }
        try { mx.release(); } catch (Throwable ignored) { }
        recStarted = false;
        if (!save) return;
        File f = recFile;
        new Thread(() -> {
            try {
                saveMedia(null, f, "TV_" + System.currentTimeMillis() + ".mp4", "video/mp4");
                f.delete();
                toast("انحفظ الفيديو بالمعرض");
            } catch (Throwable t) { toast("ما انحفظ الفيديو"); }
        }).start();
    }
}
