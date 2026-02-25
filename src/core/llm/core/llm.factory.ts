import { LlmProvider } from '../llm.types';
import { LlmProviderConfig } from './llm-config.types';
import { OpenAICompatibleProvider } from './openai-compatible.provider';
import { MockLlmProvider } from './mock.provider';

export function createLlmProvider(config: LlmProviderConfig): LlmProvider {
  switch (config.provider) {
    case 'openai-compatible':
      return new OpenAICompatibleProvider(config);
    case 'mock':
      return new MockLlmProvider();
    default:
      throw new Error(`Unknown LLM provider: ${(config as any).provider}`);
  }
}
