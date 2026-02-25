import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { KbStorage, encodeVector, decodeVector } from '../kb.storage';

describe('KbStorage', () => {
  let storage: KbStorage;
  let dbPath: string;

  beforeEach(() => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-storage-test-'));
    dbPath = path.join(tmpDir, 'kb.sqlite');
    storage = new KbStorage(dbPath);
  });

  afterEach(() => {
    storage.close();
  });

  it('creates schema on init', () => {
    // If no error, schema init succeeded
    expect(storage).toBeDefined();
  });

  it('inserts and retrieves chunks by source', () => {
    storage.insertChunk('docs/a.md', 'Heading A', 'Content A', 'sha256:aaa');
    storage.insertChunk('docs/a.md', null, 'Content B', 'sha256:aaa');
    storage.insertChunk('docs/b.md', 'Heading B', 'Content C', 'sha256:bbb');

    const chunksA = storage.getChunksBySource('docs/a.md');
    expect(chunksA.length).toBe(2);
    expect(chunksA[0].heading).toBe('Heading A');
    expect(chunksA[1].heading).toBeNull();

    const chunksB = storage.getChunksBySource('docs/b.md');
    expect(chunksB.length).toBe(1);
  });

  it('deletes chunks by source and cleans FTS', () => {
    storage.insertChunk(
      'docs/del.md',
      'Title',
      'Deletable content',
      'sha256:del'
    );
    storage.insertChunk(
      'docs/keep.md',
      'Keep',
      'Keepable content',
      'sha256:keep'
    );

    storage.deleteChunksBySource('docs/del.md');

    expect(storage.getChunksBySource('docs/del.md').length).toBe(0);
    expect(storage.getChunksBySource('docs/keep.md').length).toBe(1);

    // FTS should also be cleaned (trigger handles it)
    const ftsResults = storage.searchFts('Deletable', 10);
    expect(ftsResults.length).toBe(0);

    const keepResults = storage.searchFts('Keepable', 10);
    expect(keepResults.length).toBe(1);
  });

  it('performs FTS search with BM25 ordering', () => {
    storage.insertChunk(
      'docs/a.md',
      'API',
      'The API design is important for architecture',
      'sha256:1'
    );
    storage.insertChunk(
      'docs/b.md',
      'Config',
      'Database configuration and setup',
      'sha256:2'
    );
    storage.insertChunk(
      'docs/c.md',
      'API Ref',
      'API reference documentation for REST API endpoints',
      'sha256:3'
    );

    const results = storage.searchFts('API', 10);
    expect(results.length).toBeGreaterThanOrEqual(2);
    // The chunk with more API mentions should rank higher (more negative bm25 = first in ASC)
    expect(results[0].source_path).toBe('docs/c.md');
  });

  it('handles empty FTS query gracefully', () => {
    const results = storage.searchFts('', 10);
    expect(results).toEqual([]);
  });

  describe('embeddings', () => {
    it('stores and retrieves embedding vectors', () => {
      const chunkId = storage.insertChunk(
        'docs/emb.md',
        'Test',
        'Embedding test',
        'sha256:emb'
      );
      const vec = new Float32Array([0.1, 0.2, 0.3, 0.4]);
      storage.insertEmbedding(chunkId, encodeVector(vec), 'test-model');

      const result = storage.getEmbedding(chunkId);
      expect(result).toBeDefined();
      expect(result!.model).toBe('test-model');

      const decoded = decodeVector(result!.vector);
      expect(decoded).not.toBeNull();
      expect(decoded!.length).toBe(4);
      expect(decoded![0]).toBeCloseTo(0.1, 5);
      expect(decoded![3]).toBeCloseTo(0.4, 5);
    });

    it('reports hasEmbeddings correctly', () => {
      expect(storage.hasEmbeddings()).toBe(false);

      const chunkId = storage.insertChunk(
        'docs/e.md',
        null,
        'test',
        'sha256:e'
      );
      storage.insertEmbedding(
        chunkId,
        encodeVector(new Float32Array([1, 2])),
        'model'
      );

      expect(storage.hasEmbeddings()).toBe(true);
    });
  });

  describe('encodeVector / decodeVector', () => {
    it('roundtrips Float32Array correctly', () => {
      const original = new Float32Array([1.5, -2.5, 0, 3.14]);
      const buf = encodeVector(original);
      const decoded = decodeVector(buf);
      expect(decoded).not.toBeNull();
      expect(decoded!.length).toBe(4);
      for (let i = 0; i < original.length; i++) {
        expect(decoded![i]).toBeCloseTo(original[i], 5);
      }
    });

    it('returns null for corrupted blob (not divisible by 4)', () => {
      const badBuf = Buffer.from([1, 2, 3]); // 3 bytes, not divisible by 4
      expect(decodeVector(badBuf)).toBeNull();
    });
  });
});
