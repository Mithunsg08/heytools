package com.heytools.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class AlarmBootReceiver extends BroadcastReceiver {
  @Override public void onReceive(Context context, Intent intent) {
    if(intent==null)return;
    String a=intent.getAction();
    if(Intent.ACTION_BOOT_COMPLETED.equals(a)||Intent.ACTION_LOCKED_BOOT_COMPLETED.equals(a)||Intent.ACTION_TIME_CHANGED.equals(a)||
       Intent.ACTION_TIMEZONE_CHANGED.equals(a)||Intent.ACTION_MY_PACKAGE_REPLACED.equals(a)||
       "android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED".equals(a)) {
      AlarmScheduler.reschedule(context);
    }
  }
}
