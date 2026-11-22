package com.heytools.app;

import android.app.KeyguardManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraManager;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioTrack;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import androidx.core.app.NotificationCompat;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Charge Guard: while the phone charges, a loud alarm rings if the charger is pulled out (or the phone is moved).
 * The alarm stops when the screen is unlocked. Runs as a foreground service because Android does not deliver
 * plug and unplug broadcasts to apps that are not running.
 */
public class ChargeGuardService extends Service implements SensorEventListener {
  static final String ACTION_ARM = "com.heytools.GUARD_ARM";
  static final String ACTION_DISARM = "com.heytools.GUARD_DISARM";
  static final String ACTION_STOP = "com.heytools.GUARD_STOP";
  static final String ACTION_TEST = "com.heytools.GUARD_TEST";
  static final String ACTION_CONFIG = "com.heytools.GUARD_CONFIG";
  static final String ACTION_TAMPER = "com.heytools.GUARD_TAMPER";
  static final String ACTION_BOOT = "com.heytools.GUARD_BOOT";
  static final String PREFS = "heytools_guard";
  private static final String CH_STATUS = "heytools_guard_status", CH_ALERT = "heytools_guard_alert", CH_LIMIT = "heytools_guard_limit";
  private static final int NID = 83001, NID_LIMIT = 83002;

  /** Read by the plugin so the page can show what the guard is doing. */
  static volatile String state = "off";   // off | waiting | arming | armed | alarm
  static volatile String reason = "";
  static volatile long armAt = 0, alarmSince = 0;
  static volatile int battery = -1;
  static volatile boolean plugged = false, running = false, testing = false;

  /** Device-protected storage, so the guard can read its settings right after a restart, before the phone is unlocked. */
  static SharedPreferences sp(Context c) {
    Context d = c;
    if (Build.VERSION.SDK_INT >= 24) { try { d = c.createDeviceProtectedStorageContext(); } catch (Exception ignored) { } }
    return d.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
  }

  /** Event log kept on the device (last 60 lines). */
  static synchronized void note(Context c, String text) {
    try {
      SharedPreferences p = sp(c);
      String line = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(new Date()) + "  " + text;
      String[] old = p.getString("log", "").split("\n");
      StringBuilder sb = new StringBuilder();
      int from = Math.max(0, old.length - 59);
      for (int i = from; i < old.length; i++) if (!old[i].isEmpty()) sb.append(old[i]).append('\n');
      sb.append(line);
      p.edit().putString("log", sb.toString()).apply();
    } catch (Exception ignored) { }
  }

  private final Handler h = new Handler(Looper.getMainLooper());
  private PowerManager.WakeLock wake;
  private SensorManager sensors;
  private boolean motionOn = false, limitFired = false, flashOn = false, rxOn = false, startedLocked = false;
  private long armedSince = 0, lastHit = 0;
  private int hits = 0;
  private double lastMag = -1;
  private int origVolume = -1;
  private volatile boolean sirenOn = false;
  private Thread siren;
  private String cameraId = null;
  private Vibrator vibrator;
  private int lastNotifBattery = -2;

  @Override public IBinder onBind(Intent i) { return null; }

  @Override public void onCreate() {
    super.onCreate();
    running = true;
    NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
    if (Build.VERSION.SDK_INT >= 26 && nm != null) {
      NotificationChannel st = new NotificationChannel(CH_STATUS, "Charge Guard status", NotificationManager.IMPORTANCE_LOW);
      st.setDescription("Shows that Charge Guard is watching the charger"); st.setShowBadge(false);
      nm.createNotificationChannel(st);
      NotificationChannel al = new NotificationChannel(CH_ALERT, "Charge Guard alarm", NotificationManager.IMPORTANCE_HIGH);
      al.setDescription("Shown while the guard alarm is ringing"); al.setSound(null, null); al.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
      nm.createNotificationChannel(al);
      NotificationChannel lm = new NotificationChannel(CH_LIMIT, "Charge limit", NotificationManager.IMPORTANCE_DEFAULT);
      lm.setDescription("Tells you when the battery reaches your chosen level");
      nm.createNotificationChannel(lm);
    }
    IntentFilter f = new IntentFilter();
    f.addAction(Intent.ACTION_POWER_CONNECTED); f.addAction(Intent.ACTION_POWER_DISCONNECTED);
    f.addAction(Intent.ACTION_USER_PRESENT);
    try { registerReceiver(rx, f); rxOn = true; } catch (Exception e) { note(this, "could not listen for the charger: " + e); }
    /* the battery broadcast is sticky: this also gives the current level and plug state straight away */
    try { Intent b = registerReceiver(batteryRx, new IntentFilter(Intent.ACTION_BATTERY_CHANGED)); if (b != null) readBattery(b, false); } catch (Exception ignored) { }
    sensors = (SensorManager) getSystemService(SENSOR_SERVICE);
    vibrator = (Vibrator) getSystemService(VIBRATOR_SERVICE);
  }

