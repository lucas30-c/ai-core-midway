/**
 * 自定义应用错误类
 * 统一封装业务错误，携带错误码、HTTP 状态码和原始错误原因
 */
import { ErrorCode, ErrorCodes } from './error.codes';

/**
 * AppError - 应用级别的标准错误类
 *
 * @description
 * 就像快递包裹的“退件单”，每个错误都有：
 * - code: 错误类型标签（相当于退件原因类型）
 * - status: HTTP 状态码（相当于处理优先级）
 * - cause: 原始错误（相当于详细退件说明）
 *
 * @example
 * throw new AppError('用户未找到', { code: ErrorCodes.VALIDATION, status: 404 });
 */
export class AppError extends Error {
  public code: ErrorCode;
  public status: number;
  public cause?: unknown;

  constructor(
    message: string,
    options?: {
      code?: ErrorCode;
      status?: number;
      cause?: unknown;
    }
  ) {
    super(message);

    this.code = options?.code ?? ErrorCodes.INTERNAL;
    this.status = options?.status ?? 500;
    this.cause = options?.cause;

    Object.setPrototypeOf(this, AppError.prototype);
  }
}