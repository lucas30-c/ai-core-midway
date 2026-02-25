export interface AnalyzeCommandOptions {
  diffFile?: string;
  git?: string;
  gitRange?: string;
  staged?: boolean;
  format: 'markdown' | 'json';
  out?: string;
  failOn: 'error' | 'warning';
  tscMode: 'fast' | 'full';
  cwd: string;
  config?: string; // path to .ai-debt.json config file
}

export enum ExitCode {
  SUCCESS = 0,
  THRESHOLD_EXCEEDED = 1,
  ERROR = 2,
}
