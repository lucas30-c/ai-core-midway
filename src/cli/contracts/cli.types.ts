export interface AnalyzeCommandOptions {
  diffFile?: string;
  git?: string;
  gitRange?: string;
  format: 'markdown' | 'json';
  out?: string;
  failOn: 'error' | 'warning';
  tscMode: 'fast' | 'full';
  cwd: string;
}

export enum ExitCode {
  SUCCESS = 0,
  THRESHOLD_EXCEEDED = 1,
  ERROR = 2,
}
