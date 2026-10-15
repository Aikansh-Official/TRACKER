# TRACKER: understand it, rebuild it, explain it

This guide describes the local simplification branch, `red/tracker-simplification`, in both checkouts. Nothing in this work publishes the website or replaces a public APK.

## Start with the idea

Imagine your task is a library book. The day list and calendar are two catalog views of the same book; they should not each own a copy. In TRACKER, both views read the same `SpecialTask` records. Selecting a day changes a filter, not the database.

The phone has its own notebook: SQLite. Writing in that notebook works without internet. The outbox is a list of changes still waiting to reach the server. MongoDB is the shared server database; the phone only reaches it through authenticated HTTP endpoints.

## What was retained and changed

- Retained: accounts, routines, recurrence, task events, checklists, reminders, focus sessions, goals, moods, history, insights, exports, and reflection tools.
- Merged: Plan, Today, and the separate Calendar navigation destination into Plan. Old website Today/Calendar hash links resolve to Plan. Day, month, and week are views within the same planning experience.
- Added: dated measurable tasks (`2/5 questions`), task editing/deletion in the native Plan screen, explicit task conflicts, account-separated phone storage, and optional AI suggestions.
- The Android banner has an accessible close button. `tracker-download-dismissed-v1=yes` in browser storage remembers dismissal on that browser. It is a presentation preference, not account/task deletion. Footer download links remain. Clearing that storage key restores the banner.
- Custom Android entrance, navigation, progress, colour, and looping animations were removed. Standard Material controls still provide their normal interaction feedback.
- No location feature was invented: the supplied syllabus permits location tools, but planning does not require permission to access your location.

## Actual folder structure

The website already separated `src` and `server`; that separation remains. Existing stable features were not moved merely to make the tree bigger.

```text
Tracker/
  src/
    App.jsx                         login, navigation, shared task loading
    api.js                          API service, JWT header, cache invalidation
    pages/PlanningPage.jsx          date selection, calendar, task editor/list
    components/
      AndroidDownloadBanner.jsx    browser-only dismissal preference
      SuggestionPanel.jsx          consent, request, suggestion and sources
    TodayTasks.jsx                  reusable routine progress list
    WeekPlanner.jsx                 existing weekly view and rescheduling
    ProductivityStudio.jsx          retained focus/goals/reflection tools
    WorkspaceShell.jsx              navigation and account shell
    planning.css                    new planning layout
    professional-workspace.css      shared website palette/layout
  server/
    server.js                       Express composition and startup
    config/                         database and JWT configuration
    middleware/auth.js              JWT verification
    routes/tasks.js                 URLs and their task handlers
    routes/sync.js                  synchronization URLs
    routes/suggestions.js           opt-in AI endpoint
    controllers/tasksController.js  task request validation and operations
    controllers/syncController.js   compare-and-swap synchronization
    models/                         Mongoose schemas and indexes
    services/taskValidation.js      dates and measurable progress rules
    services/migrateTaskSync.js     additive legacy metadata migration
    services/suggestions.js         retrieval and server-only model call
    services/dailyState.js          today's routine records and rollover
  tests/                            unit and local integration tests
  docs/                             this guide and verification report
  .env.example                      configuration names, no credentials
```

The native project is `C:/Users/Aikan/Desktop/FlutterProjects/TRACKER`, despite the historical folder name. Its current source is Kotlin/Compose.

```text
app/src/main/java/com/aikansh/tracker/nativeapp/
  MainActivity.kt           app shell and retained feature screens
  MainViewModel.kt          StateFlow, user actions, sync status
  ui/PlanningScreen.kt      date picker, tasks, progress, edit/delete/conflicts
  ui/AiPlanningCard.kt      explicit consent and optional AI result
  ui/Theme.kt               colours and typography
  data/Models.kt           Kotlin data classes
  data/TrackerRepository.kt business logic and synchronization
  data/TrackerDatabase.kt  SQLite tables, migration, transactions, outbox
  data/TrackerApi.kt        authenticated HTTP and JSON conversion
  data/SecureTokenStore.kt  token storage
app/src/test/              model unit tests
app/src/androidTest/       real device/database/API integration test
app/src/debug/             local HTTP permission for debug builds only
```

