# Agent Summary — 04 DB Layer

APIs exposed in `server/db.js`:
- `getDb()` — singleton `better-sqlite3` connection to `/sqlite/ihc.sqlite`; enables WAL and NORMAL synchronous.
- `prepare(sql)` — validates non-empty SQL and proxies to `db.prepare(sql)` with error logging.
- `transaction(fn)` — validates input and returns `db.transaction(fn)` with error logging.
- `dbFilePath` — absolute path to the SQLite DB.

Initialization behaviors:
- Ensures `/sqlite` directory exists; creates DB if missing.
- Runs idempotent DDL for `antibodies` table and indexes per PRD §2 using `safeRun()`.
- Logs whether DB was created or opened and the absolute DB path.

Helpers:
- `safeRun(migrationName, sql)` — executes DDL with try/catch, logging warnings on failure.

Caveats:
- Requires optional native dependency `better-sqlite3`. If missing, logs guidance and throws.
- DML should be executed via prepared statements by callers to avoid dynamic SQL.


