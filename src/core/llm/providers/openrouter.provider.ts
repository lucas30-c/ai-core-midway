import { Provide, Config } from '@midwayjs/core';
import { AppError } from '../../../common/errors/app.error';
import { ErrorCodes } from '../../../common/errors/error.codes';
import {
  ChatMessage,
  ChatOptions,
  ChatResult,
  LlmProvider,
} from '../llm.types';

@Provide()
export class OpenRouterProvider implements LlmProvider {
  name = 'openrouter';

  @Config('ai.openrouter')
  cfg: any;

  private baseUrl() {
    return String(this.cfg?.baseUrl || 'https://openrouter.ai/api/v1').replace(
      /\/$/,
      ''
    );
  }

  private headers() {
    if (!this.cfg?.apiKey) {
      throw new AppError('Missing OPENROUTER_API_KEY', {
        code: ErrorCodes.CONFIG,
        status: 500,
      });
    }
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.cfg.apiKey}`,
      'HTTP-Referer': this.cfg.appUrl || 'http://localhost:7001',
      'X-Title': this.cfg.appName || 'ai-core-midway',
    };
  }

  private shouldFallback(status: number) {
    return status === 403 || status === 429 || status >= 500;
  }

  async chat(messages: ChatMessage[], opts?: ChatOptions): Promise<ChatResult> {
    const primary = opts?.model || this.cfg.model;
    const fallback = this.cfg.fallbackModel;

    const run = async (model: string) => {
      const resp = await fetch(`${this.baseUrl()}/chat/completions`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          model,
          messages,
          temperature: opts?.temperature ?? 0.7,
          stream: false,
        }),
      });

      if (!resp.ok) {
        return {
          ok: false,
          status: resp.status,
          errText: await resp.text().catch(() => ''),
        };
      }
      return { ok: true, data: await resp.json() };
    };

    let r = await run(primary);
    let fallbackUsed = false;

    if (!r.ok && this.shouldFallback(r.status || 0) && fallback) {
      fallbackUsed = true;
      r = await run(fallback);
    }

    if (!r.ok) {
      throw new AppError('Upstream error', {
        code: ErrorCodes.UPSTREAM,
        status: r.status ?? 502,
        cause: r.errText,
      });
    }

    const text = r.data?.choices?.[0]?.message?.content ?? '';
    const usage = r.data?.usage;
    const model = fallbackUsed ? fallback : primary;

    return { text, usage, model, fallbackUsed };
  }

  async chatStream(
    messages: ChatMessage[],
    opts: ChatOptions & { onToken: (t: string) => void }
  ) {
    const primary = opts?.model || this.cfg.model;
    const fallback = this.cfg.fallbackModel;

    const runStream = async (model: string) => {
      const resp = await fetch(`${this.baseUrl()}/chat/completions`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          model,
          messages,
          temperature: opts.temperature ?? 0.7,
          stream: true,
        }),
      });

      if (!resp.ok || !resp.body) {
        const errText = await resp.text().catch(() => '');
        throw new AppError('Upstream error', {
          code: ErrorCodes.UPSTREAM,
          status: resp.status,
          cause: errText,
        });
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data:')) continue;

          const payload = line.replace(/^data:\s*/, '');
          if (payload === '[DONE]') return;

          try {
            const json = JSON.parse(payload);
            const delta = json?.choices?.[0]?.delta?.content ?? '';
            if (delta) opts.onToken(delta);
          } catch {
            // ignore
          }
        }
      }
    };

    try {
      await runStream(primary);
      return { model: primary, fallbackUsed: false };
    } catch (e: any) {
      const status = e?.status ?? 0;
      if (
        fallback &&
        e?.code === ErrorCodes.UPSTREAM &&
        this.shouldFallback(status)
      ) {
        await runStream(fallback);
        return { model: fallback, fallbackUsed: true };
      }
      throw e;
    }
  }
}
