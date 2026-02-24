/**
 * 统一日志字段模型
 * 支持接入 ELK / Datadog 等日志系统
 */
export interface LogBase {
  level: 'info' | 'error' | 'warn';
  requestId?: string;
  route?: string;
  model?: string;
  fallbackUsed?: boolean;
  latencyMs?: number;
  errorCode?: string;
  message?: string;
  ts: string;
}

/**
 * 生成标准化日志对象
 */
export function baseLog(data: Partial<LogBase>): LogBase {
  return {
    level: data.level || 'info',
    ts: new Date().toISOString(),
    ...data,
  };
}
