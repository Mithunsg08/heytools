# Android signing key

The Android app must always be signed with the **same** key, otherwise phones that already have HeyTools
refuse to update it. The expected certificate fingerprint (SHA-256) is pinned in
`.github/workflows/android.yml`:

```
321beac46b1dbb353c1bd6cae9f6960301dd636d1141eed9a049cbfd6ff6f9e7
```

## Where the key lives

| Place | Status |
|---|---|
| **GitHub Secrets** (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`) | The only intended home. Encrypted, never shown in logs or to visitors. |
| GitHub Actions cache (`heytools-signing-v1`) | **Legacy.** In a public repository the cache can be read by anyone who can open the repo's workflows. The build only reads it as a temporary fallback and prints a warning. Move the key to Secrets and purge it. |

The build verifies the key against the pinned fingerprint and refuses to build if it differs. It never
generates a new key.

## One-time migration (about 5 minutes)

Pick **A** (everything inside GitHub, works from a phone) or **B** (you download it once).

### A. Let a workflow copy it into Secrets
1. GitHub → *Settings → Developer settings → Fine-grained tokens* → create a token for **this repository only**,
   permission **Secrets: Read and write**, expiry 1 day.
2. Repo → *Settings → Secrets and variables → Actions* → new secret `GH_ADMIN_TOKEN` = that token.
3. *Actions → Signing key migration → Run workflow →* `set-secrets`.
4. Delete the `GH_ADMIN_TOKEN` secret and the token.

### B. Encrypted download
1. Create a secret `KEY_EXPORT_PASSPHRASE` with 20+ random characters (`openssl rand -base64 24`) and keep a copy.
2. *Actions → Signing key migration → Run workflow →* `export`. Download the `heytools-signing-encrypted` artifact (kept for 1 day).
3. Decrypt on your computer:
   `openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -in heytools-signing.tar.enc | tar -x`
4. Set the secrets: `base64 -w0 heytools.p12` → `ANDROID_KEYSTORE_BASE64`, contents of `pass.txt` → `ANDROID_KEYSTORE_PASSWORD`.
5. Delete the decrypted files and the `KEY_EXPORT_PASSPHRASE` secret. Keep one offline backup of the key somewhere private (password manager / encrypted drive).

### Finish (both)
1. Run **Build Android app**. The log must say *Using the signing key from GitHub Secrets*.
2. Run *Signing key migration* → `purge` (it refuses to run unless both secrets exist). This deletes the cached copy.

Note: GitHub Actions *artifacts* of earlier runs never contained the key; only the cache did.
If you ever suspect the key leaked, it cannot be rotated for already-installed apps without a reinstall,
so treat the cache exposure as the reason to purge it now.
