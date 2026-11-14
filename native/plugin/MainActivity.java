package com.heytools.app;

import android.os.Bundle;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import com.getcapacitor.BridgeActivity;
import java.util.concurrent.TimeUnit;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(MediaLibraryPlugin.class);
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
  }
}
