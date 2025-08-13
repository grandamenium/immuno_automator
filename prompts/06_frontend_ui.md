# To-Do List
- Use the todolist tool to create relevant todos for the following task while you're implementing.

# Prompt — 06 Frontend UI (React + Vite + TS)

Role: You are an AI coding agent. Implement the minimal, themed UI per PRD without external UI libraries.

Read `docs/PRD.md` fully before starting and follow it as the single source of truth for requirements and constraints.

Before starting: read `Agent Summaries/05_api_server.md` if it exists, and only that file, to align API shapes and endpoints.

After completion: write a concise summary of what you completed (components, state flows, styling decisions, accessibility notes) to `Agent Summaries/06_frontend_ui.md`. Also update `docs/Project_Progress.md` by checking off completed items.

Objective:
- Build a one-page app with:
  - Header "IHC Helper".
  - Form to add/remove immuno sections.
  - Inputs: slides (int ≥1), primaries (up to 3 with autocomplete), color per primary (`green`, `red`, `far‑red`).
  - A “Compute plan” button.
  - Three tables below the form per PRD §6.2.

Context:
- Vite + TypeScript + React.
- No UI libraries. One CSS file `client/src/theme.css` using subtle grid, monospace for numbers, rounded cards, and a faint inline SVG background.
- API endpoints per PRD §7.

Implementation details:
- Components:
  - `App.tsx` orchestrates state and renders sections.
  - `components/ImmunoSection.tsx` for a single immuno input block.
  - `components/Tables.tsx` for rendering Primaries, Secondaries, Solutions tables.
- Types: define shared TS interfaces aligned with API payloads.
- Autocomplete: call `/api/suggest/targets?q=` with debounced input; render a simple dropdown.
- Accessibility: label inputs, keyboard navigable, responsive layout.
- Theme: implement light “microbiology” theme in `theme.css`.

Constraints:
- Keep each file under ~300 lines.
- No state libraries beyond React hooks.
- No table libraries; use semantic HTML tables.

Acceptance checks:
- App loads, responsive layout, and form interaction works (without calling API yet).
- CSS applies theme.
- Autocomplete dropdown shows suggestions when API is available later.

Debug:
- Console.warn on invalid inputs; guard forms against submission when invalid.

Finally, commit your edits with a concise commit message summarizing this step.
