package com.heytools.app;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.Intent;
import android.animation.ObjectAnimator;
import android.animation.PropertyValuesHolder;
import android.animation.ValueAnimator;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.view.KeyEvent;
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
    final String[][] themes = {{"#1e1b4b","#be185d"},{"#042f2e","#0e7490"},{"#4c0519","#ea580c"},{"#052e16","#15803d"},{"#2e1065","#7c3aed"},{"#0c1445","#2563eb"},{"#3b0a2a","#f43f5e"},{"#022c22","#06b6d4"}};
    java.util.Calendar cal = java.util.Calendar.getInstance();
    double seed = cal.get(java.util.Calendar.YEAR) * 372 + cal.get(java.util.Calendar.MONTH) * 31 + cal.get(java.util.Calendar.DAY_OF_MONTH);
    int pick = (int) Math.floor((((Math.sin(seed) * 10000) % 1) + 1) % 1 * themes.length);
    if (pick < 0 || pick >= themes.length) pick = 0;
    int c1 = Color.parseColor(themes[pick][0]), c2 = Color.parseColor(themes[pick][1]);
    final float d = getResources().getDisplayMetrics().density;
    LinearLayout root = new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL); root.setGravity(Gravity.CENTER);
    GradientDrawable bg = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[]{c1, c2});
    root.setBackground(bg); root.setPadding((int) (28 * d), (int) (28 * d), (int) (28 * d), (int) (28 * d));
    TextView hint = new TextView(this);
    hint.setText(new java.text.SimpleDateFormat("EEEE, d MMMM", java.util.Locale.getDefault()).format(new java.util.Date()));
    hint.setTextColor(Color.argb(190, 255, 255, 255)); hint.setTextSize(15); hint.setGravity(Gravity.CENTER); hint.setLetterSpacing(0.08f);
    TextView ring = new TextView(this);
    ring.setText("\u23F0"); ring.setTextSize(44); ring.setGravity(Gravity.CENTER); ring.setPadding(0, (int) (22 * d), 0, (int) (6 * d));
    ObjectAnimator pulse = ObjectAnimator.ofPropertyValuesHolder(ring, PropertyValuesHolder.ofFloat("scaleX", 1f, 1.18f), PropertyValuesHolder.ofFloat("scaleY", 1f, 1.18f));
    pulse.setDuration(700); pulse.setRepeatMode(ValueAnimator.REVERSE); pulse.setRepeatCount(ValueAnimator.INFINITE); pulse.start();
    TextView clock = new TextView(this);
    clock.setText(new java.text.SimpleDateFormat("h:mm", java.util.Locale.getDefault()).format(new java.util.Date()));
    clock.setTextColor(Color.WHITE); clock.setTextSize(84); clock.setTypeface(Typeface.create("sans-serif-thin", Typeface.NORMAL)); clock.setGravity(Gravity.CENTER); clock.setLetterSpacing(-0.04f);
    TextView ap = new TextView(this);
    ap.setText(new java.text.SimpleDateFormat("a", java.util.Locale.getDefault()).format(new java.util.Date()).toUpperCase());
    ap.setTextColor(Color.argb(200, 255, 255, 255)); ap.setTextSize(18); ap.setGravity(Gravity.CENTER); ap.setLetterSpacing(0.2f);
    TextView label = new TextView(this);
    label.setText(AlarmRingingService.ringingTitle); label.setTextColor(Color.WHITE); label.setTextSize(22); label.setGravity(Gravity.CENTER);
    label.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL)); label.setPadding(0, (int) (10 * d), 0, (int) (44 * d));
    Button sn = glass("Snooze " + snooze + " min", Color.argb(60, 255, 255, 255), Color.WHITE, d);
    Button st = glass("Stop", Color.WHITE, Color.parseColor(themes[pick][0]), d);
    LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, (int) (60 * d));
    lp.setMargins(0, (int) (8 * d), 0, (int) (8 * d));
    root.addView(hint); root.addView(ring); root.addView(clock); root.addView(ap); root.addView(label);
    root.addView(sn, lp); root.addView(st, lp);
    final boolean locked = ((KeyguardManager) getSystemService(KEYGUARD_SERVICE)).isKeyguardLocked();
    if (!locked) {
      Button open = glass("Open HeyTools", Color.TRANSPARENT, Color.argb(220, 255, 255, 255), d);
      root.addView(open, lp);
      open.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) {
        stopRing();
        startActivity(new Intent(AlarmRingActivity.this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        finish();
      }});
    }
    TextView tip = new TextView(this);
    tip.setText("Press the power button to snooze"); tip.setTextColor(Color.argb(150, 255, 255, 255)); tip.setTextSize(12); tip.setGravity(Gravity.CENTER); tip.setPadding(0, (int) (18 * d), 0, 0);
    root.addView(tip);
    sn.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) {
      try { if (id >= 0) AlarmScheduler.snooze(AlarmRingActivity.this, id, snooze); } catch (Exception ignored) {}
      stopRing(); finish();
    }});
    st.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { stopRing(); finish(); } });
    setContentView(root);
  }
  private Button glass(String text, int fill, int textColor, float d) {
    Button b = new Button(this); b.setText(text); b.setAllCaps(false); b.setTextSize(18); b.setTextColor(textColor);
    b.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL)); b.setStateListAnimator(null);
    GradientDrawable g = new GradientDrawable(); g.setColor(fill); g.setCornerRadius(40 * d);
    if (fill == Color.TRANSPARENT) g.setStroke((int) (1.5f * d), Color.argb(120, 255, 255, 255));
    b.setBackground(g); return b;
  }
  /** Volume keys do nothing while the alarm rings. */
  @Override public boolean dispatchKeyEvent(KeyEvent e) {
    int k = e.getKeyCode();
    if (k == KeyEvent.KEYCODE_VOLUME_DOWN || k == KeyEvent.KEYCODE_VOLUME_UP || k == KeyEvent.KEYCODE_VOLUME_MUTE) return true;
    return super.dispatchKeyEvent(e);
  }
  private void stopRing() { try { stopService(new Intent(this, AlarmRingingService.class)); } catch (Exception ignored) {} }
  @Override protected void onResume() { super.onResume(); h.post(watch); }
  @Override protected void onPause() { h.removeCallbacks(watch); super.onPause(); }
  @Override public void onBackPressed() { /* the alarm keeps ringing until Stop or Snooze */ }
}
