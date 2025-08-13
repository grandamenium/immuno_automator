# To-Do List
- Use the todolist tool to create relevant todos for the following task while you're implementing.

# Prompt — 01 Setup project structure and tooling

Role: You are an AI coding agent working in the repo root. Implement this step end-to-end with minimal dependencies, without building app features yet.

Read `docs/PRD.md` fully before starting and follow it as the single source of truth for requirements and constraints.

Before starting: there is no prior step. If an agent summary exists for a previous step, ignore it for this step.

After completion: write a concise summary of what you completed (scope, files added/edited, commands executed, debugging notes) to `Agent Summaries/01_setup_project.md`. Create the `Agent Summaries` folder if it does not exist. Also update `docs/Project_Progress.md` by checking off completed items.

Objective:
- Initialize the project skeleton and tooling exactly as specified in `docs/PRD.md` (tech stack, scripts, and layout), creating placeholder files and minimal boilerplate.

Constraints:
- Minimal dependencies only: prod `express`, `better-sqlite3`, `xlsx`; dev `vite`, `typescript`, `@types/node`, `@types/express`.
- Keep files under ~500 lines.
- Do not implement business logic or UI beyond minimal placeholders.
- Preserve directory structure in PRD; create missing folders.

Repository context:
- Existing file: `Inventory.xlsx` at repo root (for later ingestion).
- PRD: `docs/PRD.md` with full requirements.

Required outputs:
1) Package and scripts
- Create `package.json` with scripts:
```json
{
  "dev": "vite & node server/dev.js",
  "build": "vite build",
  "start": "node server/index.js",
  "import:excel": "node server/import_excel.js",
  "test": "node --test"
}
```
- Install declared dependencies.

2) Directory structure and placeholder files
- Create directories and empty files:
```
server/index.js
server/dev.js               # lightweight dev runner
server/import_excel.js
server/logic.js
server/db.js
server/types.d.ts
client/index.html
client/src/main.tsx
client/src/App.tsx
client/src/components/.gitkeep
client/src/theme.css
sqlite/.gitkeep
data/.gitkeep
```
- Add minimal placeholder content:
  - `server/index.js`: basic Express app that returns 200 on `/health` and logs startup.
  - `server/dev.js`: starts Express app with nodemon-like behavior avoided (no extra deps); simple runner with console logging.
  - `client/index.html`: Vite HTML shell with root div.
  - `client/src/main.tsx`, `client/src/App.tsx`: minimal React app rendering "IHC Helper" header only.
  - `client/src/theme.css`: create empty file with comment header.

3) TypeScript & Vite baseline
- Add `tsconfig.json` and `vite.config.ts` minimal setup for React + TS.
- Configure Vite to output to `dist/`.

4) Debug & DX
- Add basic console logging on server start and request logging for `/health`.
- Do not add logging libraries.

Acceptance checks:
- `npm run build` succeeds (client only for now).
- `npm start` runs Express and serves 200 on `/health`.
- Files and directories match PRD layout.

Deliverables:
- Committed files as above.
- Short note in `README.md` explaining scripts and layout (optional here; full README will be done later).

Finally, commit your edits with a concise commit message summarizing this step.
