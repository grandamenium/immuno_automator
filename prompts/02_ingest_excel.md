# To-Do List
- Use the todolist tool to create relevant todos for the following task while you're implementing.

# Prompt — 02 Analyze Excel and convert to SQLite database

Role: You are an AI coding agent. Implement ingestion from the provided Excel workbook into a normalized SQLite DB ready for querying.

Read `docs/PRD.md` fully before starting and follow it as the single source of truth for requirements and constraints.

Before starting: read `Agent Summaries/01_setup_project.md` if it exists, and only that file, to understand prior setup decisions.

After completion: write a concise summary of what you completed (scope, files added/edited, commands executed, debugging notes, row counts) to `Agent Summaries/02_ingest_excel.md`. Create the `Agent Summaries` folder if it does not exist. Also update `docs/Project_Progress.md` by checking off completed items.

Objective:
- Analyze `Inventory.xlsx` in the repo root and convert it to `/sqlite/ihc.sqlite` following the schema and normalization rules in `docs/PRD.md` §2–§3.

Inputs & context:
- Source workbook: `Inventory.xlsx` (multi-sheet; sheet names may indicate storage temperature or content type).
- Target DB file: `/sqlite/ihc.sqlite` (create if missing).
- Schema and rules: `docs/PRD.md` §2 (schema, dedupe), §3 (fluor map), and §9 (warnings).

SQLite schema (copy exactly):
```sql
CREATE TABLE IF NOT EXISTS antibodies (
  id INTEGER PRIMARY KEY,
  type TEXT CHECK(type IN ('primary','secondary','serum','other')),
  name TEXT,
  target TEXT,
  host_species TEXT,
  ig_class TEXT,
  fluorophore TEXT,
  emission_nm INTEGER,
  excitation_nm INTEGER,
  stock_mg_per_ml REAL,
  recommended_dilution TEXT,
  location TEXT,
  storage_sheet TEXT,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_antibodies_type ON antibodies(type);
CREATE INDEX IF NOT EXISTS idx_antibodies_target ON antibodies(target);
CREATE INDEX IF NOT EXISTS idx_antibodies_em ON antibodies(emission_nm);
```

Normalization helpers (implement):
- Species name standardization (title case).
- Ig notation normalization (e.g., `IgG 1` → `IgG1`).
- Fluorophore name → emission mapping using a small internal dictionary including AF488/532/546/555/568/594/633/635/647/660/680/700/750.

Deduplication key:
- `(type, vendor_catalog || name, host_species, target, fluorophore)` preferring the first seen.

Deliverables:
1) `server/import_excel.js`
- Reads `Inventory.xlsx` with `xlsx`.
- Iterates all sheets and rows; classifies records (`primary`, `secondary`, `serum`, `other`).
- Infers missing `emission_nm` via fluor map.
- Preserves `storage_sheet` and parses `storage_temp` if present (metadata only; not required in table).
- Inserts normalized rows into `antibodies` table with dedupe.
- Emits console warnings for missing `recommended_dilution` (primaries) and missing `stock_mg_per_ml` (secondaries), and for conflicting duplicates ignored by dedupe.

2) `server/db.js`
- Create a SQLite connection via `better-sqlite3` to `/sqlite/ihc.sqlite`.
- Expose minimal helpers: `getDb()`, `prepare(sql)`, `transaction(fn)`.

3) NPM script
- Ensure `npm run import:excel` executes the importer.

Debug expectations:
- Log: total sheets, total rows processed, inserted vs. deduped counts, and warnings counts.
- Exit with non-zero code if the workbook is missing or unreadable.

Acceptance checks:
- After running `npm run import:excel`, `/sqlite/ihc.sqlite` exists and contains `antibodies` rows.
- Emission mapping applied where needed.
- No crash on sheets with unexpected headers; rows skipped with warning.

Notes:
- Keep code under ~500 lines across the two files.
- Do not implement app logic here; just ingestion.

Finally, commit your edits with a concise commit message summarizing this step.
