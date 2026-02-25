export interface AnalyzeCommandOptions {
  diffFile: string;
  format: 'markdown' | 'json';
  out?: string;
  failOn: 'error' | 'warning';
  tscMode: 'fast' | 'full';
}

export enum ExitCode {
  SUCCESS = 0,
  THRESHOLD_EXCEEDED = 1,
  ERROR = 2,
}
