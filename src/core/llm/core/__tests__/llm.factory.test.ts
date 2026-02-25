import { createLlmProvider } from '../llm.factory';
import { LlmProviderConfig } from '../llm-config.types';
import { OpenAICompatibleProvider } from '../openai-compatible.provider';
import { MockLlmProvider } from '../mock.provider';

describe('createLlmProvider', () => {
  it('creates OpenAICompatibleProvider for "openai-compatible"', () => {
    const config: LlmProviderConfig = {
      provider: 'openai-compatible',
      baseUrl: 'https://api.example.com',
      apiKey: 'key',
      model: 'model',
    };
    const provider = createLlmProvider(config);
    expect(provider).toBeInstanceOf(OpenAICompatibleProvider);
    expect(provider.name).toBe('openai-compatible');
  });

  it('creates MockLlmProvider for "mock"', () => {
    const config: LlmProviderConfig = {
      provider: 'mock',
      baseUrl: '',
      apiKey: '',
      model: '',
    };
    const provider = createLlmProvider(config);
    expect(provider).toBeInstanceOf(MockLlmProvider);
    expect(provider.name).toBe('mock');
  });

  it('mock provider returns deterministic response', async () => {
    const config: LlmProviderConfig = {
      provider: 'mock',
      baseUrl: '',
      apiKey: '',
      model: '',
    };
    const provider = createLlmProvider(config);
    const result = await provider.chat([{ role: 'user', content: 'hi' }]);

    expect(result.model).toBe('mock');
    expect(result.fallbackUsed).toBe(false);
    const parsed = JSON.parse(result.text);
    expect(parsed.summary).toBe('Mock LLM summary');
    expect(parsed.additionalChecklist).toEqual(['Mock checklist item']);
  });

  it('throws on unknown provider', () => {
    const config = {
      provider: 'unknown',
      baseUrl: '',
      apiKey: '',
      model: '',
    } as any;
    expect(() => createLlmProvider(config)).toThrow(
      'Unknown LLM provider: unknown'
    );
  });
});
