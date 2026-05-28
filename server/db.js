/**
 * JSON file-based database for single-user stock portfolio
 * Atomic writes via temp file + rename
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'data.json');

function read() {
  if (!fs.existsSync(DB_PATH)) return null;
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function write(data) {
  // Atomic write: temp → rename
  const tmp = DB_PATH + '.tmp.' + Date.now();
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmp, DB_PATH);
}

export function loadData() {
  return read();
}

export function saveData(data) {
  write({ ...data, _savedAt: new Date().toISOString() });
}

export function dbStatus() {
  const data = read();
  return {
    exists: !!data,
    savedAt: data?._savedAt || null,
    portfolioCount: data?.portfolios?.length || 0,
    path: DB_PATH,
  };
}
