# To-Do List
- Use the todolist tool to create relevant todos for the following task while you're implementing.

# Prompt — 04 Database helper layer (SQLite)

Role: You are an AI coding agent. Implement a tiny SQLite helper suitable for use by import scripts and API logic.

Read `docs/PRD.md` fully before starting and follow it as the single source of truth for requirements and constraints.

Before starting: read `Agent Summaries/03_logic_and_tests.md` if it exists, and only that file, to align types and assumptions.

After completion: write a concise summary of what you completed (APIs exposed, schema checks, initialization logs, any caveats) to `Agent Summaries/04_db_layer.md`. Also update `docs/Project_Progress.md` by checking off completed items.

Objective:
- Implement `server/db.js` to manage a singleton connection to `/sqlite/ihc.sqlite` using `better-sqlite3` and expose minimal helpers.

Context:
- Schema and ingestion rules in `docs/PRD.md` §2–§3.
- DB file path: `/sqlite/ihc.sqlite` (ensure directory exists).
- No ORM, no additional dependencies.

Requirements:
- Export functions:
  - `getDb()` → returns a shared `better-sqlite3` Database instance with `fileMustExist: false`.
  - `prepare(sql)` → proxy to `db.prepare(sql)`.
  - `transaction(fn)` → wraps `db.transaction(fn)` and executes.
- On first `getDb()`:
  - Create `/sqlite` directory if missing.
  - Initialize indexes and table if not already present using the schema in PRD (idempotent `CREATE TABLE IF NOT EXISTS ...`).
  - Log to console: DB path, whether created or opened.
- Provide a small `safeRun(migrationName, sql)` helper to run idempotent DDL with try/catch and console warnings.
- Add minimal input validation and meaningful error messages when SQL fails.

Constraints:
- Keep the file under ~200 lines.
- No dynamic SQL string building from untrusted input; use prepared statements for DML in callers.
- Only `better-sqlite3` as dependency; do not add others.

Acceptance checks:
- Requiring `server/db.js` does not throw if DB file is missing; it is created.
- Running importer and API code (later steps) can reuse the same connection.
- Console shows clear logs on init and errors.

Finally, commit your edits with a concise commit message summarizing this step.
