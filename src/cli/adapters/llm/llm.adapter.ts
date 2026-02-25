import { LlmProvider } from '../../../core/llm/llm.types';
import { LlmProviderConfig } from '../../../core/llm/core/llm-config.types';
import { createLlmProvider } from '../../../core/llm/core/llm.factory';

export interface LlmAdapterOptions {
  llmOff?: boolean;
  llmProvider?: string;
  llmModel?: string;
  llmBaseUrl?: string;
  llmApiKey?: string;
}

export function initLlmProvider(opts: LlmAdapterOptions): LlmProvider | null {
  if (opts.llmOff) return null;

  const provider =
    opts.llmProvider ??
    process.env.TECH_DEBT_LLM_PROVIDER ??
    'openai-compatible';

  const model = opts.llmModel ?? process.env.TECH_DEBT_LLM_MODEL ?? '';
  const apiKey = opts.llmApiKey ?? process.env.TECH_DEBT_LLM_API_KEY ?? '';
  const baseUrl =
    opts.llmBaseUrl ??
    process.env.TECH_DEBT_LLM_BASE_URL ??
    'https://openrouter.ai/api';

  if (!apiKey || !model) return null;

  const config: LlmProviderConfig = {
    provider: provider as 'openai-compatible' | 'mock',
    baseUrl,
    apiKey,
    model,
  };

  return createLlmProvider(config);
}
