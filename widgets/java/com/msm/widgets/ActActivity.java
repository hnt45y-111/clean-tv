package com.msm.widgets;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.widget.Toast;

/** Invisible hop used by the app-icon menu: runs one ready shortcut (opens the app somewhere, or sends a command to the TV). */
public class ActActivity extends Activity {
    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        final Context app = getApplicationContext();
        final WApp wa = AppLoader.of(this);
        String id = getIntent() == null ? null : getIntent().getStringExtra("a");
        if (wa != null && id != null) {
            final Act a = Painter.find(this, wa, id);
            if (a != null) {
                if (a.kind == Act.ROUTE) {
                    try { Intent i = wa.open(this, a.arg); startActivity(i); } catch (Throwable ignored) { }
                } else {
                    new Thread(new Runnable() {
                        public void run() {
                            boolean ok = false;
                            try { ok = wa.send(app, a); } catch (Throwable ignored) { }
                            if (!ok) new Handler(Looper.getMainLooper()).post(new Runnable() { public void run() { Toast.makeText(app, "ما وصل الأمر. افتح التطبيق واربطه بالتلفاز أول", Toast.LENGTH_SHORT).show(); } });
                        }
                    }).start();
                }
            }
        }
        finish();
    }
}
