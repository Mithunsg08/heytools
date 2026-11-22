package com.heytools.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import androidx.core.content.ContextCompat;

/** After a restart while the guard was on: guard again and ring, because the phone was switched off or restarted. */
public class ChargeGuardBootReceiver extends BroadcastReceiver {
  @Override public void onReceive(Context c, Intent i) {
    try {
      if (!ChargeGuardService.sp(c).getBoolean("armed", false)) return;
      if (ChargeGuardService.running) return;   // the early start already handled this restart
      ContextCompat.startForegroundService(c, new Intent(c, ChargeGuardService.class).setAction(ChargeGuardService.ACTION_BOOT));
    } catch (Exception e) { ChargeGuardService.note(c, "could not restart the guard: " + e); }
  }
}
