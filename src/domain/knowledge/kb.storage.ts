import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { DbChunkRow } from './kb.types';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_path TEXT NOT NULL,
  heading TEXT,
  content TEXT NOT NULL,
  hash TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chunks_source ON chunks(source_path);
CREATE INDEX IF NOT EXISTS idx_chunks_hash ON chunks(hash);

CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
  content, heading, content='chunks', content_rowid='id'
);

CREATE TABLE IF NOT EXISTS embeddings (
  chunk_id INTEGER PRIMARY KEY REFERENCES chunks(id) ON DELETE CASCADE,
  vector BLOB NOT NULL,
  model TEXT NOT NULL
);
`;

const TRIGGERS_SQL = `
CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
  INSERT INTO chunks_fts(rowid, content, heading)
  VALUES (new.id, new.content, new.heading);
END;

CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
  INSERT INTO chunks_fts(chunks_fts, rowid, content, heading)
  VALUES ('delete', old.id, old.content, old.heading);
END;

CREATE TRIGGER IF NOT EXISTS chunks_au AFTER UPDATE ON chunks BEGIN
  INSERT INTO chunks_fts(chunks_fts, rowid, content, heading)
  VALUES ('delete', old.id, old.content, old.heading);
  INSERT INTO chunks_fts(rowid, content, heading)
  VALUES (new.id, new.content, new.heading);
END;
`;

export class KbStorage {
  private db: Database.Database;

  constructor(dbPath: string) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(SCHEMA_SQL);
    this.db.exec(TRIGGERS_SQL);
  }

  insertChunk(
    sourcePath: string,
    heading: string | null,
    content: string,
    hash: string
  ): number {
    const stmt = this.db.prepare(
      `INSERT INTO chunks (source_path, heading, content, hash, updated_at)
       VALUES (?, ?, ?, ?, ?)`
    );
    const result = stmt.run(
      sourcePath,
      heading,
      content,
      hash,
      new Date().toISOString()
    );
    return Number(result.lastInsertRowid);
  }

  deleteChunksBySource(sourcePath: string): void {
    this.db.prepare('DELETE FROM chunks WHERE source_path = ?').run(sourcePath);
  }

  getChunksBySource(sourcePath: string): DbChunkRow[] {
    return this.db
      .prepare('SELECT * FROM chunks WHERE source_path = ?')
      .all(sourcePath) as DbChunkRow[];
  }

  searchFts(
    query: string,
    limit: number
  ): Array<{
    id: number;
    source_path: string;
    heading: string | null;
    content: string;
  }> {
    if (!query.trim()) return [];
    const stmt = this.db.prepare(`
      SELECT c.id, c.source_path, c.heading, c.content
      FROM chunks_fts f
      JOIN chunks c ON c.id = f.rowid
      WHERE chunks_fts MATCH ?
      ORDER BY bm25(chunks_fts) ASC
      LIMIT ?
    `);
    return stmt.all(query, limit) as Array<{
      id: number;
      source_path: string;
      heading: string | null;
      content: string;
    }>;
  }

  insertEmbedding(chunkId: number, vector: Buffer, model: string): void {
    this.db
      .prepare(
        'INSERT OR REPLACE INTO embeddings (chunk_id, vector, model) VALUES (?, ?, ?)'
      )
      .run(chunkId, vector, model);
  }

  getEmbedding(chunkId: number): { vector: Buffer; model: string } | undefined {
    return this.db
      .prepare('SELECT vector, model FROM embeddings WHERE chunk_id = ?')
      .get(chunkId) as { vector: Buffer; model: string } | undefined;
  }

  getAllEmbeddings(): Array<{
    chunk_id: number;
    vector: Buffer;
    model: string;
    source_path: string;
    heading: string | null;
    content: string;
  }> {
    return this.db
      .prepare(
        `
      SELECT e.chunk_id, e.vector, e.model, c.source_path, c.heading, c.content
      FROM embeddings e
      JOIN chunks c ON c.id = e.chunk_id
    `
      )
      .all() as any[];
  }

  hasEmbeddings(): boolean {
    const row = this.db
      .prepare('SELECT COUNT(*) as cnt FROM embeddings')
      .get() as { cnt: number };
    return row.cnt > 0;
  }

  close(): void {
    this.db.close();
  }
}

export function encodeVector(vec: Float32Array): Buffer {
  return Buffer.from(vec.buffer, vec.byteOffset, vec.byteLength);
}

export function decodeVector(blob: Buffer): Float32Array | null {
  if (blob.length % 4 !== 0) return null;
  return new Float32Array(blob.buffer, blob.byteOffset, blob.length / 4);
}
