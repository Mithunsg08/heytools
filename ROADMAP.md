# HeyTools roadmap (checked against the code, 28 Nov 2026)

Principle: make the 44 web tools (plus the app-only Anti-Theft Guard, 46 entries in the registry including the external OpsReveal link) dependable, private and polished before adding more. Scores and ratings are intentionally not included: they cannot be measured from the code.

Legend: **Done** = present in code today (still needs on-device confirmation where marked) · **Gap** = not found in code · **Verify** = exists, quality unknown, test on a real phone.

## Phase 1: make it dependable

| Area | Status | Evidence / next step |
|---|---|---|
| Background media playback | Done, Verify | `PlaybackService.java`, `MediaLibraryPlugin.java`; Music Player has MediaSession. Test: screen off, app swiped away, headset buttons. |
| Video Player lock-screen controls | **Gap** | `video-player/index.html` has no MediaSession. Add play/pause/seek/next handlers. |
| Video resume, subtitles, speed, PiP | Done | Resume, `.srt/.vtt` subtitles, `playbackRate` and PiP present. |
| Alarms: reboot recovery, ringing | Done, Verify | `AlarmBootReceiver`, `AlarmRingingService`, `AlarmScheduler`, `AlarmRingActivity`. Test on Poco/HyperOS with battery optimisation on, after reboot. One-time dated alarms exist in the UI code. |
| Recorder and screen recorder | Done, Verify | `ScreenRecordService/Plugin`; encrypted media in app. Test: long recording, app backgrounded, low storage, saved file opens. Add an explicit "saved OK" check after write. |
| Image Compressor | Verify | Confirm multi-file batch and before/after comparison in the UI; add them if missing. |
| Anti-Theft Guard | Done, Verify | Builds 72/73 snatch rules and app lock still need on-device confirmation. Add charging history and battery alerts only if requested. |
| Encryption and storage audit | Mostly done | Password / no-password modes, backup encryption, `scripts/test-heysecure.js`. Remaining: audit every `localStorage`/IndexedDB key not routed through HeySecure (music/video libraries and alarms are intentionally plain, documented in SECURITY.md). |
| External request review | Done | Inventory is on the privacy page; keep it in sync when a tool adds a host. Add a CI check that fails when a new host appears in a tool without a privacy-page entry. |
| Signing key out of the Actions cache | **Needs owner action** | Secrets are set but invalid; follow SIGNING.md, then run `purge`. |
| Dependency and licence audit | Partly | `licenses/index.html`, `npm audit`. **AGPL-3.0:** `@imgly/background-removal` (Background Removal). Before any paid or commercial distribution: buy IMG.LY's commercial licence, replace the library, or get legal advice (already noted on the licences page). |
| Test every tool | **Gap** | `scripts/smoke-browser.mjs` exists; extend it to open all 44 tools and fail on console errors. |

## Phase 2: make it premium

| Item | Status | Next step |
|---|---|---|
| Universal search, favourites, recently used (app home) | Partly | App has some search/favourite/recent code (`app/app.js`); review the home screen so search is at the top and recent/favourites are one tap away. |
| Home-screen widgets | **Gap** | New native work (AppWidgetProvider): clock/timer, habit progress, quick note, favourite tool. Highest-value new feature. |
| Unified design system | **Gap** | Each tool has its own CSS. Create a shared `hey-ui.css` (type, buttons, radius, spacing, states) and migrate tools gradually, highest-traffic first. |
| Per-tool improvements | **Gap / Verify** | Habit tracker calendar view; QR scan history and safer link preview; expense monthly report and CSV (export exists, check report); notes search/folders/recurring (present, verify); focus timer statistics (present, verify); Geo Camera controls (zoom/flash present). |
| Onboarding and accessibility | **Gap** | First-run walkthrough; audit contrast, focus order, screen-reader labels, tap-target sizes. |

## Phase 3: expand carefully (after launch)

1. Document Scanner (camera, perspective crop, PDF; OCR only if it works offline at acceptable size).
2. Privacy Dashboard (permissions granted, what each is used for, which features use external services). Reuse the privacy page inventory as data.
3. Storage Analyzer (local only, always confirm before deleting).
4. Private Clipboard Manager. Android 10+ blocks background clipboard reading, so this needs a paste-in or keyboard-style design; treat passwords and OTPs as sensitive by default with auto-expiry.

## Not now

AI chatbot, social features, cloud storage, built-in browser, crypto wallet, messaging, collaboration, more basic calculators.

## Wording rule

Do not claim every tool is offline. Each tool is labelled Works offline / Partly online / Needs internet, and the privacy page lists the external services.
