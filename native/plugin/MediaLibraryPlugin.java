package com.heytools.app;

import android.content.ContentValues;
import android.content.Intent;
import android.media.MediaScannerConnection;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.util.Base64;
import android.provider.MediaStore;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.UUID;

/** Lists every video and song on the phone (MediaStore) after the person allows access. */
@CapacitorPlugin(
  name = "MediaLibrary",
  permissions = {
    @Permission(alias = "videoNew", strings = { "android.permission.READ_MEDIA_VIDEO" }),
    @Permission(alias = "audioNew", strings = { "android.permission.READ_MEDIA_AUDIO" }),
    @Permission(alias = "storageOld", strings = { "android.permission.READ_EXTERNAL_STORAGE" })
  }
)
public class MediaLibraryPlugin extends Plugin {

  private String[] aliasesFor(String kind) {
    if (Build.VERSION.SDK_INT >= 33) {
      return new String[] { "audio".equals(kind) ? "audioNew" : "videoNew" };
    }
    return new String[] { "storageOld" };
  }

  private boolean granted(String kind) {
    for (String alias : aliasesFor(kind)) {
      if (getPermissionState(alias) != PermissionState.GRANTED) return false;
    }
    return true;
  }

  @PluginMethod
  public void checkAccess(PluginCall call) {
    JSObject r = new JSObject();
    r.put("granted", granted(call.getString("kind", "video")));
    call.resolve(r);
  }

  @PluginMethod
  public void requestAccess(PluginCall call) {
    String kind = call.getString("kind", "video");
    if (granted(kind)) {
      JSObject r = new JSObject();
      r.put("granted", true);
      call.resolve(r);
      return;
    }
    requestPermissionForAliases(aliasesFor(kind), call, "accessCallback");
  }

  @PermissionCallback
  private void accessCallback(PluginCall call) {
    JSObject r = new JSObject();
    r.put("granted", granted(call.getString("kind", "video")));
    call.resolve(r);
  }

  @PluginMethod
  public void scan(final PluginCall call) {
    final String kind = call.getString("kind", "video");
    if (!granted(kind)) {
      call.reject("Permission not granted");
      return;
    }
    getBridge().execute(new Runnable() {
      @Override
      public void run() {
        try {
          boolean audio = "audio".equals(kind);
          Uri uri = audio ? MediaStore.Audio.Media.EXTERNAL_CONTENT_URI : MediaStore.Video.Media.EXTERNAL_CONTENT_URI;
          String[] proj = audio
            ? new String[] {
                MediaStore.Audio.Media._ID, MediaStore.Audio.Media.DISPLAY_NAME, MediaStore.Audio.Media.DURATION,
                MediaStore.Audio.Media.SIZE, MediaStore.Audio.Media.DATA, MediaStore.Audio.Media.ARTIST,
                MediaStore.Audio.Media.ALBUM }
            : new String[] {
                MediaStore.Video.Media._ID, MediaStore.Video.Media.DISPLAY_NAME, MediaStore.Video.Media.DURATION,
                MediaStore.Video.Media.SIZE, MediaStore.Video.Media.DATA };
          // music only: skip ringtones, notifications and alarms
          String sel = audio
            ? MediaStore.Audio.Media.IS_RINGTONE + "=0 AND " + MediaStore.Audio.Media.IS_NOTIFICATION + "=0 AND " + MediaStore.Audio.Media.IS_ALARM + "=0"
            : null;
          JSArray items = new JSArray();
          Cursor c = getContext().getContentResolver().query(uri, proj, sel, null, MediaStore.MediaColumns.DATE_ADDED + " DESC");
          if (c != null) {
            try {
              int iId = c.getColumnIndexOrThrow(proj[0]);
              int iName = c.getColumnIndexOrThrow(proj[1]);
              int iDur = c.getColumnIndexOrThrow(proj[2]);
              int iSize = c.getColumnIndexOrThrow(proj[3]);
              int iData = c.getColumnIndexOrThrow(proj[4]);
              int iArtist = audio ? c.getColumnIndexOrThrow(proj[5]) : -1;
              int iAlbum = audio ? c.getColumnIndexOrThrow(proj[6]) : -1;
              int count = 0;
              while (c.moveToNext() && count < 30000) {
                String path = c.getString(iData);
                if (path == null) continue;
                JSObject o = new JSObject();
                o.put("id", c.getLong(iId));
                o.put("title", c.getString(iName));
                o.put("duration", c.getLong(iDur));
                o.put("size", c.getLong(iSize));
                o.put("path", path);
                if (audio) {
                  o.put("artist", c.getString(iArtist));
                  o.put("album", c.getString(iAlbum));
                }
                items.put(o);
                count++;
              }
            } finally {
              c.close();
            }
          }
          JSObject ret = new JSObject();
          ret.put("items", items);
          call.resolve(ret);
        } catch (Exception e) {
          call.reject("Could not read the media library: " + e.getMessage());
        }
      }
    });
  }

