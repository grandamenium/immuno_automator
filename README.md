# ImmunoCalculator

Quick start for local development and optional Render deployment.

## Local development

- Requirements: Node 20 LTS recommended
- Install deps:

```bash
npm ci
```

- Build client and import Excel into SQLite:

```bash
npm run build && npm run import:excel
```

- Start server:

```bash
npm start
```

- Open:
  - App: http://localhost:3000/
  - Health: http://localhost:3000/health

### Notes
- Importer looks for `Inventory.xlsx` at repo root, or `data/antibodies.xlsx`.
- SQLite DB default: `sqlite/ihc.sqlite`. Override with:

```bash
DB_FILE=/absolute/writable/path/ihc.sqlite npm start
```

- If the default path is not writable (e.g., some hosts), the server falls back automatically to a writable temp directory like `/tmp/sqlite/ihc.sqlite`.

## Render deployment (optional)

- Type: Web Service
- Runtime: Node 20
- Build command: `npm run build && npm run import:excel`
- Start command: `npm start` (or see “No persistent disk” below)
- Health check: `/health`

### No persistent disk (free option)
- Use Start command: `npm run import:excel && npm start`
  - Seeds the DB on each deploy into a writable path.
  - Data resets on each deploy (no persistence), which is fine for read-only reference data.

### With persistent disk (optional)
- Add a Persistent Disk mounted at `/sqlite` and keep Start as `npm start`.
- You can also set `DB_FILE=/sqlite/ihc.sqlite` to be explicit.

### Environment variables (optional)
- `DB_FILE`: absolute path to SQLite file to override default.
