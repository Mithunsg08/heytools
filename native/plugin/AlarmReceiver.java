package com.heytools.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

public class AlarmReceiver extends BroadcastReceiver {
  @Override public void onReceive(Context context, Intent intent) {
    int id=-1;
    try { if(intent!=null&&intent.getData()!=null) id=Integer.parseInt(intent.getData().getLastPathSegment()); }
    catch(Exception ignored) { return; }
    if(id<0)return;
    // Ring even if the exact-alarm switch was turned off after scheduling: the person asked for this alarm.
    // The scheduler validates that this ID is still active and advances repeating alarms before ringing.
    org.json.JSONObject alarm=AlarmScheduler.fired(context,id);
    if(alarm==null)return;
    Intent service=new Intent(context,AlarmRingingService.class);
    service.putExtra("alarmId",id);
    service.putExtra("title",alarm.optString("label","Alarm"));
    service.putExtra("tone",alarm.optString("tone","classic"));
    service.putExtra("snooze",alarm.optInt("snooze",10));
    if(Build.VERSION.SDK_INT>=26)context.startForegroundService(service);else context.startService(service);
  }
}
