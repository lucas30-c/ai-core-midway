import * as fs from 'fs';
import * as path from 'path';
import { KnowledgeMeta } from './kb.types';

const META_FILENAME = 'meta.json';

export class MetaManager {
  private metaPath: string;
  private meta: KnowledgeMeta;

  constructor(techDebtDir: string) {
    this.metaPath = path.join(techDebtDir, META_FILENAME);
    this.meta = this.load();
  }

  private load(): KnowledgeMeta {
    try {
      if (fs.existsSync(this.metaPath)) {
        const raw = fs.readFileSync(this.metaPath, 'utf-8');
        return JSON.parse(raw) as KnowledgeMeta;
      }
    } catch {
      // corrupt meta.json, start fresh
    }
    return {
      version: '1.0',
      kbDirs: [],
      kbGlob: '**/*.md',
      lastIndexedAt: '',
      fileHashes: {},
    };
  }

  getMeta(): KnowledgeMeta {
    return this.meta;
  }

  getFileHash(filePath: string): string | undefined {
    return this.meta.fileHashes[filePath];
  }

  setFileHash(filePath: string, hash: string): void {
    this.meta.fileHashes[filePath] = hash;
  }

  removeFileHash(filePath: string): void {
    delete this.meta.fileHashes[filePath];
  }

  getAllTrackedPaths(): string[] {
    return Object.keys(this.meta.fileHashes);
  }

  save(kbDirs: string[], kbGlob: string): void {
    this.meta.kbDirs = kbDirs;
    this.meta.kbGlob = kbGlob;
    this.meta.lastIndexedAt = new Date().toISOString();

    const dir = path.dirname(this.metaPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(
      this.metaPath,
      JSON.stringify(this.meta, null, 2),
      'utf-8'
    );
  }
}
