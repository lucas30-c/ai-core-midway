import { Provide, Scope, ScopeEnum } from '@midwayjs/core';
import db from './db';

/**
 * 调用记录结构
 */
export interface CallRecord {
  requestId: string;
  model: string;
  latencyMs: number;
  totalTokens?: number;
  cost?: number;
  status: 'success' | 'error';
  errorCode?: string;
  ts: string;
}

/**
 * 调用记录内存存储 + SQLite 持久化
 * 用于记录 LLM 调用历史，支持成本分析和链路追踪
 */
@Provide()
@Scope(ScopeEnum.Singleton)
export class CallStore {
  private cache: CallRecord[] = [];

  add(record: CallRecord) {
    this.cache.push(record);

    if (this.cache.length > 1000) {
      this.cache.shift();
    }

    db.prepare(
      `
      INSERT INTO llm_calls
      (request_id, model, latency_ms, total_tokens, cost, status, error_code, ts)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      record.requestId,
      record.model,
      record.latencyMs,
      record.totalTokens,
      record.cost,
      record.status,
      record.errorCode || null,
      record.ts
    );
  }

  recent() {
    return this.cache.slice(-50);
  }

  summary() {
    return db
      .prepare(
        `
      SELECT
        COUNT(*) as total_calls,
        SUM(total_tokens) as total_tokens,
        SUM(cost) as total_cost,
        AVG(latency_ms) as avg_latency
      FROM llm_calls
    `
      )
      .get();
  }
}
