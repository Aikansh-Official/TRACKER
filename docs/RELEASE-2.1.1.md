# Website and Android 2.1.1 release

Publication authorized on 18 October 2026. The existing website work was preserved and included in this release after tests/build verification.

## Changes

- Publish the native Android 2.1.1 companion and update banner, sidebar, footer and README download links.
- Android edits stay local until manual or scheduled daily sync; explicit sign-in performs one initial import. No per-edit or 30-second Android polling.
- Website Pending supports completion without moving the original date, undo, reschedule and archive; Archive supports restoring tasks/routines.
- Routine library lists active routines even when they are not due today.
- Shared task lifecycle rules preserve completion history, restore measurable progress on undo and keep closed tasks closed when edited.
- Calendar/date validation, recurring occurrence checklists, temporary routines and weekly-target behavior have regression coverage.
- Existing navigation, keyboard handling and workflow spacing changes are retained. No frontend framework migration.

## Verification

- `npm test`: 26 tests passed, including real local MongoDB integration and phone snapshot compatibility.
- `npm run build`: passed; generated output is excluded from commits.
- Native 13 JVM tests, lint and release build passed. Eight device tests and real background timing were verified on 16 October; see the native repository's sync report.
- Local synthetic-account browser check: registered through the form, created an overdue task, completed it from Pending with its original planned date preserved, and undid completion successfully. Inspected desktop and 390×844 views; document width 380 px at a 390 px viewport, no horizontal overflow. Browser console reported zero errors/warnings. Evidence: ignored `output/playwright/release-pending-desktop.png` and `release-pending-mobile.png`.
- Deployed health/download checks are performed after publication. These checks do not constitute exhaustive production user-data or load testing.

## Deployment and rollback

Render deploys the website repository's `main` branch. Keep the existing MongoDB/JWT environment settings; no production reset or credential change is needed. GitHub Releases retain 2.1.0 as a rollback download. APK signing is unchanged; do not uninstall to update.

The native source and APK release are separate from the Render service: Render hosts React/Express, while Android users install the new APK. Website saves use the API immediately; the phone exchanges data only at its selected sync time or when requested. Free Render services may sleep, delaying login/sync; no hosting purchase is included.