  /** Start the foreground service so playback keeps going when the app is in the background. */
  @PluginMethod
  public void startPlayback(PluginCall call) {
    try {
      Intent i = new Intent(getContext(), PlaybackService.class);
      i.putExtra("title", call.getString("title", "HeyTools"));
      if (Build.VERSION.SDK_INT >= 26) {
        getContext().startForegroundService(i);
      } else {
        getContext().startService(i);
      }
      call.resolve();
    } catch (Exception e) {
      call.reject("Could not start background playback: " + e.getMessage());
    }
  }

  @PluginMethod
  public void stopPlayback(PluginCall call) {
    try {
      getContext().stopService(new Intent(getContext(), PlaybackService.class));
      call.resolve();
    } catch (Exception e) {
      call.reject("Could not stop background playback: " + e.getMessage());
    }
  }

  /* ---- save a file so the phone can see it (used by every download button inside the tools) ---- */
  private final HashMap<String, OutputStream> saveStreams = new HashMap<>();
  private final HashMap<String, Uri> saveUris = new HashMap<>();
  private final HashMap<String, File> saveFiles = new HashMap<>();
  private final HashMap<String, String> saveWhere = new HashMap<>();

  private String safeName(String n) {
    if (n == null || n.trim().isEmpty()) return "file";
    String s = n.replaceAll("[\\\\/:*?\"<>|]", "_").trim();
    return s.isEmpty() ? "file" : s;
  }

  @PluginMethod
  public void saveStart(PluginCall call) {
    try {
      String name = safeName(call.getString("name", "file"));
      String mime = call.getString("mime", "application/octet-stream");
      if (mime == null || mime.isEmpty()) mime = "application/octet-stream";
      String dir;
      Uri collection = null;
      if (mime.startsWith("image/")) {
        dir = Environment.DIRECTORY_PICTURES;
        collection = MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
      } else if (mime.startsWith("video/")) {
        dir = Environment.DIRECTORY_MOVIES;
        collection = MediaStore.Video.Media.EXTERNAL_CONTENT_URI;
      } else if (mime.startsWith("audio/")) {
        dir = Environment.DIRECTORY_MUSIC;
        collection = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
      } else {
        dir = Environment.DIRECTORY_DOWNLOADS;
      }
      String id = UUID.randomUUID().toString();
      OutputStream os;
      if (Build.VERSION.SDK_INT >= 29) {
        if (collection == null) collection = MediaStore.Downloads.EXTERNAL_CONTENT_URI;
        ContentValues v = new ContentValues();
        v.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
        v.put(MediaStore.MediaColumns.MIME_TYPE, mime);
        v.put(MediaStore.MediaColumns.RELATIVE_PATH, dir + "/HeyTools");
        v.put(MediaStore.MediaColumns.IS_PENDING, 1);
        Uri uri = getContext().getContentResolver().insert(collection, v);
        if (uri == null) throw new Exception("The phone would not create the file");
        os = getContext().getContentResolver().openOutputStream(uri);
        if (os == null) throw new Exception("The phone would not open the file");
        saveUris.put(id, uri);
      } else {
        File base = new File(Environment.getExternalStoragePublicDirectory(dir), "HeyTools");
        base.mkdirs();
        File f = new File(base, name);
        os = new FileOutputStream(f);
        saveFiles.put(id, f);
      }
      saveStreams.put(id, os);
      saveWhere.put(id, dir + "/HeyTools/" + name);
      JSObject r = new JSObject();
      r.put("id", id);
      call.resolve(r);
    } catch (Exception e) {
      call.reject("Could not start saving: " + e.getMessage());
    }
  }

  @PluginMethod
  public void saveChunk(PluginCall call) {
    try {
      OutputStream os = saveStreams.get(call.getString("id", ""));
      if (os == null) throw new Exception("unknown file");
      String data = call.getString("data", "");
      if (data != null && !data.isEmpty()) os.write(Base64.decode(data, Base64.DEFAULT));
      call.resolve();
    } catch (Exception e) {
      call.reject("Could not write the file: " + e.getMessage());
    }
  }

  @PluginMethod
  public void saveFinish(PluginCall call) {
    String id = call.getString("id", "");
    try {
      OutputStream os = saveStreams.remove(id);
      if (os != null) {
        os.flush();
        os.close();
      }
      Uri uri = saveUris.remove(id);
      if (uri != null) {
        ContentValues v = new ContentValues();
        v.put(MediaStore.MediaColumns.IS_PENDING, 0);
        getContext().getContentResolver().update(uri, v, null, null);
      }
      File f = saveFiles.remove(id);
      if (f != null) MediaScannerConnection.scanFile(getContext(), new String[] { f.getAbsolutePath() }, null, null);
      JSObject r = new JSObject();
      r.put("where", saveWhere.remove(id));
      call.resolve(r);
    } catch (Exception e) {
      call.reject("Could not finish saving: " + e.getMessage());
    }
  }
}
