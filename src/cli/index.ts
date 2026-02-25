#!/usr/bin/env node

import { Command } from 'commander';
import { registerAnalyzeCommand } from './commands/analyze.command';

// Guard: only run when executed directly (not when required by Midway scanner)
if (require.main === module) {
  const program = new Command();

  program
    .name('ai-debt')
    .description('AI-powered technical debt analyzer')
    .version('1.0.0');

  registerAnalyzeCommand(program);

  program.parse(process.argv);
}
