# To-Do List
- Use the todolist tool to create relevant todos for the following task while you're implementing.

# Prompt — 08 Deployment (Render)

Role: You are an AI coding agent. Prepare the project for deployment to Render as a single Web Service.

Read `docs/PRD.md` fully before starting and follow it as the single source of truth for requirements and constraints.

Before starting: read `Agent Summaries/07_frontend_integration.md` if it exists, and only that file, to align build and runtime expectations.

After completion: write a concise summary of what you completed (build verification, import step results, start validation, deploy notes) to `Agent Summaries/08_render_deploy.md`. Also update `docs/Project_Progress.md` by checking off completed items.

Objective:
- Ensure build and start commands work in Render:
  - Build: `npm run build && npm run import:excel`
  - Start: `npm start`
- Ensure the Excel file is bundled under `/data` or configured as a Render static asset.

Implementation steps:
- Verify `package.json` scripts match PRD.
- Confirm that `server/index.js` serves static `dist/` and the API under `/api/*`.
- Ensure importer reads from `/data/antibodies.xlsx` and writes to `/sqlite/ihc.sqlite`.
- Add a minimal `README.md` deploy section (commands, expected env/runtime Node 20).
- Provide instructions to add a Render Web Service:
  - Root: repo root
  - Runtime: Node 20
  - Build command: `npm run build && npm run import:excel`
  - Start command: `npm start`
  - Disk: persistent (if needed) or ephemeral (since DB rebuilt on build)
  - Health check: `GET /health`
- Validate locally by running build and importer, then start and test endpoints.

Acceptance checks:
- Fresh environment can run the build/import/start pipeline without manual steps.`
- `/health` and static app served.
- API responds correctly post-deploy.

Debug:
- Ensure meaningful console logs exist for build, import, and server start; include error stacks on failure.

Finally, commit your edits with a concise commit message summarizing this step.
