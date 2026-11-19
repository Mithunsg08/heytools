package com.heytools.app;

import android.Manifest;
import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.projection.MediaProjectionManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import androidx.activity.result.ActivityResult;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.io.OutputStream;

/** Screen recording for the Recorder tool (Android WebView has no screen capture of its own). */
@CapacitorPlugin(name = "ScreenRecord")
public class ScreenRecordPlugin extends Plugin {

  @PluginMethod
  public void start(PluginCall call) {
    if (Build.VERSION.SDK_INT < 21) { call.reject("Screen recording needs Android 5 or newer."); return; }
    if (ScreenRecordService.recording) { call.reject("A screen recording is already running."); return; }
    MediaProjectionManager mpm = (MediaProjectionManager) getContext().getSystemService(Context.MEDIA_PROJECTION_SERVICE);
    if (mpm == null) { call.reject("Screen capture is not available on this phone."); return; }
    startActivityForResult(call, mpm.createScreenCaptureIntent(), "onConsent");
  }

  @ActivityCallback
  private void onConsent(PluginCall call, ActivityResult result) {
    if (call == null) return;
    if (result == null || result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
      call.reject("cancelled");
      return;
    }
    final boolean mic = Boolean.TRUE.equals(call.getBoolean("mic", false)) && hasMic();
    final int maxDim = call.getInt("maxDim", 1280);
    Intent i = new Intent(getContext(), ScreenRecordService.class)
      .setAction(ScreenRecordService.ACTION_START)
      .putExtra("code", result.getResultCode())
      .putExtra("data", result.getData())
      .putExtra("mic", mic)
      .putExtra("maxDim", maxDim);
    ScreenRecordService.listener = new ScreenRecordService.Listener() {
      @Override public void onFinished(String path, long durationMs) {
        JSObject o = new JSObject();
        o.put("path", path);
        o.put("durationMs", durationMs);
        notifyListeners("finished", o);
      }
    };
    try {
      if (Build.VERSION.SDK_INT >= 26) getContext().startForegroundService(i);
      else getContext().startService(i);
    } catch (Exception e) {
      call.reject("Could not start screen recording: " + e.getMessage());
      return;
    }
    waitUntilRecording(call, mic, 0);
  }

  /** The service starts on its own thread of events, so check a few times before answering the web page. */
  private void waitUntilRecording(final PluginCall call, final boolean mic, final int tries) {
    if (ScreenRecordService.recording) {
      JSObject o = new JSObject();
      o.put("recording", true);
      o.put("mic", mic);
      call.resolve(o);
      return;
    }
    if (ScreenRecordService.lastError != null || tries > 40) {
      String why = ScreenRecordService.lastError != null ? ScreenRecordService.lastError : "Screen recording did not start.";
      call.reject(why);
      return;
    }
    new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
      @Override public void run() { waitUntilRecording(call, mic, tries + 1); }
    }, 100);
  }

  @PluginMethod
  public void stop(PluginCall call) {
    boolean ok = ScreenRecordService.finishNow(false);
    if (!ok || ScreenRecordService.lastPath == null) {
      call.reject("Nothing was recorded.");
      return;
    }
    JSObject o = new JSObject();
    o.put("path", ScreenRecordService.lastPath);
    o.put("durationMs", ScreenRecordService.lastMs);
    call.resolve(o);
  }

  @PluginMethod
  public void pause(PluginCall call) {
    JSObject o = new JSObject();
    o.put("ok", ScreenRecordService.pauseRecording());
    call.resolve(o);
  }

  @PluginMethod
  public void resume(PluginCall call) {
    JSObject o = new JSObject();
    o.put("ok", ScreenRecordService.resumeRecording());
    call.resolve(o);
  }

  @PluginMethod
  public void status(PluginCall call) {
    JSObject o = new JSObject();
    o.put("recording", ScreenRecordService.recording);
    o.put("paused", ScreenRecordService.paused);
    call.resolve(o);
  }

  /** Copies a finished recording into the phone's Movies/HeyTools folder (Android 10 and newer). */
  @PluginMethod
  public void exportToGallery(PluginCall call) {
    File f = ownFile(call.getString("path"));
    if (f == null) { call.reject("That file is not available."); return; }
    if (Build.VERSION.SDK_INT < 29) {
      JSObject o = new JSObject();
      o.put("where", "");
      call.resolve(o);
      return;
    }
    String name = call.getString("name", f.getName());
    if (name == null || name.trim().isEmpty()) name = f.getName();
    name = name.replaceAll("[\\\\/:*?\"<>|]", "_");
    if (!name.toLowerCase().endsWith(".mp4")) name = name + ".mp4";
    try {
      ContentResolver cr = getContext().getContentResolver();
      ContentValues v = new ContentValues();
      v.put(MediaStore.Video.Media.DISPLAY_NAME, name);
      v.put(MediaStore.Video.Media.MIME_TYPE, "video/mp4");
      v.put(MediaStore.Video.Media.RELATIVE_PATH, Environment.DIRECTORY_MOVIES + "/HeyTools");
      v.put(MediaStore.Video.Media.IS_PENDING, 1);
      Uri uri = cr.insert(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, v);
      if (uri == null) throw new IllegalStateException("Could not create the file");
      InputStream in = new FileInputStream(f);
      OutputStream out = cr.openOutputStream(uri);
      if (out == null) { in.close(); throw new IllegalStateException("Could not open the file"); }
      byte[] buf = new byte[64 * 1024];
      int n;
      try { while ((n = in.read(buf)) > 0) out.write(buf, 0, n); } finally { try { in.close(); } catch (Exception ignored) {} try { out.close(); } catch (Exception ignored) {} }
      ContentValues done = new ContentValues();
      done.put(MediaStore.Video.Media.IS_PENDING, 0);
      cr.update(uri, done, null, null);
      JSObject o = new JSObject();
      o.put("where", "Movies/HeyTools");
      call.resolve(o);
    } catch (Exception e) {
      call.reject("Could not save to your phone: " + e.getMessage());
    }
  }

  @PluginMethod
  public void deleteFile(PluginCall call) {
    File f = ownFile(call.getString("path"));
    if (f != null) { try { f.delete(); } catch (Exception ignored) {} }
    call.resolve();
  }

  private boolean hasMic() {
    return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
  }

  /** Only files this feature created in the app's own Movies folder can be read, exported or deleted. */
  private File ownFile(String path) {
    if (path == null || path.isEmpty()) return null;
    try {
      File dir = getContext().getExternalFilesDir("Movies");
      if (dir == null) dir = getContext().getCacheDir();
      File f = new File(path).getCanonicalFile();
      if (!f.getPath().startsWith(dir.getCanonicalPath() + File.separator) || !f.exists()) return null;
      return f;
    } catch (Exception e) {
      return null;
    }
  }
}
