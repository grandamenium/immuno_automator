/*
  Excel → SQLite importer
  - Reads Inventory.xlsx (or data/antibodies.xlsx if present)
  - Normalizes rows to PRD schema
  - Dedupe and insert into sqlite/ihc.sqlite
  - Logs stats and warnings
*/

const fs = require('node:fs');
const path = require('node:path');
const process = require('node:process');
const XLSX = require('xlsx');
const { getDb, prepare, transaction } = require('./db');

const START_TS = Date.now();

function logInfo(msg) { console.log(`[import:excel] ${msg}`); }
function logWarn(msg) { console.warn(`[import:excel][warn] ${msg}`); }
function logErr(msg) { console.error(`[import:excel][error] ${msg}`); }

const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_XLSX = path.resolve(ROOT_DIR, 'Inventory.xlsx');
const ALT_XLSX = path.resolve(ROOT_DIR, 'data', 'antibodies.xlsx');

const SPECIES_WORDS = [
  'Mouse','Rat','Rabbit','Goat','Donkey','Sheep','Guinea Pig','Guinea pig','Chicken','Human','Hamster','Pig','Cow','Bovine'
];

// Fluorophore → emission map (nm). Includes AF488/532/546/555/568/594/633/635/647/660/680/700/750 and common dyes.
const FLUOR_TO_EMISSION = {
  'AF488': 519, 'Alexa Fluor 488': 519, 'Alexa 488': 519, 'FITC': 519,
  'AF532': 554, 'Alexa Fluor 532': 554,
  'AF546': 570, 'Alexa Fluor 546': 570, 'TRITC': 570,
  'AF555': 565, 'Alexa Fluor 555': 565, 'Cy3': 565,
  'AF568': 603, 'Alexa Fluor 568': 603,
  'AF594': 617, 'Alexa Fluor 594': 617,
  'AF633': 647, 'Alexa Fluor 633': 647,
  'AF635': 655, 'Alexa Fluor 635': 655,
  'AF647': 671, 'Alexa Fluor 647': 671, 'Alexa 647': 671, 'Cy5': 670,
  'AF660': 690, 'Alexa Fluor 660': 690,
  'AF680': 704, 'Alexa Fluor 680': 704, 'Cy5.5': 694,
  'AF700': 719, 'Alexa Fluor 700': 719,
  'AF750': 776, 'Alexa Fluor 750': 776, 'Cy7': 776
};

function titleCaseSpecies(value) {
  if (!value) return value;
  const clean = String(value).trim().toLowerCase();
  // Handle two-word species like 'guinea pig'
  return clean.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function normalizeIgClass(value) {
  if (!value) return value;
  let v = String(value).trim();
  // Unify separators and remove spaces around subclass numbers
  v = v.replace(/\s*[-\s]?\s*(\d)([ab])?\b/gi, (_, d, s) => (s ? `${d}${s.toLowerCase()}` : d));
  v = v.replace(/\s+/g, ''); // remove spaces
  v = v.replace(/IgG([12][ab]?)/i, (m, g) => `IgG${g}`);
  // Ensure standard casing for common tokens
  v = v.replace(/igg/gi, 'IgG').replace(/igh/gi, 'IgH');
  return v;
}

function extractFluorophoreFromStrings(...fields) {
  const joined = fields.filter(Boolean).map(String).join(' ').toLowerCase();
  // Common tokens
  const candidates = [
    /alexa\s*fluor\s*(\d{3})/i,
    /af\s*[- ]?(\d{3})/i,
    /(cy\s*5\.5)/i,
    /(cy\s*\d)/i,
    /(fitc)/i,
    /(tritc)/i
  ];
  for (const rx of candidates) {
    const m = joined.match(rx);
    if (m) {
      const token = m[0];
      if (/\d{3}/.test(m[1] || '')) {
        const num = m[1];
        return `AF${num}`; // normalize AFxxx
      }
      return token.toUpperCase().replace(/\s+/g, '');
    }
  }
  return null;
}

function inferEmissionNm(fluorophore, fallbackName) {
  if (!fluorophore && fallbackName) {
    const inferred = extractFluorophoreFromStrings(fallbackName);
    if (inferred) fluorophore = inferred;
  }
  if (!fluorophore) return { fluorophore: null, emission_nm: null };
  // Best-effort name normalization to dictionary keys
  const keys = Object.keys(FLUOR_TO_EMISSION);
  const direct = keys.find(k => k.toLowerCase() === fluorophore.toLowerCase());
  if (direct) return { fluorophore: direct, emission_nm: FLUOR_TO_EMISSION[direct] };
  // If AF number provided, try AFxxx form
  const af = fluorophore.match(/af\s*-?\s*(\d{3})/i);
  if (af) {
    const key = `AF${af[1]}`;
    if (FLUOR_TO_EMISSION[key]) return { fluorophore: key, emission_nm: FLUOR_TO_EMISSION[key] };
  }
  // Alexa 647 → AF647 mapping
  const alexa = fluorophore.match(/(alexa\s*fluor\s*(\d{3}))/i);
  if (alexa) {
    const key = `AF${alexa[2]}`;
    if (FLUOR_TO_EMISSION[key]) return { fluorophore: key, emission_nm: FLUOR_TO_EMISSION[key] };
  }
  // Cy dyes
  const cy = fluorophore.match(/cy\s*(5\.5|\d)/i);
  if (cy) {
    const key = `Cy${cy[1].replace(/\s+/g, '')}`;
    const finalKey = key.toUpperCase();
    if (FLUOR_TO_EMISSION[finalKey]) return { fluorophore: finalKey, emission_nm: FLUOR_TO_EMISSION[finalKey] };
  }
  // FITC/TRITC
  if (/fitc/i.test(fluorophore) && FLUOR_TO_EMISSION['FITC']) return { fluorophore: 'FITC', emission_nm: FLUOR_TO_EMISSION['FITC'] };
  if (/tritc/i.test(fluorophore) && FLUOR_TO_EMISSION['TRITC']) return { fluorophore: 'TRITC', emission_nm: FLUOR_TO_EMISSION['TRITC'] };
  return { fluorophore, emission_nm: null };
}

function firstValue(obj, keys) {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') return obj[k];
  }
  return null;
}

