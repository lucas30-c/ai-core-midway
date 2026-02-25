import { OpenAICompatibleProvider } from '../openai-compatible.provider';
import { LlmProviderConfig } from '../llm-config.types';

const BASE_CONFIG: LlmProviderConfig = {
  provider: 'openai-compatible',
  baseUrl: 'https://api.example.com',
  apiKey: 'test-key',
  model: 'test-model',
};

function mockFetchOk(content: string, usage?: any) {
  return jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      id: 'chatcmpl-1',
      choices: [
        { message: { role: 'assistant', content }, finish_reason: 'stop' },
      ],
      usage,
    }),
  });
}

describe('OpenAICompatibleProvider', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends request to {baseUrl}/v1/chat/completions', async () => {
    const mockFn = mockFetchOk('hello');
    globalThis.fetch = mockFn as any;

    const provider = new OpenAICompatibleProvider(BASE_CONFIG);
    await provider.chat([{ role: 'user', content: 'hi' }]);

    expect(mockFn).toHaveBeenCalledTimes(1);
    const [url, init] = mockFn.mock.calls[0];
    expect(url).toBe('https://api.example.com/v1/chat/completions');
    expect(init.method).toBe('POST');
    expect(init.headers['Authorization']).toBe('Bearer test-key');
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('normalizes baseUrl that ends with /v1', async () => {
    const mockFn = mockFetchOk('hello');
    globalThis.fetch = mockFn as any;

    const provider = new OpenAICompatibleProvider({
      ...BASE_CONFIG,
      baseUrl: 'https://openrouter.ai/api/v1',
    });
    await provider.chat([{ role: 'user', content: 'hi' }]);

    const [url] = mockFn.mock.calls[0];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
  });

  it('normalizes baseUrl that ends with /v1/', async () => {
    const mockFn = mockFetchOk('hello');
    globalThis.fetch = mockFn as any;

    const provider = new OpenAICompatibleProvider({
      ...BASE_CONFIG,
      baseUrl: 'https://openrouter.ai/api/v1/',
    });
    await provider.chat([{ role: 'user', content: 'hi' }]);

    const [url] = mockFn.mock.calls[0];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
  });

  it('parses response text and usage', async () => {
    globalThis.fetch = mockFetchOk('the answer', {
      prompt_tokens: 10,
      completion_tokens: 5,
      total_tokens: 15,
    }) as any;

    const provider = new OpenAICompatibleProvider(BASE_CONFIG);
    const result = await provider.chat([{ role: 'user', content: 'q' }]);

    expect(result.text).toBe('the answer');
    expect(result.model).toBe('test-model');
    expect(result.fallbackUsed).toBe(false);
    expect(result.usage).toEqual({
      prompt_tokens: 10,
      completion_tokens: 5,
      total_tokens: 15,
    });
  });

  it('passes temperature and model from ChatOptions', async () => {
    const mockFn = mockFetchOk('ok');
    globalThis.fetch = mockFn as any;

    const provider = new OpenAICompatibleProvider(BASE_CONFIG);
    await provider.chat([{ role: 'user', content: 'hi' }], {
      temperature: 0.1,
      model: 'custom-model',
    });

    const body = JSON.parse(mockFn.mock.calls[0][1].body);
    expect(body.model).toBe('custom-model');
    expect(body.temperature).toBe(0.1);
  });

  it('throws on non-OK response', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      text: async () => 'rate limited',
    }) as any;

    const provider = new OpenAICompatibleProvider(BASE_CONFIG);
    await expect(
      provider.chat([{ role: 'user', content: 'hi' }])
    ).rejects.toThrow('LLM request failed: 429 Too Many Requests');
  });

  it('throws on empty choices', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'x', choices: [] }),
    }) as any;

    const provider = new OpenAICompatibleProvider(BASE_CONFIG);
    await expect(
      provider.chat([{ role: 'user', content: 'hi' }])
    ).rejects.toThrow('LLM response missing choices or content');
  });

  it('uses fallback model on first model failure', async () => {
    let callCount = 0;
    globalThis.fetch = jest.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: false,
          status: 500,
          statusText: 'Error',
          text: async () => '',
        };
      }
      return {
        ok: true,
        json: async () => ({
          id: 'x',
          choices: [
            {
              message: { role: 'assistant', content: 'fallback' },
              finish_reason: 'stop',
            },
          ],
        }),
      };
    }) as any;

    const provider = new OpenAICompatibleProvider({
      ...BASE_CONFIG,
      fallbackModel: 'fallback-model',
    });
    const result = await provider.chat([{ role: 'user', content: 'hi' }]);

    expect(result.text).toBe('fallback');
    expect(result.fallbackUsed).toBe(true);
    expect(callCount).toBe(2);

    const secondBody = JSON.parse(
      (globalThis.fetch as jest.Mock).mock.calls[1][1].body
    );
    expect(secondBody.model).toBe('fallback-model');
  });

  it('chatStream throws not implemented', async () => {
    const provider = new OpenAICompatibleProvider(BASE_CONFIG);
    await expect(
      provider.chatStream([], { onToken: () => {} })
    ).rejects.toThrow('does not support streaming');
  });
});
