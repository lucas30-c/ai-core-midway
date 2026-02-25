Spec: Productization Enhancements for ai-debt CLI
Goal

Enhance the existing ai-debt analyze CLI with product-level capabilities:

Add --staged diff source

Add --cwd support for git + analysis execution

Add schemaVersion and metadata to JSON output

Add a sample GitHub Actions CI workflow

Do NOT modify domain/analyze logic.
Do NOT introduce AST rules yet.
Do NOT refactor Midway.
Only extend CLI layer and output layer.

1️⃣ Add --staged Support
Behavior
ai-debt analyze --staged

Should analyze:

git diff --no-color --cached

Meaning: analyze currently staged changes.

Constraints

--staged is mutually exclusive with:

--diff-file

--git

--git-range

Exactly one source must be provided.

Implementation
Update CLI types
export interface AnalyzeCommandOptions {
  diffFile?: string;
  git?: string;
  gitRange?: string;
  staged?: boolean;   // NEW
  format: 'markdown' | 'json';
  out?: string;
  failOn: 'error' | 'warning';
  tscMode: 'fast' | 'full';
  cwd: string;
}
Create new source adapter

File:

src/cli/adapters/diff-sources/git-staged.source.ts
export async function readGitStagedDiff(
  cwd: string
): Promise<string>

Implementation:

execGitCommand(['diff', '--no-color', '--cached'], cwd)
Update exclusivity validation

In analyze.command.ts:

const sources = [
  opts.diffFile,
  opts.git,
  opts.gitRange,
  opts.staged ? true : undefined
].filter(Boolean);

if (sources.length !== 1) {
  // stderr + exit 2
}
Update resolveDiffSource()

Add:

if (options.staged) {
  return readGitStagedDiff(options.cwd);
}
2️⃣ Add --cwd Support
Behavior

Allow:

ai-debt analyze --git HEAD --cwd ./packages/app

This should:

Run git commands in provided cwd

Pass cwd into analyzer (for ESLint/TSC runners)

Implementation

In analyze.command.ts:

Add:

.option('--cwd <path>', 'Working directory', process.cwd())

Pass it into AnalyzeCommandOptions.

Ensure:

execGitCommand uses cwd

createAnalyzer uses cwd (if analyzer depends on working directory)

3️⃣ Add JSON schemaVersion + metadata

Enhance JSON output format.

Current JSON
{
  ...reportModel
}
New JSON structure
{
  "schemaVersion": "1.0.0",
  "generatedAt": "...",
  "engine": {
    "name": "ai-debt",
    "version": "1.0.0"
  },
  "analysis": {
    ...existing report model
  }
}
Requirements

schemaVersion hardcoded as "1.0.0"

engine.version read from package.json

Preserve backward compatibility in markdown mode (no change)

Only JSON format gets wrapper

Implementation

Modify:

src/cli/adapters/renderers.ts

When format === 'json':

return JSON.stringify({
  schemaVersion: '1.0.0',
  generatedAt: new Date().toISOString(),
  engine: {
    name: 'ai-debt',
    version: pkg.version
  },
  analysis: report
}, null, 2);

Read version from package.json dynamically.

4️⃣ Add GitHub Actions Example Workflow

Create:

.github/workflows/ai-debt.yml
Workflow Content
name: AI Debt Analysis

on:
  pull_request:
    branches:
      - main

jobs:
  analyze:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 18

      - run: npm install

      - run: npm run build

      - run: |
          node dist/cli/index.js analyze \
            --git-range origin/main..HEAD \
            --fail-on warning \
            --format markdown \
            --out ai-debt-report.md

      - uses: actions/upload-artifact@v4
        with:
          name: ai-debt-report
          path: ai-debt-report.md
5️⃣ Tests

Add unit tests for:

staged source validation

source exclusivity with staged

JSON wrapper contains:

schemaVersion

engine.version

analysis property

6️⃣ Acceptance Criteria

--staged works correctly

--cwd correctly changes git execution directory

JSON output contains wrapper metadata

Markdown output unchanged

All previous tests pass

New tests pass

Lint clean

7️⃣ Non-goals

No AST rules yet

No RAG

No multi-language support

No Docker support

Final Deliverable

Working CLI:

ai-debt analyze --staged
ai-debt analyze --git HEAD --cwd ./packages/app
ai-debt analyze --git-range main..HEAD --format json

With CI workflow example committed.