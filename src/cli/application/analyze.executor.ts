import { AnalyzeCommandOptions, ExitCode } from '../contracts/cli.types';
import { CliError } from '../errors/cli.errors';
import { readDiffFile } from '../adapters/diff-file.source';
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

export async function executeAnalyzeCommand(
  options: AnalyzeCommandOptions
): Promise<never> {
  try {
    const diff = await readDiffFile(options.diffFile);
    const analyzer = createAnalyzer();
    const result = await analyzer.analyzeDiff(diff, {
      tscMode: options.tscMode,
    });
    const rendered = renderReport(result.report, options.format);
    await writeOutput(rendered, options.out);
    const exitCode = resolveExitCode(result.report, options.failOn);
    return process.exit(exitCode) as never;
  } catch (err: any) {
    if (err instanceof CliError) {
      process.stderr.write(`AI_DEBT_CLI_ERROR: ${err.message}\n`);
      return process.exit(err.exitCode) as never;
    }
    process.stderr.write(
      `AI_DEBT_CLI_ERROR: ${err?.message ?? 'Unknown error'}\n`
    );
    return process.exit(ExitCode.ERROR) as never;
  }
}
