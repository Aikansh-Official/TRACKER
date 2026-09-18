# UI and performance pass — 2026-09-17

## Follow-up — 2026-09-18

- Split Mood, Calendar (including WeekPlanner), and Insights into lazy modules alongside Plan; retained their existing behavior and shared navigation.
- Startup JS decreased from 314.41 kB to about 278.4 kB before compression (91.72 kB to about 83.2 kB gzipped). These are bundle measurements, not a measured production speedup.
- Added bounded, user-keyed, date-keyed, 20-second in-memory API caching. Writes and session changes invalidate it; late reads cannot refill invalidated entries. Returning to the visible tab refreshes dashboard/library and active analytics.
- Analytics queries use plain read-only objects and select only required user/task/routine fields. No DB migration or data changes.
- Removed orphan sparkline styles and unused imports. Reduced entrance animation duration and stagger. Core screens, graphs, scheduling, mood, notifications, and sync remain.
- Eight API tests pass, including expiry, write invalidation, cloning, and in-flight race protection. Lazy screens and calendar week view checked using isolated local fixtures.
- Live health request timed out at 20 seconds. Hosting/network responsiveness and authenticated production workflows are not verified by these local checks.

## Changes

- Today: local task search, All / To do / Done filters, useful empty states, saving feedback, and per-row duplicate-click protection.
- Reduced oversized Today summary spacing. Added explicit dark input colors, focus outlines, touch-sized quantity controls, and long-title wrapping.
- Minute-only clock updates replace whole-app second-by-second renders. Focus updates only while a running session is visible.
- Planner JavaScript loads on demand. Concurrent identical GET requests share one request, without storing response data or merging writes.
- Network failures and non-JSON server responses produce readable errors. Requests have a 45-second response-header timeout.
- Confetti durations fit the celebration lifetime; task completion has no full-screen tint. Day tint clears after 1.6 seconds. Reduced-motion users retain static completion feedback.
- Category comparison uses the last 30 points for its horizontal scale and no longer truncates to four categories.
- Content-hashed assets use browser caching. Service-worker fallback no longer sends HTML as missing JavaScript. API responses are excluded from the worker cache.

## Verified

- Production build succeeds.
- `node --test tests/api.test.mjs`: four tests pass (GET sharing, user/write isolation, retries, malformed/no-content responses).
- Isolated browser smoke checks: Overview, Today, Routines, Mood, Calendar, Insights empty state, and Plan including Focus / Goals / Review render without console errors.
- Isolated task interactions: increment, decrement, completion, disabled maximum, search with no matches, and clearing search.
- Desktop dark-mode screenshot inspected. Mobile 390px navigation and task controls exposed correctly; mobile completion reached 2/2.

## Limits

Browser checks used local mock responses, not real user accounts. They do not verify live login, MongoDB persistence, sync, every form submission, or production latency. Mobile screenshot capture failed, so full mobile visual sign-off is still pending. No production deployment was performed in this pass. No database connection, schema, or sync contract was changed.

Local browser fixtures are ignored under output/playwright and are not included in the production build.
