/**
 * Online backup of the SQLite database (safe while the app is running).
 * Usage: node dist/server/backup.js [output-file]
 * Default output: DATA_DIR/backups/resumescreen-YYYY-MM-DDTHH-MM.db
 */
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync, backup } from "node:sqlite";

const dataDir = path.resolve(process.env.DATA_DIR ?? "./data");
const source = path.join(dataDir, "resumescreen.db");
if (!fs.existsSync(source)) {
  console.error(`No database found at ${source}`);
  process.exit(1);
}
const out =
  process.argv[2] ?? path.join(dataDir, "backups", `resumescreen-${new Date().toISOString().slice(0, 16).replace(/:/g, "-")}.db`);
fs.mkdirSync(path.dirname(out), { recursive: true });
const db = new DatabaseSync(source, { readOnly: true });
await backup(db, out);
db.close();
fs.chmodSync(out, 0o600);
console.log(`Backup written to ${out}`);
