# TRACKER

TRACKER is a MongoDB-backed productivity workspace for routines, daily planning, focused work, goals, mood context, weekly reflection, and honest long-term analytics.

## Run the full app

1. Install MongoDB Community Server once. On this Windows machine TRACKER also supports the user-level server under `%LOCALAPPDATA%\MongoDBServer`.
2. From this folder, run `npm run dev:full`. The startup guard reuses MongoDB when it is running and starts the local engine when it is not.
3. Open MongoDB Compass and connect to `mongodb://127.0.0.1:27017`.
4. Open the Vite address shown in the terminal, usually `http://localhost:5173` or `http://localhost:5174` when that port is occupied.
5. Create an account and use TRACKER normally. Compass will show the `routine_tracker` database and its saved collections.

## Deploy the website and API together on Render

The Render service can serve the React website and the Express API from the same URL. Keep the service connected to the same MongoDB database by setting `MONGODB_URI` in Render's environment variables. Use `npm start` as the start command; the `prestart` step builds the frontend before Express starts. The website is served at `/`, the health check is `/api/health` (it reports the connected database name, never credentials), and all authenticated API and Flutter sync routes remain under `/api/*`.

## Productivity system

- Daily planning with a guiding intention, realistic capacity, three must-win priorities, and a shutdown note.
- If–then implementation intentions that turn a vague goal into a clear trigger and action.
- Quick capture from every signed-in page, with dated tasks/events, recurrence, reminders, estimates, and checklists.
- Month and draggable week calendar views, including routine time blocks and workload-aware planning.
- Persistent focus timer with distraction tracking, session notes, honest completion or abandonment, and focus history.
- Planned-versus-actual focus calibration for improving future time estimates.
- Flexible routines: daily, weekdays, weekends, custom weekdays, or a weekly target, plus time estimates and pause/resume.
- Intentional routine recovery days that remain visible but do not reduce consistency analytics.
- Intentional task outcomes: reschedule, delegate, or drop without treating every changed plan as failure.
- Goals decomposed into measurable milestones with automatically calculated progress.
- Complex mood check-ins covering mood, energy, stress, focus, sleep, emotions, influences, and reflection.
- Mood-aware planning guidance and weekly reviews built from saved completion, focus, mood, and task-outcome evidence.
- Analytics and gold/graphite charts generated from the signed-in user's real history only.
- JSON data export for portability.
- Standards-based `.ics` export for Google Calendar, Outlook, and Apple Calendar, plus installable PWA support.

## Configuration

The local `.env` points the API to `mongodb://127.0.0.1:27017/routine_tracker` and is ignored by Git. Use `.env.example` as the template if you move the project or use MongoDB Atlas.

## MongoDB persistence

Every feature is scoped to the signed-in user and stored by the backend. The main collections are `users`, `routines`, `dailyroutinerecords`, `specialtasks`, `moodentries`, `dailyplans`, `focussessions`, `goals`, and `weeklyreviews`.

- Routine completion remains a separate record per routine and date.
- A focus session is saved when it starts, so its timer, distractions, and note survive reloads.
- Rescheduled, delegated, and intentionally dropped tasks keep their outcome history.
- Recurring task occurrences, checklist state, reminder settings, skips, and recovery reasons are stored in MongoDB.
- Overdue special tasks move to Pending and expired temporary routines are marked Expired when the dashboard prepares the current day.
- Analytics use saved records only; no fake starter history is injected.
