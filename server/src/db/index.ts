import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { SCHEMA_SQL } from './schema.js';
import { seedWordCacheIfEmpty } from './seedWordCache.js';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });
  fs.mkdirSync(config.uploadsDir, { recursive: true });

  db = new Database(config.databasePath);
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA_SQL);
  applyMigrations(db);

  const seeded = seedWordCacheIfEmpty(db);
  if (seeded.inserted > 0) {
    console.log(`[seed] inserted ${seeded.inserted} basic word translations`);
  }

  return db;
}

function applyMigrations(database: Database.Database): void {
  // Add columns for older databases that were created before they existed.
  ensureColumn(database, 'songs', 'lyrics_offset_ms', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(database, 'user_library', 'listen_count', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(database, 'user_library', 'last_listened_at', 'TEXT');
  ensureColumn(database, 'users', 'role', "TEXT NOT NULL DEFAULT 'student'");
}

function ensureColumn(
  database: Database.Database,
  table: string,
  column: string,
  ddl: string,
): void {
  const cols = database
    .prepare(`PRAGMA table_info(${table})`)
    .all() as { name: string }[];
  if (cols.some((c) => c.name === column)) return;
  database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
