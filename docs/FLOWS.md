# Current user and data flows

See [LEARNING-GUIDE.md](LEARNING-GUIDE.md) for architecture, models, endpoints and folder responsibilities.

```mermaid
flowchart TD
  SignIn[Sign in] --> Workspace[Overview and navigation]
  Workspace --> Plan[Plan day, week or month]
  Plan --> Save[Create or edit task]
  Save --> API[Authenticated user-scoped API]
  API --> DB[(MongoDB)]
  DB --> Refresh[Refresh shared views]
  Workspace --> Pending[Pending work]
  Pending --> Complete[Complete in place or reschedule]
  Complete --> API
  Workspace --> Library[Routine library]
  Library --> Archive[Archive or restore routine]
  Archive --> API
```

```mermaid
flowchart LR
  Phone[Android edit] --> Local[(SQLite and pending changes)]
  Local --> Trigger[Manual sync or selected daily time]
  Trigger --> API[Authenticated revision-aware API]
  API --> Shared[(MongoDB)]
  Shared --> Web[Website refresh]
  Web -->|Web edits| API
  API -->|Next phone sync| Local
```

Explicit phone sign-in imports once. Website editing needs network access; offline editing is implemented on Android. A sync failure keeps phone changes pending. Task revision conflicts require an explicit choice; routine/mood competing updates retain last-successful-upload-wins behavior.
