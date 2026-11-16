package com.heytools.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class AlarmActionReceiver extends BroadcastReceiver {
  @Override public void onReceive(Context context, Intent intent) {
    if(intent==null)return;
    int id=intent.getIntExtra("alarmId",-1);
    String action=intent.getAction();
    if("com.heytools.ALARM_SNOOZE".equals(action)&&id>=0){
      try{AlarmScheduler.snooze(context,id,intent.getIntExtra("minutes",10));}catch(Exception ignored){}
    }
    Intent stop=new Intent(context,AlarmRingingService.class).setAction(AlarmRingingService.ACTION_STOP);
    context.startService(stop);
  }
}
