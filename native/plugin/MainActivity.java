package com.heytools.app;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.content.Intent;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import com.getcapacitor.BridgeActivity;
import java.util.concurrent.TimeUnit;

public class MainActivity extends BridgeActivity {
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

  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(MediaLibraryPlugin.class);
    registerPlugin(HeyAlarmPlugin.class);
    super.onCreate(savedInstanceState);
    // let the video and music players start playing without an extra tap
    getBridge().getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false);
    // look for a newer build every few hours, even when the app is closed
    try {
      PeriodicWorkRequest check = new PeriodicWorkRequest.Builder(UpdateWorker.class, 3, TimeUnit.HOURS)
        .setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
        .build();
      WorkManager.getInstance(this).enqueueUniquePeriodicWork("heytools-update-check", ExistingPeriodicWorkPolicy.KEEP, check);
    } catch (Throwable ignored) {
      // never stop the app from opening because of this
    }
    dispatchMediaAction(getIntent());
    dispatchAlarmOpen(getIntent());
  }
}
