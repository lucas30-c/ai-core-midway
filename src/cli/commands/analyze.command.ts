import { Command } from 'commander';
import { AnalyzeCommandOptions } from '../contracts/cli.types';
import { executeAnalyzeCommand } from '../application/analyze.executor';

export function registerAnalyzeCommand(program: Command): void {
  program
    .command('analyze')
    .description('Analyze a git diff file for technical debt')
    .requiredOption('--diff-file <path>', 'Path to git diff file')
    .option('--format <type>', 'Output format (markdown|json)', 'markdown')
    .option('--out <path>', 'Output file path (default: stdout)')
    .option('--fail-on <level>', 'Fail threshold (error|warning)', 'error')
    .option('--tsc-mode <mode>', 'TypeScript check mode (fast|full)', 'fast')
    .action(async (opts: Record<string, string>) => {
      const format = opts.format as AnalyzeCommandOptions['format'];
      if (!['markdown', 'json'].includes(format)) {
        process.stderr.write(
          `AI_DEBT_CLI_ERROR: Invalid --format value "${opts.format}". Must be markdown or json.\n`
        );
        process.exit(2);
      }

      const failOn = opts.failOn as AnalyzeCommandOptions['failOn'];
      if (!['error', 'warning'].includes(failOn)) {
        process.stderr.write(
          `AI_DEBT_CLI_ERROR: Invalid --fail-on value "${opts.failOn}". Must be error or warning.\n`
        );
        process.exit(2);
      }

      const tscMode = opts.tscMode as AnalyzeCommandOptions['tscMode'];
      if (!['fast', 'full'].includes(tscMode)) {
        process.stderr.write(
          `AI_DEBT_CLI_ERROR: Invalid --tsc-mode value "${opts.tscMode}". Must be fast or full.\n`
        );
        process.exit(2);
      }

      const options: AnalyzeCommandOptions = {
        diffFile: opts.diffFile,
        format,
        out: opts.out,
        failOn,
        tscMode,
      };

      await executeAnalyzeCommand(options);
    });
}
