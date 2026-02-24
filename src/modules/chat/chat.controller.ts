import { Controller, Post, Get, Body, Inject } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { LlmService } from '../../core/llm/llm.service';
import { ChatBodyDTO } from './chat.dto';
import { CallStore } from '../../core/metrics/call.store';

@Controller('/')
export class ChatController {
  @Inject()
  ctx: Context;

  @Inject()
  llm: LlmService;

  @Inject()
  callStore: CallStore;

  @Post('/chat')
  async chat(@Body() body: ChatBodyDTO) {
    const ctx = this.ctx;
    const requestId = ctx.state.requestId;
    const traceId = ctx.state.traceId;
    const spanId = ctx.state.spanId;
    const t0 = Date.now();

    let model = 'unknown';
    let fallbackUsed = false;

    try {
      const result = await this.llm.chat(body.messages, {
        temperature: body.temperature,
        model: body.model,
      });

      model = result.model;
      fallbackUsed = result.fallbackUsed;
      const latencyMs = Date.now() - t0;

      // 成功入库
      this.callStore.add({
        requestId,
        model,
        latencyMs,
        totalTokens: result.usage?.total_tokens,
        cost: result.usage?.cost,
        status: 'success',
        ts: new Date().toISOString(),
      });

      // 业务日志（不是 access log）
      ctx.logger.info({
        level: 'info',
        kind: 'llm_call',
        requestId,
        traceId,
        spanId,
        route: '/chat',
        model,
        fallbackUsed,
        latencyMs,
        totalTokens: result.usage?.total_tokens,
        cost: result.usage?.cost,
        ts: new Date().toISOString(),
      });

      return { requestId, traceId, ...result, latencyMs };
    } catch (err: any) {
      const latencyMs = Date.now() - t0;

      // 失败也入库
      this.callStore.add({
        requestId,
        model,
        latencyMs,
        status: 'error',
        errorCode: err?.code || 'INTERNAL',
        ts: new Date().toISOString(),
      });

      // 继续抛给 GlobalErrorFilter 统一处理
      throw err;
    }
  }

  @Post('/chat/stream')
  async chatStream(@Body() body: ChatBodyDTO) {
    const ctx = this.ctx;
    const requestId = ctx.state.requestId;
    const traceId = ctx.state.traceId;
    const spanId = ctx.state.spanId;
    const t0 = Date.now();

    let model = 'unknown';
    let fallbackUsed = false;

    ctx.set('Content-Type', 'text/event-stream; charset=utf-8');
    ctx.set('Cache-Control', 'no-cache, no-transform');
    ctx.set('Connection', 'keep-alive');

    const send = (event: string, data: any) => {
      ctx.res.write(`event: ${event}\n`);
      ctx.res.write(`data: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`);
    };

    send('meta', { requestId, traceId });

    try {
      const out = await this.llm.chatStream(body.messages, {
        temperature: body.temperature,
        model: body.model,
        onToken: (tok) => send('token', tok),
      });

      model = out.model;
      fallbackUsed = out.fallbackUsed;
      const latencyMs = Date.now() - t0;

      // 成功入库
      this.callStore.add({
        requestId,
        model,
        latencyMs,
        status: 'success',
        ts: new Date().toISOString(),
      });

      // 业务日志
      ctx.logger.info({
        level: 'info',
        kind: 'llm_call',
        requestId,
        traceId,
        spanId,
        route: '/chat/stream',
        model,
        fallbackUsed,
        latencyMs,
        ts: new Date().toISOString(),
      });

      send('done', '[DONE]');
      ctx.res.end();
      return;
    } catch (err: any) {
      const latencyMs = Date.now() - t0;

      // 失败也入库
      this.callStore.add({
        requestId,
        model,
        latencyMs,
        status: 'error',
        errorCode: err?.code || 'INTERNAL',
        ts: new Date().toISOString(),
      });

      // 继续抛给 GlobalErrorFilter 统一处理
      throw err;
    }
  }

  @Get('/metrics')
  async metrics() {
    return this.callStore.recent();
  }

  @Get('/metrics/recent')
  async recent() {
    return this.callStore.recent();
  }

  @Get('/metrics/summary')
  async summary() {
    return this.callStore.summary();
  }
}