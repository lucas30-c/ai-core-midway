/**
 * 请求 ID 中间件
 * 为每个 HTTP 请求生成唯一标识符，用于链路追踪和日志关联
 *
 * @description
 * - 每个请求都有一个唯一的 requestId
 * - 出问题时可以通过这个 ID 追踪整个请求链路
 * - 支持客户端传入自定义 ID（通过 x-request-id 请求头）
 *
 *
 * middleware（中间件）就是：

在每个请求到达 controller 之前/之后，统一做一些事。

比如我们写的 RequestIdMiddleware：

每个请求进来先生成 requestId

放到 ctx.state.requestId

并在响应 header 里返回 x-request-id

这就像前端里你给 axios 加的 interceptor（拦截器）。
 */
//
import { Middleware } from '@midwayjs/core';
import { Context, NextFunction } from '@midwayjs/koa';

function newRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

@Middleware()
export class RequestIdMiddleware {
  resolve() {
    return async (ctx: Context, next: NextFunction) => {
      const rid = ctx.get('x-request-id') || newRequestId();

      ctx.logger.info({ step: 'middleware', requestId: ctx.state.requestId });
      ctx.state.requestId = rid;
      ctx.set('x-request-id', rid);

      await next();
    };
  }
}
