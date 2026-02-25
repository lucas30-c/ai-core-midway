#!/usr/bin/env node

import { Command } from 'commander';
import { registerAnalyzeCommand } from './commands/analyze.command';

// Dynamic import from package.json
// Path: dist/cli/index.js → ../../package.json (root)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require('../../package.json');

// Guard: only run when executed directly (not when required by Midway scanner)
if (require.main === module) {
  const program = new Command();

  program
    .name(pkg.name)
    .description('AI-powered technical debt analyzer')
    .version(pkg.version);

  registerAnalyzeCommand(program);

  program.parse(process.argv);
}
