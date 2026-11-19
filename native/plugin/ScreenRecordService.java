package com.heytools.app;

import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.MediaRecorder;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.SystemClock;
import android.util.DisplayMetrics;
import android.view.WindowManager;
import androidx.core.app.NotificationCompat;
import java.io.File;

/**
 * Records the phone screen (and optionally the microphone) to an MP4 file in the app's own storage.
 * Android requires a foreground service of type "mediaProjection" for this, so a notification with a Stop button is shown while recording.
 */
public class ScreenRecordService extends Service {
  static final String CHANNEL = "heytools_screen";
  static final int NOTE_ID = 7201;
  static final String ACTION_START = "com.heytools.SCREEN_START";
  static final String ACTION_STOP = "com.heytools.SCREEN_STOP";

  /** Called when a recording ends without the web page asking (for example from the notification's Stop button). */
  interface Listener { void onFinished(String path, long durationMs); }
  static volatile Listener listener;
  static volatile boolean recording = false;
  static volatile boolean paused = false;
  static volatile String lastPath = null;
  static volatile long lastMs = 0L;
  static volatile String lastError = null;
  static volatile ScreenRecordService instance;

  private MediaProjection projection;
  private VirtualDisplay display;
  private MediaRecorder recorder;
  private File outFile;
  private long startedAt = 0L;
  private long pausedTotal = 0L;
  private long pausedAt = 0L;
  private boolean finishing = false;

  @Override public IBinder onBind(Intent intent) { return null; }

  @Override public int onStartCommand(Intent intent, int flags, int startId) {
    instance = this;
    String action = intent == null ? null : intent.getAction();
    if (ACTION_STOP.equals(action)) {
      finish(true);
      return START_NOT_STICKY;
    }
    if (ACTION_START.equals(action)) {
      lastError = null;
      createChannel();
      Notification n = buildNotification();
      try {
        if (Build.VERSION.SDK_INT >= 29) startForeground(NOTE_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION);
        else startForeground(NOTE_ID, n);
        begin(intent);
      } catch (Exception e) {
        lastError = "Could not start screen recording: " + e.getMessage();
        cleanup();
        stopForegroundCompat();
        stopSelf();
      }
    }
    return START_NOT_STICKY;
  }

  private void begin(Intent intent) throws Exception {
    int code = intent.getIntExtra("code", Activity.RESULT_CANCELED);
    @SuppressWarnings("deprecation")
    Intent data = (Intent) intent.getParcelableExtra("data");
    boolean mic = intent.getBooleanExtra("mic", false);
    int maxDim = Math.max(480, intent.getIntExtra("maxDim", 1280));
    MediaProjectionManager mpm = (MediaProjectionManager) getSystemService(Context.MEDIA_PROJECTION_SERVICE);
    if (mpm == null || data == null) throw new IllegalStateException("Screen capture is not available");
    projection = mpm.getMediaProjection(code, data);
    if (projection == null) throw new IllegalStateException("Permission was not granted");
    // Android 14 needs this callback registered before the virtual display is created.
    projection.registerCallback(new MediaProjection.Callback() {
      @Override public void onStop() { finish(true); }
    }, new Handler(Looper.getMainLooper()));

    DisplayMetrics m = new DisplayMetrics();
    WindowManager wm = (WindowManager) getSystemService(Context.WINDOW_SERVICE);
    wm.getDefaultDisplay().getRealMetrics(m);
    float s = Math.min(1f, (float) maxDim / (float) Math.max(m.widthPixels, m.heightPixels));
    int w = ((int) (m.widthPixels * s)) & ~1;
    int h = ((int) (m.heightPixels * s)) & ~1;

    File dir = getExternalFilesDir("Movies");
    if (dir == null) dir = getCacheDir();
    dir.mkdirs();
    outFile = new File(dir, "screen_" + System.currentTimeMillis() + ".mp4");

    recorder = new MediaRecorder();
    if (mic) recorder.setAudioSource(MediaRecorder.AudioSource.MIC);
    recorder.setVideoSource(MediaRecorder.VideoSource.SURFACE);
    recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
    recorder.setOutputFile(outFile.getAbsolutePath());
    recorder.setVideoEncoder(MediaRecorder.VideoEncoder.H264);
    if (mic) {
      recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
      recorder.setAudioEncodingBitRate(128000);
      recorder.setAudioSamplingRate(44100);
    }
    recorder.setVideoSize(w, h);
    recorder.setVideoFrameRate(30);
    recorder.setVideoEncodingBitRate(Math.max(1500000, Math.min(8000000, w * h * 4)));
    recorder.prepare();
    display = projection.createVirtualDisplay("HeyToolsScreen", w, h, m.densityDpi,
      DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR, recorder.getSurface(), null, null);
    recorder.start();
    startedAt = SystemClock.elapsedRealtime();
    pausedTotal = 0L; pausedAt = 0L; paused = false; finishing = false;
    recording = true;
  }

