# Security policy

## Reporting a problem

Please open a private report through GitHub: **Security → Report a vulnerability** on this repository. If that is not available, open an issue that says only "security report" and no details, and the owner will reach out. Please do not post exploit details publicly.

## How HeyTools is built to protect people

- **No accounts, no ads, no third-party analytics code.** Data stays in on-device storage.
- **Optional anonymous counts are opt-in** (`heytools.track.consent`) and send nothing until the person turns them on. The endpoint is configured in `track-config.js` and is empty by default.
- **No code is fetched from the internet by offline tools.** Fonts and libraries live in `fonts/` and `vendor/` at exact versions. `scripts/validate-repo.js` fails the build if a tool loads Google Fonts, an unpinned library, or (for tools marked offline) any outside script.
- **Android hardening** (see `native/scripts/patch-android.js`): `allowBackup=false` (no cloud or adb copy of app data), `usesCleartextTraffic=false`, the boot receiver is not exported, WebView debugging is off, and only the permissions listed on the privacy page are requested.
- **Backups are validated.** A backup file never contains login tokens or install ids, and a restored file is limited to plain text values under safe key names and a fixed size.
- **Updates are only offered, never forced.** The APK must be signed with the same key as the installed app, so Android rejects a tampered file.
- The app shell has a Content-Security-Policy (`app/index.html`) that blocks plugins, restricts framing and base URLs, and only allows the app's own scripts.

## Signing key (important)

Android updates only install if they are signed with the same key. Losing the key means every user must uninstall and reinstall.

1. Create repository secrets `ANDROID_KEYSTORE_BASE64` and `ANDROID_KEYSTORE_PASSWORD` (Settings → Secrets and variables → Actions).
2. Keep an offline copy of the keystore and its password (for example in a password manager).
3. Do not rely on the workflow cache for the key: caches can be evicted.

## Supply chain

- Pin every dependency to an exact version, and prefer versions that are at least two weeks old.
- Libraries in `vendor/` are listed with their source in `vendor/README.md`. Update them deliberately, then run the validator.
- Tools marked *Needs internet* may load helper code from a CDN (for example Tailwind in Earth ZIP code). Keep those URLs pinned.

## Known limits

- Notes and trackers are stored unencrypted in the app's private storage. Anyone who can unlock the phone or has root access can read them. Use a screen lock.
- Public streaming and API services used by some tools (see the privacy page) can see the requests you make to them.
