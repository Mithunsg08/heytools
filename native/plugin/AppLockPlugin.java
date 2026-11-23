package com.heytools.app;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * App lock: asks Android to confirm the phone's own screen lock (fingerprint, face, PIN, pattern or password),
 * exactly as the lock screen does. HeyTools never sees or stores the PIN or the biometric data.
 */
@CapacitorPlugin(name = "AppLock")
public class AppLockPlugin extends Plugin {
  private KeyguardManager km() { return (KeyguardManager) getContext().getSystemService(Context.KEYGUARD_SERVICE); }

  @PluginMethod
  public void isAvailable(PluginCall call) {
    KeyguardManager k = km(); JSObject r = new JSObject();
    r.put("available", k != null && k.isDeviceSecure());
    call.resolve(r);
  }

  @PluginMethod
  public void authenticate(PluginCall call) {
    try {
      KeyguardManager k = km();
      if (k == null || !k.isDeviceSecure()) { call.reject("no_lock"); return; }
      Intent i = k.createConfirmDeviceCredentialIntent(call.getString("title", "HeyTools"), call.getString("subtitle", "Unlock to continue"));
      if (i == null) { call.reject("no_lock"); return; }
      startActivityForResult(call, i, "authResult");
    } catch (Exception e) { call.reject("Could not open the lock screen: " + e.getMessage(), e); }
  }

  @ActivityCallback
  private void authResult(PluginCall call, ActivityResult result) {
    if (call == null) return;
    JSObject r = new JSObject();
    r.put("ok", result != null && result.getResultCode() == Activity.RESULT_OK);
    call.resolve(r);
  }
}
