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
  config?: string;

  // Phase 2 additions
  kbDir?: string[];
  kbGlob?: string;
  kbOff?: boolean;
  llmOff?: boolean;
  llmProvider?: string;
  llmModel?: string;
  llmBaseUrl?: string;
  llmApiKey?: string;
}

export enum ExitCode {
  SUCCESS = 0,
  THRESHOLD_EXCEEDED = 1,
  ERROR = 2,
}
