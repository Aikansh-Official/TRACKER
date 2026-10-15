# Release verification — 16 October 2026

- Web: `npm test` — 11 passed, including a real local MongoDB integration test; `npm run build` — passed.
- Android: `:app:testDebugUnitTest`, `:app:lintRelease`, and `:app:assembleRelease` — passed. Lint: 0 errors, 21 warnings.
- APK: version 2.1.0/code 3, production HTTPS API, signature verified and matches the previous checked-in native APK. SHA-256 is published alongside the download.
- Cleanup: removed unused standalone web Calendar page, unreachable Today dashboard, generated build-output file, and unused native TasksScreen helpers. Moved analytics into `components/OverviewInsights.jsx`. IDE metadata is excluded from Git while local IDE files remain.
- Website navigation: Overview contains Insights; Plan contains day/week/month planning; footer is limited to authentication and About.

The detailed earlier local/device evidence is in VERIFICATION.md. These release checks do not repeat every device scenario. The APK retains debug-key signing for portfolio distribution. Live AI generation and Play Store publishing are not part of this release.

The new task sync requires mutation IDs and base revisions; older clients need an upgrade. Existing production database content is preserved by an additive synchronization-metadata migration.
