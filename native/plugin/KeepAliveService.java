package com.heytools.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;

/**
 * Keeps HeyTools running while a long job is busy (compressing, removing a background, downloading a model),
 * so Android does not stop it as soon as you switch to another app. Shows a quiet ongoing notification.
 */
public class KeepAliveService extends Service {
  static final String CHANNEL = "heytools_work";
  static final int NOTE_ID = 7301;
  static final String ACTION_STOP = "com.heytools.WORK_STOP";
  private PowerManager.WakeLock wake;

  @Override public IBinder onBind(Intent intent) { return null; }

  @Override public int onStartCommand(Intent intent, int flags, int startId) {
    if (intent != null && ACTION_STOP.equals(intent.getAction())) {
      release();
      stopForegroundCompat();
      stopSelf();
      return START_NOT_STICKY;
    }
    String title = intent != null && intent.getStringExtra("title") != null ? intent.getStringExtra("title") : "HeyTools is working";
    String text = intent != null && intent.getStringExtra("text") != null ? intent.getStringExtra("text") : "";
    createChannel();
    int icon = getResources().getIdentifier("ic_stat_hey", "drawable", getPackageName());
    if (icon == 0) icon = android.R.drawable.stat_notify_sync;
    Notification n = new NotificationCompat.Builder(this, CHANNEL)
      .setSmallIcon(icon)
      .setContentTitle(title)
      .setContentText(text)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setCategory(NotificationCompat.CATEGORY_PROGRESS)
      .setProgress(0, 0, true)
      .build();
    try {
      if (Build.VERSION.SDK_INT >= 29) startForeground(NOTE_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
      else startForeground(NOTE_ID, n);
      acquire();
    } catch (Exception e) {
      stopSelf();
    }
    return START_NOT_STICKY;
  }

  private void acquire() {
    try {
      if (wake == null) {
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        if (pm == null) return;
        wake = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "HeyTools:work");
        wake.setReferenceCounted(false);
      }
      if (!wake.isHeld()) wake.acquire(30 * 60 * 1000L);   // a job never keeps the phone awake for more than 30 minutes
    } catch (Exception ignored) {}
  }

  private void release() {
    try { if (wake != null && wake.isHeld()) wake.release(); } catch (Exception ignored) {}
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
    NotificationChannel ch = new NotificationChannel(CHANNEL, "Background work", NotificationManager.IMPORTANCE_LOW);
    ch.setDescription("Shown while a long job keeps running");
    ch.setShowBadge(false);
    nm.createNotificationChannel(ch);
  }

  @Override public void onDestroy() {
    release();
    super.onDestroy();
  }
}
