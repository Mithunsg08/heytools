package com.heytools.app;

import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.SecureRandom;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Android Keystore-backed AES-256-GCM for small structured WebView records.
 * This plugin deliberately does not expose key material to JavaScript.
 * Large media blobs need a streaming native implementation, not this string API.
 */
@CapacitorPlugin(name = "SecureStorage")
public final class SecureStoragePlugin extends Plugin {
  private static final String STORE = "AndroidKeyStore";
  private static final String ALIAS = "com.heytools.app.secure-storage.v1";
  private static final String TRANSFORMATION = "AES/GCM/NoPadding";
  private static final int NONCE_BYTES = 12;
  private static final int TAG_BITS = 128;
  private static final int MAX_PLAINTEXT_BYTES = 1024 * 1024;

  private static SecretKey getOrCreateKey() throws Exception {
    KeyStore store = KeyStore.getInstance(STORE);
    store.load(null);
    if (store.containsAlias(ALIAS)) {
      java.security.Key key = store.getKey(ALIAS, null);
      if (key instanceof SecretKey) return (SecretKey) key;
      throw new IllegalStateException("Secure storage key is unavailable");
    }
    KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, STORE);
    generator.init(new KeyGenParameterSpec.Builder(
      ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
      .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
      .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
      .setKeySize(256)
      .setRandomizedEncryptionRequired(true)
      .build());
    return generator.generateKey();
  }

  private static byte[] aad(String recordKey) {
    return ("heytools-secure-record-v1:" + recordKey).getBytes(StandardCharsets.UTF_8);
  }

  private static boolean validRecordKey(String key) {
    return key != null && key.matches("[A-Za-z0-9_.:-]{1,120}");
  }

  @PluginMethod
  public void encrypt(PluginCall call) {
    try {
      String recordKey = call.getString("key", "");
      String plaintext = call.getString("value", null);
      if (!validRecordKey(recordKey) || plaintext == null) {
        call.reject("A valid record key and value are required");
        return;
      }
      byte[] input = plaintext.getBytes(StandardCharsets.UTF_8);
      if (input.length > MAX_PLAINTEXT_BYTES) {
        call.reject("Secure record is too large; use encrypted file storage");
        return;
      }
      byte[] nonce = new byte[NONCE_BYTES];
      new SecureRandom().nextBytes(nonce);
      Cipher cipher = Cipher.getInstance(TRANSFORMATION);
      cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey(), new GCMParameterSpec(TAG_BITS, nonce));
      cipher.updateAAD(aad(recordKey));
      byte[] encrypted = cipher.doFinal(input);
      JSObject result = new JSObject();
      result.put("v", 1);
      result.put("alg", "A256GCM");
      result.put("iv", Base64.encodeToString(nonce, Base64.NO_WRAP));
      result.put("data", Base64.encodeToString(encrypted, Base64.NO_WRAP));
      call.resolve(result);
    } catch (Exception error) {
      call.reject("Could not encrypt this record", error);
    }
  }

  @PluginMethod
  public void decrypt(PluginCall call) {
    try {
      String recordKey = call.getString("key", "");
      JSObject envelope = call.getObject("envelope");
      if (!validRecordKey(recordKey) || envelope == null ||
          envelope.optInt("v", -1) != 1 || !"A256GCM".equals(envelope.optString("alg"))) {
        call.reject("Invalid encrypted record");
        return;
      }
      byte[] nonce = Base64.decode(envelope.getString("iv"), Base64.NO_WRAP);
      byte[] encrypted = Base64.decode(envelope.getString("data"), Base64.NO_WRAP);
      if (nonce.length != NONCE_BYTES || encrypted.length < 16 ||
          encrypted.length > MAX_PLAINTEXT_BYTES + 16) {
        call.reject("Invalid encrypted record size");
        return;
      }
      Cipher cipher = Cipher.getInstance(TRANSFORMATION);
      cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), new GCMParameterSpec(TAG_BITS, nonce));
      cipher.updateAAD(aad(recordKey));
      byte[] plaintext = cipher.doFinal(encrypted);
      JSObject result = new JSObject();
      result.put("value", new String(plaintext, StandardCharsets.UTF_8));
      call.resolve(result);
    } catch (Exception error) {
      call.reject("Could not decrypt this record; it may be damaged or the device key may have changed", error);
    }
  }
}