New screen → `ui` on Android, `src/pages` on web. Reusable element → `ui` or `src/components`. Database changes → schema plus an additive migration. New HTTP operation → route, controller if substantial, reusable business rules in services. Do not put SQL inside a composable or MongoDB calls inside React.

Some retained screens still live in the older large `MainActivity.kt` and flat React files. The new planning feature is separated; this is an incremental rework, not a claim that every older file has been fully reorganized.

## Local setup

Website prerequisites: Node.js, npm, MongoDB Community Server. Use the versions already installed/locked in this checkout. Run `npm ci` on a fresh checkout. Copy `.env.example` to `.env` and choose a long random JWT secret. Never commit `.env`.

```powershell
node server/ensureMongo.js
npm run server
# In another terminal:
npm run dev
```

Vite proxies `/api` to port 5000. `npm run build` produces `dist`; Express can serve that build. `npm test` includes a real MongoDB integration test, so MongoDB must be running. That test starts a separate server on 5058 with database `tracker_simplification_test` and creates synthetic users. It does not delete your normal database.

For a test site and emulator together:

```powershell
$env:PORT='5057'
$env:MONGODB_URI='mongodb://127.0.0.1:27017/tracker_simplification_qa'
node server/server.js
```

Open `http://127.0.0.1:5057`. In the Android project:

```powershell
.\gradlew.bat :app:assembleDebug :app:testDebugUnitTest -PtrackerApiUrl=http://10.0.2.2:5057/api/
.\gradlew.bat :app:connectedDebugAndroidTest -PtrackerApiUrl=http://10.0.2.2:5057/api/
```

`10.0.2.2` means the host computer from the standard Android emulator. Debug has application ID suffix `.qa`, so it does not overwrite the normal installed app or its data. Debug permits local HTTP; release does not add that permission. The default URL remains the existing hosted API, so always pass the local URL for these tests. Release signing still uses the project's existing debug-signing configuration; this work does not make a store-ready release.

Dependencies have specific jobs: React renders; Express routes requests; Mongoose describes MongoDB records; bcrypt hashes passwords; jsonwebtoken signs/verifies tokens; OkHttp handles Android HTTP; coroutines move work off the main thread; StateFlow exposes UI state. SQLiteOpenHelper is used directly, so there is no Room annotation processing to learn in this iteration. AndroidX test runner is test-only.

## Database and endpoints

| Record | Purpose |
|---|---|
| User | name, email, password hash, timezone |
| SpecialTask | dated task/event, measurable target/progress/unit, recurrence, checklist, sync metadata |
| Routine | repeating habit definition and schedule |
| DailyRoutineRecord | one day's quantity/completion for a routine |
| FocusSession | focused work duration and notes |
| DailyPlan / Goal / WeeklyReview | priorities, longer goals, reflections |
| MoodEntry | daily mood and related observations |

| Endpoint | Use |
|---|---|
| POST `/api/auth/register`, `/login` | create account or authenticate |
| GET `/api/auth/me` | read authenticated account |
| GET/POST `/api/tasks` | list or create tasks |
| PATCH/DELETE `/api/tasks/:id` | edit/reschedule/progress or soft-delete |
| PATCH `/api/tasks/:id/complete` | complete/reopen; measurable progress follows completion |
| PATCH `/api/tasks/:id/subtasks/:subtaskId` | checklist completion |
| PATCH `/api/tasks/:id/outcome` | retained skip/drop/delegate/reschedule |
| POST `/api/sync/push` | send bounded task mutations with base revisions |
| POST `/api/sync/pull` | paginated changes including deletion markers |
| GET `/api/tasks?includeDeleted=true` | full authenticated snapshot used by the current phone client |
| POST `/api/suggestions` | consent-gated retrieval and optional generation |
| `/api/routines`, `/moods`, `/productivity`, `/analytics`, `/dashboard` | retained feature APIs |

