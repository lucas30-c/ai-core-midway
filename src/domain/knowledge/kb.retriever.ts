import { KbStorage, decodeVector } from './kb.storage';
import { KnowledgeChunk, EmbeddingClient } from './kb.types';

const STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'but',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'with',
  'by',
  'from',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'could',
  'should',
  'may',
  'might',
  'must',
  'shall',
  'can',
  'need',
  'this',
  'that',
  'these',
  'those',
  'it',
  'its',
]);

export class KbRetriever {
  private storage: KbStorage;
  private embeddingClient: EmbeddingClient | null;

  constructor(storage: KbStorage, embeddingClient: EmbeddingClient | null) {
    this.storage = storage;
    this.embeddingClient = embeddingClient;
  }

  async search(
    query: string,
    options?: { topK?: number }
  ): Promise<KnowledgeChunk[]> {
    const topK = options?.topK ?? 8;

    // Try embedding path first
    if (this.embeddingClient && this.storage.hasEmbeddings()) {
      const embResult = await this.searchByEmbedding(query, topK);
      if (embResult) return embResult;
    }

    // Fallback to FTS5
    return this.searchByFts(query, topK);
  }

  private async searchByEmbedding(
    query: string,
    topK: number
  ): Promise<KnowledgeChunk[] | null> {
    if (!this.embeddingClient) return null;

    const vectors = await this.embeddingClient.embed([query]);
    if (!vectors || !vectors[0]) return null;

    const queryVec = vectors[0];
    const allEmbeddings = this.storage.getAllEmbeddings();

    const scored: Array<{ chunk: KnowledgeChunk; score: number }> = [];

    for (const row of allEmbeddings) {
      const storedVec = decodeVector(row.vector);
      if (!storedVec) continue;

      const sim = cosineSimilarity(queryVec, storedVec);
      scored.push({
        chunk: {
          id: row.chunk_id,
          sourcePath: row.source_path,
          heading: row.heading,
          content: row.content,
        },
        score: sim,
      });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).map(s => s.chunk);
  }

  private searchByFts(query: string, topK: number): KnowledgeChunk[] {
    const ftsQuery = buildFtsQuery(query);
    if (!ftsQuery) return [];

    const rows = this.storage.searchFts(ftsQuery, topK);
    return rows.map(r => ({
      id: r.id,
      sourcePath: r.source_path,
      heading: r.heading,
      content: r.content,
    }));
  }
}

export function buildFtsQuery(input: string): string {
  const tokens = input
    .split(/\W+/)
    .filter(t => t.length >= 3)
    .filter(t => !STOPWORDS.has(t.toLowerCase()))
    .slice(0, 8);

  if (tokens.length === 0) return '';
  return tokens.join(' OR ');
}

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
