import {
  LlmProvider,
  ChatMessage,
  ChatOptions,
  ChatResult,
} from '../llm.types';

export class MockLlmProvider implements LlmProvider {
  name = 'mock';

  async chat(
    _messages: ChatMessage[],
    _opts?: ChatOptions
  ): Promise<ChatResult> {
    return {
      text: JSON.stringify({
        summary: 'Mock LLM summary',
        riskExplanations: [],
        additionalChecklist: ['Mock checklist item'],
      }),
      model: 'mock',
      fallbackUsed: false,
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    };
  }

  async chatStream(
    _messages: ChatMessage[],
    _opts: ChatOptions & { onToken: (t: string) => void }
  ): Promise<{ model: string; fallbackUsed: boolean }> {
    throw new Error('MockLlmProvider does not support streaming');
  }
}