`taskType` is `ONE_TIME` or `MEASURABLE`; recurrence is a separate scheduling property. A measurable task can repeat without inventing another task type. Existing one-day measurable routines are preserved as routines; new one-day measurable items use task records. Recurrence materializes up to 120 occurrences, with a default one-year horizon. Editing edits one occurrence; the retained delete API can delete a series.

## Registration, login, and JWT — the theory first

A JWT is a signed membership card. A signature detects tampering; it does not encrypt the card. Never put passwords in it.

1. Registration validates name/email/password, hashes the password with bcrypt, and stores the hash.
2. Login looks up the email and asks bcrypt to compare the submitted password with the stored hash.
3. The server issues a seven-day JWT containing the account ID.
4. The client sends `Authorization: Bearer ...` on later API requests.
5. `requireAuth` verifies the signature and expiry. Every record query uses the verified user ID, never a client-supplied owner ID.

Knowing a task ID is not permission to edit it. Controllers query both `_id` and `userId`. Invalid/expired sessions return 401. The website's existing token storage is browser localStorage; XSS prevention remains important. The native token store remains separate from the SQLite data.

Exercise: try editing user A's task with user B's JWT. Interview: why are password hashing, JWT verification, and per-record authorization three different safeguards?

## Follow one task from screen to database

Example: “Solve 5 questions”, progress 2, unit “questions”.

1. React form state holds your draft. It has not been saved yet.
2. Submit calls `api('/tasks', ...)`; the service adds the JWT.
3. The route dispatches to `createTask`; validation rejects impossible dates or invalid progress.
4. Mongoose inserts a user-owned task with a stable sync ID.
5. The response is returned only after the write succeeds.
6. The browser reloads shared records. The selected-day list and calendar read those records.

The calendar count is derived UI state. Storing a second calendar count would create another value you could forget to update.

Exercise: add a task for tomorrow, edit its date, and verify that it disappears from the old date and appears on the new one. Interview: which values belong in the database, and which should be derived?

## Offline edit and synchronization

The repository writes the task and outbox entry in one SQLite transaction. Either both changes commit or neither does. This avoids a saved task that the sync worker never discovers.

Each task carries:

- `syncId`: permanent identity generated before network access.
- `baseRevision`: the last server version the phone actually saw.
- `mutationId`: stable identity for one queued change; retries reuse it.
- `revision`: local ordering/version information.
- `deletedAt`: a deletion marker, rather than immediate physical removal.

Example: the phone read server revision 3, then changed progress to 2/5 offline. If the server is still at revision 3, it accepts the edit and advances to revision 4. A retry with the same mutation ID is acknowledged without inserting another record.

If the website already advanced to revision 4, the server reports a conflict. The phone keeps its local edit in the outbox. Plan offers an explicit, confirmed choice: keep local versions or use server versions for conflicting tasks. Keeping local rebases the pending changes onto the latest server revisions; another concurrent change can still produce another conflict. This is whole-task conflict resolution, not automatic merging of individual fields.

Server compare-and-swap makes the revision check and update atomic. A timestamp alone is unsuitable because device clocks can disagree. Website saves also advance revision; otherwise the phone cannot detect website edits.

Deletion markers remain on the server so an offline device can learn of deletion. Legacy missing sync metadata is backfilled additively. No existing task content is erased by that migration.

The phone uses separate database files per signed-in account. A legacy file stays associated with its recorded owner. Guest work remains in a separate workspace; it is not silently uploaded to whichever user signs in next. There is no guest-to-account import UI in this change.

Sync runs on app launch, after local changes, from the Sync action, and every 30 seconds while the activity is started. It stops polling when the activity is stopped. There is no WorkManager/background-service promise. The website refreshes visible data every 30 seconds, on returning to the tab, and when the browser reports connectivity restored. Network failure leaves local pending work intact. Session expiry clears the token without deleting local work; sign back into the same account to resume.

