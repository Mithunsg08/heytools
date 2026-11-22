package com.heytools.app;

import android.app.KeyguardManager;
import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONObject;

/** Page-facing controls for the Charge Guard service. */
@CapacitorPlugin(name = "ChargeGuard")
public class ChargeGuardPlugin extends Plugin {
  private static final String[] SOUNDS = {"wail", "yelp", "police", "beep"};

  private void send(String action) {
    ContextCompat.startForegroundService(getContext(), new Intent(getContext(), ChargeGuardService.class).setAction(action));
  }
  private JSObject settings(SharedPreferences p) {
    JSObject s = new JSObject();
    s.put("delay", p.getInt("delay", 10)); s.put("sound", p.getString("sound", "wail"));
    s.put("trigUnplug", p.getBoolean("trigUnplug", true)); s.put("trigMotion", p.getBoolean("trigMotion", false));
    s.put("sens", p.getInt("sens", 2)); s.put("flash", p.getBoolean("flash", true)); s.put("vibrate", p.getBoolean("vibrate", true));
    s.put("unlockStops", p.getBoolean("unlockStops", true)); s.put("duration", p.getInt("duration", 0));
    s.put("allowInUse", p.getBoolean("allowInUse", true)); s.put("snatch", p.getBoolean("snatch", true)); s.put("snatchSens", p.getInt("snatchSens", 2)); s.put("lockOnAlarm", p.getBoolean("lockOnAlarm", true)); s.put("limit", p.getInt("limit", 0));
    return s;
  }

  @PluginMethod
  public void getState(PluginCall call) {
    Context c = getContext(); SharedPreferences p = ChargeGuardService.sp(c);
    JSObject r = new JSObject();
    boolean wanted = p.getBoolean("armed", false);
    String st = ChargeGuardService.state;
    if (wanted && !ChargeGuardService.running) st = "stopped";
    if (!wanted && !ChargeGuardService.testing) st = "off";
    r.put("state", st); r.put("armed", wanted); r.put("testing", ChargeGuardService.testing);
    r.put("reason", ChargeGuardService.reason); r.put("battery", ChargeGuardService.battery); r.put("plugged", ChargeGuardService.plugged);
    long left = Math.max(0, ChargeGuardService.armAt - System.currentTimeMillis());
    r.put("armIn", st.equals("arming") ? (int) Math.ceil(left / 1000.0) : 0);
    r.put("alarmSince", ChargeGuardService.alarmSince);
    long sa = ChargeGuardService.lastSensorAt;
    r.put("sensorAge", sa == 0 ? -1 : (int) Math.min(600000, System.currentTimeMillis() - sa));
    r.put("peak", Math.round(ChargeGuardService.peakDev * 10) / 10.0);
    ChargeGuardService.peakDev = 0;
    KeyguardManager km = (KeyguardManager) c.getSystemService(Context.KEYGUARD_SERVICE);
    r.put("secure", km != null && km.isDeviceSecure());
    r.put("settings", settings(p));
    DevicePolicyManager dpm = (DevicePolicyManager) c.getSystemService(Context.DEVICE_POLICY_SERVICE);
    r.put("adminActive", dpm != null && dpm.isAdminActive(new ComponentName(c, GuardAdminReceiver.class)));
    call.resolve(r);
  }

  @PluginMethod
  public void configure(PluginCall call) {
    try {
      JSONObject d = call.getData(); SharedPreferences.Editor e = ChargeGuardService.sp(getContext()).edit();
      if (d.has("delay")) e.putInt("delay", Math.max(0, Math.min(120, d.optInt("delay", 10))));
      if (d.has("sound")) { String s = d.optString("sound", "wail"); for (String ok : SOUNDS) if (ok.equals(s)) e.putString("sound", s); }
      if (d.has("snatchSens")) e.putInt("snatchSens", Math.max(1, Math.min(3, d.optInt("snatchSens", 2))));
      if (d.has("sens")) e.putInt("sens", Math.max(1, Math.min(3, d.optInt("sens", 2))));
      if (d.has("duration")) e.putInt("duration", Math.max(0, Math.min(60, d.optInt("duration", 15))));
      if (d.has("limit")) e.putInt("limit", Math.max(0, Math.min(100, d.optInt("limit", 0))));
      String[] flags = {"trigUnplug", "trigMotion", "flash", "vibrate", "unlockStops", "allowInUse", "snatch", "lockOnAlarm"};
      for (String f : flags) if (d.has(f)) e.putBoolean(f, d.optBoolean(f));
      e.apply();
      if (ChargeGuardService.running) send(ChargeGuardService.ACTION_CONFIG);
      call.resolve();
    } catch (Exception ex) { call.reject("Could not save the settings: " + ex.getMessage(), ex); }
  }

  @PluginMethod public void arm(PluginCall call) { try { send(ChargeGuardService.ACTION_ARM); call.resolve(); } catch (Exception e) { call.reject("Could not start the guard: " + e.getMessage(), e); } }
  @PluginMethod public void disarm(PluginCall call) {
    try {
      ChargeGuardService.sp(getContext()).edit().putBoolean("armed", false).apply();
      if (ChargeGuardService.running) send(ChargeGuardService.ACTION_DISARM);
      call.resolve();
    } catch (Exception e) { call.reject("Could not stop the guard: " + e.getMessage(), e); }
  }
  @PluginMethod public void stopAlarm(PluginCall call) { try { if (ChargeGuardService.running) send(ChargeGuardService.ACTION_STOP); call.resolve(); } catch (Exception e) { call.reject(e.getMessage(), e); } }
  /** Opens Android's own "activate device admin" screen so the person can allow screen locking. */
  @PluginMethod public void requestAdmin(PluginCall call) {
    try {
      Intent i = new Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN);
      i.putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, new ComponentName(getContext(), GuardAdminReceiver.class));
      i.putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION, "Lets Charge Guard lock your screen the moment the theft alarm starts. It can do nothing else.");
      if (getActivity() != null) getActivity().startActivity(i); else getContext().startActivity(i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
      call.resolve();
    } catch (Exception e) { call.reject("Could not open the permission screen: " + e.getMessage(), e); }
  }
  /** Gives the permission back, which also lets the app be uninstalled normally. */
  @PluginMethod public void removeAdmin(PluginCall call) {
    try {
      DevicePolicyManager dpm = (DevicePolicyManager) getContext().getSystemService(Context.DEVICE_POLICY_SERVICE);
      if (dpm != null) dpm.removeActiveAdmin(new ComponentName(getContext(), GuardAdminReceiver.class));
      call.resolve();
    } catch (Exception e) { call.reject(e.getMessage(), e); }
  }
  /** Opens HeyTools' own App info page, where "Allow restricted settings" lives for apps installed from outside the Play Store. */
  @PluginMethod public void openAppSettings(PluginCall call) {
    try {
      Intent i = new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS, android.net.Uri.parse("package:" + getContext().getPackageName())).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      getContext().startActivity(i); call.resolve();
    } catch (Exception e) { call.reject("Could not open App info: " + e.getMessage(), e); }
  }
  @PluginMethod public void test(PluginCall call) { try { send(ChargeGuardService.ACTION_TEST); call.resolve(); } catch (Exception e) { call.reject("Could not start the test: " + e.getMessage(), e); } }

  @PluginMethod
  public void getLog(PluginCall call) { JSObject r = new JSObject(); r.put("log", ChargeGuardService.sp(getContext()).getString("log", "")); call.resolve(r); }
  @PluginMethod
  public void clearLog(PluginCall call) { ChargeGuardService.sp(getContext()).edit().remove("log").apply(); call.resolve(); }
}
