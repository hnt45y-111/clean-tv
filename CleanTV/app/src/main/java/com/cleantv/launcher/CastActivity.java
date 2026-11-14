package com.cleantv.launcher;

import android.app.Activity;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.WindowManager;
import android.widget.ImageView;

/** Full-screen view that shows the phone screen while CastServer receives frames. */
public class CastActivity extends Activity {
    static volatile CastActivity current;
    private ImageView img;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        img = new ImageView(this);
        img.setBackgroundColor(Color.BLACK);
        img.setScaleType(ImageView.ScaleType.FIT_CENTER);
        setContentView(img);
        current = this;
        Bitmap last = CastServer.last;
        if (last != null) img.setImageBitmap(last);
    }

    private volatile Bitmap next;
    private final java.util.concurrent.atomic.AtomicBoolean queued = new java.util.concurrent.atomic.AtomicBoolean();

    void show(final Bitmap bm) {
        next = bm;
        if (queued.compareAndSet(false, true)) {
            runOnUiThread(new Runnable() { public void run() { queued.set(false); Bitmap b = next; if (b != null) img.setImageBitmap(b); img.invalidate(); } });
        }
    }

    @Override
    public boolean onKeyDown(int code, KeyEvent e) {
        if (code == KeyEvent.KEYCODE_BACK) { CastServer.stopCurrent(); finish(); return true; }
        return super.onKeyDown(code, e);
    }

    @Override
    protected void onDestroy() {
        if (current == this) current = null;
        super.onDestroy();
    }
}
