import { DiffFile } from '../diff/diff.types';
import { AiDebtConfig } from '../config/config.types';

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Finding {
  id: string;
  ruleId: string;
  severity: Severity;
  confidence: number;
  file: string;
  range?: { start: number; end: number };
  message: string;
  evidence?: string;
}

export interface AnalyzeContext {
  diffFiles: DiffFile[];
  stats: { filesChanged: number; insertions: number; deletions: number };
  cwd: string;
  changedFiles: string[]; // normalized paths (relative POSIX, no a/b prefix)
  config: AiDebtConfig;
}

export interface Rule {
  id: string;
  run(ctx: AnalyzeContext): Finding[];
}
