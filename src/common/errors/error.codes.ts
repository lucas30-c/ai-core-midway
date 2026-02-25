/**
 * 应用错误码常量定义
 * 用于标识不同类型的业务错误，便于前端统一处理和日志追踪
 */
export const ErrorCodes = {
  /** 配置错误 - 如缺少必要的环境变量或配置项 */
  CONFIG: 'CONFIG',
  /** 参数校验错误 - 请求参数不符合预期格式或规则 */
  VALIDATION: 'VALIDATION',
  /** 上游服务错误 - 第三方 API 调用失败 */
  UPSTREAM: 'UPSTREAM',
  /** 认证错误 - 用户身份验证失败或权限不足 */
  AUTH: 'AUTH',
  /** 内部错误 - 未知的服务器内部错误 */
  INTERNAL: 'INTERNAL',
} as const;

/** 错误码类型，从 ErrorCodes 常量中推导 */
export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
