package com.heytools.app;

import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
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
}
