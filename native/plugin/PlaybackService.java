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
import android.media.MediaPlayer;
import android.media.AudioAttributes;
import android.net.Uri;
import androidx.core.app.NotificationCompat;
import androidx.media.app.NotificationCompat.MediaStyle;
import android.graphics.BitmapFactory;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;

/** Persistent media controls for the active HeyTools player. */
public class PlaybackService extends Service {
  public static final String CHANNEL = "heytools_playback";
  private static final int NOTIFICATION_ID = 7001;
  public static volatile boolean isRunning = false;
  public static volatile boolean audioIsPlaying = false;
  public static volatile boolean audioIsPlaying = false;
  private String title = "HeyTools";
  private String artist = "Now playing";
  private boolean playing = true;
  private String lastSignature = "";
  private MediaSessionCompat mediaSession;
  private MediaPlayer audioPlayer;
  private String audioSource = "";

  @Override public IBinder onBind(Intent intent) { return null; }
  @Override public void onCreate() {
    super.onCreate(); isRunning = true;
    mediaSession = new MediaSessionCompat(this, "HeyToolsPlayback");
    mediaSession.setFlags(MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS | MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS);
    mediaSession.setCallback(new MediaSessionCompat.Callback() {
      @Override public void onPlay() { resumeAudio(); }
      @Override public void onPause() { pauseAudio(); }
      @Override public void onSkipToNext() { sendAction("NEXT", 7103); }
      @Override public void onSkipToPrevious() { sendAction("PREVIOUS", 7101); }
      @Override public void onStop() { pauseAudio(); }
    });
    mediaSession.setActive(true);
  }
  private void sendAction(String name, int request) {
    try { action(name, request).send(); } catch (Exception ignored) {}
  }
  private void updateMediaSession() {
    if (mediaSession == null) return;
    mediaSession.setMetadata(new MediaMetadataCompat.Builder()
      .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
      .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, artist)
      .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_TITLE, title)
      .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_SUBTITLE, artist)
      .putBitmap(MediaMetadataCompat.METADATA_KEY_DISPLAY_ICON,
        BitmapFactory.decodeResource(getResources(), getResources().getIdentifier("ic_stat_hey", "drawable", getPackageName())))
      .build());
    long actions=PlaybackStateCompat.ACTION_PLAY|PlaybackStateCompat.ACTION_PAUSE|
      PlaybackStateCompat.ACTION_PLAY_PAUSE|PlaybackStateCompat.ACTION_SKIP_TO_NEXT|
      PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS|PlaybackStateCompat.ACTION_STOP;
    mediaSession.setPlaybackState(new PlaybackStateCompat.Builder().setActions(actions)
      .setState(playing?PlaybackStateCompat.STATE_PLAYING:PlaybackStateCompat.STATE_PAUSED,
        PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN, playing?1f:0f).build());
  }


  private void releaseAudio() {
    audioIsPlaying = false;
    if (audioPlayer != null) {
      try { audioPlayer.setOnPreparedListener(null); audioPlayer.setOnErrorListener(null); audioPlayer.stop(); } catch (Exception ignored) {}
      try { audioPlayer.release(); } catch (Exception ignored) {}
      audioPlayer = null;
    }
  }
  private void refreshControls() {
    updateMediaSession();
    try { NotificationManager nm=(NotificationManager)getSystemService(NOTIFICATION_SERVICE); if(nm!=null)nm.notify(NOTIFICATION_ID,buildNotification()); } catch(Exception ignored) {}
  }
  private void pauseAudio() {
    if (audioPlayer != null) try { if (audioPlayer.isPlaying()) audioPlayer.pause(); } catch (Exception ignored) {}
    audioIsPlaying=false; playing=false; audioIsPlaying=false; refreshControls();
  }
  private void resumeAudio() {
    if (audioPlayer != null) try { audioPlayer.start(); playing=true; audioIsPlaying=true; refreshControls(); } catch (Exception ignored) {}
  }
  private void startAudio(String source) {
    if (source == null || !(source.startsWith("https://") || source.startsWith("http://") || source.startsWith("file://") || source.startsWith("content://"))) { pauseAudio(); return; }
    if (source.equals(audioSource) && audioPlayer != null) { resumeAudio(); return; }
    releaseAudio(); audioSource=source; playing=true; refreshControls();
    try {
      audioPlayer=new MediaPlayer();
      audioPlayer.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build());
      audioPlayer.setOnPreparedListener(mp -> { if(audioPlayer==mp){mp.setVolume(1f,1f);mp.start();playing=true;audioIsPlaying=true;refreshControls();} });
      audioPlayer.setOnCompletionListener(mp -> {playing=false;audioIsPlaying=false;refreshControls();sendAction("NEXT",7103);});
      audioPlayer.setOnErrorListener((mp,what,extra)->{playing=false;audioIsPlaying=false;refreshControls();return true;});
      audioPlayer.setDataSource(this,Uri.parse(source));
      audioPlayer.prepareAsync();
    } catch(Exception e) { releaseAudio(); playing=false; refreshControls(); }
  }
  public void controlAudio(String action) {
    if ("play".equals(action)) resumeAudio();
    else if ("pause".equals(action)) pauseAudio();
    else if ("stop".equals(action)) { pauseAudio(); releaseAudio(); audioIsPlaying=false; audioSource=""; }
  }

  @Override public int onStartCommand(Intent intent, int flags, int startId) {

    if (intent != null && "com.heytools.PLAY_URL".equals(intent.getAction())) {
      String t=intent.getStringExtra("title"), a=intent.getStringExtra("artist");
      if(t!=null&&!t.trim().isEmpty())title=t; if(a!=null)artist=a;
      startForeground(NOTIFICATION_ID,buildNotification());
      startAudio(intent.getStringExtra("source"));
      lastSignature=title+"|"+artist+"|true"; return START_STICKY;
    }
    if (intent != null && "com.heytools.PAUSE_URL".equals(intent.getAction())) { pauseAudio(); return START_STICKY; }
    if (intent != null && "com.heytools.RESUME_URL".equals(intent.getAction())) { resumeAudio(); return START_STICKY; }
    if (intent != null && "com.heytools.STOP_URL".equals(intent.getAction())) { controlAudio("stop"); stopSelf(); return START_NOT_STICKY; }
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
    updateMediaSession();
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
      .setStyle(new MediaStyle().setMediaSession(mediaSession == null ? null : mediaSession.getSessionToken())
        .setShowActionsInCompactView(0,1,2))
      .addAction(android.R.drawable.ic_media_previous,"Previous",action("PREVIOUS",7101))
      .addAction(playing?android.R.drawable.ic_media_pause:android.R.drawable.ic_media_play,
        playing?"Pause":"Play",action("TOGGLE",7102))
      .addAction(android.R.drawable.ic_media_next,"Next",action("NEXT",7103))
      .build();
  }
  @Override public void onDestroy(){
    NotificationManager nm=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);
    if(nm!=null)nm.cancel(NOTIFICATION_ID);
    releaseAudio(); audioSource="";
    isRunning = false; audioIsPlaying = false;
    if (mediaSession != null) { mediaSession.setActive(false); mediaSession.release(); mediaSession = null; }
    super.onDestroy();
  }
}
