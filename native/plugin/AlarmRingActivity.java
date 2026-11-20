package com.heytools.app;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

/** The ringing screen. It only offers Snooze and Stop, so a locked phone never exposes the rest of the app. */
public class AlarmRingActivity extends Activity {
  private final Handler h = new Handler(Looper.getMainLooper());
  private final Runnable watch = new Runnable() {
    @Override public void run() {
      if (!AlarmRingingService.ringing) { finish(); return; }
      h.postDelayed(this, 1000);
    }
  };

  @Override protected void onCreate(Bundle b) {
    super.onCreate(b);
    try {
      if (Build.VERSION.SDK_INT >= 27) { setShowWhenLocked(true); setTurnScreenOn(true); }
      else getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
      getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    } catch (Throwable ignored) {}
    final int id = AlarmRingingService.ringingId;
    final int snooze = AlarmRingingService.ringingSnooze;
    LinearLayout root = new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL); root.setGravity(Gravity.CENTER);
    root.setBackgroundColor(Color.parseColor("#0b0f14")); root.setPadding(48, 48, 48, 48);
    TextView clock = new TextView(this);
    clock.setText(new java.text.SimpleDateFormat("h:mm a", java.util.Locale.getDefault()).format(new java.util.Date()));
    clock.setTextColor(Color.WHITE); clock.setTextSize(56); clock.setTypeface(Typeface.DEFAULT_BOLD); clock.setGravity(Gravity.CENTER);
    TextView label = new TextView(this);
    label.setText(AlarmRingingService.ringingTitle); label.setTextColor(Color.parseColor("#c7d0db")); label.setTextSize(22); label.setGravity(Gravity.CENTER);
    label.setPadding(0, 16, 0, 64);
    Button sn = new Button(this); sn.setText("Snooze " + snooze + " min"); sn.setAllCaps(false); sn.setTextSize(18);
    Button st = new Button(this); st.setText("Stop"); st.setAllCaps(false); st.setTextSize(20);
    LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 160);
    lp.setMargins(0, 12, 0, 12);
    root.addView(clock); root.addView(label);
    root.addView(sn, lp); root.addView(st, lp);
    final boolean locked = ((KeyguardManager) getSystemService(KEYGUARD_SERVICE)).isKeyguardLocked();
    if (!locked) {
      Button open = new Button(this); open.setText("Open HeyTools"); open.setAllCaps(false); open.setTextSize(16);
      root.addView(open, lp);
      open.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) {
        stopRing();
        startActivity(new Intent(AlarmRingActivity.this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        finish();
      }});
    }
    sn.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) {
      try { if (id >= 0) AlarmScheduler.snooze(AlarmRingActivity.this, id, snooze); } catch (Exception ignored) {}
      stopRing(); finish();
    }});
    st.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { stopRing(); finish(); } });
    setContentView(root);
  }
  private void stopRing() { try { stopService(new Intent(this, AlarmRingingService.class)); } catch (Exception ignored) {} }
  @Override protected void onResume() { super.onResume(); h.post(watch); }
  @Override protected void onPause() { h.removeCallbacks(watch); super.onPause(); }
  @Override public void onBackPressed() { /* the alarm keeps ringing until Stop or Snooze */ }
}
