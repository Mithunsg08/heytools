package com.heytools.app;

import android.Manifest;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.content.Intent;
import android.content.pm.PackageManager;
import androidx.core.app.ActivityCompat;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import com.getcapacitor.BridgeActivity;
import java.util.concurrent.TimeUnit;

public class MainActivity extends BridgeActivity {
  private static final int NOTIFICATION_PERMISSION_REQUEST = 9101;

  private void callPage(String fn) {
    try {
      if (getBridge() != null && getBridge().getWebView() != null)
        getBridge().getWebView().evaluateJavascript("window." + fn + "&&window." + fn + "()", null);
    } catch (Throwable ignored) {}
  }
  @Override public void onPause() { callPage("__heyPause"); super.onPause(); }
  @Override public void onResume() { super.onResume(); callPage("__heyResume"); }

  @Override
  public void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    dispatchMediaAction(intent);
    dispatchAlarmOpen(intent);
  }

  private void runWhenHeyToolsReady(final String javascript) {
    final Handler handler = new Handler(Looper.getMainLooper());
    final Runnable[] task = new Runnable[1];
    task[0] = new Runnable() {
      int attempts = 0;
      private void retry() {
        if (++attempts < 20) handler.postDelayed(task[0], 300);
      }
      @Override public void run() {
        try {
          if (getBridge() == null || getBridge().getWebView() == null) { retry(); return; }
          String wrapped = "(function(){if(!window.__HEYTOOLS_READY)return false;" + javascript + ";return true;})()";
          getBridge().getWebView().evaluateJavascript(wrapped, value -> {
            if (!"true".equals(value)) retry();
          });
        } catch (Exception ignored) { retry(); }
      }
    };
    handler.postDelayed(task[0], 250);
  }

  /** When an alarm opens the app, show it over the lock screen and wake the display. */
  private void showOverLockScreen() {
    try {
      if (android.os.Build.VERSION.SDK_INT >= 27) {
        setShowWhenLocked(true);
        setTurnScreenOn(true);
      } else {
        getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | android.view.WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
      }
    } catch (Throwable ignored) {}
  }

  private void dispatchAlarmOpen(final Intent intent) {
    if (intent == null || !"com.heytools.ALARM_OPEN".equals(intent.getAction())) return;
    runWhenHeyToolsReady("location.hash='#/alarm-clock'");
  }

  private void dispatchMediaAction(final Intent intent) {
    if (intent == null || intent.getAction() == null || !intent.getAction().startsWith("com.heytools.MEDIA_")) return;
    final String action = intent.getAction().substring("com.heytools.MEDIA_".length()).toLowerCase(java.util.Locale.US);
    if (!("play".equals(action) || "pause".equals(action) || "toggle".equals(action) ||
          "next".equals(action) || "previous".equals(action) || "open".equals(action))) return;
    runWhenHeyToolsReady("window.dispatchEvent(new CustomEvent('heytools:media-action',{detail:{action:'" + action + "'}}))");
  }

  private void requestNotificationPermissionIfNeeded() {
    if (Build.VERSION.SDK_INT >= 33 &&
        checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
      ActivityCompat.requestPermissions(this,
        new String[] { Manifest.permission.POST_NOTIFICATIONS },
        NOTIFICATION_PERMISSION_REQUEST);
    }
  }

  private void scheduleUpdateChecks() {
    Constraints network = new Constraints.Builder()
      .setRequiredNetworkType(NetworkType.CONNECTED)
      .build();

    // Run once shortly after launch so users do not wait for the first 3-hour interval.
    OneTimeWorkRequest immediate = new OneTimeWorkRequest.Builder(UpdateWorker.class)
      .setConstraints(network)
      .build();
    WorkManager.getInstance(this).enqueueUniqueWork(
      "heytools-update-check-now", ExistingWorkPolicy.KEEP, immediate);

    // Keep checking periodically while the app is not open.
    PeriodicWorkRequest periodic = new PeriodicWorkRequest.Builder(UpdateWorker.class, 3, TimeUnit.HOURS)
      .setConstraints(network)
      .build();
    WorkManager.getInstance(this).enqueueUniquePeriodicWork(
      "heytools-update-check", ExistingPeriodicWorkPolicy.KEEP, periodic);
  }

  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(MediaLibraryPlugin.class);
    registerPlugin(HeyAlarmPlugin.class);
    registerPlugin(ScreenRecordPlugin.class);
    super.onCreate(savedInstanceState);
    getBridge().getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false);

    try {
      requestNotificationPermissionIfNeeded();
      scheduleUpdateChecks();
    } catch (Throwable ignored) {
      // Update checks and permission handling must never prevent the app from opening.
    }

    dispatchMediaAction(getIntent());
    dispatchAlarmOpen(getIntent());
  }
}
