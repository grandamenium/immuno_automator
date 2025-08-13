const path = require('node:path');
const express = require('express');
const { prepare } = require('./db');
const logic = require('./logic');

const app = express();

// Minimal JSON parsing for future API endpoints
app.use(express.json());

// Basic request logging with duration
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const elapsed = Date.now() - start;
    console.log(`[req] ${req.method} ${req.originalUrl} -> ${res.statusCode} ${elapsed}ms`);
  });
  next();
});

// Health endpoint with basic request logging
app.get('/health', (req, res) => {
  const timestampIso = new Date().toISOString();
  console.log(`[health] ${timestampIso} ${req.method} ${req.url} from ${req.ip}`);
  res.status(200).json({ ok: true, time: timestampIso });
});

// ------------------------------
// API routes
// ------------------------------

// GET /api/suggest/targets?q=...
app.get('/api/suggest/targets', (req, res, next) => {
  try {
    const q = (req.query.q || '').toString().trim();
    if (!q) return res.json({ suggestions: [] });
    // Escape % and _ for LIKE
    const escaped = q.replace(/[%_\\]/g, (m) => `\\${m}`);
    const likeParam = `%${escaped}%`;
    const stmt = prepare(`
      SELECT DISTINCT target
      FROM antibodies
      WHERE type='primary' AND target IS NOT NULL AND target != '' AND target LIKE ? ESCAPE '\\' COLLATE NOCASE
      ORDER BY target
      LIMIT 20
    `);
    const rows = stmt.all(likeParam);
    const suggestions = rows.map(r => r.target).filter(Boolean);
    res.json({ suggestions });
  } catch (err) {
    next(err);
  }
});

// POST /api/plan
// Body: { immunos: [{ slides: number, primaries: string[], colors: string[] }] }
app.post('/api/plan', (req, res, next) => {
  try {
    const { immunos } = req.body || {};
    if (!Array.isArray(immunos) || immunos.length === 0) {
      const err = new Error('Body must include non-empty array "immunos"');
      err.status = 400;
      throw err;
    }

    // Preload all secondaries once to avoid repeated DB hits
    const selectAllSecondaries = prepare(`
      SELECT id, name, target, host_species, ig_class, emission_nm, stock_mg_per_ml, location, storage_sheet
      FROM antibodies WHERE type='secondary'
    `);
    const allSecondaries = selectAllSecondaries.all();

    const selectPrimaryByTarget = prepare(`
      SELECT id, name, target, host_species, ig_class, recommended_dilution, location, storage_sheet
      FROM antibodies
      WHERE type='primary' AND target = ? COLLATE NOCASE
      ORDER BY id ASC
      LIMIT 1
    `);

    /** @type {Array<any>} */
    const primariesTable = [];
    /** @type {Array<any>} */
    const secondariesTable = [];
    /** @type {Array<any>} */
    const solutions = [];
    /** @type {Array<string>} */
    const warnings = [];

    for (let idx = 0; idx < immunos.length; idx += 1) {
      const im = immunos[idx] || {};
      const slides = Number(im.slides);
      if (!Number.isFinite(slides) || slides <= 0) {
        warnings.push(`Immuno #${idx + 1}: invalid slides; expected positive number`);
      }
      const primaryTargets = Array.isArray(im.primaries) ? im.primaries : [];
      const colorSelections = Array.isArray(im.colors) ? im.colors : [];
      if (colorSelections.length !== primaryTargets.length) {
        warnings.push(`Immuno #${idx + 1}: colors length does not match primaries`);
      }

      // Resolve primaries from DB by target
      const primaries = primaryTargets.map((t) => {
        if (!t || !String(t).trim()) return null;
        const row = selectPrimaryByTarget.get(String(t).trim());
        if (!row) {
          warnings.push(`Immuno #${idx + 1}: no primary found for target "${t}"`);
          return null;
        }
        if (!row.recommended_dilution) {
          warnings.push(`Immuno #${idx + 1}: primary "${row.name || row.target}" missing recommended_dilution; defaulting to 1:1000`);
        }
        return row;
      });

      // Choose secondaries using logic.matchSecondaries
      const chosenSecondaries = logic.matchSecondaries(primaries, allSecondaries, colorSelections);

      // Warnings for missing secondary stocks
      chosenSecondaries.forEach((s, i) => {
        if (!s) warnings.push(`Immuno #${idx + 1}: no secondary found for primary #${i + 1}`);
        else if (s.stock_mg_per_ml == null) warnings.push(`Immuno #${idx + 1}: secondary "${s.name || s.target}" missing stock_mg_per_ml; assuming 1 mg/mL`);
      });

      // Unify serum hosts
      const { hosts, warning } = logic.unifySerumHosts(chosenSecondaries);
      if (warning) warnings.push(`Immuno #${idx + 1}: ${warning}`);

      // Compute solutions
      const blocking = logic.calcBlockingVolumes(slides, hosts);
      const primaryMix = logic.calcPrimaryMix(slides, primaries.filter(Boolean));
      const secondaryMix = logic.calcSecondaryMix(slides, chosenSecondaries.filter(Boolean));

      // Assemble tables
      primariesTable.push({
        immuno: idx + 1,
        cells: primaries.map(p => p ? {
          name: p.name,
          ig_class: p.ig_class,
          recommended_dilution: p.recommended_dilution || '1:1000',
          location: p.location || null,
          storage_sheet: p.storage_sheet || null
        } : null)
      });

      secondariesTable.push({
        immuno: idx + 1,
        cells: chosenSecondaries.map(s => s ? {
          name: s.name,
          host_species: s.host_species,
          ig_class: s.ig_class,
          emission_nm: s.emission_nm,
          location: s.location || null,
          storage_sheet: s.storage_sheet || null
        } : null)
      });

      solutions.push({
        immuno: idx + 1,
        blocking,
        primary: primaryMix,
        secondary: secondaryMix
      });
    }

    res.json({ primariesTable, secondariesTable, solutions, warnings });
  } catch (err) {
    next(err);
  }
});

// Serve the built client if present
const distDir = path.resolve(__dirname, '..', 'dist');
app.use(express.static(distDir));

// Fallback to index.html for client routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(distDir, 'index.html'));
});

// Centralized error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err && err.status ? err.status : 500;
  const message = err && err.message ? err.message : 'Internal Server Error';
  console.error(`[error] ${req.method} ${req.originalUrl} -> ${status}: ${message}`);
  res.status(status).json({ error: message });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`[server] Started on http://localhost:${PORT}`);
});

module.exports = app;