function toNumber(val) {
  if (val === undefined || val === null) return null;
  const s = String(val).replace(/[,\s]/g, '').replace(/mg\s*\/\s*ml/i, '').replace(/µl|ul|ml/i, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseCatalogOrVendor(row) {
  const catalog = firstValue(row, [
    'catalog', 'catalog number', 'catalog no', 'catalog #', 'cat', 'cat#', 'cat #', 'sku'
  ]);
  const vendor = firstValue(row, [
    'vendor', 'company', 'supplier', 'brand'
  ]);
  let combined = null;
  if (vendor && catalog) combined = `${vendor} ${catalog}`;
  else if (catalog) combined = String(catalog);
  else if (vendor) combined = String(vendor);
  return combined ? String(combined).trim() : null;
}

function guessType(row, name, target, host, fluorophore, emission_nm) {
  const hay = [name, target, host].filter(Boolean).join(' ').toLowerCase();
  const hasFluor = !!fluorophore || !!emission_nm || /alexa|af\s*\d{3}|fitc|tritc|cy\s*\d/i.test(hay);
  if (hasFluor) return 'secondary';
  if (/serum/i.test(hay)) return 'serum';
  // Secondary heuristic: "anti-<species>" with recognized species
  if (/anti-\s*([a-z ]+)/i.test(hay)) {
    const m = hay.match(/anti-\s*([a-z ]+)/i);
    const species = titleCaseSpecies(m[1]);
    if (SPECIES_WORDS.includes(species)) return 'secondary';
  }
  // If target protein-like words or explicit primary flags exist
  const hasAntigen = /target|antigen|protein|receptor|clone|monoclonal|polyclonal/i.test(Object.keys(row).join(' '));
  if (hasAntigen) return 'primary';
  // Fallback default: primary if there is a target protein field, else other
  return target ? 'primary' : 'other';
}

function canonicalizeRow(rawRow, sheetName) {
  // Lowercase keys for flexible matching
  const row = {};
  for (const [k, v] of Object.entries(rawRow)) {
    row[String(k).trim().toLowerCase()] = v;
  }

  const name = firstValue(row, ['name', 'antibody', 'product', 'description', 'primary', 'secondary']);
  const targetRaw = firstValue(row, ['target protein', 'target', 'antigen', 'anti', 'species recognized', 'reacts with']);
  const hostRaw = firstValue(row, ['host', 'host species', 'raised in', 'source']);
  const igRaw = firstValue(row, ['ig class', 'isotype', 'subclass', 'igg subclass']);
  const fluorRaw = firstValue(row, ['fluorophore', 'fluor', 'dye']);
  const emissionRaw = firstValue(row, ['emission', 'emission (nm)', 'em (nm)', 'em']);
  const excitationRaw = firstValue(row, ['excitation', 'excitation (nm)', 'ex (nm)', 'ex']);
  const stockRaw = firstValue(row, ['stock', 'stock (mg/ml)', 'conc', 'concentration', 'stock conc', 'stock mg/ml']);
  const dilutionRaw = firstValue(row, ['recommended dilution', 'dilution', 'working dilution', 'rec dilution']);
  const locationRaw = firstValue(row, ['location', 'box', 'drawer', 'freezer']);
  const notesRaw = firstValue(row, ['notes', 'comments', 'comment']);
  const vendorCatalog = parseCatalogOrVendor(row);

  let { fluorophore, emission_nm } = inferEmissionNm(fluorRaw, name);
  const explicitEmission = toNumber(emissionRaw);
  if (explicitEmission && !emission_nm) emission_nm = explicitEmission;

  const host_species = hostRaw ? titleCaseSpecies(hostRaw) : null;
  const ig_class = normalizeIgClass(igRaw);

  let target = targetRaw;
  if (target && /anti-\s*([a-z ]+)/i.test(String(target))) {
    // normalize "Anti-Rabbit" → "Rabbit"
    const m = String(target).match(/anti-\s*([a-z ]+)/i);
    target = titleCaseSpecies(m[1]);
  } else if (target && SPECIES_WORDS.includes(titleCaseSpecies(String(target)))) {
    // species token alone → treat as species
    target = titleCaseSpecies(String(target));
  }

  const type = guessType(row, name, target, host_species, fluorophore, emission_nm);

  // Backfill fluorophore if absent but name hints
  if (!fluorophore) {
    const f = extractFluorophoreFromStrings(name);
    if (f) {
      const m = inferEmissionNm(f, null);
      fluorophore = m.fluorophore;
      if (!emission_nm) emission_nm = m.emission_nm;
    }
  }

  const excitation_nm = toNumber(excitationRaw);
  const stock_mg_per_ml = toNumber(stockRaw);
  const recommended_dilution = dilutionRaw ? String(dilutionRaw).trim() : null;
  const location = locationRaw ? String(locationRaw).trim() : null;
  const storage_sheet = String(sheetName || '').trim();
  const notes = notesRaw ? String(notesRaw).trim() : null;

  return {
    type,
    name: name ? String(name).trim() : null,
    target: target ? String(target).trim() : null,
    host_species,
    ig_class,
    fluorophore,
    emission_nm,
    excitation_nm,
    stock_mg_per_ml,
    recommended_dilution,
    location,
    storage_sheet,
    notes,
    vendor_catalog_or_name: (vendorCatalog && String(vendorCatalog).trim()) || (name ? String(name).trim() : null)
  };
}

function createSchema(db) {
  const schemaSql = `
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
`;
  db.exec(schemaSql);
}

function runImport(workbookPath) {
  logInfo(`Starting import from ${workbookPath}`);
  const wb = XLSX.readFile(workbookPath, { cellDates: false });
  const sheetNames = wb.SheetNames || [];
  const totalSheets = sheetNames.length;
  logInfo(`Workbook sheets: ${totalSheets}`);

  const db = getDb();
  createSchema(db);

  const insertStmt = prepare(`
    INSERT INTO antibodies (
      type, name, target, host_species, ig_class, fluorophore, emission_nm, excitation_nm,
      stock_mg_per_ml, recommended_dilution, location, storage_sheet, notes
    ) VALUES (
      @type, @name, @target, @host_species, @ig_class, @fluorophore, @emission_nm, @excitation_nm,
      @stock_mg_per_ml, @recommended_dilution, @location, @storage_sheet, @notes
    )
  `);

  let counts = {
    totalSheets,
    totalRows: 0,
    inserted: 0,
    deduped: 0,
    skipped: 0,
    warnMissingDilutionPrimaries: 0,
    warnMissingStockSecondaries: 0,
    warnDuplicates: 0,
    warnRowIssues: 0
  };

  const seenKeys = new Set();

  const insertMany = transaction((rows) => {
    for (const r of rows) insertStmt.run(r);
  });

  for (const sheetName of sheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
    if (!Array.isArray(rows)) continue;
    const normalized = [];
    for (const raw of rows) {
      const rec = canonicalizeRow(raw, sheetName);
      counts.totalRows += 1;
      // Minimal requirement: must have at least a name or target
      if (!rec.name && !rec.target) {
        counts.skipped += 1;
        counts.warnRowIssues += 1;
        logWarn(`Skipped row on sheet "${sheetName}": missing name and target`);
        continue;
      }

      // Warnings per business rules
      if (rec.type === 'primary' && !rec.recommended_dilution) {
        counts.warnMissingDilutionPrimaries += 1;
        logWarn(`Primary missing recommended_dilution: ${rec.name || rec.target || '(unnamed)'}`);
      }
      if (rec.type === 'secondary' && (rec.stock_mg_per_ml === null || rec.stock_mg_per_ml === undefined)) {
        counts.warnMissingStockSecondaries += 1;
        logWarn(`Secondary missing stock_mg_per_ml: ${rec.name || rec.target || '(unnamed)'}`);
      }

      const key = [
        rec.type || '',
        (rec.vendor_catalog_or_name || '').toLowerCase(),
        (rec.host_species || '').toLowerCase(),
        (rec.target || '').toLowerCase(),
        (rec.fluorophore || '').toLowerCase()
      ].join('|');

      if (seenKeys.has(key)) {
        counts.deduped += 1;
        counts.warnDuplicates += 1;
        logWarn(`Duplicate ignored by dedupe (key=${key})`);
        continue;
      }

      seenKeys.add(key);
      normalized.push(rec);
    }

    if (normalized.length > 0) {
      insertMany(normalized);
      counts.inserted += normalized.length;
    }
  }

  const durationMs = Date.now() - START_TS;
  logInfo(`Completed import in ${durationMs} ms`);
  logInfo(`Sheets: ${counts.totalSheets}, Rows: ${counts.totalRows}, Inserted: ${counts.inserted}, Deduped: ${counts.deduped}, Skipped: ${counts.skipped}`);
  logInfo(`Warnings — missing dilution (primaries): ${counts.warnMissingDilutionPrimaries}, missing stock (secondaries): ${counts.warnMissingStockSecondaries}, duplicates=${counts.warnDuplicates}, row issues=${counts.warnRowIssues}`);

  return counts;
}

function main() {
  try {
    const candidatePaths = [];
    if (process.argv[2]) candidatePaths.push(path.resolve(process.cwd(), process.argv[2]));
    candidatePaths.push(DEFAULT_XLSX);
    candidatePaths.push(ALT_XLSX);

    const inputPath = candidatePaths.find(p => fs.existsSync(p));
    if (!inputPath) {
      logErr('Workbook not found. Looked for:');
      for (const p of candidatePaths) console.error(`  - ${p}`);
      process.exitCode = 1;
      return;
    }

    const stats = runImport(inputPath);
    // Surface a brief success line with db path
    let resolvedDbFile = null;
    try {
      const { getDb: _g, getDbFilePath: _getDbFilePath } = require('./db');
      const db = _g();
      resolvedDbFile = (db && db.name) ? db.name : (_getDbFilePath ? _getDbFilePath() : null);
      logInfo(`SQLite DB ready at ${resolvedDbFile}`);
    } catch (e) {
      logWarn(`Could not resolve DB file path: ${e.message}`);
    }
    // Optionally, write a tiny summary file to aid later agents
    try {
      const summaryDir = path.resolve(ROOT_DIR, 'Agent Summaries');
      if (!fs.existsSync(summaryDir)) fs.mkdirSync(summaryDir, { recursive: true });
      const summaryPath = path.join(summaryDir, '02_ingest_excel.md');
      const summary = [
        '# Agent Summary — 02 Ingest Excel',
        '',
        `Workbook: ${inputPath}`,
        `Output DB: ${resolvedDbFile}`,
        '',
        `Sheets=${stats.totalSheets} Rows=${stats.totalRows} Inserted=${stats.inserted} Deduped=${stats.deduped} Skipped=${stats.skipped}`,
        `Warnings: missingDilutionPrimaries=${stats.warnMissingDilutionPrimaries}, missingStockSecondaries=${stats.warnMissingStockSecondaries}, duplicates=${stats.warnDuplicates}, rowIssues=${stats.warnRowIssues}`,
        `Completed in ${Date.now() - START_TS} ms`
      ].join('\n');
      fs.writeFileSync(summaryPath, summary, 'utf8');
    } catch (e) {
      logWarn(`Could not write summary file: ${e.message}`);
    }
  } catch (err) {
    logErr(err && err.message ? err.message : String(err));
    process.exitCode = 1;
  }
}

main();
