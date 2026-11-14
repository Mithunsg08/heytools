# HeyTools private dashboard

Shows how many times the app was downloaded and on what kind of device (Android phone, Android tablet,
iPhone, iPad, Windows, Mac, ...). Only the person who knows the email and password can open it.

**No username or password is stored in this repository.** You type them into Google yourself (step 3).
The data is saved in a Google Sheet inside *your* Google account.

## Set it up (about 5 minutes, on a phone or computer)

1. Sign in to Google as the owner account, then open **script.google.com** and tap **New project**.
2. Delete the sample code and paste the whole of `dashboard/Code.gs` from this repository. Tap **Save**.
3. Open **Project Settings** (gear icon), scroll to **Script properties**, tap **Add script property** twice:
   - `DASH_EMAIL`  = the email that may sign in
   - `DASH_PASS`   = a password you choose (use one you do not use anywhere else)
4. Tap **Deploy > New deployment > Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone** (the website must be able to send counts; the dashboard itself needs the password)
   - Tap **Deploy**, allow the permissions Google asks for, and copy the **Web app URL**.
5. Open `track-config.js` in this repository and paste the URL between the quotes of `HEY_TRACK_URL`. Commit.
6. Open the Web app URL in a browser, sign in with the email and password from step 3.

## What is counted
- `download_click`: someone tapped a download button on the website, a tool page or in the app.
- `app_open`: the Android app or the installed web app was opened (counted once per day per device).
- `pwa_install`: the web app was added to a home screen or computer.
- The dashboard also reads the real APK download numbers from GitHub (these count finished downloads).

Nothing personal is collected: no name, no email, no files, no location. A random id made on the device
is used only to count each install once.

## Safety notes
- After 5 wrong passwords, sign-in pauses for 15 minutes.
- A sign-in lasts 30 minutes.
- To change the password, edit `DASH_PASS` in Script properties. Nothing else needs to change.
- Anyone can send fake counts to the web app URL (the website cannot keep a secret), but nobody can read
  the numbers without the password. If you ever want to cut off the fake counts, deploy a new version and
  put the new URL in `track-config.js`.
