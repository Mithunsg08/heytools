# Security policy

## Reporting a problem

Please open a private report through GitHub: **Security → Report a vulnerability** on this repository. If that is not available, open an issue that says only "security report" and no details, and the owner will reach out. Please do not post exploit details publicly.

## Safeguards are not a certification

HeyTools uses the safeguards listed below and checks them automatically on every change. **They are safeguards, not a security certification.** HeyTools has not had an independent penetration test, formal audit or third-party certification (for example no ISO 27001, SOC 2 or OWASP MASVS attestation). Passing the automated checks means the listed properties were true when the check ran; it does not prove the app is free of vulnerabilities.

| Safeguard | What it does | What it does not do | Checked by |
|---|---|---|---|
| Content Security Policy (`app/index.html`) | Same-origin scripts only, no `unsafe-inline` for JavaScript, no plugins, restricted framing and base URLs. | Inline styles are still allowed and broad HTTPS connections remain open for streaming and lookup features, so it is not a complete destination allowlist. | `scripts/validate-repo.js` |
| Android cleartext restrictions | `usesCleartextTraffic=false` and a generated Network Security Config that denies plain HTTP and trusts system certificate authorities only. | Does not authenticate the servers that tools contact over HTTPS, or protect against a user-installed root certificate. | `scripts/validate-repo.js`, `native/scripts/patch-android.js` |
| Android backup disabled | `allowBackup=false`, so Android cloud/adb backup does not copy app data. | Does not stop a rooted or unlocked device, or you from exporting a backup yourself. | `scripts/validate-repo.js` |
| Android Keystore primitive | AES-256-GCM key kept in the Android Keystore (`SecureStoragePlugin`), used for the no-password mode and fingerprint/face quick unlock. | Not a hardware-backed guarantee on every phone (depends on the device's Keystore/StrongBox). Someone using your unlocked phone and the app can still see data in no-password mode. | `scripts/test-heysecure.js` (logic with a mocked Keystore) |
| Encrypted storage and backup | AES-256-GCM records; data key wrapped by a PBKDF2-SHA-256 (600,000 rounds) password key; encrypted, authenticated backups with their own password. | Passwords are unrecoverable by design. Does not defend against malware that runs as you or someone who knows the password. | `scripts/test-heysecure.js`, `scripts/test-notifications.js` |
| Dependency audit | `npm audit` for the production dependencies of the Android build. | Only known, published advisories; does not cover vendored libraries or unknown flaws. | `.github/workflows/security.yml` |
| Security source checks | `scripts/security-check.js` scans the source for risky patterns (unpinned or remote scripts, missing hardening). | Pattern matching, not a code audit. It can miss problems and can flag harmless code. | `.github/workflows/security.yml` |

## How HeyTools is built to protect people

- **No accounts or advertising SDKs.** One optional first-party download counter exists, off until the person opts in (`heytools.track.consent`); see the privacy page for exactly what it sends.
- **Private data is encrypted on the device.** Password mode, or no-password mode (device-only key); optional fingerprint/face unlock that can only be turned on with the password. Details: `SECURITY_STORAGE_MIGRATION.md`.
- **No code is fetched from the internet by offline tools.** Fonts and libraries live in `fonts/` and `vendor/` at exact versions. `scripts/validate-repo.js` fails the build if a tool loads Google Fonts, an unpinned library, or (for tools marked offline) any outside script.
- **Android hardening** (`native/scripts/patch-android.js`): backup and cleartext traffic off, boot receiver not exported, WebView debugging off, no legacy shared-storage access, no accessibility service.
- **Updates are only offered, never forced.** The APK must be signed with the same key as the installed app, so Android rejects a tampered file.

## Signing key

Android only installs an update signed with the same key, so losing it forces everyone to reinstall. The key belongs in **GitHub Secrets** (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`), never in the Actions cache, which is readable by visitors of a public repository. Moving an existing cached key is described in [SIGNING.md](SIGNING.md). Keep an offline copy of the key and its password.

## Supply chain

- Pin every dependency to an exact version, and prefer versions that are at least two weeks old.
- Libraries in `vendor/` are listed with their source in `vendor/README.md`. Update them deliberately, then run the validator.
- Tools marked *Needs internet* may load helper code from a CDN (for example Tailwind in Earth ZIP code). Keep those URLs pinned.

## Known limits

- **Anti-Theft Guard cannot stop a hardware force-restart or the power menu.** Android does not let an ordinary app block those without accessibility or device-owner powers, which Play Protect rejects for sideloaded apps. A snatch cannot be detected if the phone is already moving.
- **No-password mode is encryption at rest only.** It protects copied files and backups, not a phone that is unlocked and in someone's hand.
- **Not encrypted:** the video and music library files, alarm times and general preferences.
- A compromised or rooted device, or malicious code running in the app, may expose data while it is unlocked.
- Browser session storage (used for Spotify tokens) is not hardware-backed.
- Forgotten passwords (data or backup) cannot be recovered.
- Public streaming and API services used by some tools (see the privacy page) can see the requests you make to them.
