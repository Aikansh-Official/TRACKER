# TRACKER

TRACKER is a MongoDB-backed productivity workspace for routines, daily planning, focused work, goals, mood context, weekly reflection, and honest long-term analytics.

## Run the full app

1. Ensure the local MongoDB server is running (the same server MongoDB Compass connects to).
2. Open MongoDB Compass and connect to `mongodb://127.0.0.1:27017`.
3. From this folder, run `npm run dev:full`.
4. Open the Vite address shown in the terminal, usually `http://localhost:5173` or `http://localhost:5174` when that port is occupied.
5. Create an account and use TRACKER normally. Compass will show the `routine_tracker` database and its saved collections.

## Productivity system

- Daily planning with a guiding intention, realistic capacity, three must-win priorities, and a shutdown note.
- Persistent focus timer with distraction tracking, session notes, honest completion or abandonment, and focus history.
- Flexible routines: daily, weekdays, weekends, custom weekdays, or a weekly target, plus time estimates and pause/resume.
- Intentional task outcomes: reschedule, delegate, or drop without treating every changed plan as failure.
- Goals decomposed into measurable milestones with automatically calculated progress.
- Complex mood check-ins covering mood, energy, stress, focus, sleep, emotions, influences, and reflection.
- Mood-aware planning guidance and weekly reviews built from saved completion, focus, mood, and task-outcome evidence.
- Analytics and gold/graphite charts generated from the signed-in user's real history only.
- JSON data export for portability.

## Configuration

The local `.env` points the API to `mongodb://127.0.0.1:27017/routine_tracker` and is ignored by Git. Use `.env.example` as the template if you move the project or use MongoDB Atlas.

## MongoDB persistence

Every feature is scoped to the signed-in user and stored by the backend. The main collections are `users`, `routines`, `dailyroutinerecords`, `specialtasks`, `moodentries`, `dailyplans`, `focussessions`, `goals`, and `weeklyreviews`.

- Routine completion remains a separate record per routine and date.
- A focus session is saved when it starts, so its timer, distractions, and note survive reloads.
- Rescheduled, delegated, and intentionally dropped tasks keep their outcome history.
- Overdue special tasks move to Pending and expired temporary routines are marked Expired when the dashboard prepares the current day.
- Analytics use saved records only; no fake starter history is injected.
