# Live Storage Encryption Migration — Audit and Plan

Status: audit completed; implementation not yet enabled.

## Scope found on main

### WebView / same-origin localStorage
The repository has 31 matching source files using localStorage. The sensitive or user-created data paths include:
- Notes and to-dos: `notes-to-do-list/index.html`
- Expenses: `expense-tracker/index.html`
- Habits: `habit-tracker/index.html`
- Alarms and alarm UI state: `alarm-clock/index.html`
- Water, focus, countdown timers, breathing sessions, split bills, tally counter and spin-wheel history
- Geo Camera preferences: `geo-camera/index.html`
- Recorder settings and pending screen-recording handoff: `recorder/index.html`
- Video Player preferences/history: `video-player/index.html`
- Music Player preferences/library metadata: `music-player/index.html`
- App preferences, layout, recent tools, permissions, backup/restore and diagnostic logs: `app/app.js`
- Notification preferences: `heynotify.js`
- Install prompt dismissal and optional anonymous install/download telemetry: `install-prompt.js`, `heytrack.js`

Some keys are operational preferences or transient handoff state rather than user content. They must be classified individually; encrypting every key indiscriminately could break startup, notification handoff, or telemetry consent.

### IndexedDB
The current source identifies separate stores/databases:
- `hushbloom`: Recorder media blobs
- `geocam`: Geo Camera photo gallery records
- `vp3`: Video Player library, saved copies, channels and captions
- `music-player`: Music Player imported audio files

These contain binary media or structured metadata and cannot be considered protected by an encrypted localStorage implementation. The actual record schemas and blob sizes must be handled in their owning tools.

### Android native storage
- `AlarmScheduler.java` stores alarm schedules in `heytools_native_alarms` using a **device-protected storage context**. Android can read this before the first unlock after reboot, which is part of the current alarm-resilience design.
- Alarm event logs, playback logs, update preferences and update-notification state also use SharedPreferences.
- Native alarm schedules must not be moved behind a credential-protected Keystore key unless direct-boot behavior is explicitly preserved. A safe design should keep only the minimum boot-required scheduling metadata available to the boot receiver and protect any additional sensitive fields separately.

## Required design constraints

1. Use Android Keystore AES-GCM keys for Android-private application data. Do not export the key to JavaScript.
2. Use a separate WebCrypto key strategy for browser/PWA installs; browser storage encryption is defense-in-depth, not hardware-backed.
3. Replace synchronous localStorage access for protected records with an asynchronous repository and refactor every consumer to await initialization/read/write. Do not add a synchronous JavaScript bridge for encryption: Android JavaScript interfaces are exposed to frames and do not provide reliable per-frame origin isolation.
4. Encrypt IndexedDB payloads (including media blobs) before persistence, with random nonces and authenticated record metadata. Do not claim external Gallery/MediaStore files are encrypted by HeyTools.
5. Preserve alarm scheduling, reboot rescheduling, one-off/repeating alarms, snooze and ring delivery. Keep the minimum data required for direct-boot scheduling available to the receiver.
6. Preserve encrypted backup/restore and make it export/import through the secure repository, rather than reading raw localStorage keys.
7. Fail closed for protected writes if encryption is unavailable; never silently fall back to plaintext. Provide a clear recovery/error path.
8. Test on Android WebView and browser/PWA separately. Run JavaScript checks, native Android build, storage migration tests, and alarm reboot/direct-boot regression tests before release.

## Implementation order

1. Add a native Keystore-backed encryption plugin and browser WebCrypto adapter behind one asynchronous secure-storage API.
2. Add versioned encrypted IndexedDB storage and transaction-safe migration helpers.
3. Migrate core user content first (notes/to-dos, expenses, habits, trackers and app-owned preferences), then each tool's records and media.
4. Handle Android alarm schedule metadata separately, preserving device-protected boot behavior.
5. Update backup/restore, delete-all-data, privacy disclosures and security regression checks.
6. Verify all tools, alarm delivery after app termination/reboot, and media playback/recording flows. Publish only after CI and device tests pass.

## Important limitation

This audit is based on source inspection, not a penetration test or independent security certification. Android's app sandbox and device encryption already protect app-private files at rest; application-managed encryption is additional defense-in-depth and does not protect against a compromised running app, malicious same-origin script, rooted device, or an unlocked device being used by an attacker.
