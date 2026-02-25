import { Command } from 'commander';
import { AnalyzeCommandOptions } from '../contracts/cli.types';
import { executeAnalyzeCommand } from '../application/analyze.executor';

export function registerAnalyzeCommand(program: Command): void {
  program
    .command('analyze')
    .description('Analyze a git diff for technical debt')
    .option('--diff-file <path>', 'Path to git diff file')
    .option('--git <commit>', 'Analyze diff from a single git commit')
    .option('--git-range <range>', 'Analyze diff between two refs (base..head)')
    .option('--format <type>', 'Output format (markdown|json)', 'markdown')
    .option('--out <path>', 'Output file path (default: stdout)')
    .option('--fail-on <level>', 'Fail threshold (error|warning)', 'error')
    .option('--tsc-mode <mode>', 'TypeScript check mode (fast|full)', 'fast')
    .action(async (opts: Record<string, string>) => {
      // Source exclusivity check
      const sources = [opts.diffFile, opts.git, opts.gitRange].filter(Boolean);
      if (sources.length !== 1) {
        process.stderr.write(
          'AI_DEBT_CLI_ERROR: Exactly one diff source required' +
            ' (--diff-file | --git | --git-range)\n'
        );
        process.exit(2);
      }

      const format = opts.format as AnalyzeCommandOptions['format'];
      if (!['markdown', 'json'].includes(format)) {
        process.stderr.write(
          'AI_DEBT_CLI_ERROR: Invalid --format value' +
            ` "${opts.format}". Must be markdown or json.\n`
        );
        process.exit(2);
      }

      const failOn = opts.failOn as AnalyzeCommandOptions['failOn'];
      if (!['error', 'warning'].includes(failOn)) {
        process.stderr.write(
          'AI_DEBT_CLI_ERROR: Invalid --fail-on value' +
            ` "${opts.failOn}". Must be error or warning.\n`
        );
        process.exit(2);
      }

      const tscMode = opts.tscMode as AnalyzeCommandOptions['tscMode'];
      if (!['fast', 'full'].includes(tscMode)) {
        process.stderr.write(
          'AI_DEBT_CLI_ERROR: Invalid --tsc-mode value' +
            ` "${opts.tscMode}". Must be fast or full.\n`
        );
        process.exit(2);
      }

      const options: AnalyzeCommandOptions = {
        diffFile: opts.diffFile,
        git: opts.git,
        gitRange: opts.gitRange,
        format,
        out: opts.out,
        failOn,
        tscMode,
        cwd: process.cwd(),
      };

      const exitCode = await executeAnalyzeCommand(options);
      process.exit(exitCode);
    });
}
