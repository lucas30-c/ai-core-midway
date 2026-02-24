import { Middleware } from '@midwayjs/core';
import { Context, NextFunction } from '@midwayjs/koa';

/**
 * 生成随机 ID
 */
function randId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * 链路追踪中间件
 * 生成 traceId/spanId，支持上游传入以串联分布式链路
 */
@Middleware()
export class TraceMiddleware {
  resolve() {
    return async (ctx: Context, next: NextFunction) => {
      // 允许上游（网关/客户端）传入 traceId，方便串联
      const traceId = ctx.get('x-trace-id') || randId('trace');
      const spanId = randId('span');

      ctx.state.traceId = traceId;
      ctx.state.spanId = spanId;

      // 回传给客户端（后续前端/网关可以用来排查）
      ctx.set('x-trace-id', traceId);
      ctx.set('x-span-id', spanId);

      await next();
    };
  }
}
