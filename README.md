# TRACKER Routine Manager

## Run the full app

1. Ensure the local MongoDB server is running (it is the server that Compass connects to).
2. Open MongoDB Compass and connect to `mongodb://127.0.0.1:27017`.
3. From this folder, run `npm run dev:full`.
4. Open the Vite address shown in the terminal, usually `http://localhost:5173`.
5. Create an account, then add a routine or special task. Compass will show a new `routine_tracker` database with `users`, `routines`, `dailyroutinerecords`, and `specialtasks` collections.

## Configuration

The local `.env` already points the API to `mongodb://127.0.0.1:27017/routine_tracker` and is ignored by Git. Use `.env.example` as the template if you move the project or use MongoDB Atlas.

## Persistence behaviour

- Routine completions are saved as a separate document per routine and date.
- Each account only receives data belonging to its signed-in user ID.
- On every dashboard load, overdue special tasks move to Pending and expired temporary routines are marked Expired—even if the browser was closed at midnight.
