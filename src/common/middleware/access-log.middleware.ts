import { Middleware } from '@midwayjs/core';
import { Context, NextFunction } from '@midwayjs/koa';

/**
 * 访问日志中间件
 * 记录每个请求的访问信息，包含请求方法、路径、状态码、耗时等
 * 企业级标配，用于接入 ELK / ARMS 等日志分析平台
 */
@Middleware()
export class AccessLogMiddleware {
  resolve() {
    return async (ctx: Context, next: NextFunction) => {
      const start = Date.now();
      try {
        await next();
      } finally {
        const latencyMs = Date.now() - start;

        ctx.logger.info({
          level: 'info',
          kind: 'access',
          requestId: ctx.state?.requestId,
          traceId: ctx.state?.traceId,
          spanId: ctx.state?.spanId,
          method: ctx.method,
          path: ctx.path,
          status: ctx.status,
          latencyMs,
          ts: new Date().toISOString(),
        });
      }
    };
  }
}
