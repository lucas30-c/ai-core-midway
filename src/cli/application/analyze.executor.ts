import { AnalyzeCommandOptions, ExitCode } from '../contracts/cli.types';
import { CliError, UsageError } from '../errors/cli.errors';
import { readDiffFile } from '../adapters/diff-file.source';
import { readGitCommitDiff } from '../adapters/diff-sources/git-commit.source';
import { readGitRangeDiff } from '../adapters/diff-sources/git-range.source';
import { readGitStagedDiff } from '../adapters/diff-sources/git-staged.source';
import { loadAiDebtConfig } from '../adapters/config/config.loader';
import { renderReport } from '../adapters/renderers';
import { writeOutput } from '../adapters/output.writer';
import { resolveExitCode } from './exit-code.policy';
import { AnalyzeService } from '../../modules/analyze/analyze.service';
import { AiDebtConfig } from '../../domain/analyze/config/config.types';

function createAnalyzer(cwd: string, config: AiDebtConfig) {
  const service = new AnalyzeService();
  return {
    analyzeDiff(diff: string, opts: { tscMode: 'fast' | 'full' }) {
      return service.analyzeDiff(diff, { ...opts, cwd, config });
    },
  };
}

async function resolveDiffSource(
  options: AnalyzeCommandOptions
): Promise<string> {
  if (options.diffFile) {
    return readDiffFile(options.diffFile);
  }
  if (options.git) {
    return readGitCommitDiff(options.git, options.cwd);
  }
  if (options.gitRange) {
    return readGitRangeDiff(options.gitRange, options.cwd);
  }
  if (options.staged) {
    return readGitStagedDiff(options.cwd);
  }
  throw new UsageError(
    'No diff source provided. Use --diff-file, --git, --git-range, or --staged'
  );
}

export async function executeAnalyzeCommand(
  options: AnalyzeCommandOptions
): Promise<ExitCode> {
  try {
    const config = loadAiDebtConfig(options.cwd, options.config);
    const diff = await resolveDiffSource(options);
    const analyzer = createAnalyzer(options.cwd, config);
    const result = await analyzer.analyzeDiff(diff, {
      tscMode: options.tscMode,
    });
    const rendered = renderReport(result.report, options.format);
    await writeOutput(rendered, options.out);
    return resolveExitCode(result.report, options.failOn);
  } catch (err: any) {
    if (err instanceof CliError) {
      process.stderr.write(`AI_DEBT_CLI_ERROR: ${err.message}\n`);
      return err.exitCode as ExitCode;
    }
    process.stderr.write(
      `AI_DEBT_CLI_ERROR: ${err?.message ?? 'Unknown error'}\n`
    );
    return ExitCode.ERROR;
  }
}
