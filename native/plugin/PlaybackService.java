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

/** Keeps the app alive while music or video is playing, so playback does not stop when you leave the screen. */
public class PlaybackService extends Service {
  public static final String CHANNEL = "heytools_playback";
  private static final int NOTIFICATION_ID = 7001;

  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    String title = intent != null ? intent.getStringExtra("title") : null;
    if (title == null) title = "HeyTools";

    NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
    if (Build.VERSION.SDK_INT >= 26 && nm != null) {
      NotificationChannel ch = new NotificationChannel(CHANNEL, "Playback", NotificationManager.IMPORTANCE_LOW);
      ch.setDescription("Shown while music or video keeps playing");
      nm.createNotificationChannel(ch);
    }

    Intent open = new Intent(this, MainActivity.class);
    open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    int piFlags = Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0;
    PendingIntent pi = PendingIntent.getActivity(this, 0, open, piFlags);

    int icon = getResources().getIdentifier("ic_stat_hey", "drawable", getPackageName());
    if (icon == 0) icon = android.R.drawable.ic_media_play;

    Notification n = new NotificationCompat.Builder(this, CHANNEL)
      .setContentTitle(title)
      .setContentText("Playing in HeyTools. Tap to open.")
      .setSmallIcon(icon)
      .setContentIntent(pi)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .build();

    if (Build.VERSION.SDK_INT >= 29) {
      startForeground(NOTIFICATION_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
    } else {
      startForeground(NOTIFICATION_ID, n);
    }
    return START_NOT_STICKY;
  }
}
