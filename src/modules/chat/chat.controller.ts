import { Controller, Post, Body, Inject } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { LlmService } from '../../core/llm/llm.service';
import { ChatBodyDTO } from './chat.dto';

@Controller('/')
export class ChatController {
  @Inject()
  ctx: Context;

  @Inject()
  llm: LlmService;

  @Post('/chat')
  async chat(@Body() body: ChatBodyDTO) {
    const requestId = this.ctx.state.requestId;
    const t0 = Date.now();

    const result = await this.llm.chat(body.messages, {
      temperature: body.temperature,
      model: body.model,
    });

    const latencyMs = Date.now() - t0;

    this.ctx.logger.info({
      level: 'info',
      requestId,
      route: '/chat',
      model: result.model,
      fallbackUsed: result.fallbackUsed,
      latencyMs,
      ts: new Date().toISOString(),
    });

    return { requestId, ...result, latencyMs };
  }

  @Post('/chat/stream')
  async chatStream(@Body() body: ChatBodyDTO) {
    const ctx = this.ctx;
    const requestId = ctx.state.requestId;
    const t0 = Date.now();

    ctx.set('Content-Type', 'text/event-stream; charset=utf-8');
    ctx.set('Cache-Control', 'no-cache, no-transform');
    ctx.set('Connection', 'keep-alive');

    const send = (event: string, data: any) => {
      ctx.res.write(`event: ${event}\n`);
      ctx.res.write(`data: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`);
    };

    send('meta', { requestId });

    const out = await this.llm.chatStream(body.messages, {
      temperature: body.temperature,
      model: body.model,
      onToken: (tok) => send('token', tok),
    });

    const latencyMs = Date.now() - t0;

    ctx.logger.info({
      level: 'info',
      requestId,
      route: '/chat/stream',
      model: out.model,
      fallbackUsed: out.fallbackUsed,
      latencyMs,
      ts: new Date().toISOString(),
    });

    send('done', '[DONE]');
    ctx.res.end();
    return;
  }
}