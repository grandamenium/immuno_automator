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

function ensureSqliteDirExists() {
  const dirPath = path.dirname(dbFilePath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getDb() {
  if (dbInstance) return dbInstance;
  if (!Database) {
    console.error('[db] better-sqlite3 is not installed. Install with:');
    console.error('      npm i better-sqlite3 --save');
    const nodeVersion = process.version;
    console.error(`[db] Current Node: ${nodeVersion}. If build fails, try Node 20 LTS.`);
    process.exitCode = 1;
    throw new Error('better-sqlite3 not installed');
  }
  ensureSqliteDirExists();
  dbInstance = new Database(dbFilePath, { fileMustExist: false });
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('synchronous = NORMAL');
  return dbInstance;
}

function prepare(sql) {
  return getDb().prepare(sql);
}

function transaction(fn) {
  return getDb().transaction(fn);
}

module.exports = {
  getDb,
  prepare,
  transaction,
  dbFilePath
};


