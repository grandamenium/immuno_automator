# To-Do List
- Use the todolist tool to create relevant todos for the following task while you're implementing.

# Prompt — 07 Frontend integration + niceties

Role: You are an AI coding agent. Wire the frontend to the backend, render results, and add small UX features.

Read `docs/PRD.md` fully before starting and follow it as the single source of truth for requirements and constraints.

Before starting: read `Agent Summaries/06_frontend_ui.md` if it exists, and only that file, to align component contracts.

After completion: write a concise summary of what you completed (API wiring, state persistence, CSV export, error handling) to `Agent Summaries/07_frontend_integration.md`. Also update `docs/Project_Progress.md` by checking off completed items.

Objective:
- Connect the form to `POST /api/plan` and render the returned tables.
- Add small “export CSV” buttons for each table (build CSV manually, trigger download).
- Persist the last run input in `localStorage` and preload on app load.

Context:
- API per `docs/PRD.md` §7. Tables per §6.2. Business rules per §§3–5, 9–10.

Implementation details:
- Submit handler: validate inputs; send JSON; handle loading and error states.
- Render results into three tables; show warnings, if any.
- CSV export: generate CSV strings from current table data; use `Blob` and `URL.createObjectURL`.
- Persistence: serialize form state on change to `localStorage`; restore on mount with validation.

Constraints:
- No additional dependencies.
- Keep files concise and typed.

Acceptance checks:
- Successful request renders the three tables accurately.
- CSV files download and contain expected headers and rows.
- Refresh restores previous form state.

Debug:
- Console.log request/response and timing in dev mode; Console.error on failures with user-friendly toasts (plain HTML, no libs).

Finally, commit your edits with a concise commit message summarizing this step.
