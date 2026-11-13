# HeyTools for Android

This folder turns the HeyTools website into a real Android app (APK) using Capacitor.
The app can read every video and song on the phone, which a normal website is not allowed to do.

## Get the APK (no computer setup needed)
1. On GitHub open the **Actions** tab, choose **Build Android app**, then **Run workflow**.
   (It also runs by itself on every push to `main`.)
2. After about 5 minutes open **Releases**, then **HeyTools for Android (latest)**.
3. Download `HeyTools.apk` on your phone and open it. Allow **Install unknown apps** when Android asks.

## How it works
- `scripts/prepare-web.js` copies the website into the app.
- `plugin/MediaLibraryPlugin.java` asks Android for video/music access and lists the files (MediaStore).
- `scripts/patch-android.js` adds the permissions, the plugin and the icon to the generated project.
- Inside the app, `app/native.js` talks to the plugin and hands the files to the Video Player and Music Player.

The app is a debug build, signed with a debug key, so it is for installing on your own phone.
