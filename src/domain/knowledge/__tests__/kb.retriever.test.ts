import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { KbStorage } from '../kb.storage';
import { KbRetriever, buildFtsQuery } from '../kb.retriever';

describe('KbRetriever', () => {
  let storage: KbStorage;

  beforeEach(() => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-retriever-test-'));
    storage = new KbStorage(path.join(tmpDir, 'kb.sqlite'));

    // Seed test data
    storage.insertChunk(
      'docs/arch.md',
      'Architecture',
      'The system architecture uses layered design patterns',
      'sha256:1'
    );
    storage.insertChunk(
      'docs/api.md',
      'API Design',
      'REST API endpoints and authentication flow',
      'sha256:2'
    );
    storage.insertChunk(
      'docs/db.md',
      'Database',
      'PostgreSQL database schema and migration strategy',
      'sha256:3'
    );
    storage.insertChunk(
      'docs/deploy.md',
      'Deployment',
      'Container deployment with Docker and Kubernetes',
      'sha256:4'
    );
  });

  afterEach(() => {
    storage.close();
  });

  it('returns results for FTS search', async () => {
    const retriever = new KbRetriever(storage, null);
    const results = await retriever.search('architecture design');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].sourcePath).toBe('docs/arch.md');
  });

  it('respects topK limit', async () => {
    const retriever = new KbRetriever(storage, null);
    const results = await retriever.search('system', { topK: 2 });
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('returns empty for no-match query', async () => {
    const retriever = new KbRetriever(storage, null);
    const results = await retriever.search('zzzznonexistent');
    expect(results).toEqual([]);
  });

  it('maps DB rows to KnowledgeChunk format', async () => {
    const retriever = new KbRetriever(storage, null);
    const results = await retriever.search('database schema');
    expect(results.length).toBeGreaterThanOrEqual(1);

    const chunk = results.find(r => r.sourcePath === 'docs/db.md');
    expect(chunk).toBeDefined();
    expect(chunk!.heading).toBe('Database');
    expect(chunk!.content).toContain('PostgreSQL');
    expect(chunk!.id).toBeDefined();
  });

  it('uses embedding path when available (mocked)', async () => {
    // Insert an embedding so hasEmbeddings() returns true
    const chunkId = storage.getChunksBySource('docs/arch.md')[0].id;
    const vec = new Float32Array([0.1, 0.9, 0.1]);
    const buf = Buffer.from(vec.buffer, vec.byteOffset, vec.byteLength);
    storage.insertEmbedding(chunkId, buf, 'test-model');

    const mockEmbedder = {
      embed: jest.fn().mockResolvedValue([new Float32Array([0.1, 0.9, 0.1])]),
    };

    const retriever = new KbRetriever(storage, mockEmbedder);
    const results = await retriever.search('architecture');

    expect(mockEmbedder.embed).toHaveBeenCalledTimes(1);
    expect(results.length).toBeGreaterThanOrEqual(1);
  });
});

describe('buildFtsQuery', () => {
  it('joins tokens with OR', () => {
    expect(buildFtsQuery('architecture design patterns')).toBe(
      'architecture OR design OR patterns'
    );
  });

  it('drops tokens < 3 chars', () => {
    expect(buildFtsQuery('a ab architecture')).toBe('architecture');
  });

  it('removes stopwords', () => {
    expect(buildFtsQuery('the architecture is important')).toBe(
      'architecture OR important'
    );
  });

  it('caps at 8 tokens', () => {
    const manyWords = Array.from({ length: 15 }, (_, i) => `word${i}`).join(
      ' '
    );
    const tokens = buildFtsQuery(manyWords).split(' OR ');
    expect(tokens.length).toBeLessThanOrEqual(8);
  });

  it('returns empty string for empty input', () => {
    expect(buildFtsQuery('')).toBe('');
  });

  it('returns empty string for only stopwords', () => {
    expect(buildFtsQuery('the is are')).toBe('');
  });
});
