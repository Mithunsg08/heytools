package com.heytools.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(MediaLibraryPlugin.class);
    super.onCreate(savedInstanceState);
    // let the video and music players start playing without an extra tap
    getBridge().getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false);
  }
}