  static boolean pauseRecording() {
    ScreenRecordService s = instance;
    if (s == null || !recording || paused || s.recorder == null || Build.VERSION.SDK_INT < 24) return false;
    try { s.recorder.pause(); s.pausedAt = SystemClock.elapsedRealtime(); paused = true; return true; } catch (Exception e) { return false; }
  }

  static boolean resumeRecording() {
    ScreenRecordService s = instance;
    if (s == null || !recording || !paused || s.recorder == null || Build.VERSION.SDK_INT < 24) return false;
    try { s.recorder.resume(); s.pausedTotal += SystemClock.elapsedRealtime() - s.pausedAt; paused = false; return true; } catch (Exception e) { return false; }
  }

  /** Stops recording and stores the result in lastPath / lastMs. Returns true when a usable file was produced. */
  static boolean finishNow(boolean notify) {
    ScreenRecordService s = instance;
    if (s == null) return false;
    return s.finish(notify);
  }

  private synchronized boolean finish(boolean notify) {
    if (finishing || !recording) { return false; }
    finishing = true;
    boolean ok = true;
    long now = SystemClock.elapsedRealtime();
    if (paused) { pausedTotal += now - pausedAt; }
    long ms = Math.max(0L, now - startedAt - pausedTotal);
    try { if (recorder != null) recorder.stop(); } catch (Exception e) { ok = false; }   // stop() fails when the recording was too short
    cleanup();
    recording = false; paused = false;
    lastPath = (ok && outFile != null && outFile.exists() && outFile.length() > 0) ? outFile.getAbsolutePath() : null;
    lastMs = ms;
    if (lastPath == null) ok = false;
    final String path = lastPath; final long dur = ms;
    stopForegroundCompat();
    stopSelf();
    if (notify && ok) {
      Listener l = listener;
      if (l != null) { try { l.onFinished(path, dur); } catch (Exception ignored) {} }
    }
    return ok;
  }

  private void cleanup() {
    try { if (recorder != null) { recorder.reset(); recorder.release(); } } catch (Exception ignored) {}
    recorder = null;
    try { if (display != null) display.release(); } catch (Exception ignored) {}
    display = null;
    try { if (projection != null) projection.stop(); } catch (Exception ignored) {}
    projection = null;
  }

  private void stopForegroundCompat() {
    try {
      if (Build.VERSION.SDK_INT >= 24) stopForeground(Service.STOP_FOREGROUND_REMOVE);
      else stopForeground(true);
    } catch (Exception ignored) {}
  }

  private void createChannel() {
    if (Build.VERSION.SDK_INT < 26) return;
    NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
    if (nm == null) return;
    NotificationChannel ch = new NotificationChannel(CHANNEL, "Screen recording", NotificationManager.IMPORTANCE_LOW);
    ch.setDescription("Shown while HeyTools records your screen");
    ch.setShowBadge(false);
    nm.createNotificationChannel(ch);
  }

  private Notification buildNotification() {
    int icon = getResources().getIdentifier("ic_stat_hey", "drawable", getPackageName());
    if (icon == 0) icon = android.R.drawable.ic_media_play;
    Intent stop = new Intent(this, ScreenRecordService.class).setAction(ACTION_STOP);
    int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
    PendingIntent stopIntent = PendingIntent.getService(this, 7202, stop, flags);
    return new NotificationCompat.Builder(this, CHANNEL)
      .setSmallIcon(icon)
      .setContentTitle("Recording your screen")
      .setContentText("Tap Stop when you are done")
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .addAction(android.R.drawable.ic_media_pause, "Stop", stopIntent)
      .build();
  }

  @Override public void onDestroy() {
    if (recording) { finish(false); }
    else { cleanup(); }
    if (instance == this) instance = null;
    super.onDestroy();
  }
}
