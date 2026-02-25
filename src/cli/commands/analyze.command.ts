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
    .option('--staged', 'Analyze staged changes (git diff --cached)')
    .option(
      '--cwd <path>',
      'Working directory for git and analysis',
      process.cwd()
    )
    .option('--format <type>', 'Output format (markdown|json)', 'markdown')
    .option('--out <path>', 'Output file path (default: stdout)')
    .option('--fail-on <level>', 'Fail threshold (error|warning)', 'error')
    .option('--tsc-mode <mode>', 'TypeScript check mode (fast|full)', 'fast')
    .option('--config <path>', 'Path to .ai-debt.json config file')
    .option('--kb-dir <path...>', 'Knowledge base directories (repeatable)')
    .option('--kb-glob <pattern>', 'Files to index within kb-dir', '**/*.md')
    .option('--kb-off', 'Disable KB even if --kb-dir is set')
    .option('--llm-off', 'Disable LLM enrichment')
    .option('--llm-provider <name>', 'LLM provider (openai-compatible|mock)')
    .option('--llm-model <name>', 'LLM model override')
    .option('--llm-base-url <url>', 'LLM base URL override (without /v1)')
    .option('--llm-api-key <key>', 'LLM API key override')
    .action(async (opts: Record<string, string | boolean>) => {
      // Source exclusivity check
      const sources = [
        opts.diffFile,
        opts.git,
        opts.gitRange,
        opts.staged ? true : undefined,
      ].filter(Boolean);
      if (sources.length !== 1) {
        process.stderr.write(
          'AI_DEBT_CLI_ERROR: Exactly one diff source required' +
            ' (--diff-file | --git | --git-range | --staged)\n'
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
        diffFile: opts.diffFile as string | undefined,
        git: opts.git as string | undefined,
        gitRange: opts.gitRange as string | undefined,
        staged: opts.staged as boolean | undefined,
        format,
        out: opts.out as string | undefined,
        failOn,
        tscMode,
        cwd: (opts.cwd as string) || process.cwd(),
        config: opts.config as string | undefined,
        kbDir: opts.kbDir as unknown as string[] | undefined,
        kbGlob: opts.kbGlob as string | undefined,
        kbOff: opts.kbOff as boolean | undefined,
        llmOff: opts.llmOff as boolean | undefined,
        llmProvider: opts.llmProvider as string | undefined,
        llmModel: opts.llmModel as string | undefined,
        llmBaseUrl: opts.llmBaseUrl as string | undefined,
        llmApiKey: opts.llmApiKey as string | undefined,
      };

      const exitCode = await executeAnalyzeCommand(options);
      process.exit(exitCode);
    });
}
