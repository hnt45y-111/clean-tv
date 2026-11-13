package com.cleantv.launcher;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.StateListDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

/** Pop-up shown at adhan time, above any app, with a Stop button. */
public class AdhanActivity extends Activity {
    private final Handler h = new Handler(Looper.getMainLooper());
    private boolean withSound;

    private int dp(float v) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics());
    }

    private GradientDrawable round(int color, float r, int stroke) {
        GradientDrawable g = new GradientDrawable();
        g.setColor(color);
        g.setCornerRadius(dp(r));
        if (stroke != 0) g.setStroke(dp(2), stroke);
        return g;
    }

    private Button button(String text, boolean primary) {
        Button b = new Button(this);
        b.setText(text);
        b.setAllCaps(false);
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
        b.setTypeface(Typeface.DEFAULT_BOLD);
        b.setTextColor(Color.WHITE);
        b.setPadding(dp(28), dp(12), dp(28), dp(12));
        StateListDrawable sl = new StateListDrawable();
        sl.addState(new int[]{android.R.attr.state_focused}, round(primary ? Color.rgb(233, 196, 106) : Color.WHITE, 16, 0));
        sl.addState(new int[]{}, round(Color.argb(70, 255, 255, 255), 16, 0));
        b.setBackground(sl);
        b.setOnFocusChangeListener(new View.OnFocusChangeListener() {
            @Override
            public void onFocusChange(View v, boolean f) { ((Button) v).setTextColor(f ? Color.rgb(17, 17, 17) : Color.WHITE); }
        });
        return b;
    }

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        String title = getIntent().getStringExtra("title");
        String sub = getIntent().getStringExtra("sub");
        withSound = getIntent().getBooleanExtra("sound", true);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.argb(150, 0, 0, 0));

        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setGravity(Gravity.CENTER);
        card.setPadding(dp(40), dp(28), dp(40), dp(26));
        card.setBackground(round(Color.argb(245, 14, 16, 24), 26, Color.rgb(233, 196, 106)));

        TextView icon = new TextView(this);
        icon.setText("🕌");
        icon.setTextSize(TypedValue.COMPLEX_UNIT_SP, 44);
        icon.setGravity(Gravity.CENTER);
        card.addView(icon);

        TextView t = new TextView(this);
        t.setText(title == null ? "حان الآن موعد الأذان" : title);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, 28);
        t.setTypeface(Typeface.DEFAULT_BOLD);
        t.setTextColor(Color.rgb(246, 220, 155));
        t.setGravity(Gravity.CENTER);
        card.addView(t);

        if (sub != null && sub.length() > 0) {
            TextView s = new TextView(this);
            s.setText(sub);
            s.setTextSize(TypedValue.COMPLEX_UNIT_SP, 17);
            s.setTextColor(Color.argb(210, 255, 255, 255));
            s.setGravity(Gravity.CENTER);
            s.setPadding(0, dp(6), 0, dp(18));
            card.addView(s);
        }

        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER);
        Button stop = button(withSound ? "⏹  إيقاف الأذان" : "حسناً", true);
        Button close = button("إغلاق", false);
        stop.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { finishNow(); } });
        close.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { finishNow(); } });
        row.addView(stop);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lp.setMargins(dp(16), 0, 0, 0);
        if (withSound) row.addView(close, lp);
        card.addView(row);

        FrameLayout.LayoutParams cp = new FrameLayout.LayoutParams(FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.CENTER);
        root.addView(card, cp);
        setContentView(root);
        stop.requestFocus();

        Overlay.hideBanner(this);
        if (withSound) {
            Media.onAdhanEnd = new Runnable() {
                @Override
                public void run() { h.postDelayed(new Runnable() { @Override public void run() { finishNow(); } }, 4000); }
            };
            Media.playAdhan(this);
            h.postDelayed(new Runnable() { @Override public void run() { finishNow(); } }, 6 * 60000);
        } else {
            h.postDelayed(new Runnable() { @Override public void run() { finishNow(); } }, 45000);
        }
    }

    private void finishNow() {
        Media.onAdhanEnd = null;
        Media.stopAdhan(this);
        if (!isFinishing()) finish();
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK || keyCode == KeyEvent.KEYCODE_HOME) { finishNow(); return true; }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onDestroy() {
        h.removeCallbacksAndMessages(null);
        super.onDestroy();
    }
}
