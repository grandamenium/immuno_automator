# IHC Helper — Product Requirements Document (PRD)

This PRD specifies a minimal, end-to-end “IHC Helper” application to assist planning immunohistochemistry (IHC) runs. It is derived directly from the provided brief, organized for implementation and testing.

Note on data source for this repository: the repo currently contains `Inventory.xlsx` at the root. The app specification references `/data/antibodies.xlsx`. During development, we will analyze `Inventory.xlsx` and either (a) convert it into `/data/antibodies.xlsx` with normalized sheets, or (b) point the importer to `Inventory.xlsx` while conforming to the same schema and normalization rules below.

## 0) Goals

Given user inputs about planned IHC runs (“immunos”), the app must:

1. Search a local lab database (ingested from a multi‑sheet Excel workbook) to pick primary and secondary antibodies and the appropriate blocking serum(s) according to rules in §4.
2. Map user‑chosen color words (e.g., green, red, far‑red) to fluorophore emission wavelengths (nm) so secondaries can be filtered by spectral color.
3. Calculate volumes for blocking, primary, and secondary solutions for each immuno based on 300 µL/slide, round up each prepared solution to the nearest mL, and respect composition rules in §5.
4. Render three tables per run: primaries table, secondaries table, and solution‑recipes table (see §6 outputs).

Avidin/biotin/streptavidin steps are explicitly ignored.

## 1) Tech stack & project shape

- Frontend: React (Vite) + TypeScript. No UI libraries. One CSS file with a light “microbiology” theme.
- Backend: Node 20 + Express.
- Database: SQLite via `better-sqlite3`.
- Excel import: `xlsx` to ingest the workbook at startup (one‑shot import script).
- Testing: Node’s built‑in `node:test` for unit tests.
- One service: Express serves built React app (`dist/`) and exposes a minimal JSON API. Suitable for a single Render Web Service.

Dependencies (prod): `express`, `better-sqlite3`, `xlsx`
Dev deps: `vite`, `typescript`, `@types/node`, `@types/express`

NPM scripts:

```json
{
  "dev": "vite & node server/dev.js",
  "build": "vite build",
  "start": "node server/index.js",
  "import:excel": "node server/import_excel.js",
  "test": "node --test"
}
```

Repository layout:

```
/ server
  index.js            # Express app: API + static file serving
  import_excel.js     # One‑shot Excel -> SQLite loader
  logic.js            # Matching + calculations (pure functions, unit‑tested)
  db.js               # SQLite connection + simple query helpers
  types.d.ts          # Shared types
/client
  index.html
  src/main.tsx
  src/App.tsx
  src/components/*
  src/theme.css
/sqlite
  ihc.sqlite          # Generated
/data
  antibodies.xlsx     # Provided Excel workbook (multi‑sheet)
```

## 2) Database ingestion & schema

Input: A multi‑sheet Excel workbook. Sheet names might indicate storage temperature (e.g., "4C", "-20C") or content type (e.g., "Primaries", "Secondaries", "Other"). Normalize across sheets into a single schema.

Ingestion rules:
- Read all sheets.
- Identify entries as `primary`, `secondary`, or `serum/other` using header keywords (e.g., presence of `Target protein`, `Host/Raised in`, `Ig class`, `Anti-<species>`, `Fluorophore`, `Emission (nm)`, `Stock (mg/mL)`, `Location/Box`). Where ambiguous, infer from fields like Fluorophore (→ secondary), or `Anti-Rabbit` in the target species field (→ secondary).
- Preserve sheet name as `storage_sheet` and add parsed `storage_temp` if name looks like a temperature (e.g., 4, -20) — stored as metadata only.
- Deduplicate by `(type, vendor_catalog || name, host_species, target, fluorophore)` preferring the first seen.

SQLite schema (minimal):

```sql
CREATE TABLE antibodies (
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
CREATE INDEX idx_antibodies_type ON antibodies(type);
CREATE INDEX idx_antibodies_target ON antibodies(target);
CREATE INDEX idx_antibodies_em ON antibodies(emission_nm);
```

Normalization helpers:
- Standardize species names (`mouse`→`Mouse`, `goat`→`Goat`, etc.).
- Standardize Ig notation (`IgG 1`→`IgG1`, `IgG-2a`→`IgG2a`).
- Parse fluorophore names into `emission_nm` using lookup in §3 when missing.

