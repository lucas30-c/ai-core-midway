import * as path from 'path';
import {
  KnowledgeProvider,
  KnowledgeChunk,
  KbSearchOptions,
  EmbeddingClient,
} from '../kb.types';
import { KbStorage } from '../kb.storage';
import { KbIndexer } from '../kb.indexer';
import { KbRetriever } from '../kb.retriever';
import { MetaManager } from '../meta.manager';

export interface LocalProviderOptions {
  cwd: string;
  kbDirs: string[];
  kbGlob: string;
  embeddingClient?: EmbeddingClient | null;
}

export class LocalKnowledgeProvider implements KnowledgeProvider {
  type = 'local' as const;

  private storage: KbStorage | null = null;
  private retriever: KbRetriever | null = null;
  private ready = false;
  private readonly options: LocalProviderOptions;

  constructor(options: LocalProviderOptions) {
    this.options = options;
  }

  async initialize(): Promise<void> {
    try {
      const techDebtDir = path.resolve(this.options.cwd, '.tech-debt');
      const dbPath = path.join(techDebtDir, 'kb.sqlite');

      this.storage = new KbStorage(dbPath);
      const meta = new MetaManager(techDebtDir);
      const indexer = new KbIndexer(this.storage, meta, this.options.cwd);

      await indexer.index(this.options.kbDirs, this.options.kbGlob);

      this.retriever = new KbRetriever(
        this.storage,
        this.options.embeddingClient ?? null
      );
      this.ready = true;
    } catch (err) {
      console.error(
        `[tech-debt] KB initialization failed: ${(err as Error).message}`
      );
      this.ready = false;
    }
  }

  isAvailable(): boolean {
    return this.ready;
  }

  async search(
    query: string,
    options?: KbSearchOptions
  ): Promise<KnowledgeChunk[]> {
    if (!this.ready || !this.retriever) return [];
    return this.retriever.search(query, options);
  }

  close(): void {
    if (this.storage) {
      this.storage.close();
      this.storage = null;
    }
    this.ready = false;
  }
}
