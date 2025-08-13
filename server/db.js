const fs = require('node:fs');
const path = require('node:path');

let Database;
try {
  // Native module; optional dependency. Only required when DB is accessed.
  Database = require('better-sqlite3');
} catch (err) {
  Database = null;
}

const dbFilePath = path.resolve(__dirname, '..', 'sqlite', 'ihc.sqlite');
let dbInstance = null;

function logInfo(msg) { console.log(`[db] ${msg}`); }
function logWarn(msg) { console.warn(`[db][warn] ${msg}`); }
function logErr(msg) { console.error(`[db][error] ${msg}`); }

function ensureSqliteDirExists() {
  const dirPath = path.dirname(dbFilePath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function safeRun(migrationName, sql) {
  if (!sql || typeof sql !== 'string') {
    logWarn(`safeRun(${migrationName}): empty or invalid SQL`);
    return;
  }
  try {
    getDb().exec(sql);
  } catch (e) {
    logWarn(`Migration "${migrationName}" failed: ${e && e.message ? e.message : String(e)}`);
  }
}

function initializeSchema(db) {
  // Idempotent schema per PRD §2
  const ddl = `
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
  safeRun('create_base_schema', ddl);
}

function getDb() {
  if (dbInstance) return dbInstance;
  if (!Database) {
    logErr('better-sqlite3 is not installed. Install with:');
    console.error('      npm i better-sqlite3 --save');
    const nodeVersion = process.version;
    logErr(`Current Node: ${nodeVersion}. If build fails, try Node 20 LTS.`);
    process.exitCode = 1;
    throw new Error('better-sqlite3 not installed');
  }
  ensureSqliteDirExists();
  const existedBefore = fs.existsSync(dbFilePath);
  dbInstance = new Database(dbFilePath, { fileMustExist: false });
  // Pragmas for single-writer concurrency and reasonable durability
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('synchronous = NORMAL');

  initializeSchema(dbInstance);
  logInfo(`${existedBefore ? 'Opened' : 'Created'} SQLite database at ${dbFilePath}`);
  return dbInstance;
}

function prepare(sql) {
  if (typeof sql !== 'string' || sql.trim() === '') {
    throw new Error('prepare(sql): sql must be a non-empty string');
  }
  try {
    return getDb().prepare(sql);
  } catch (e) {
    logErr(`prepare failed: ${e && e.message ? e.message : String(e)}`);
    throw e;
  }
}

function transaction(fn) {
  if (typeof fn !== 'function') {
    throw new Error('transaction(fn): fn must be a function');
  }
  try {
    return getDb().transaction(fn);
  } catch (e) {
    logErr(`transaction wrapper failed: ${e && e.message ? e.message : String(e)}`);
    throw e;
  }
}

module.exports = {
  getDb,
  prepare,
  transaction,
  dbFilePath
};


