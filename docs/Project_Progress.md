# Project Progress — IHC Helper

Use this checklist to track progress. Each step links to a detailed prompt in `prompts/` for an AI agent to execute that step. Do not start later steps until earlier ones are complete and reviewed.

- [X] 01 — Initialize project structure and tooling
  - Create minimal repo layout, `package.json` scripts, server/client directories, TypeScript + Vite setup, and placeholder files per PRD.
  - Prompt: `prompts/01_setup_project.md`

- [X] 02 — Analyze Excel workbook and convert to usable SQLite database
  - Inspect `Inventory.xlsx`, design normalization to PRD schema, implement first-pass importer, produce `/sqlite/ihc.sqlite`.
  - Prompt: `prompts/02_ingest_excel.md`

- [X] 03 — Implement core logic (pure functions) + unit tests
  - Color mapping, fluorophore lookup, matching rules, serum host unification, and volume/recipes calculations in `server/logic.js`. Cover with `node:test`.
  - Prompt: `prompts/03_logic_and_tests.md`

- [ ] 04 — Database helper layer
  - Implement `server/db.js` for SQLite connection, schema checks, and query helpers.
  - Prompt: `prompts/04_db_layer.md`

- [ ] 05 — API endpoints and Express server
  - Implement `POST /api/plan` and `GET /api/suggest/targets`, static serving, and dev server script.
  - Prompt: `prompts/05_api_server.md`

- [ ] 06 — Frontend UI (React + Vite + TS)
  - Build minimal microbiology-themed UI: inputs for immunos, colors, and tables rendering.
  - Prompt: `prompts/06_frontend_ui.md`

- [ ] 07 — Frontend integration + niceties
  - Wire to API, render 3 tables, CSV export buttons, and persist last run in `localStorage`.
  - Prompt: `prompts/07_frontend_integration.md`

- [ ] 08 — Deployment (Render)
  - Configure build/import/start commands and verify server serves built client + API.
  - Prompt: `prompts/08_render_deploy.md`

Notes:
- Keep files under ~500 lines when possible.
- Prefer few dependencies per PRD.
- Add basic debug logging in server and importer for visibility.
- Refer to `docs/PRD.md` for acceptance criteria per step.
