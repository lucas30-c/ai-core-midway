import { EmbeddingClient } from '../kb.types';

export interface EmbeddingClientConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeout?: number;
}

export class HttpEmbeddingClient implements EmbeddingClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeout: number;

  constructor(config: EmbeddingClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/v1\/?$/, '');
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.timeout = config.timeout ?? 30000;
  }

  async embed(texts: string[]): Promise<Float32Array[] | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetch(`${this.baseUrl}/v1/embeddings`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: this.model, input: texts }),
        signal: controller.signal,
      });

      if (!res.ok) return null;

      const data = (await res.json()) as {
        data: Array<{ embedding: number[]; index: number }>;
      };

      if (!data.data?.length) return null;

      const sorted = data.data.sort((a, b) => a.index - b.index);
      return sorted.map(d => new Float32Array(d.embedding));
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
