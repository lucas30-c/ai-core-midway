// eslint-disable-next-line @typescript-eslint/no-var-requires
const Database = require('better-sqlite3');
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const dataDir = join(process.cwd(), 'data');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir);
}

const db = Database(join(dataDir, 'llm_calls.db'));

db.exec(`
CREATE TABLE IF NOT EXISTS llm_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT,
  model TEXT,
  latency_ms INTEGER,
  total_tokens INTEGER,
  cost REAL,
  status TEXT,
  error_code TEXT,
  ts TEXT
);
`);

export default db;
