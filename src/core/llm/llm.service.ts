import { Inject, Provide, Config, Init } from '@midwayjs/core';
import { AppError } from '../../common/errors/app.error';
import { ErrorCodes } from '../../common/errors/error.codes';
import { LlmProvider, ChatMessage, ChatOptions, ChatResult } from './llm.types';
import { OpenRouterProvider } from './providers/openrouter.provider';

@Provide()
export class LlmService {
  @Config('ai')
  aiConfig: any;

  @Inject()
  openrouterProvider: OpenRouterProvider;

  private providers: Record<string, LlmProvider>;

  @Init()
  async onModuleInit() {
    this.providers = {
      openrouter: this.openrouterProvider,
    };
  }

  private getProvider(): LlmProvider {
    const name = this.aiConfig?.provider;
    const p = this.providers[name];
    if (!p) {
      throw new AppError(`Unknown provider: ${name}`, {
        code: ErrorCodes.CONFIG,
        status: 500,
      });
    }
    return p;
  }

  async chat(messages: ChatMessage[], opts?: ChatOptions): Promise<ChatResult> {
    if (!messages?.length) {
      throw new AppError('messages is required', {
        code: ErrorCodes.VALIDATION,
        status: 400,
      });
    }
    return this.getProvider().chat(messages, opts);
  }

  async chatStream(
    messages: ChatMessage[],
    opts: ChatOptions & { onToken: (t: string) => void }
  ) {
    if (!messages?.length) {
      throw new AppError('messages is required', {
        code: ErrorCodes.VALIDATION,
        status: 400,
      });
    }
    return this.getProvider().chatStream(messages, opts);
  }
}
