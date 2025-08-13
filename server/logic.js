/**
 * JSDoc typedefs for clarity (shapes subset of PRD §2 fields).
 *
 * @typedef {Object} PrimaryAb
 * @property {string|null} name
 * @property {string|null} target        // protein target (not used for matching secondaries)
 * @property {string|null} host_species  // species the primary was raised in (e.g., "Rabbit")
 * @property {string|null} ig_class      // e.g., "IgG", "IgG1", "IgG2a"
 * @property {string|null} recommended_dilution // e.g., "1:1000"
 *
 * @typedef {Object} SecondaryAb
 * @property {string|null} name
 * @property {string|null} target        // species recognized (e.g., "Rabbit")
 * @property {string|null} host_species  // serum host (e.g., "Goat")
 * @property {string|null} ig_class      // e.g., "IgG"
 * @property {number|null} emission_nm
 * @property {number|null} stock_mg_per_ml
 */

// ------------------------------
// §3 Color ranges and fluorophore anchors
// ------------------------------

/** @type {Record<string, [number, number]>} */
const COLOR_TO_RANGE_NM = {
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

/** @type {Record<string, number[]>} */
const PREFERRED_FLUOR_EMISSIONS = {
  green: [519],
  red: [565, 603, 617],
  'far red': [671]
};

// Fluorophore → emission map (nm) — minimal but covers PRD examples
/** @type {Record<string, number>} */
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

// ------------------------------
// Helpers
// ------------------------------

/**
 * Title-case species tokens, preserving multi-word species like "Guinea Pig".
 * @param {string|null|undefined} value
 * @returns {string|null}
 */
function normalizeSpecies(value) {
  if (!value) return null;
  const clean = String(value).trim().toLowerCase();
  if (!clean) return null;
  return clean.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/**
 * Normalize Ig class strings like "IgG 1" → "IgG1", "IgG-2a" → "IgG2a".
 * @param {string|null|undefined} value
 * @returns {string|null}
 */
function normalizeIgClass(value) {
  if (!value) return null;
  let v = String(value).trim();
  v = v.replace(/\s*[-\s]?\s*(\d)([ab])?\b/gi, (_, d, s) => (s ? `${d}${String(s).toLowerCase()}` : d));
  v = v.replace(/\s+/g, '');
  v = v.replace(/igg/gi, 'IgG');
  return v;
}

/**
 * Parse a dilution string like "1:1000" → 1000. Returns null if invalid.
 * @param {string|null|undefined} value
 * @returns {number|null}
 */
function parseDilution(value) {
  if (!value) return null;
  const m = String(value).trim().match(/^(\d+)\s*:\s*(\d+)$/);
  if (!m) return null;
  const denom = Number(m[2]);
  return Number.isFinite(denom) && denom > 0 ? denom : null;
}

/**
 * Get emission nm from a fluorophore name. Accepts AF numbers, Alexa Fluor, FITC/TRITC, Cy dyes.
 * @param {string|null|undefined} name
 * @returns {number|null}
 */
function mapFluorophoreNameToEmission(name) {
  if (!name) return null;
  const s = String(name);
  // Direct lookup (case-insensitive)
  const key = Object.keys(FLUOR_TO_EMISSION).find(k => k.toLowerCase() === s.toLowerCase());
  if (key) return FLUOR_TO_EMISSION[key];
  // AF ###
  const af = s.match(/af\s*-?\s*(\d{3})/i);
  if (af) {
    const k = `AF${af[1]}`;
    if (FLUOR_TO_EMISSION[k] != null) return FLUOR_TO_EMISSION[k];
  }
  // Alexa Fluor ###
  const alexa = s.match(/alexa\s*fluor\s*(\d{3})/i);
  if (alexa) {
    const k = `AF${alexa[1]}`;
    if (FLUOR_TO_EMISSION[k] != null) return FLUOR_TO_EMISSION[k];
  }
  // Cy dyes
  const cy = s.match(/cy\s*(5\.5|\d)/i);
  if (cy) {
    const k = `Cy${cy[1].replace(/\s+/g, '').toUpperCase()}`;
    if (FLUOR_TO_EMISSION[k] != null) return FLUOR_TO_EMISSION[k];
  }
  // FITC/TRITC
  if (/fitc/i.test(s)) return FLUOR_TO_EMISSION['FITC'] || null;
  if (/tritc/i.test(s)) return FLUOR_TO_EMISSION['TRITC'] || null;
  return null;
}

/**
 * Convert slides → total prepared volume (mL), rounding up to a whole mL at 300 µL/slide.
 * @param {number} slides
 * @returns {{ total_mL: number, total_uL: number }}
 */
function computeRoundedTotal(slides) {
  const perSlide_uL = 300;
  const rawTotal_uL = Math.max(0, Math.round(slides)) * perSlide_uL;
  const total_mL = Math.ceil(rawTotal_uL / 1000);
  const total_uL = total_mL * 1000;
  return { total_mL, total_uL };
}

/**
 * Determine whether a secondary Ig class is compatible with a primary Ig class per PRD rules.
 * - Generalist IgG matches any IgG*
 * - Exact subclass match preferred; different subclasses incompatible unless secondary is general IgG
 * - If either side missing, treat as compatible
 * @param {string|null} primaryIg
 * @param {string|null} secondaryIg
 * @returns {boolean}
 */
function isIgCompatible(primaryIg, secondaryIg) {
  const p = normalizeIgClass(primaryIg);
  const s = normalizeIgClass(secondaryIg);
  if (!p || !s) return true; // missing info → compatible
  const pIsIgG = /^IgG/i.test(p);
  const sIsIgG = /^IgG/i.test(s);
  if (!pIsIgG || !sIsIgG) return p.toLowerCase() === s.toLowerCase();
  // Both IgG variants
  if (p === 'IgG' || s === 'IgG') return true; // wildcard
  return p.toLowerCase() === s.toLowerCase();
}

/**
 * Normalize a color key and resolve to range [min,max] nm. Accepts synonyms for far-red.
 * @param {string} colorKey
 * @returns {[number, number]|null}
 */
function resolveColorRange(colorKey) {
  if (!colorKey) return null;
  const k = String(colorKey).toLowerCase().trim();
  if (COLOR_TO_RANGE_NM[k]) return COLOR_TO_RANGE_NM[k];
  if (k === 'farred' || k === 'far-red') return COLOR_TO_RANGE_NM['far red'];
  return null;
}

/**
 * Select one secondary for each primary subject to host/Ig/color rules with simple tie-breakers.
 * @param {PrimaryAb[]} primaries
 * @param {SecondaryAb[]} secondaries
 * @param {string[]} colorSelections // same length as primaries
 * @returns {Array<SecondaryAb|null>} // parallel to primaries
 */
function matchSecondaries(primaries, secondaries, colorSelections) {
  const chosen = /** @type {(SecondaryAb|null)[]} */([]);
  const alreadyHosts = [];
  for (let i = 0; i < primaries.length; i += 1) {
    const pri = primaries[i] || {};
    const host = normalizeSpecies(pri.host_species);
    const priIg = normalizeIgClass(pri.ig_class);
    const color = colorSelections && colorSelections[i] ? colorSelections[i] : null;
    const range = color ? resolveColorRange(color) : null;

    /** @type {SecondaryAb[]} */
    const candidates = (secondaries || []).filter(sec => {
      if (!sec) return false;
      // species match: secondary target species equals primary host species
      const secTarget = normalizeSpecies(sec.target);
      if (host && secTarget && secTarget !== host) return false;
      // Ig compatible
      if (!isIgCompatible(priIg, sec.ig_class)) return false;
      // color constraint
      if (range) {
        const em = Number(sec.emission_nm);
        if (!Number.isFinite(em)) return false;
        if (em < range[0] || em > range[1]) return false;
      }
      return true;
    });

    if (candidates.length === 0) {
      chosen.push(null);
      continue;
    }

    // Tie-break scoring
    const majorityHost = (() => {
      if (alreadyHosts.length === 0) return null;
      const counts = alreadyHosts.reduce((m, h) => (m[h] = (m[h] || 0) + 1, m), /** @type {Record<string,number>} */({}));
      let best = null; let bestN = -1;
      for (const [h, n] of Object.entries(counts)) {
        if (n > bestN) { bestN = n; best = h; }
      }
      return best;
    })();

    const preferredPeaks = (() => {
      if (!color) return [];
      const key = color.toLowerCase().trim();
      if (PREFERRED_FLUOR_EMISSIONS[key]) return PREFERRED_FLUOR_EMISSIONS[key];
      if (key === 'farred' || key === 'far-red') return PREFERRED_FLUOR_EMISSIONS['far red'] || [];
      return [];
    })();

    let best = candidates[0];
    let bestScore = -1;
    for (const sec of candidates) {
      let score = 0;
      if (majorityHost && normalizeSpecies(sec.host_species) === majorityHost) score += 3;
      if (preferredPeaks.includes(Number(sec.emission_nm))) score += 2;
      if (sec.stock_mg_per_ml != null) score += 1;
      // stable order tiebreaker: keep first if equal
      if (score > bestScore) {
        bestScore = score;
        best = sec;
      }
    }
    chosen.push(best || null);
    if (best && best.host_species) alreadyHosts.push(normalizeSpecies(best.host_species));
  }
  return chosen;
}

/**
 * Unify serum hosts for chosen secondaries.
 * @param {Array<SecondaryAb|null>} chosenSecondaries
 * @returns {{ hosts: string[], warning?: string }}
 */
function unifySerumHosts(chosenSecondaries) {
  const hostSet = new Set(
    (chosenSecondaries || [])
      .map(s => s && s.host_species ? normalizeSpecies(s.host_species) : null)
      .filter(Boolean)
  );
  const hosts = Array.from(hostSet);
  if (hosts.length <= 1) return { hosts };
  if (hosts.length === 2) return { hosts };
  return { hosts: hosts.slice(0, 2), warning: 'More than two serum hosts required; please adjust selections.' };
}

/**
 * Compute blocking solution volumes (§5.1).
 * @param {number} slides
 * @param {string[]|string} hostsInput // single host or two hosts
 * @returns {{ total_mL: number, total_uL: number, serum: Array<{ host: string, volume_uL: number }>, diluent_uL: number }}
 */
function calcBlockingVolumes(slides, hostsInput) {
  const { total_mL, total_uL } = computeRoundedTotal(slides);
  const hosts = Array.isArray(hostsInput) ? hostsInput : (hostsInput ? [String(hostsInput)] : []);
  const uniqueHosts = Array.from(new Set(hosts.map(h => normalizeSpecies(h)).filter(Boolean)));
  const serumParts = uniqueHosts.length === 2 ? [0.025, 0.025] : uniqueHosts.length === 1 ? [0.05] : [];
  const serum = uniqueHosts.map((h, idx) => ({ host: h, volume_uL: Math.round(total_uL * serumParts[idx]) }));
  const totalSerum_uL = serum.reduce((sum, s) => sum + s.volume_uL, 0);
  const diluent_uL = total_uL - totalSerum_uL;
  return { total_mL, total_uL, serum, diluent_uL };
}

/**
 * Compute primary mix (§5.2). Defaults missing dilutions to 1:1000.
 * @param {number} slides
 * @param {Array<PrimaryAb & { id?: string }>} primariesWithDilutions
 * @returns {{ total_mL: number, total_uL: number, primaries: Array<{ name: string|null, volume_uL: number }>, blocking_uL: number, pbst_uL: number }}
 */
function calcPrimaryMix(slides, primariesWithDilutions) {
  const { total_mL, total_uL } = computeRoundedTotal(slides);
  const primariesOut = [];
  let totalStocks_uL = 0;
  for (const p of (primariesWithDilutions || [])) {
    const denom = parseDilution(p.recommended_dilution) || 1000; // default 1:1000
    const vol_uL = Math.round(total_uL / denom);
    totalStocks_uL += vol_uL;
    primariesOut.push({ name: p.name || null, volume_uL: vol_uL });
  }
  const diluent_uL = total_uL - totalStocks_uL;
  const blocking_uL = Math.round(diluent_uL * 0.10);
  const pbst_uL = diluent_uL - blocking_uL;
  return { total_mL, total_uL, primaries: primariesOut, blocking_uL, pbst_uL };
}

/**
 * Compute secondary mix (§5.3). Assumes 1 µg/mL target for each secondary simultaneously.
 * Stock volume per secondary in µL: V_total_mL / C_stock(mg/mL). If missing, assume 1 mg/mL.
 * @param {number} slides
 * @param {Array<SecondaryAb>} secondariesWithStocks
 * @returns {{ total_mL: number, total_uL: number, secondaries: Array<{ name: string|null, volume_uL: number, assumedStock?: boolean }>, pbst_uL: number }}
 */
function calcSecondaryMix(slides, secondariesWithStocks) {
  const { total_mL, total_uL } = computeRoundedTotal(slides);
  const out = [];
  let totalStocks_uL = 0;
  for (const s of (secondariesWithStocks || [])) {
    const C = (s.stock_mg_per_ml != null && Number(s.stock_mg_per_ml) > 0) ? Number(s.stock_mg_per_ml) : 1; // assume 1 mg/mL
    const vol_uL = Math.round(total_mL / C);
    totalStocks_uL += vol_uL;
    const row = { name: s.name || null, volume_uL: vol_uL };
    if (s.stock_mg_per_ml == null) row.assumedStock = true;
    out.push(row);
  }
  const pbst_uL = total_uL - totalStocks_uL;
  return { total_mL, total_uL, secondaries: out, pbst_uL };
}

module.exports = {
  COLOR_TO_RANGE_NM,
  PREFERRED_FLUOR_EMISSIONS,
  mapFluorophoreNameToEmission,
  matchSecondaries,
  unifySerumHosts,
  calcBlockingVolumes,
  calcPrimaryMix,
  calcSecondaryMix
};

