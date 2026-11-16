package com.heytools.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import androidx.core.app.NotificationCompat;

/** Persistent media controls for the active HeyTools player. */
public class PlaybackService extends Service {
  public static final String CHANNEL = "heytools_playback";
  private static final int NOTIFICATION_ID = 7001;
  public static volatile boolean isRunning = false;
  private String title = "HeyTools";
  private String artist = "Now playing";
  private boolean playing = true;
  private String lastSignature = "";

  @Override public IBinder onBind(Intent intent) { return null; }
  @Override public void onCreate() { super.onCreate(); isRunning = true; }

  @Override public int onStartCommand(Intent intent, int flags, int startId) {
    if (intent != null) {
      String t=intent.getStringExtra("title"), a=intent.getStringExtra("artist");
      if(t!=null&&!t.trim().isEmpty())title=t;
      if(a!=null)artist=a;
      playing=intent.getBooleanExtra("playing",true);
    }
    NotificationManager nm=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);
    if(Build.VERSION.SDK_INT>=26&&nm!=null){
      NotificationChannel ch=new NotificationChannel(CHANNEL,"Media controls",NotificationManager.IMPORTANCE_LOW);
      ch.setDescription("Play, pause and skip HeyTools music");
      ch.setShowBadge(false);nm.createNotificationChannel(ch);
    }
    String signature=title+"|"+artist+"|"+playing;
    if(!signature.equals(lastSignature)){
      Notification n=buildNotification();
      if(Build.VERSION.SDK_INT>=29)startForeground(NOTIFICATION_ID,n,ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
      else startForeground(NOTIFICATION_ID,n);
      lastSignature=signature;
    }
    return START_NOT_STICKY;
  }

  private PendingIntent action(String name,int request){
    Intent i=new Intent(this,MainActivity.class).setAction("com.heytools.MEDIA_"+name)
      .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);
    int flags=PendingIntent.FLAG_UPDATE_CURRENT|(Build.VERSION.SDK_INT>=23?PendingIntent.FLAG_IMMUTABLE:0);
    return PendingIntent.getActivity(this,request,i,flags);
  }
  private Notification buildNotification(){
    int icon=getResources().getIdentifier("ic_stat_hey","drawable",getPackageName());
    if(icon==0)icon=android.R.drawable.ic_media_play;
    return new NotificationCompat.Builder(this,CHANNEL)
      .setSmallIcon(icon).setContentTitle(title).setContentText(artist+" · HeyTools")
      .setSubText("Now playing").setCategory(NotificationCompat.CATEGORY_TRANSPORT)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC).setOnlyAlertOnce(true)
      .setOngoing(true).setAutoCancel(false)
      .setContentIntent(action("OPEN",7100))
      .addAction(android.R.drawable.ic_media_previous,"Previous",action("PREVIOUS",7101))
      .addAction(playing?android.R.drawable.ic_media_pause:android.R.drawable.ic_media_play,
        playing?"Pause":"Play",action("TOGGLE",7102))
      .addAction(android.R.drawable.ic_media_next,"Next",action("NEXT",7103))
      .build();
  }
  @Override public void onDestroy(){
    NotificationManager nm=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);
    if(nm!=null)nm.cancel(NOTIFICATION_ID);
    isRunning = false;
    super.onDestroy();
  }
}
