import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.resolve(process.cwd(), 'lhse_edoc.db');
const MIGRATIONS_DIR = path.resolve(process.cwd(), 'migrations');

// Initialize SQLite database matching Cloudflare D1 dialect
export const db = new Database(DB_PATH);

// Enable WAL mode for high concurrency & enforce foreign key integrity
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id TEXT PRIMARY KEY,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  if (fs.existsSync(MIGRATIONS_DIR)) {
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const alreadyApplied = db.prepare('SELECT id FROM _migrations WHERE id = ?').get(file);
      if (!alreadyApplied) {
        try {
          const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
          db.exec(sql);
          db.prepare('INSERT INTO _migrations (id) VALUES (?)').run(file);
        } catch (err: any) {
          console.warn(`[Migrations] Notice on ${file}:`, err.message);
        }
      }
    }
  }

  // Idempotent column check for OCR fields on document_attachments
  try {
    const attCols = (db.prepare('PRAGMA table_info(document_attachments)').all() as any[]).map(c => c.name);
    if (!attCols.includes('ocr_text')) {
      db.exec('ALTER TABLE document_attachments ADD COLUMN ocr_text TEXT;');
    }
    if (!attCols.includes('ocr_status')) {
      db.exec("ALTER TABLE document_attachments ADD COLUMN ocr_status TEXT DEFAULT 'PENDING';");
    }
    if (!attCols.includes('ocr_extracted_at')) {
      db.exec('ALTER TABLE document_attachments ADD COLUMN ocr_extracted_at DATETIME;');
    }
  } catch (e: any) {
    console.warn('[DB] Attachment OCR column check notice:', e.message);
  }

  // Idempotent column check for indexed_ocr_content on documents
  try {
    const docCols = (db.prepare('PRAGMA table_info(documents)').all() as any[]).map(c => c.name);
    if (!docCols.includes('indexed_ocr_content')) {
      db.exec('ALTER TABLE documents ADD COLUMN indexed_ocr_content TEXT;');
    }
  } catch (e: any) {
    console.warn('[DB] Document OCR column check notice:', e.message);
  }
}
