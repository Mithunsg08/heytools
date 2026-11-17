#!/usr/bin/env bash
set -euo pipefail

APK="native/android/app/build/outputs/apk/debug/app-debug.apk"
adb install -r "$APK"
adb shell appops set com.heytools.app SCHEDULE_EXACT_ALARM allow
adb shell pm grant com.heytools.app android.permission.POST_NOTIFICATIONS || true
adb logcat -c

if ! (cd native/android && ./gradlew connectedDebugAndroidTest --no-daemon); then
  echo "Instrumentation failed; collecting emulator diagnostics."
  adb logcat -d -v threadtime > android-instrumentation-logcat.txt || true
  mkdir -p android-test-diagnostics
  find native/android/app/build/outputs native/android/app/build/reports -type f \\( -name '*.xml' -o -name '*.txt' -o -name '*.html' \\) -exec cp --parents {} android-test-diagnostics/ \\; 2>/dev/null || true
  exit 1
fi

adb shell appops set com.heytools.app SCHEDULE_EXACT_ALARM allow
adb shell pm grant com.heytools.app android.permission.POST_NOTIFICATIONS || true
adb shell am force-stop com.heytools.app
adb shell monkey -p com.heytools.app 1
sleep 25
adb shell dumpsys activity activities | grep -E 'mResumedActivity|topResumedActivity' | grep -q 'com.heytools.app'
adb shell uiautomator dump /sdcard/window.xml >/dev/null
adb shell cat /sdcard/window.xml | grep -q 'HeyTools'

if adb logcat -d -t 5000 | grep -E 'FATAL EXCEPTION.*main|Process: com.heytools.app'; then
  echo "HeyTools crashed during Android 16 launch smoke test."
  exit 1
fi

echo "Android 16 install, exact-alarm instrumentation, launch and UI checks passed."
