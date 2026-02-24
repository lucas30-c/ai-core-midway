import { Finding } from '../rules/rule.types';

export interface ToolRunContext {
  cwd: string;              // repo root
  files: string[];          // changed files (filtered)
  requestId?: string;
  traceId?: string;
}

export interface ToolRunner {
  id: string;
  run(ctx: ToolRunContext): Promise<Finding[]>;
}