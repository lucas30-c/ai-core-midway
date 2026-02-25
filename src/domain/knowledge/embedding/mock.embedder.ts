import { EmbeddingClient } from '../kb.types';

export class MockEmbeddingClient implements EmbeddingClient {
  private readonly dimensions: number;

  constructor(dimensions = 384) {
    this.dimensions = dimensions;
  }

  async embed(texts: string[]): Promise<Float32Array[] | null> {
    return texts.map(() => {
      const vec = new Float32Array(this.dimensions);
      for (let i = 0; i < this.dimensions; i++) {
        vec[i] = Math.random() * 2 - 1;
      }
      // Normalize to unit vector
      let norm = 0;
      for (let i = 0; i < this.dimensions; i++) norm += vec[i] * vec[i];
      norm = Math.sqrt(norm);
      for (let i = 0; i < this.dimensions; i++) vec[i] /= norm;
      return vec;
    });
  }
}
