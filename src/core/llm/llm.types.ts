export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  model?: string;
}

export interface ChatResult {
  text: string;
  usage?: any;
  model: string;
  fallbackUsed: boolean;
}

export interface LlmProvider {
  name: string;

  chat(messages: ChatMessage[], opts?: ChatOptions): Promise<ChatResult>;

  chatStream(
    messages: ChatMessage[],
    opts: ChatOptions & { onToken: (t: string) => void }
  ): Promise<{ model: string; fallbackUsed: boolean }>;
}