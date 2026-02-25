export interface LlmProviderConfig {
  provider: 'openai-compatible' | 'mock';
  baseUrl: string;
  apiKey: string;
  model: string;
  fallbackModel?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}
