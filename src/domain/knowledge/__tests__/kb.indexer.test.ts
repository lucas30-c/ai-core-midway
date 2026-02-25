import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { KbStorage } from '../kb.storage';
import { MetaManager } from '../meta.manager';
import { KbIndexer } from '../kb.indexer';

describe('KbIndexer', () => {
  let tmpDir: string;
  let techDebtDir: string;
  let storage: KbStorage;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-indexer-test-'));
    techDebtDir = path.join(tmpDir, '.tech-debt');
    fs.mkdirSync(techDebtDir, { recursive: true });
    storage = new KbStorage(path.join(techDebtDir, 'kb.sqlite'));
  });

  afterEach(() => {
    storage.close();
  });

  function writeFile(relPath: string, content: string): void {
    const absPath = path.join(tmpDir, relPath);
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, content, 'utf-8');
  }

  it('indexes markdown files from single kb-dir', async () => {
    writeFile('docs/arch.md', '# Architecture\nThe system uses layers.');
    writeFile('docs/api.md', '# API\nREST endpoints.');

    const meta = new MetaManager(techDebtDir);
    const indexer = new KbIndexer(storage, meta, tmpDir);
    await indexer.index(['./docs'], '**/*.md');

    const chunks1 = storage.getChunksBySource('docs/arch.md');
    expect(chunks1.length).toBeGreaterThanOrEqual(1);
    expect(chunks1[0].content).toContain('system uses layers');

    const chunks2 = storage.getChunksBySource('docs/api.md');
    expect(chunks2.length).toBeGreaterThanOrEqual(1);
  });

  it('indexes from multiple kb-dirs', async () => {
    writeFile('docs/doc.md', '# Doc\nDoc content.');
    writeFile('adr/decision.md', '# Decision\nWe decided X.');

    const meta = new MetaManager(techDebtDir);
    const indexer = new KbIndexer(storage, meta, tmpDir);
    await indexer.index(['./docs', './adr'], '**/*.md');

    expect(
      storage.getChunksBySource('docs/doc.md').length
    ).toBeGreaterThanOrEqual(1);
    expect(
      storage.getChunksBySource('adr/decision.md').length
    ).toBeGreaterThanOrEqual(1);
  });

  it('skips unchanged files on re-index', async () => {
    writeFile('docs/stable.md', '# Stable\nNo changes.');

    const meta = new MetaManager(techDebtDir);
    const indexer = new KbIndexer(storage, meta, tmpDir);

    await indexer.index(['./docs'], '**/*.md');
    const firstChunks = storage.getChunksBySource('docs/stable.md');
    const firstId = firstChunks[0].id;

    // Re-index without changes
    const meta2 = new MetaManager(techDebtDir);
    const indexer2 = new KbIndexer(storage, meta2, tmpDir);
    await indexer2.index(['./docs'], '**/*.md');

    const secondChunks = storage.getChunksBySource('docs/stable.md');
    // Same chunk ID means it was not re-inserted
    expect(secondChunks[0].id).toBe(firstId);
  });

  it('re-indexes changed files', async () => {
    writeFile('docs/mutable.md', '# V1\nOriginal content.');

    const meta = new MetaManager(techDebtDir);
    const indexer = new KbIndexer(storage, meta, tmpDir);
    await indexer.index(['./docs'], '**/*.md');

    const v1 = storage.getChunksBySource('docs/mutable.md');
    expect(v1[0].content).toContain('Original');

    // Modify file
    writeFile('docs/mutable.md', '# V2\nUpdated content.');

    const meta2 = new MetaManager(techDebtDir);
    const indexer2 = new KbIndexer(storage, meta2, tmpDir);
    await indexer2.index(['./docs'], '**/*.md');

    const v2 = storage.getChunksBySource('docs/mutable.md');
    expect(v2[0].content).toContain('Updated');
  });

  it('detects and removes deleted files', async () => {
    writeFile('docs/temp.md', '# Temp\nWill be deleted.');
    writeFile('docs/keep.md', '# Keep\nStays.');

    const meta = new MetaManager(techDebtDir);
    const indexer = new KbIndexer(storage, meta, tmpDir);
    await indexer.index(['./docs'], '**/*.md');

    expect(
      storage.getChunksBySource('docs/temp.md').length
    ).toBeGreaterThanOrEqual(1);

    // Delete the file
    fs.unlinkSync(path.join(tmpDir, 'docs/temp.md'));

    const meta2 = new MetaManager(techDebtDir);
    const indexer2 = new KbIndexer(storage, meta2, tmpDir);
    await indexer2.index(['./docs'], '**/*.md');

    expect(storage.getChunksBySource('docs/temp.md').length).toBe(0);
    expect(
      storage.getChunksBySource('docs/keep.md').length
    ).toBeGreaterThanOrEqual(1);
  });

  it('ignores non-matching glob patterns', async () => {
    writeFile('docs/readme.txt', 'This is a text file.');
    writeFile('docs/readme.md', '# Readme\nMarkdown file.');

    const meta = new MetaManager(techDebtDir);
    const indexer = new KbIndexer(storage, meta, tmpDir);
    await indexer.index(['./docs'], '**/*.md');

    expect(storage.getChunksBySource('docs/readme.txt').length).toBe(0);
    expect(
      storage.getChunksBySource('docs/readme.md').length
    ).toBeGreaterThanOrEqual(1);
  });
});