The current Android client pulls full task snapshots; the API also offers a compound time-and-ID cursor for incremental clients. That cursor avoids skipping rows sharing a timestamp. Full snapshots are simpler but will need paging for very large accounts.

Routine creation now includes a stable client ID to avoid duplicate habits after a lost response. Routine progress now has a durable queue keyed by routine and date, so a later day cannot replace an earlier day waiting to upload. SQLite version 4 creates that queue and backfills existing pending progress. Routine progress and mood synchronization still use a last-successful-upload-wins policy for the same routine/date or mood/date; they do not have the explicit task conflict choice. Do not claim the stronger task conflict guarantees for those flows.

Exercise: edit the same task on web and phone while the phone is offline. Interview: why do we need both a stable task ID and a stable mutation ID? Why is a mutex useful around syncing and local edits?

## Retrieval and AI suggestions

RAG means retrieve evidence first, then generate using that evidence. It does not require embeddings or a vector database.

This implementation fetches bounded candidates belonging to the signed-in user: up to 40 recent tasks, 20 completed focus sessions, and four weekly reviews from the last 30 days. It ranks excerpts by matching query words, then recency, and sends only the top eight excerpts. Each excerpt is capped. This is simple lexical retrieval; synonyms and older relevant records can be missed. No embeddings are used.

Both clients require a fresh opt-in choice before requesting a suggestion. The server independently checks `consent: true`. Fewer than two available records produces an insufficient-history result. When disabled or unconfigured, the endpoint reports that clearly and task planning continues normally.

To enable generation later, set server-only `AI_ENABLED=true`, `AI_MODEL`, and `OPENAI_API_KEY` in `.env`. No provider credential belongs in React, BuildConfig, or an APK. The server uses the [OpenAI Chat Completions API](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create), requests no tools, and instructs the model to treat retrieved text as untrusted evidence. The response includes the actual retrieved excerpts. Citations generated by the model still require human judgment; the source list is not a guarantee that every generated sentence is correct.

Suggestions are text, not executable task mutations. You review them and use the normal Add/Edit flow to accept only the actions you want. The live provider path has not been verified without a configured model/key.

Exercise: compare retrieval for “questions” and “focus”; inspect the sources before the suggestion. Interview: how does retrieval differ from sending the entire database to a model? Why must authorization happen before generation?

## Rebuild order

1. Build a static dated task list and form. Learn props, state, and derived lists.
2. Add Express task routes backed by an in-memory array for learning only.
3. Replace the array with MongoDB and validate input. Learn IDs and indexes.
4. Add registration, hashing, JWT verification, and user ownership. Test two accounts.
5. Add date/month/week views over the same records, then measurable progress.
6. Build the Compose task screen with state hoisting and a ViewModel.
7. Add SQLite, transactions, and an outbox before attempting synchronization.
8. Add stable IDs, retries, version conflicts, deletion markers, and account separation.
9. Add opt-in retrieval and generation only after normal planning works without AI.

Reproduce from understanding: React state flow; a request/response handler; validation; owner filtering; Compose state hoisting; repository responsibilities; the outbox transaction; the conflict decision. Look up: Gradle syntax, Compose component parameters, SQL migration syntax, JWT library options, HTTP-client configuration, and model API parameters. Knowing why a safeguard exists matters more than memorizing its library spelling.

## Further exercises and interview prompts

| Area | Exercise | Explain in an interview |
|---|---|---|
| UI | Add an overdue filter without a new database table | controlled input vs derived state |
| Validation | Reject February 30 and negative progress | why server validation is necessary even with HTML constraints |
| Persistence | Restart the app after an offline edit | transaction durability vs UI state |
| Auth | Try another user's task ID | authentication vs authorization |
| Sync | Retry the same mutation twice | idempotency and atomic compare-and-swap |
| Deletion | Delete offline, reconnect, restart | tombstones and eventual consistency |
| AI | Disable the provider and keep planning | optional services and graceful failure |

See `VERIFICATION.md` for what was actually tested, what was inspected, and remaining limitations.