  @Override public int onStartCommand(Intent intent, int flags, int startId) {
    try {
      Notification n = statusNotification();
      if (Build.VERSION.SDK_INT >= 34) startForeground(NID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
      else startForeground(NID, n);
    } catch (Exception e) { note(this, "could not start in the background: " + e); stopSelf(); return START_NOT_STICKY; }
    String a = intent == null ? null : intent.getAction();
    if (a == null) { if (sp(this).getBoolean("armed", false)) arm(); else stopSelfClean(); return START_STICKY; }
    switch (a) {
      case ACTION_ARM: arm(); break;
      case ACTION_DISARM: disarm(); break;
      case ACTION_STOP: if (state.equals("alarm") || testing) stopAlarm("Stopped from the app"); break;
      case ACTION_TEST: startTest(); break;
      case ACTION_CONFIG: applyConfig(); break;
      case ACTION_TAMPER: if (state.equals("armed") || state.equals("arming")) trigger("Someone tried to switch the phone off"); break;
      case ACTION_BOOT:
        if (sp(this).getBoolean("armed", false)) { note(this, "Phone restarted while the guard was on"); trigger("Phone was switched off or restarted"); }
        else stopSelfClean();
        break;
      default: break;
    }
    return START_STICKY;
  }

  /* ---------- state machine ---------- */
  private void arm() {
    if (running && (state.equals("armed") || state.equals("arming") || state.equals("alarm")) && sp(this).getBoolean("armed", false)) return;   // already guarding
    sp(this).edit().putBoolean("armed", true).apply();
    note(this, "Guard turned on (battery " + battery + "%, " + (plugged ? "charging" : "not charging") + ")");
    if (plugged) startArming(); else setState("waiting");
  }
  private void startArming() {
    int d = sp(this).getInt("delay", 10);
    h.removeCallbacks(armedRunnable);
    if (d <= 0) { setState("armed"); note(this, "Armed"); return; }
    armAt = System.currentTimeMillis() + d * 1000L;
    setState("arming");
    h.postDelayed(armedRunnable, d * 1000L);
  }
  private final Runnable armedRunnable = new Runnable() { @Override public void run() {
    if (!state.equals("arming")) return;
    if (plugged || !sp(ChargeGuardService.this).getBoolean("trigUnplug", true)) { setState("armed"); note(ChargeGuardService.this, "Armed"); }
    else setState("waiting");
  } };
  private void disarm() {
    sp(this).edit().putBoolean("armed", false).apply();
    stopOutputs(); h.removeCallbacksAndMessages(null);
    note(this, "Guard turned off");
    state = "off"; reason = ""; setMotion(false);
    stopSelfClean();
  }
  private void stopSelfClean() {
    state = "off";
    try { stopForeground(true); } catch (Exception ignored) { }
    stopSelf();
  }
  private void setState(String s) {
    state = s;
    if (s.equals("armed")) { armedSince = System.currentTimeMillis(); hits = 0; lastMag = -1; }
    setMotion(s.equals("armed") && sp(this).getBoolean("trigMotion", false));
    refreshNotification();
  }
  private void applyConfig() {
    setMotion(state.equals("armed") && sp(this).getBoolean("trigMotion", false));
    refreshNotification();
  }

  private final Runnable checkUnplug = new Runnable() { @Override public void run() {
    if (readPlugged()) return;                       // a flicker, the cable is back
    plugged = false;
    if (state.equals("arming")) { setState("waiting"); return; }
    if (!state.equals("armed") || !sp(ChargeGuardService.this).getBoolean("trigUnplug", true)) return;
    if (sp(ChargeGuardService.this).getBoolean("allowInUse", true) && inUse()) {
      note(ChargeGuardService.this, "Charger removed while the phone was in use: no alarm");
      setState("waiting"); return;
    }
    trigger("Charger unplugged");
  } };

  private boolean inUse() {
    PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
    KeyguardManager km = (KeyguardManager) getSystemService(KEYGUARD_SERVICE);
    return pm != null && km != null && pm.isInteractive() && !km.isKeyguardLocked();
  }

  private final BroadcastReceiver rx = new BroadcastReceiver() { @Override public void onReceive(Context c, Intent i) {
    String a = i.getAction(); if (a == null) return;
    if (Intent.ACTION_POWER_CONNECTED.equals(a)) {
      plugged = true; h.removeCallbacks(checkUnplug);
      note(c, "Charger connected");
      if (state.equals("waiting")) startArming();
    } else if (Intent.ACTION_POWER_DISCONNECTED.equals(a)) {
      plugged = false; note(c, "Charger disconnected");
      h.removeCallbacks(checkUnplug); h.postDelayed(checkUnplug, 1000);
    } else if (Intent.ACTION_USER_PRESENT.equals(a)) {
      if (state.equals("alarm") && sp(c).getBoolean("unlockStops", true) && System.currentTimeMillis() - alarmSince > 1500) stopAlarm("Stopped: phone unlocked");
    }
  } };
  private final BroadcastReceiver batteryRx = new BroadcastReceiver() { @Override public void onReceive(Context c, Intent i) { readBattery(i, true); } };

  private boolean readPlugged() {
    try { Intent b = registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED)); return b != null && b.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) != 0; }
    catch (Exception e) { return plugged; }
  }
  private void readBattery(Intent b, boolean live) {
    int level = b.getIntExtra(BatteryManager.EXTRA_LEVEL, -1), scale = b.getIntExtra(BatteryManager.EXTRA_SCALE, 100);
    if (level >= 0 && scale > 0) battery = Math.round(level * 100f / scale);
    boolean p = b.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) != 0;
    if (!live) plugged = p;
    int limit = sp(this).getInt("limit", 0);
    if (limit > 0 && p && battery >= limit && !limitFired) {
      limitFired = true; note(this, "Battery reached " + battery + "%");
      NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
      if (nm != null) nm.notify(NID_LIMIT, new NotificationCompat.Builder(this, CH_LIMIT).setSmallIcon(icon())
        .setContentTitle("Battery at " + battery + "%").setContentText("Unplug the charger to protect the battery.")
        .setContentIntent(openApp()).setAutoCancel(true).setCategory(NotificationCompat.CATEGORY_STATUS).build());
    } else if (!p || (limit > 0 && battery < limit - 1)) limitFired = false;
    if (battery != lastNotifBattery && !state.equals("alarm")) { lastNotifBattery = battery; if (!state.equals("off")) refreshNotification(); }
  }

  /* ---------- alarm ---------- */
  private void trigger(String why) {
    if (state.equals("alarm")) return;
    reason = why; alarmSince = System.currentTimeMillis();
    KeyguardManager km = (KeyguardManager) getSystemService(KEYGUARD_SERVICE);
    startedLocked = km != null && km.isKeyguardLocked();
    setState("alarm");
    note(this, "ALARM: " + why + " (battery " + battery + "%)");
    startOutputs();
    int mins = sp(this).getInt("duration", 15);
    h.removeCallbacks(timeoutRunnable);
    h.postDelayed(timeoutRunnable, (mins <= 0 ? 60 : mins) * 60 * 1000L);
  }
  private final Runnable timeoutRunnable = new Runnable() { @Override public void run() { if (state.equals("alarm")) stopAlarm("Stopped: time limit reached"); } };

  private void startTest() {
    if (state.equals("alarm") || testing) return;
    testing = true; reason = "Test"; alarmSince = System.currentTimeMillis();
    startOutputs();
    note(this, "Test alarm started");
    h.postDelayed(new Runnable() { @Override public void run() { if (testing) stopAlarm("Test finished"); } }, 6000);
  }

  private void stopAlarm(String why) {
    h.removeCallbacks(timeoutRunnable);
    stopOutputs();
    note(this, why);
    if (testing) {
      testing = false;
      if (state.equals("off") && !sp(this).getBoolean("armed", false)) { stopSelfClean(); return; }
      refreshNotification(); return;
    }
    if (sp(this).getBoolean("armed", false)) { if (plugged) startArming(); else setState("waiting"); }
    else stopSelfClean();
  }

  private void startOutputs() {
    PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
    if (pm != null && (wake == null || !wake.isHeld())) { wake = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "HeyTools:Guard"); wake.acquire(65 * 60 * 1000L); }
    forceVolume();
    h.removeCallbacks(volumeLock); h.postDelayed(volumeLock, 400);
    startSiren(sp(this).getString("sound", "wail"));
    if (sp(this).getBoolean("flash", true)) { h.removeCallbacks(flashRunnable); h.post(flashRunnable); }
    if (sp(this).getBoolean("vibrate", true)) vibrate(true);
    if (!testing) alertNotification();
  }
  private void stopOutputs() {
    h.removeCallbacks(volumeLock); h.removeCallbacks(flashRunnable);
    stopSiren(); torch(false); flashOn = false; vibrate(false);
    try { AudioManager am = (AudioManager) getSystemService(AUDIO_SERVICE); if (am != null && origVolume >= 0) am.setStreamVolume(AudioManager.STREAM_ALARM, origVolume, 0); } catch (Exception ignored) { }
    origVolume = -1;
    NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
    if (nm != null) nm.cancel(NID + 1);
    if (wake != null && wake.isHeld()) { try { wake.release(); } catch (Exception ignored) { } }
  }

  /** A thief can turn the volume down: keep the alarm stream at maximum while ringing. */
  private void forceVolume() {
    try {
      AudioManager am = (AudioManager) getSystemService(AUDIO_SERVICE); if (am == null) return;
      if (origVolume < 0) origVolume = am.getStreamVolume(AudioManager.STREAM_ALARM);
      am.setStreamVolume(AudioManager.STREAM_ALARM, am.getStreamMaxVolume(AudioManager.STREAM_ALARM), 0);
    } catch (Exception ignored) { }
  }
  private final Runnable volumeLock = new Runnable() { @Override public void run() {
    if (!sirenOn) return; forceVolume(); h.postDelayed(this, 400);
  } };

  private void startSiren(final String kind) {
    stopSiren();
    sirenOn = true;
    siren = new Thread(new Runnable() { @Override public void run() {
      AudioTrack track = null;
      try {
        final int rate = 22050;
        int min = AudioTrack.getMinBufferSize(rate, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT);
        track = new AudioTrack(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build(),
          new AudioFormat.Builder().setSampleRate(rate).setEncoding(AudioFormat.ENCODING_PCM_16BIT).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build(),
          Math.max(min, rate / 2), AudioTrack.MODE_STREAM, AudioManager.AUDIO_SESSION_ID_GENERATE);
        track.play();
        short[] buf = new short[1024];
        double phase = 0; long n = 0;
        while (sirenOn) {
          for (int i = 0; i < buf.length; i++, n++) {
            double t = n / (double) rate, f, gate = 1;
            switch (kind) {
              case "yelp": f = 600 + 900 * ((t % 0.3) / 0.3); break;
              case "police": f = (((long) (t / 0.4)) % 2 == 0) ? 960 : 770; break;
              case "beep": f = 2300; gate = (t % 0.4) < 0.2 ? 1 : 0; break;
              default: { double u = (t % 1.6) / 1.6; f = 650 + 800 * (u < 0.5 ? u * 2 : 2 - u * 2); }
            }
            phase += 2 * Math.PI * f / rate;
            double v = Math.sin(phase) * 1.7 * gate;          // pushed into clipping for a harsher, louder tone
            if (v > 1) v = 1; else if (v < -1) v = -1;
            buf[i] = (short) (v * 32000);
          }
          track.write(buf, 0, buf.length);
        }
      } catch (Throwable e) { note(ChargeGuardService.this, "siren failed: " + e); }
      finally { if (track != null) { try { track.stop(); } catch (Exception ignored) { } try { track.release(); } catch (Exception ignored) { } } }
    } }, "guard-siren");
    siren.start();
  }
  private void stopSiren() { sirenOn = false; siren = null; }

  private final Runnable flashRunnable = new Runnable() { @Override public void run() {
    if (!state.equals("alarm") && !testing) return;
    flashOn = !flashOn; torch(flashOn); h.postDelayed(this, 180);
  } };
  private void torch(boolean on) {
    try {
      CameraManager cm = (CameraManager) getSystemService(CAMERA_SERVICE); if (cm == null) return;
      if (cameraId == null) for (String id : cm.getCameraIdList()) {
        Boolean has = cm.getCameraCharacteristics(id).get(CameraCharacteristics.FLASH_INFO_AVAILABLE);
        if (has != null && has) { cameraId = id; break; }
      }
      if (cameraId != null) cm.setTorchMode(cameraId, on);
    } catch (Exception ignored) { }
  }
  @SuppressWarnings("deprecation")
  private void vibrate(boolean on) {
    try {
      if (vibrator == null) return;
      if (!on) { vibrator.cancel(); return; }
      long[] p = {0, 700, 250};
      if (Build.VERSION.SDK_INT >= 26) vibrator.vibrate(VibrationEffect.createWaveform(p, 0)); else vibrator.vibrate(p, 0);
    } catch (Exception ignored) { }
  }

  /* ---------- motion ---------- */
  private void setMotion(boolean on) {
    if (sensors == null || on == motionOn) return;
    try {
      if (on) {
        Sensor acc = sensors.getDefaultSensor(Sensor.TYPE_ACCELEROMETER); if (acc == null) return;
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        if (pm != null && (wake == null || !wake.isHeld())) { wake = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "HeyTools:Guard"); wake.acquire(); }
        sensors.registerListener(this, acc, SensorManager.SENSOR_DELAY_NORMAL); motionOn = true;
      } else {
        sensors.unregisterListener(this); motionOn = false;
        if (!state.equals("alarm") && !testing && wake != null && wake.isHeld()) { try { wake.release(); } catch (Exception ignored) { } }
      }
    } catch (Exception e) { note(this, "motion sensor: " + e); }
  }
  @Override public void onSensorChanged(SensorEvent e) {
    if (!state.equals("armed")) return;
    long now = System.currentTimeMillis();
    if (now - armedSince < 3000) { lastMag = -1; return; }           // let the phone settle after arming
    double mag = Math.sqrt(e.values[0] * e.values[0] + e.values[1] * e.values[1] + e.values[2] * e.values[2]);
    if (lastMag < 0) { lastMag = mag; return; }
    int sens = sp(this).getInt("sens", 2);
    double limit = sens >= 3 ? 0.6 : (sens <= 1 ? 2.2 : 1.2);
    if (Math.abs(mag - lastMag) > limit) {
      if (now - lastHit > 1500) hits = 0;
      hits++; lastHit = now;
      if (hits >= 2) { hits = 0; trigger("Phone was moved"); }
    }
    lastMag = mag;
  }
  @Override public void onAccuracyChanged(Sensor s, int a) { }

  /* ---------- notifications ---------- */
  private int icon() { int i = getResources().getIdentifier("ic_stat_hey", "drawable", getPackageName()); return i == 0 ? android.R.drawable.ic_lock_lock : i; }
  private PendingIntent openApp() {
    Intent i = getPackageManager().getLaunchIntentForPackage(getPackageName());
    if (i == null) i = new Intent();
    return PendingIntent.getActivity(this, 0, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
  }
  private Notification statusNotification() {
    String s = state, text;
    if (s.equals("armed")) text = "Guarding" + (battery >= 0 ? " · battery " + battery + "%" : "") + ". Unplugging sets off the alarm.";
    else if (s.equals("arming")) text = "Getting ready. Guard starts in a few seconds.";
    else if (s.equals("alarm")) text = "ALARM: " + reason;
    else text = "Waiting for you to plug in the charger.";
    return new NotificationCompat.Builder(this, CH_STATUS).setSmallIcon(icon()).setContentTitle("Charge Guard")
      .setContentText(text).setOngoing(true).setOnlyAlertOnce(true).setContentIntent(openApp())
      .setVisibility(NotificationCompat.VISIBILITY_PRIVATE).setCategory(NotificationCompat.CATEGORY_SERVICE).build();
  }
  private void refreshNotification() {
    NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
    if (nm != null) try { nm.notify(NID, statusNotification()); } catch (Exception ignored) { }
  }
  private void alertNotification() {
    NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE); if (nm == null) return;
    NotificationCompat.Builder b = new NotificationCompat.Builder(this, CH_ALERT).setSmallIcon(icon())
      .setContentTitle("Charge Guard alarm").setContentText(reason + ". Unlock the phone to stop it.")
      .setCategory(NotificationCompat.CATEGORY_ALARM).setPriority(NotificationCompat.PRIORITY_MAX)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC).setOngoing(true).setContentIntent(openApp());
    /* a Stop button only when the phone was already unlocked: on a locked phone, unlocking is the only way to stop it */
    if (!startedLocked) {
      Intent stop = new Intent(this, ChargeGuardService.class).setAction(ACTION_STOP);
      PendingIntent pi = PendingIntent.getService(this, 1, stop, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
      b.addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop", pi);
    }
    nm.notify(NID + 1, b.build());
  }

  @Override public void onDestroy() {
    running = false;
    stopOutputs(); h.removeCallbacksAndMessages(null); setMotion(false);
    if (rxOn) { try { unregisterReceiver(rx); } catch (Exception ignored) { } }
    try { unregisterReceiver(batteryRx); } catch (Exception ignored) { }
    if (wake != null && wake.isHeld()) { try { wake.release(); } catch (Exception ignored) { } }
    if (!sp(this).getBoolean("armed", false)) state = "off";
    super.onDestroy();
  }
}
