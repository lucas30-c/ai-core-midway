Quest Spec: Add Git Diff Sources to ai-debt CLI
Goal

Extend existing ai-debt analyze CLI to support git-based diff sources:

--git <commit-ish>

--git-range <base>..<head>

This must integrate into the existing CLI architecture without refactoring core analysis logic.

No changes to domain/analyze logic.
No Midway refactor.
No AST rules.
No RAG.

Only extend diff source adapters and CLI wiring.

Functional Requirements
1) New CLI Flags

Extend analyze command with:

Flag	Type	Description
--git <commit>	string	Analyze diff from single commit
--git-range <base>..<head>	string	Analyze diff between two refs
2) Source Exclusivity Rule

Exactly one of the following must be provided:

--diff-file

--git

--git-range

If:

none provided → exit 2 (UsageError)

more than one provided → exit 2 (UsageError)

Git Command Behavior
For --git <commit>

Execute:

git show --format= --no-color --patch <commit>

Capture stdout as unified diff.

If git exits non-zero → exit 2 with message:

AI_DEBT_CLI_ERROR: Failed to resolve git commit <commit>
For --git-range <base>..<head>

Validate format:

must contain ..

both base and head must be non-empty

Execute:

git diff --no-color <base>..<head>

Capture stdout as unified diff.

If git exits non-zero → exit 2 with message:

AI_DEBT_CLI_ERROR: Failed to resolve git range <base>..<head>
Implementation Structure

Add new files:

src/cli/adapters/diff-sources/
  git-commit.source.ts
  git-range.source.ts
  git.exec.ts
git.exec.ts

Implement:

export async function execGitCommand(
  args: string[],
  cwd: string
): Promise<string>

Use child_process.execFile (NOT exec shell).
Set:

maxBuffer large enough (e.g., 20MB)

encoding: 'utf8'

Reject on:

non-zero exit

stderr content

timeout (optional)

Update analyze.executor.ts

Replace direct call to readDiffFile() with:

const diff = await resolveDiffSource(options);

Implement:

async function resolveDiffSource(options: AnalyzeCommandOptions): Promise<string>

Switch on:

diffFile

git

gitRange

Update CLI Types

Modify AnalyzeCommandOptions:

export interface AnalyzeCommandOptions {
  diffFile?: string;
  git?: string;
  gitRange?: string;
  format: 'markdown' | 'json';
  out?: string;
  failOn: 'error' | 'warning';
  tscMode: 'fast' | 'full';
  cwd: string;
}
Update Commander Wiring

In analyze.command.ts:

Remove .requiredOption('--diff-file')

Make all three source flags optional

After parsing, validate exclusivity

Example:

const sources = [
  options.diffFile,
  options.git,
  options.gitRange
].filter(Boolean);

if (sources.length !== 1) {
  throw new UsageError('Exactly one diff source must be provided');
}
Error Handling

All errors must:

go to stderr

start with AI_DEBT_CLI_ERROR:

exit with code 2

Edge Cases to Handle

Not a git repository

Unknown commit

Invalid range format

Empty diff output

Allowed (exit 0, no findings)

Large diff

Use sufficient buffer in exec

Manual Verification Commands
# Single commit
node dist/cli/index.js analyze --git HEAD~1

# Range
node dist/cli/index.js analyze --git origin/main..HEAD

# Error: both flags
node dist/cli/index.js analyze --git HEAD --diff-file x.diff

# Error: invalid range
node dist/cli/index.js analyze --git-range main

# Not git repo
mkdir /tmp/test && cd /tmp/test
node /path/to/dist/cli/index.js analyze --git HEAD
Acceptance Criteria

All previous --diff-file functionality unchanged

Git commands produce identical report format as file-based diff

Exit codes consistent with existing policy

No refactor to AnalyzeService

Lint passes

Tests pass

Non-goals

No support for --staged

No three-dot range (...)

No shallow clone handling

No CI workflow addition in this task

Implementation Order

git.exec.ts

git-commit.source.ts

git-range.source.ts

update CLI types

update analyze.command.ts

update analyze.executor.ts

build + smoke test

Deliverable

Working CLI:

ai-debt analyze --git HEAD~1
ai-debt analyze --git-range main..HEAD

with correct markdown/json output and correct exit codes.