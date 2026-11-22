package com.heytools.app;

import android.accessibilityservice.AccessibilityService;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.content.Intent;
import android.view.accessibility.AccessibilityEvent;
import androidx.core.content.ContextCompat;
import java.util.Locale;

/**
 * While Charge Guard is on, closes the power-off menu the moment it opens and sets off the alarm.
 * Android lets an app do this only as an accessibility service, which the person has to switch on themselves.
 * It cannot stop a hardware force restart (holding the power button for many seconds); the guard handles that case on the next start.
 */
public class GuardAccessibilityService extends AccessibilityService {
  private final Handler h = new Handler(Looper.getMainLooper());
  private long lastBlock = 0, lastDiag = 0;

  @Override public void onAccessibilityEvent(AccessibilityEvent e) {
    try {
      if (e == null || e.getEventType() != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return;
      String st = ChargeGuardService.state;
      if (!ChargeGuardService.running || !(st.equals("armed") || st.equals("arming") || st.equals("alarm"))) return;
      if (!ChargeGuardService.sp(this).getBoolean("blockPower", true)) return;
      CharSequence pk = e.getPackageName(); if (pk == null) return;
      String p = pk.toString();
      if (p.equals(getPackageName())) return;
      StringBuilder sb = new StringBuilder();
      if (e.getClassName() != null) sb.append(e.getClassName());
      if (e.getText() != null) for (CharSequence t : e.getText()) sb.append(' ').append(t);
      String s = sb.toString().toLowerCase(Locale.ROOT);
      boolean system = p.equals("android") || p.contains("systemui") || p.contains("miui") || p.contains("xiaomi") || p.contains("power") || p.contains("samsung") || p.contains("oplus") || p.contains("coloros");
      boolean menu = s.contains("globalactions") || s.contains("powermenu") || s.contains("power menu") || s.contains("shutdown")
        || s.contains("power off") || s.contains("poweroff") || s.contains("restart") || s.contains("reboot") || s.contains("emergency");
      long now = System.currentTimeMillis();
      if (system && !menu && now - lastDiag > 5000) {          // helps tune detection on a new phone model
        lastDiag = now; ChargeGuardService.note(this, "ui " + p + " / " + (e.getClassName() == null ? "" : e.getClassName()));
      }
      if (!(system && menu)) return;
      performGlobalAction(GLOBAL_ACTION_BACK);
      if (Build.VERSION.SDK_INT >= 28) h.postDelayed(new Runnable() { @Override public void run() { performGlobalAction(GLOBAL_ACTION_LOCK_SCREEN); } }, 120);
      if (now - lastBlock > 3000) {
        lastBlock = now;
        ChargeGuardService.note(this, "Power menu closed (" + p + ")");
        ContextCompat.startForegroundService(this, new Intent(this, ChargeGuardService.class).setAction(ChargeGuardService.ACTION_TAMPER));
      }
    } catch (Exception ignored) { }
  }
  @Override public void onInterrupt() { }
}
