# To-Do List
- Use the todolist tool to create relevant todos for the following task while you're implementing.

# Prompt — 05 API endpoints and Express server

Role: You are an AI coding agent. Implement the minimal Express server per PRD.

Read `docs/PRD.md` fully before starting and follow it as the single source of truth for requirements and constraints.

Before starting: read `Agent Summaries/04_db_layer.md` if it exists, and only that file, to align DB access patterns.

After completion: write a concise summary of what you completed (routes added, request/response shapes, logging/error handling, static serving) to `Agent Summaries/05_api_server.md`. Also update `docs/Project_Progress.md` by checking off completed items.

Objective:
- Implement `server/index.js` to:
  - Serve the built client from `dist/` (static hosting + SPA fallback to `index.html`).
  - Expose two endpoints: `POST /api/plan` and `GET /api/suggest/targets`.
  - Use the pure functions from `server/logic.js` for planning logic (no DB inside logic).

Context:
- DB helpers from `server/db.js`.
- Schema per `docs/PRD.md` §2. Business logic per §§3–5, 9–10. API per §7.
- Keep dependencies minimal (only Express).

Endpoints:
- `GET /health` → `{ ok: true }`.
- `GET /api/suggest/targets?q=...`
  - Query `antibodies` where `type='primary'` and `target LIKE ?` (case-insensitive, sanitized) to provide autocomplete suggestions (distinct targets, capped to 20).
- `POST /api/plan`
  - Body: `{ immunos: [{ slides: number, primaries: string[], colors: string[] }] }`.
  - For each immuno: query primaries by target; query candidate secondaries; run matching and calculations via `logic.js`; assemble `primariesTable`, `secondariesTable`, `solutions`.
  - Return warnings array for missing data, >2 hosts, etc.

Server behavior:
- JSON body parsing via `express.json()`.
- Basic request logging to console (method, path, duration).
- Centralized error handler returning JSON `{ error: message }` with proper status codes.
- Static hosting: `express.static('dist')` and SPA fallback.

Constraints:
- Keep `server/index.js` under ~300 lines.
- No extra deps (no cors, no helmet).
- Avoid global mutable state except DB connection.

Acceptance checks:
- `npm start` starts server and `/health` returns 200.
- `/api/suggest/targets` returns suggestions from DB when populated.
- `/api/plan` returns tables structure per PRD §6.2 given mock data.

Dev helper:
- `server/dev.js`: start the server with console logging and graceful shutdown (SIGINT/SIGTERM). No nodemon.

Finally, commit your edits with a concise commit message summarizing this step.
