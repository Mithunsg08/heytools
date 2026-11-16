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
      JSONArray alarms = call.getArray("alarms", new JSONArray());
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
  public void getState(PluginCall call) {
    try { call.resolve(AlarmScheduler.getState(getContext())); }
    catch (Exception e) { call.reject("Could not read alarm state: " + e.getMessage(), e); }
  }

  @PluginMethod
  public void cancelAlarms(PluginCall call) {
    try {
      AlarmScheduler.cancelIds(getContext(), call.getArray("ids", new JSONArray()));
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
}
