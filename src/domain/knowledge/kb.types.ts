export interface DbChunkRow {
  id: number;
  source_path: string;
  heading: string | null;
  content: string;
  hash: string;
  updated_at: string;
}

export interface KnowledgeChunk {
  id: number;
  sourcePath: string;
  heading: string | null;
  content: string;
  score?: number;
}

export interface KnowledgeMeta {
  version: '1.0';
  kbDirs: string[];
  kbGlob: string;
  lastIndexedAt: string;
  fileHashes: Record<string, string>;
}

export interface KbSearchOptions {
  topK?: number;
}

export interface KnowledgeProvider {
  type: 'local';
  initialize(): Promise<void>;
  isAvailable(): boolean;
  search(query: string, options?: KbSearchOptions): Promise<KnowledgeChunk[]>;
  close(): void;
}

export interface EmbeddingClient {
  embed(texts: string[]): Promise<Float32Array[] | null>;
}

export interface RetrievedKnowledgeChunk {
  sourcePath: string;
  heading: string | null;
  excerpt: string;
}
