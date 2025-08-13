# To-Do List
- Use the todolist tool to create relevant todos for the following task while you're implementing.

# Prompt — 03 Implement core logic (pure functions) + unit tests

Role: You are an AI coding agent. Implement pure functions for matching and calculations, and cover them with `node:test` unit tests. No DB or server calls inside these functions.

Read `docs/PRD.md` fully before starting and follow it as the single source of truth for requirements and constraints.

Before starting: read `Agent Summaries/02_ingest_excel.md` if it exists, and only that file, to understand data normalization outcomes.

After completion: write a concise summary of what you completed (APIs exported, key cases covered, tests added, any assumptions) to `Agent Summaries/03_logic_and_tests.md`. Also update `docs/Project_Progress.md` by checking off completed items.

Objective:
- Implement `server/logic.js` with the following exports and behaviors, per `docs/PRD.md` §§3–5, 9–10:
  - `COLOR_TO_RANGE_NM` and `PREFERRED_FLUOR_EMISSIONS` constants.
  - `mapFluorophoreNameToEmission(name: string): number | null`.
  - `matchSecondaries(primaries, secondaries, colorSelections)` respecting host, Ig rules, and color ranges.
  - `unifySerumHosts(chosenSecondaries)` returning a single host if possible or a tuple of two hosts; warn if >2.
  - `calcBlockingVolumes(S, hosts)` returning total mL (rounded up) and component volumes (5% serum or two hosts 2.5%+2.5%).
  - `calcPrimaryMix(S, primariesWithDilutions)` handling multiple primaries, using 1:1000 default if missing, `V_diluent` split 10% Blocking / 90% PBST.
  - `calcSecondaryMix(S, secondariesWithStocks)` computing stock µL as `V_mL / C_stock` (assume 1 mg/mL if missing), PBST remainder.

Inputs/outputs shapes:
- Define small TypeScript-style JSDoc typedefs at top of `logic.js` (JS allowed with JSDoc types) matching `docs/PRD.md` §2 fields used.

Unit tests (Node test files under `server/__tests__/`):
- `matchSecondaries()` — host match, IgG wildcard (`IgG` vs `IgG1`), color window filter.
- `unifySerumHosts()` — single host vs two-host mix.
- `calcBlockingVolumes()` — rounding and 5%/2.5% splits.
- `calcPrimaryMix()` — multiple primaries, subtraction of stock volumes, 10%/90% diluent split.
- `calcSecondaryMix()` — stock µL and PBST remainder.

Constraints:
- Keep each file under ~500 lines.
- Pure functions only; no DB access.
- Use integers in µL during calc; round totals to whole mL then recompute components to sum exactly.

Acceptance checks:
- `npm test` runs and all tests pass once implemented.
- Functions are documented with concise JSDoc for clarity.

Notes:
- Reuse fluorophore map from PRD.
- Handle color synonyms: `far red`, `far-red`, `farred`.

Finally, commit your edits with a concise commit message summarizing this step.
