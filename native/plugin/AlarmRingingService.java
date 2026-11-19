package com.heytools.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.content.res.AssetFileDescriptor;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;

public class AlarmRingingService extends Service {
  static final String CHANNEL="heytools_alarm_ringing";
  static final String ACTION_STOP="com.heytools.ALARM_STOP_RING";
  private static final int NOTIFICATION_ID=82001;
  private MediaPlayer player;
  private PowerManager.WakeLock wakeLock;
  private int alarmId=-1;

  @Override public IBinder onBind(Intent i){return null;}
  @Override public void onCreate(){
    super.onCreate();
    PowerManager pm=(PowerManager)getSystemService(POWER_SERVICE);
    if(pm!=null){wakeLock=pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK,"HeyTools:Alarm");wakeLock.acquire(10*60*1000L);}
    NotificationManager nm=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);
    if(Build.VERSION.SDK_INT>=26&&nm!=null){
      NotificationChannel ch=new NotificationChannel(CHANNEL,"Alarms",NotificationManager.IMPORTANCE_HIGH);
      ch.setDescription("Ringing alarms and alarm controls");ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
      ch.enableVibration(true);ch.setSound(null,null);nm.createNotificationChannel(ch);
    }
  }
  @Override public int onStartCommand(Intent intent,int flags,int startId){
    if(intent!=null&&ACTION_STOP.equals(intent.getAction())){stopSelf();return START_NOT_STICKY;}
    alarmId=intent==null?-1:intent.getIntExtra("alarmId",-1);
    String title=intent==null?"Alarm":intent.getStringExtra("title");
    String tone=intent==null?"classic":intent.getStringExtra("tone");
    int snooze=intent==null?10:intent.getIntExtra("snooze",10);
    startForeground(NOTIFICATION_ID,buildNotification(title,snooze));
    playTone(tone);
    return START_NOT_STICKY;
  }
  private Notification buildNotification(String title,int snooze){
    Intent open=new Intent(this,MainActivity.class).setAction("com.heytools.ALARM_OPEN").setData(android.net.Uri.parse("heytools://alarm/ringing/"+alarmId));
    PendingIntent content=PendingIntent.getActivity(this,alarmId,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    Intent stop=new Intent(this,AlarmActionReceiver.class).setAction("com.heytools.ALARM_STOP").putExtra("alarmId",alarmId);
    PendingIntent stopPi=PendingIntent.getBroadcast(this,alarmId+300000,stop,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    Intent snoozeI=new Intent(this,AlarmActionReceiver.class).setAction("com.heytools.ALARM_SNOOZE").putExtra("alarmId",alarmId).putExtra("minutes",snooze);
    PendingIntent snoozePi=PendingIntent.getBroadcast(this,alarmId+400000,snoozeI,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    int icon=getResources().getIdentifier("ic_stat_hey","drawable",getPackageName());if(icon==0)icon=android.R.drawable.ic_lock_idle_alarm;
    NotificationCompat.Builder b=new NotificationCompat.Builder(this,CHANNEL)
      .setSmallIcon(icon).setContentTitle(title==null||title.trim().isEmpty()?"Alarm":title)
      .setContentText("Your alarm is ringing").setCategory(NotificationCompat.CATEGORY_ALARM)
      .setPriority(NotificationCompat.PRIORITY_MAX).setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setOngoing(true).setAutoCancel(false).setOnlyAlertOnce(true).setContentIntent(content)
      .addAction(android.R.drawable.ic_lock_idle_alarm,"Snooze "+snooze+" min",snoozePi)
      .addAction(android.R.drawable.ic_menu_close_clear_cancel,"Stop",stopPi);
    b.setFullScreenIntent(content,true);
    return b.build();
  }
  /** An alarm that is turned all the way down is not an alarm. Raise the alarm volume to at least half if it is lower. */
  private void ensureAudible(){
    try{
      android.media.AudioManager am=(android.media.AudioManager)getSystemService(AUDIO_SERVICE);
      if(am==null)return;
      int max=am.getStreamMaxVolume(android.media.AudioManager.STREAM_ALARM);
      int want=Math.max(1,max/2);
      if(am.getStreamVolume(android.media.AudioManager.STREAM_ALARM)<want)am.setStreamVolume(android.media.AudioManager.STREAM_ALARM,want,0);
    }catch(Exception ignored){}
  }
  private void playTone(String name){
    ensureAudible();
    stopPlayer();
    String safe=(name==null?"classic":name).replaceAll("[^a-z0-9_]","");
    int res=getResources().getIdentifier("tone_"+safe,"raw",getPackageName());
    if(res==0)res=getResources().getIdentifier("tone_classic","raw",getPackageName());
    try{
      player=new MediaPlayer();
      player.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
      AssetFileDescriptor afd=getResources().openRawResourceFd(res);
      if(afd==null)throw new IllegalStateException("Alarm tone resource is unavailable");
      try { player.setDataSource(afd.getFileDescriptor(),afd.getStartOffset(),afd.getLength()); }
      finally { afd.close(); }
      player.setLooping(true);player.setVolume(1f,1f);player.prepare();player.start();
    }catch(Exception ignored){stopPlayer();}
  }
  private void stopPlayer(){if(player!=null){try{if(player.isPlaying())player.stop();player.release();}catch(Exception ignored){}player=null;}}
  @Override public void onDestroy(){
    stopPlayer();
    NotificationManager nm=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);if(nm!=null)nm.cancel(NOTIFICATION_ID);
    if(wakeLock!=null&&wakeLock.isHeld())try{wakeLock.release();}catch(Exception ignored){}
    super.onDestroy();
  }
}