## 3) Color & fluorophore lookup

Color word → emission ranges (nm):

```ts
export const COLOR_TO_RANGE_NM: Record<string, [number, number]> = {
  violet: [380, 450],
  blue: [450, 495],
  cyan: [485, 520],
  green: [495, 570],
  yellow: [570, 590],
  orange: [590, 620],
  red: [620, 650],
  'deep red': [640, 660],
  'far red': [650, 700],
  'far-red': [650, 700],
  'farred': [650, 700],
  'near-ir': [700, 780]
};
```

Preferred fluorophore emission anchors (nm):

```ts
export const PREFERRED_FLUOR_EMISSIONS: Record<string, number[]> = {
  green: [519],
  red:   [565, 603, 617],
  'far red': [671]
};
```

Include a small dictionary mapping fluorophore names to emission peaks (e.g., AF488/532/546/555/568/594/633/635/647/660/680/700/750). Matching accepts any secondary whose `emission_nm` falls inside the chosen color range.

## 4) Matching rules

Given an immuno with up to three primaries and a chosen color per primary:

1. Find primaries by `target` (case/space/punctuation‑insensitive). If multiple matches, pick the first (deduped). If none, return `N/A`.
2. For each chosen primary, select a secondary that satisfies all:
   - `type='secondary'`.
   - `target` species recognized matches the primary’s host species (e.g., primary host `Rabbit` → secondary `Anti‑Rabbit`).
   - Ig matching: if primary has `IgG1/IgG2a/...`, prefer exact subclass matches. If no subclass field on either side, treat as compatible. Special rule: a secondary specific for `IgG` (no subclass) is compatible with any `IgG*` primary; a primary listed as `IgG` is compatible with a secondary that is either general `IgG` or any `IgG*` subclass.
   - Color constraint: secondary `emission_nm` must lie within the selected color range.
3. Serum host unification per immuno: try to choose secondaries all raised in the same host species (e.g., all Goat) to allow a single blocking serum. If impossible, allow two hosts and mark blocking serum as a mix (2.5% each). If three different hosts are unavoidable, return a validation warning requesting user adjustment.

Tie‑breakers when multiple secondaries match:
- Prefer keeping the same host species as others in the same immuno.
- Prefer preferred fluorophore peaks in §3 for the requested color.
- Prefer entries that include a known stock concentration.

## 5) Volume calculations & compositions

Let `S = # slides` for an immuno. For every solution below, target 300 µL/slide and round the final prepared volume up to the next whole mL. Perform calculations in µL, then round totals, then recompute component volumes to meet the rounded total.

5.1 Blocking solution (per immuno)
- Total volume `V_block = ceil_ml(S * 300 µL)`.
- Composition by volume:
  - 5% serum from the same host as the secondary antibodies (if two hosts, 2.5% each).
  - Remainder is `PBST + 0.01% BSA` base (report as a single premade diluent line item).

5.2 Primary antibody solution (per immuno)
- Total volume `V_pri = ceil_ml(S * 300 µL)`.
- Diluent: a 1:10 dilution of the blocking solution with PBST.
  - Compute diluent volume `V_diluent = V_pri - Σ V_primary_ab_i`.
  - Of `V_diluent`, use 10% `Blocking solution` and 90% `PBST`.
- Primary antibody volumes: for each selected primary with `recommended_dilution` like `1:1000`, add `V_pri / 1000`. If missing, default to `1:1000` and warn.

5.3 Secondary antibody solution (per immuno)
- Total volume `V_sec = ceil_ml(S * 300 µL)`.
- Secondary concentration: target 1 µg/mL final for each secondary simultaneously in the same mix.
- For each secondary with stock concentration `C_stock` (mg/mL), compute stock volume in µL: `V_stock_µL = (V_sec_mL) / C_stock`. If missing, assume 1 mg/mL and warn. Remainder to `V_sec` is PBST.

## 6) Inputs and outputs

Inputs (UI):
- How many immunos? (integer ≥ 1)
- For each immuno:
  - Slides (integer ≥ 1)
  - Primaries (up to 3): protein names (free text with autocomplete suggestions from DB)
  - Color per primary: one of `green`, `red`, `far‑red`

