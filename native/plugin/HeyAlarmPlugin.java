package com.heytools.app;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.JSObject;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;

/** Exact, OS-owned alarms. These survive process death and device reboot. */
@CapacitorPlugin(name = "HeyAlarm")
public class HeyAlarmPlugin extends Plugin {
  @PluginMethod
  public void syncAlarms(PluginCall call) {
    try {
      JSONArray alarms = call.getData().optJSONArray("alarms");
      if (alarms == null) alarms = new JSONArray();
      AlarmScheduler.sync(getContext(), alarms);
      JSObject result = new JSObject();
      result.put("scheduled", alarms.length());
      result.put("exactPermission", AlarmScheduler.canScheduleExact(getContext()));
      call.resolve(result);
    } catch (SecurityException e) {
      call.reject("Allow HeyTools under Settings > Alarms & reminders, then save the alarm again.", e);
    } catch (Exception e) {
      call.reject("Could not schedule alarms: " + e.getMessage(), e);
    }
  }

  @PluginMethod
  public void requestExactPermission(PluginCall call) {
    try {
      if (android.os.Build.VERSION.SDK_INT >= 31 && !AlarmScheduler.canScheduleExact(getContext())) {
        android.content.Intent request = new android.content.Intent(
          android.provider.Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
          android.net.Uri.parse("package:" + getContext().getPackageName()));
        request.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
          getContext().startActivity(request);
        } catch (Exception unavailable) {
          android.content.Intent fallback = new android.content.Intent(
            android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
            android.net.Uri.parse("package:" + getContext().getPackageName()));
          fallback.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
          getContext().startActivity(fallback);
        }
      }
      JSObject r = new JSObject();
      r.put("exactPermission", AlarmScheduler.canScheduleExact(getContext()));
      call.resolve(r);
    } catch (Exception e) { call.reject("Could not open alarm permission settings: " + e.getMessage(), e); }
  }


  @PluginMethod
  public void testAlarm(PluginCall call) {
    try {
      AlarmScheduler.addTest(getContext());
      call.resolve();
    } catch (SecurityException e) {
      call.reject("Allow HeyTools under Settings > Alarms & reminders first.", e);
    } catch (Exception e) { call.reject("Could not start the test alarm: " + e.getMessage(), e); }
  }

  /** True when Android does not restrict HeyTools in the background. Some phones stop alarms for restricted apps. */
  @PluginMethod
  public void getBatteryState(PluginCall call) {
    try {
      android.os.PowerManager pm = (android.os.PowerManager) getContext().getSystemService(android.content.Context.POWER_SERVICE);
      boolean ok = android.os.Build.VERSION.SDK_INT < 23 || (pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName()));
      JSObject r = new JSObject();
      r.put("unrestricted", ok);
      call.resolve(r);
    } catch (Exception e) { call.reject("Could not read battery state: " + e.getMessage(), e); }
  }

  /** Opens the system battery optimisation list (needs no special permission), falling back to the app's settings page. */
  @PluginMethod
  public void openBatterySettings(PluginCall call) {
    try {
      android.content.Intent list = new android.content.Intent(android.provider.Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
      list.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
      try {
        getContext().startActivity(list);
      } catch (Exception unavailable) {
        android.content.Intent details = new android.content.Intent(
          android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
          android.net.Uri.parse("package:" + getContext().getPackageName()));
        details.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(details);
      }
      call.resolve();
    } catch (Exception e) { call.reject("Could not open battery settings: " + e.getMessage(), e); }
  }

  /** What Android itself says about this app's notifications (some phones keep their own switch next to the permission). */
  @PluginMethod
  public void getNotificationState(PluginCall call) {
    try {
      boolean enabled = androidx.core.app.NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
      boolean runtime = true;
      if (android.os.Build.VERSION.SDK_INT >= 33) {
        runtime = androidx.core.content.ContextCompat.checkSelfPermission(getContext(), android.Manifest.permission.POST_NOTIFICATIONS)
          == android.content.pm.PackageManager.PERMISSION_GRANTED;
      }
      JSObject r = new JSObject();
      r.put("enabled", enabled);
      r.put("runtime", runtime);
      r.put("sdk", android.os.Build.VERSION.SDK_INT);
      r.put("alarmLog", AlarmScheduler.noteLog(getContext()));
      r.put("playLog", PlaybackService.noteLog(getContext()));
      call.resolve(r);
    } catch (Exception e) { call.reject("Could not read notification state: " + e.getMessage(), e); }
  }

  /** Opens this app's notification settings page, the only place to turn notifications on again after they were refused twice. */
  @PluginMethod
  public void openNotificationSettings(PluginCall call) {
    try {
      android.content.Intent i = new android.content.Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS);
      i.putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
      i.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
      try {
        getContext().startActivity(i);
      } catch (Exception unavailable) {
        android.content.Intent d = new android.content.Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
          android.net.Uri.parse("package:" + getContext().getPackageName()));
        d.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(d);
      }
      call.resolve();
    } catch (Exception e) { call.reject("Could not open settings: " + e.getMessage(), e); }
  }

  /** Keeps the app alive with a quiet notification while a long job runs. */
  @PluginMethod
  public void startWork(PluginCall call) {
    try {
      android.content.Intent i = new android.content.Intent(getContext(), KeepAliveService.class);
      i.putExtra("title", call.getString("title", "HeyTools is working"));
      i.putExtra("text", call.getString("text", ""));
      if (android.os.Build.VERSION.SDK_INT >= 26) getContext().startForegroundService(i);
      else getContext().startService(i);
      call.resolve();
    } catch (Exception e) { call.reject("Could not keep the app running: " + e.getMessage(), e); }
  }

  @PluginMethod
  public void stopWork(PluginCall call) {
    try {
      android.content.Intent i = new android.content.Intent(getContext(), KeepAliveService.class);
      i.setAction(KeepAliveService.ACTION_STOP);
      getContext().startService(i);
    } catch (Exception ignored) {}
    call.resolve();
  }

  /** Lets the person switch background update checks off (Settings > Privacy & data). */
  @PluginMethod
  public void setAutoUpdate(PluginCall call) {
    boolean on = call.getBoolean("enabled", true);
    getContext().getSharedPreferences("heytools_prefs", 0).edit().putBoolean("auto_update", on).apply();
    call.resolve();
  }

  @PluginMethod
  public void getState(PluginCall call) {
    try { call.resolve(AlarmScheduler.getState(getContext())); }
    catch (Exception e) { call.reject("Could not read alarm state: " + e.getMessage(), e); }
  }

  @PluginMethod
  public void cancelAlarms(PluginCall call) {
    try {
      JSONArray ids = call.getData().optJSONArray("ids");
      if (ids == null) ids = new JSONArray();
      AlarmScheduler.cancelIds(getContext(), ids);
      call.resolve();
    } catch (Exception e) { call.reject("Could not cancel alarms: " + e.getMessage(), e); }
  }

  @PluginMethod
  public void snooze(PluginCall call) {
    try {
      int id = call.getInt("id", -1);
      int minutes = Math.max(1, Math.min(60, call.getInt("minutes", 10)));
      if (id < 0) throw new IllegalArgumentException("Missing alarm id");
      AlarmScheduler.snooze(getContext(), id, minutes);
      call.resolve();
    } catch (Exception e) { call.reject("Could not snooze alarm: " + e.getMessage(), e); }
  }

  @PluginMethod
  public void getRinging(PluginCall call) {
    JSObject o = new JSObject();
    o.put("ringing", AlarmRingingService.ringing);
    o.put("id", AlarmRingingService.ringingId);
    o.put("title", AlarmRingingService.ringingTitle);
    o.put("snooze", AlarmRingingService.ringingSnooze);
    call.resolve(o);
  }

  @PluginMethod
  public void stopRinging(PluginCall call) {
    try { getContext().stopService(new android.content.Intent(getContext(), AlarmRingingService.class)); } catch (Exception ignored) {}
    call.resolve();
  }

  @PluginMethod
  public void cancelSnooze(PluginCall call) {
    try {
      int id = call.getInt("id", -1);
      if (id < 0) throw new IllegalArgumentException("Missing alarm id");
      AlarmScheduler.cancelSnooze(getContext(), id);
      call.resolve();
    } catch (Exception e) { call.reject("Could not cancel snooze: " + e.getMessage(), e); }
  }
}
