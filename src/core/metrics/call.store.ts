import { Provide, Scope, ScopeEnum } from '@midwayjs/core';

/**
 * 调用记录结构
 */
export interface CallRecord {
  requestId: string;
  model: string;
  latencyMs: number;
  totalTokens?: number;
  cost?: number;
  ts: string;
}

/**
 * 调用记录内存存储
 * 用于记录 LLM 调用历史，支持成本分析和链路追踪
 */
@Provide()
@Scope(ScopeEnum.Singleton)
export class CallStore {
  private records: CallRecord[] = [];

  add(record: CallRecord) {
    this.records.push(record);
  }

  list() {
    return this.records.slice(-50);
  }
}
