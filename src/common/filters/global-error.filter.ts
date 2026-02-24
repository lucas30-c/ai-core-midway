/**
 * 全局错误过滤器
 * 统一拦截所有未处理的异常，进行日志记录并返回标准化错误响应
 *
 * @description
 * 就像公司的“客户投诉处理中心”：
 * - 所有问题都汇总到这里统一处理
 * - 记录详细日志便于事后追查
 * - 给客户（前端）返回友好的错误信息
 * 
 * 任何地方 throw error，都会被 GlobalErrorFilter 捕获，然后：

打一条结构化日志

返回统一格式的错误 JSON

否则你会遇到“有的接口报错是 HTML，有的是 JSON，有的直接崩掉”
 */
import { Catch } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { AppError } from '../errors/app.error';
import { ErrorCodes } from '../errors/error.codes';

@Catch()
export class GlobalErrorFilter {
  async catch(err: any, ctx: Context) {
    const requestId = ctx.state?.requestId;
    const traceId = ctx.state?.traceId;
    const spanId = ctx.state?.spanId;

    const isAppError = err instanceof AppError;

    const status = isAppError ? err.status : 500;
    const code = isAppError ? err.code : ErrorCodes.INTERNAL;
    const message = isAppError ? err.message : 'Internal Server Error';

    ctx.logger.error({
      level: 'error',
      requestId,
      traceId,
      spanId,
      code,
      status,
      message,
      cause: String(err?.cause ?? err?.message ?? err),
      path: ctx.path,
      method: ctx.method,
      ts: new Date().toISOString(),
    });

    ctx.status = status;
    ctx.body = {
      requestId,
      traceId,
      code,
      error: message,
    };
  }
}