Outputs (rendered as 3 tables):
- Table A: Primaries (columns: `Immuno # | Ab1 | Ab2 | Ab3`). Each cell shows: Name (e.g., `Rabbit anti‑Reelin`), Ig class, Recommended dilution (e.g., `1:1000`), Location (storage_sheet, location). `N/A` if none.
- Table B: Secondaries (same shape as A). Each cell shows: Name (e.g., `Goat anti‑Rabbit Alexa 647`), Host species (raised in), Ig specificity (e.g., `IgG`), Emission nm, Location.
- Table C: Solutions. For each immuno: blocking (total mL and component volumes), primary (total mL; each primary’s stock µL; diluent breakdown), secondary (total mL; each secondary’s stock µL; PBST remainder).

## 7) API

- POST `/api/plan`
  - Body: `{ immunos: [{ slides: number, primaries: string[], colors: string[] /* same length as primaries */ }] }`
  - Response: `{ primariesTable, secondariesTable, solutions }` per §6.

- GET `/api/suggest/targets?q=...`
  - Autocomplete query from `antibodies` where `type='primary'`.

## 8) UI (minimal, microbiology‑themed)

- One responsive page with header “IHC Helper”.
- Form that adds/removes immuno sections.
- A “Compute plan” button.
- Render the three tables below the form.
- Styling: subtle grid, monospace for numbers, rounded cards, inline SVG background of faint cells/colonies. No UI libs.

## 9) Business rules — edge cases & warnings

- Serum host mismatch: If chosen secondaries would require >2 distinct host species, show a warning and prefer alternatives that reduce host count.
- Ig generalist: `IgG` (no subclass) is compatible with any `IgG*`. Different subclasses are incompatible unless the secondary is general `IgG`.
- Missing data: If `recommended_dilution` missing on a primary, use `1:1000` and warn. If secondary stock concentration missing, assume `1 mg/mL` and warn.
- Color synonyms: Accept `far red`, `far-red`, `farred`.
- Duplicates: Return the first unique match by the dedupe key (§2). Do not list duplicates.
- Biotin/streptavidin: Ignore.

## 10) Unit tests (must pass)

Write tests for the pure functions in `logic.js`:
- `matchSecondaries()` respects host, Ig rules, and color windows; tests for IgG wildcard compatibility.
- `unifySerumHosts()` picks a single host when possible; otherwise `(hostA, hostB)`.
- `calcBlockingVolumes(S)` returns rounded‑up totals and 5% (or 2.5%+2.5%) serum splits.
- `calcPrimaryMix(S, dilutions)` handles multiple primaries, subtracts antibody stock volumes, and splits diluent 10%/90% block/PBST.
- `calcSecondaryMix(S, stocks)` computes stock µL as `V_mL / C_stock` and PBST remainder.

## 11) Deployment (Render)

- Single Web Service.
- Build command: `npm run build && npm run import:excel` (import reads `/data/antibodies.xlsx` into `/sqlite/ihc.sqlite`).
- Start command: `npm start`.
- Store the Excel file as a Render static asset or include it under `/data`.

## 12) Acceptance criteria (must‑haves)

- One‑page app. Input form → three tables exactly as in §6.
- DB import from multi‑sheet Excel into SQLite with the schema in §2.
- Matching and serum rules per §4.
- Color mapping and emission‑range filtering per §3.
- Volume math per §5 with rounding up to whole mL.
- Minimal dependencies only.
- Clean, commented code; pure functions in `logic.js` with unit tests.

## 13) Nice‑to‑haves (if trivial)

- Export CSV buttons for each table (no libs).
- Persist last run in `localStorage`.

## 14) Example request body

```json
{
  "immunos": [
    {
      "slides": 8,
      "primaries": ["Reelin", "Calretinin"],
      "colors": ["far red", "green"]
    }
  ]
}
```

## 15) Developer notes

- Build small internal tables to map fluorophore names to emission peaks (e.g., AF488→519, AF555→565, AF568→603, AF594→617, AF647→671, AF680→704, AF700→719, AF750→776). Use these to fill missing `emission_nm` during import.
- Keep numeric math in µL during calculation, then round totals to whole mL and recompute component volumes so they sum exactly.
- Treat `PBST + 0.01% BSA` as a single premade diluent in outputs; don’t compute its internal stock preparation.
