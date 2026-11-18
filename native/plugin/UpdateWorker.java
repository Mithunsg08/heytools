package com.heytools.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.json.JSONObject;

/** Runs every few hours, even when the app is closed. If a newer build was published it shows a notification that opens the download. */
public class UpdateWorker extends Worker {
  private static final String RELEASE_API = "https://api.github.com/repos/Mithunsg08/heytools/releases/tags/android-latest";
  private static final String APK_URL = "https://github.com/Mithunsg08/heytools/releases/download/android-latest/HeyTools.apk";
  private static final String CHANNEL = "heytools_updates";

  public UpdateWorker(@NonNull Context context, @NonNull WorkerParameters params) {
    super(context, params);
  }

  @NonNull
  @Override
  public Result doWork() {
    if (!getApplicationContext().getSharedPreferences("heytools_prefs", 0).getBoolean("auto_update", true)) return Result.success();
    try {
      HttpURLConnection c = (HttpURLConnection) new URL(RELEASE_API).openConnection();
      c.setRequestProperty("Accept", "application/vnd.github+json");
      c.setConnectTimeout(15000);
      c.setReadTimeout(15000);
      if (c.getResponseCode() != 200) return Result.success(); // rate limited or offline: try again next time
      BufferedReader r = new BufferedReader(new InputStreamReader(c.getInputStream()));
      StringBuilder sb = new StringBuilder();
      String line;
      while ((line = r.readLine()) != null) sb.append(line);
      r.close();
      String body = new JSONObject(sb.toString()).optString("body", "");
      Matcher m = Pattern.compile("build\\D{0,3}(\\d+)", Pattern.CASE_INSENSITIVE).matcher(body);
      if (!m.find()) return Result.success();
      int latest = Integer.parseInt(m.group(1));

      Context ctx = getApplicationContext();
      PackageInfo pi = ctx.getPackageManager().getPackageInfo(ctx.getPackageName(), 0);
      long mine = Build.VERSION.SDK_INT >= 28 ? pi.getLongVersionCode() : pi.versionCode;
      SharedPreferences sp = ctx.getSharedPreferences("heytools_update", Context.MODE_PRIVATE);
      if (latest > mine && sp.getInt("notified", 0) < latest) {
        if (show(ctx, latest)) sp.edit().putInt("notified", latest).apply();
      }
      return Result.success();
    } catch (Exception e) {
      return Result.retry();
    }
  }

  private boolean show(Context ctx, int latest) {
    if (!NotificationManagerCompat.from(ctx).areNotificationsEnabled()) return false;
    NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
    if (Build.VERSION.SDK_INT >= 26 && nm != null) {
      NotificationChannel ch = new NotificationChannel(CHANNEL, "App updates", NotificationManager.IMPORTANCE_DEFAULT);
      ch.setDescription("Tells you when a new version of HeyTools is ready");
      nm.createNotificationChannel(ch);
    }
    Intent open = new Intent(Intent.ACTION_VIEW, Uri.parse(APK_URL));
    open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    int flags = Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0;
    PendingIntent pi = PendingIntent.getActivity(ctx, 0, open, flags);
    android.app.Notification n = new NotificationCompat.Builder(ctx, CHANNEL)
      .setSmallIcon(android.R.drawable.stat_sys_download_done)
      .setContentTitle("HeyTools update ready")
      .setContentText("A new version (build " + latest + ") is ready. Tap to download.")
      .setContentIntent(pi)
      .setAutoCancel(true)
      .build();
    NotificationManagerCompat.from(ctx).notify(7002, n);
    return true;
  }
}
