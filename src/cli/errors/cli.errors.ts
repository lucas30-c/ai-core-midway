import { ExitCode } from '../contracts/cli.types';

export class CliError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode: number = ExitCode.ERROR) {
    super(message);
    this.name = 'CliError';
    this.exitCode = exitCode;
  }
}

export class UsageError extends CliError {
  constructor(message: string) {
    super(message, ExitCode.ERROR);
    this.name = 'UsageError';
  }
}

export class FileReadError extends CliError {
  constructor(message: string) {
    super(message, ExitCode.ERROR);
    this.name = 'FileReadError';
  }
}

export class AnalysisError extends CliError {
  constructor(message: string) {
    super(message, ExitCode.ERROR);
    this.name = 'AnalysisError';
  }
}
