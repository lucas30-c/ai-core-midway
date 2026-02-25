import {
  LlmProvider,
  ChatMessage,
  ChatOptions,
  ChatResult,
} from '../llm.types';
import { LlmProviderConfig } from './llm-config.types';

interface OpenAIResponse {
  id: string;
  choices: Array<{
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/v1\/?$/, '');
}

export class OpenAICompatibleProvider implements LlmProvider {
  name = 'openai-compatible';

  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly fallbackModel?: string;
  private readonly defaultTemperature: number;
  private readonly maxTokens: number;
  private readonly timeout: number;

  constructor(config: LlmProviderConfig) {
    this.baseUrl = normalizeBaseUrl(config.baseUrl);
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.fallbackModel = config.fallbackModel;
    this.defaultTemperature = config.temperature ?? 0.3;
    this.maxTokens = config.maxTokens ?? 2048;
    this.timeout = config.timeout ?? 30000;
  }

  async chat(messages: ChatMessage[], opts?: ChatOptions): Promise<ChatResult> {
    const model = opts?.model ?? this.model;
    const temperature = opts?.temperature ?? this.defaultTemperature;

    try {
      return await this.doChat(messages, model, temperature);
    } catch (err) {
      if (this.fallbackModel && model !== this.fallbackModel) {
        return await this.doChat(messages, this.fallbackModel, temperature);
      }
      throw err;
    }
  }

  async chatStream(
    _messages: ChatMessage[],
    _opts: ChatOptions & { onToken: (t: string) => void }
  ): Promise<{ model: string; fallbackUsed: boolean }> {
    throw new Error(
      'OpenAICompatibleProvider does not support streaming in Phase 2'
    );
  }

  private async doChat(
    messages: ChatMessage[],
    model: string,
    temperature: number
  ): Promise<ChatResult> {
    const url = `${this.baseUrl}/v1/chat/completions`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          temperature,
          max_tokens: this.maxTokens,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(
          `LLM request failed: ${res.status} ${res.statusText}${
            body ? ` — ${body.slice(0, 200)}` : ''
          }`
        );
      }

      const data = (await res.json()) as OpenAIResponse;

      if (!data.choices?.length || !data.choices[0].message?.content) {
        throw new Error('LLM response missing choices or content');
      }

      return {
        text: data.choices[0].message.content,
        model: model,
        fallbackUsed: model !== this.model,
        usage: data.usage
          ? {
              prompt_tokens: data.usage.prompt_tokens,
              completion_tokens: data.usage.completion_tokens,
              total_tokens: data.usage.total_tokens,
            }
          : undefined,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
