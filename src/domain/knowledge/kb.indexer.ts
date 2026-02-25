import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { minimatch } from 'minimatch';
import { KbStorage } from './kb.storage';
import { MetaManager } from './meta.manager';
import { chunkMarkdown } from './chunking/markdown.chunker';

export class KbIndexer {
  private storage: KbStorage;
  private meta: MetaManager;
  private cwd: string;

  constructor(storage: KbStorage, meta: MetaManager, cwd: string) {
    this.storage = storage;
    this.meta = meta;
    this.cwd = cwd;
  }

  async index(kbDirs: string[], kbGlob: string): Promise<void> {
    const scannedPaths = new Set<string>();

    for (const dir of kbDirs) {
      const absDir = path.resolve(this.cwd, dir);
      if (!fs.existsSync(absDir)) continue;

      const files = this.scanDir(absDir, '');
      for (const relFile of files) {
        const posixRel = relFile.replace(/\\/g, '/');

        // Skip node_modules
        if (
          posixRel.includes('/node_modules/') ||
          posixRel.startsWith('node_modules/')
        )
          continue;

        // Apply glob match on the full relative path from cwd
        const fullRel = path.posix.join(dir.replace(/\\/g, '/'), posixRel);
        const globTarget = posixRel; // match within kb-dir
        if (!minimatch(globTarget, kbGlob, { dot: true })) continue;

        scannedPaths.add(fullRel);

        const absFile = path.join(absDir, relFile);
        const content = fs.readFileSync(absFile, 'utf-8');
        const hash =
          'sha256:' + crypto.createHash('sha256').update(content).digest('hex');

        const existingHash = this.meta.getFileHash(fullRel);
        if (existingHash === hash) continue;

        // Changed or new file: re-index
        this.storage.deleteChunksBySource(fullRel);

        const chunks = chunkMarkdown(fullRel, content);
        for (const chunk of chunks) {
          this.storage.insertChunk(fullRel, chunk.heading, chunk.content, hash);
        }

        this.meta.setFileHash(fullRel, hash);
      }
    }

    // Detect deleted files
    const trackedPaths = this.meta.getAllTrackedPaths();
    for (const tracked of trackedPaths) {
      if (!scannedPaths.has(tracked)) {
        this.storage.deleteChunksBySource(tracked);
        this.meta.removeFileHash(tracked);
      }
    }

    this.meta.save(kbDirs, kbGlob);
  }

  private scanDir(baseDir: string, rel: string): string[] {
    const results: string[] = [];
    const absPath = path.join(baseDir, rel);

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(absPath, { withFileTypes: true });
    } catch {
      return results;
    }

    for (const entry of entries) {
      if (entry.name === 'node_modules') continue;
      const entryRel = rel ? path.join(rel, entry.name) : entry.name;

      if (entry.isDirectory()) {
        results.push(...this.scanDir(baseDir, entryRel));
      } else if (entry.isFile()) {
        results.push(entryRel);
      }
    }

    return results;
  }
}
