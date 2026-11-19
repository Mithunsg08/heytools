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
  /** Lets the web page ask where the native player is, so playback can be handed back without losing the position. */
  public static volatile PlaybackService inst;
  /** Called when a song handed to the native player finishes, so the app can start the next one. */
  public static volatile Runnable endedListener;
  public interface ActionListener { void onAction(String action); }
  /** Next / previous pressed while the native player owns playback; the app forwards it to the open player. */
  public static volatile ActionListener actionListener;
  public static int audioPositionMs() { PlaybackService s = inst; try { return s != null && s.audioPlayer != null ? s.audioPlayer.getCurrentPosition() : 0; } catch (Exception e) { return 0; } }
  public static int audioDurationMs() { PlaybackService s = inst; try { return s != null && s.audioPlayer != null ? s.audioPlayer.getDuration() : 0; } catch (Exception e) { return 0; } }
  public static boolean audioActive() { PlaybackService s = inst; return s != null && s.audioPlayer != null; }
  private String title = "HeyTools";
  private String artist = "Now playing";
  private boolean playing = true;
  private String lastSignature = "";
  private MediaSessionCompat mediaSession;
  private MediaPlayer audioPlayer;
  private String audioSource = "";
  private android.os.PowerManager.WakeLock wake;

  @Override public IBinder onBind(Intent intent) { return null; }
  @Override public void onCreate() {
    super.onCreate(); isRunning = true; inst = this;
    mediaSession = new MediaSessionCompat(this, "HeyToolsPlayback");
    mediaSession.setFlags(MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS | MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS);
    mediaSession.setCallback(new MediaSessionCompat.Callback() {
      @Override public void onPlay() { resumeAudio(); }
      @Override public void onPause() { pauseAudio(); }
      @Override public void onSkipToNext() { skip("next", "NEXT", 7103); }
      @Override public void onSkipToPrevious() { skip("previous", "PREVIOUS", 7101); }
      @Override public void onStop() { pauseAudio(); }
    });
    mediaSession.setActive(true);
  }
  private void skip(String word, String name, int request) {
    ActionListener l = actionListener;
    if (l != null) { try { l.onAction(word); return; } catch (Exception ignored) {} }
    sendAction(name, request);
  }
  private PendingIntent svc(String act, int request) {
    Intent i = new Intent(this, PlaybackService.class).setAction(act);
    int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
    return PendingIntent.getService(this, request, i, flags);
  }
  private void sendAction(String name, int request) {
    try { action(name, request).send(); } catch (Exception ignored) {}
  }
  /** Keeps the CPU running while music or video plays, so locking the screen does not stop it. Released on pause. */
  private void setWake(boolean on) {
    try {
      if (on) {
        if (wake == null) {
          android.os.PowerManager pm = (android.os.PowerManager) getSystemService(POWER_SERVICE);
          if (pm == null) return;
          wake = pm.newWakeLock(android.os.PowerManager.PARTIAL_WAKE_LOCK, "HeyTools:playback");
          wake.setReferenceCounted(false);
        }
        if (!wake.isHeld()) wake.acquire(6 * 60 * 60 * 1000L);
      } else if (wake != null && wake.isHeld()) {
        wake.release();
      }
    } catch (Exception ignored) {}
  }
  private void updateMediaSession() {
    setWake(playing);
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
    audioIsPlaying=false; playing=false; refreshControls();
  }
  private void resumeAudio() {
    if (audioPlayer != null) try { audioPlayer.start(); playing=true; audioIsPlaying=true; refreshControls(); } catch (Exception ignored) {}
  }
  private void startAudio(String source) { startAudio(source, 0); }
  private void startAudio(String source, final int startMs) {
    if (source == null || !(source.startsWith("https://") || source.startsWith("http://") || source.startsWith("file://") || source.startsWith("content://"))) { pauseAudio(); return; }
    if (source.equals(audioSource) && audioPlayer != null) { resumeAudio(); return; }
    releaseAudio(); audioSource=source; playing=true; refreshControls();
    try {
      audioPlayer=new MediaPlayer();
      try{audioPlayer.setWakeMode(this,android.os.PowerManager.PARTIAL_WAKE_LOCK);}catch(Exception ignored){}
      audioPlayer.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build());
      audioPlayer.setOnPreparedListener(mp -> { if(audioPlayer==mp){mp.setVolume(1f,1f);if(startMs>0){try{mp.seekTo(startMs);}catch(Exception ignored){}}mp.start();playing=true;audioIsPlaying=true;setWake(true);refreshControls();} });
      audioPlayer.setOnCompletionListener(mp -> {playing=false;audioIsPlaying=false;refreshControls();Runnable r=endedListener;if(r!=null){try{r.run();}catch(Exception ignored){}}else{sendAction("NEXT",7103);}});
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
      startAudio(intent.getStringExtra("source"), intent.getIntExtra("position", 0));
      lastSignature=title+"|"+artist+"|true"; return START_STICKY;
    }
    if (intent != null && "com.heytools.SVC_TOGGLE".equals(intent.getAction())) { if (audioIsPlaying) pauseAudio(); else resumeAudio(); return START_STICKY; }
    if (intent != null && "com.heytools.SVC_NEXT".equals(intent.getAction())) { skip("next", "NEXT", 7103); return START_STICKY; }
    if (intent != null && "com.heytools.SVC_PREVIOUS".equals(intent.getAction())) { skip("previous", "PREVIOUS", 7101); return START_STICKY; }
    if (intent != null && "com.heytools.PAUSE_URL".equals(intent.getAction())) { pauseAudio(); return START_STICKY; }
    if (intent != null && "com.heytools.RESUME_URL".equals(intent.getAction())) { resumeAudio(); return START_STICKY; }
    if (intent != null && "com.heytools.STOP_URL".equals(intent.getAction())) { controlAudio("stop"); stopSelf(); return START_NOT_STICKY; }
    if (intent != null) {
      String t=intent.getStringExtra("title"), a=intent.getStringExtra("artist");
      if(t!=null&&!t.trim().isEmpty())title=t;
      if(a!=null)artist=a;
      // while the native player owns playback its own state wins: the page pausing its muted copy must not mark this as paused
      if(audioPlayer!=null) playing=audioIsPlaying; else playing=intent.getBooleanExtra("playing",true);
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
      .addAction(android.R.drawable.ic_media_previous,"Previous",audioPlayer!=null?svc("com.heytools.SVC_PREVIOUS",7111):action("PREVIOUS",7101))
      .addAction(playing?android.R.drawable.ic_media_pause:android.R.drawable.ic_media_play,
        playing?"Pause":"Play",audioPlayer!=null?svc("com.heytools.SVC_TOGGLE",7112):action("TOGGLE",7102))
      .addAction(android.R.drawable.ic_media_next,"Next",audioPlayer!=null?svc("com.heytools.SVC_NEXT",7113):action("NEXT",7103))
      .build();
  }
  @Override public void onDestroy(){
    NotificationManager nm=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);
    if(nm!=null)nm.cancel(NOTIFICATION_ID);
    releaseAudio(); audioSource=""; setWake(false);
    isRunning = false; audioIsPlaying = false; if (inst == this) inst = null;
    if (mediaSession != null) { mediaSession.setActive(false); mediaSession.release(); mediaSession = null; }
    super.onDestroy();
  }
}
