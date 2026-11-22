package com.heytools.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import androidx.core.content.ContextCompat;

/** Turns Charge Guard back on after a restart, if it was on before. */
public class ChargeGuardBootReceiver extends BroadcastReceiver {
  @Override public void onReceive(Context c, Intent i) {
    try {
      if (!ChargeGuardService.sp(c).getBoolean("armed", false)) return;
      ChargeGuardService.note(c, "Phone restarted: guard turned back on");
      ContextCompat.startForegroundService(c, new Intent(c, ChargeGuardService.class).setAction(ChargeGuardService.ACTION_ARM));
    } catch (Exception e) { ChargeGuardService.note(c, "could not restart the guard: " + e); }
  }
}
