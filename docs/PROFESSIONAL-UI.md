# Professional workspace redesign

Implemented 2026-10-03 using the supplied charcoal/amber dashboard as visual direction.

## Design system

- One persistent desktop sidebar and top bar across all nine authenticated routes.
- Collapsible mobile navigation below 850px; two-column KPI tiles on small screens.
- Dark charcoal surfaces, subtle borders, warm amber actions, system sans-serif typography.
- Saved light/dark preference retained; new sessions default to dark.
- Shared form, card, heading, focus-state and spacing rules in `src/professional-workspace.css`.
- Overview has real task counts, a task summary table, seven-day saved-history chart, and shortcuts to Plan, Mood and Calendar.
- Missing history remains an explicit empty state, never fabricated chart data. Seven-day average excludes dates without planned records, matching its displayed recorded-day semantics.
- Existing features, backend routes, database configuration and Android sync contracts were not changed. Account/support/download links remain available.

## Verification

- Production build and all eight existing API-cache tests passed.
- Browser inspections used an ignored local fixture that intercepts requests; no production database writes.
- Inspected Overview in light and dark, Today, Plan, Mood, Calendar and Insights empty state at desktop width.
- Verified mobile menu open/select/close and Overview at 390x844; no horizontal overflow.
- Verified new-intention form opens, typed text is visible in dark mode, and closes without saving.
- Verified seven-day chart with explicit test-only fixture records as well as empty history. Fixtures are not production content or part of the build.
- Authentication, backend persistence, populated full Insights, all nested workflows and native app sync were not end-to-end retested in this visual pass.
- Local only: not pushed or deployed by this request.
