import { KnowledgeProvider } from '../../../domain/knowledge/kb.types';
import { LocalKnowledgeProvider } from '../../../domain/knowledge/providers/local.provider';
import { HttpEmbeddingClient } from '../../../domain/knowledge/embedding/embedding.client';

export interface KbAdapterOptions {
  kbOff?: boolean;
  kbDirs?: string[];
  kbGlob?: string;
  cwd: string;
}

export function initKbProvider(
  opts: KbAdapterOptions
): KnowledgeProvider | null {
  if (opts.kbOff) return null;
  if (!opts.kbDirs || opts.kbDirs.length === 0) return null;

  const kbGlob = opts.kbGlob ?? '**/*.md';

  let embeddingClient = null;
  const embModel = process.env.TECH_DEBT_EMBEDDINGS_MODEL ?? '';
  if (embModel) {
    const embBaseUrl =
      process.env.TECH_DEBT_EMBEDDINGS_BASE_URL ??
      process.env.TECH_DEBT_LLM_BASE_URL ??
      '';
    const embApiKey =
      process.env.TECH_DEBT_EMBEDDINGS_API_KEY ??
      process.env.TECH_DEBT_LLM_API_KEY ??
      '';

    if (embBaseUrl && embApiKey) {
      embeddingClient = new HttpEmbeddingClient({
        baseUrl: embBaseUrl,
        apiKey: embApiKey,
        model: embModel,
      });
    }
  }

  return new LocalKnowledgeProvider({
    cwd: opts.cwd,
    kbDirs: opts.kbDirs,
    kbGlob,
    embeddingClient,
  });
}
