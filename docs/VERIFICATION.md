> Historical local QA report from 15 October 2026. See [release checks](RELEASE-2.1.0.md) for the later cleanup and Android release build.

# Local verification — 15 October 2026

Both repositories are on `red/tracker-simplification`. Existing uncommitted website UI work and Android Gradle changes were preserved. No push, deployment, public APK replacement, or production-data deletion was performed.

## Verified

| Check | Result and scope |
|---|---|
| Website production build | `npm run build` passed |
| Website/backend tests | 11 Node test cases passed; includes one multi-assertion real MongoDB integration scenario |
| Android debug build | `assembleDebug` passed with local QA API URL |
| Android model tests | 4 passed, zero failures |
| Android device integration | `PlanningSyncTest` and `DatabaseMigrationTest` passed on Pixel_8a emulator, Android 17; directly run through instrumentation after installing the QA APK |
| Registration/login | Real local synthetic accounts; valid login, wrong password, invalid email, missing/invalid/expired JWT |
| User isolation | Another user's task cannot be listed, edited, or deleted; sync pull and retrieval do not expose that user's data |
| Task operations | One-time and measurable creation; progress bounds; impossible dates; completion/reopening; rescheduling; recurrence; checklist completion; outcomes; series deletion |
| Sync identity and retries | Repeated mutation produces one record; simultaneous mutations accept one revision; stale mutation reports a conflict |
| Deletions | Website hides deleted records while sync snapshot/pull retains tombstones; stale offline update cannot silently resurrect a deleted task |
| Device round trip | Android repository writes reach the shared backend; website task endpoint writes reach Android; uses real HTTP and MongoDB, not fixtures or mocked responses |
| Device offline persistence | Wi-Fi and mobile data disabled for create/edit; reopening SQLite preserved 2/5 and the outbox |
| Process restart | QA app force-stopped and launched offline; inspected Compose UI showed “Restart proof: solve 5 questions”, 2/5, and “Saved locally · 1 pending” |
| Connectivity recovery | After restoring connectivity, foreground sync changed status to “Synced 1 changes”; progress remained 2/5 |
| Conflict handling | Competing website/phone edits preserved the local pending edit; explicit keep-local resolution reached the server; use-server resolution discarded only the conflicting local task version |
| SQLite upgrade and dated queue | Version-2 fixture upgraded to version 4 with task/outbox intact; two routine dates persisted across reopen and were acknowledged independently |
| Routine creation retry | Repeated creation with the same stable client ID returned one server routine; quantity progress synchronized |
| Account switching | New account had no old tasks; signing back into the original account restored its pending edit |
| Expired session | Clearing the session left pending data intact; reauthentication resumed synchronization |
| Browser behavior | Registered through UI, created 2/5 measurable task, increased to 3/5, reloaded, dismissed banner and reloaded |
| Calendar consistency | Browser reschedule from Oct 15 to Oct 16 moved calendar count from old day 0 to new day 1, while keeping 3/5 progress |
| Responsive layout | Inspected 390×844 and 1440×1000 browser views; mobile document width 380 at viewport width 390, no horizontal document overflow |
| AI unavailable path | Consent required; insufficient history returns an explicit message; configured-off server returns 503 without affecting tasks |
| Retrieval | Keyword ranking and eight-source bound tested; cross-user empty-history request returned no sources |

The device round-trip test exercises the same task endpoints used by the website. It does not automate a browser and phone simultaneously as one test. Separate browser checks exercised those endpoints through rendered UI.

## Evidence

Ignored local artifacts under `output/playwright/`:

- `planning-mobile.png`: measured task after save/reload.
- `planning-calendar-mobile.png`: integrated month calendar at phone width.
- `planning-desktop.png`: desktop Plan/calendar/task view.
- `android-restart.png`, `android-restart.xml`: offline process-restart proof.
- `android-synced.xml`: foreground sync after connectivity restoration.

Android test XML is under `app/build/test-results/testDebugUnitTest/` and `app/build/outputs/androidTest-results/connected/debug/`. Each directly executed instrumentation class returned `OK (1 test)`.

## Inspected or not verified

- Live LLM generation was not executed: a server model/key was not configured for this work. The real provider call is implemented; its generated output and citation quality are unverified.
- A reconstructed version-2 SQLite fixture was upgraded and checked on-device. A user's normal populated installation was not modified; legacy account-file mapping was inspected, while new-account separation was tested in `.qa`.
- All retained focus, goals, mood, analytics, export, reminder timing, and historical routine combinations were not re-tested exhaustively. They remain in the project.
- No physical phone, release/store signing, production performance/load, or public deployment was verified.

## Known limits

- Strong revision conflict handling applies to dated task records. Routine progress now preserves pending edits for multiple dates; competing edits to the same routine/date or mood/date use last-successful-upload-wins, without the task conflict dialog.
- Guest work remains a separate local workspace. There is no automatic account import.
- Foreground synchronization runs about every 30 seconds and after edits/manual requests. There is no continuous background service or WorkManager job.
- The phone currently downloads a full authenticated task snapshot; the incremental pull API is available but not yet used by it.
- AI retrieval is lexical and recency-limited, not semantic embedding search. Suggestions are reviewed text; applying one uses the ordinary task editor.
- Older app versions do not send the new mutation ID/base-revision contract. This local backend rejects those old push requests instead of guessing. Any future public rollout must coordinate backend and app versions.
- Debug APK uses `.qa` and the local test API. It is not a published release.
- Existing large legacy feature files remain; the new planning, AI, and server task/sync handlers have focused modules.

The full scope is therefore not a claim that every old feature has been modernized or that live AI is verified. The core planning/task rework, local persistence, and task sync path have working local verification.
