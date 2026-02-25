import { AnalyzeCommandOptions, ExitCode } from '../contracts/cli.types';
import { CliError, UsageError } from '../errors/cli.errors';
import { readDiffFile } from '../adapters/diff-file.source';
import { readGitCommitDiff } from '../adapters/diff-sources/git-commit.source';
import { readGitRangeDiff } from '../adapters/diff-sources/git-range.source';
import { renderReport } from '../adapters/renderers';
import { writeOutput } from '../adapters/output.writer';
import { resolveExitCode } from './exit-code.policy';
import { AnalyzeService } from '../../modules/analyze/analyze.service';

function createAnalyzer() {
  const service = new AnalyzeService();
  return {
    analyzeDiff(diff: string, opts: { tscMode: 'fast' | 'full' }) {
      return service.analyzeDiff(diff, opts);
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
  throw new UsageError(
    'No diff source provided. Use --diff-file, --git, or --git-range'
  );
}

export async function executeAnalyzeCommand(
  options: AnalyzeCommandOptions
): Promise<ExitCode> {
  try {
    const diff = await resolveDiffSource(options);
    const analyzer = createAnalyzer();
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
