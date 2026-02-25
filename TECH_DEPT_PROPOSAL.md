Qoder Quest Proposal: Ship ai-debt analyze CLI MVP (fast, CI-ready)
Goal

Implement a minimal but engineering-grade CLI for the existing repo without refactoring core.

Deliver MVP features only:

ai-debt analyze --diff-file <path>

--format markdown|json (default markdown)

--out <path> (optional)

--fail-on error|warning (default error)

--tsc-mode fast|full (default fast)

correct exit codes (CI ready)

Do not implement git diff sources yet.

Acceptance Criteria (must pass)

node dist/cli/index.js analyze --diff-file ./x.diff works

--format markdown prints markdown report to stdout

--format json prints JSON report to stdout (canonical report object)

--out ./report.md writes output file

Exit codes:

0 when below threshold

1 when >= threshold

2 for usage/runtime errors (invalid args, file read fail, analyze crash)

All errors go to stderr with prefix AI_DEBT_CLI_ERROR:

Implementation Plan
1) Add dependencies

add commander to dependencies

ensure build compiles cli to dist/cli/**

2) New CLI files (exact paths)

Create:

src/cli/index.ts
src/cli/commands/analyze.command.ts
src/cli/application/analyze.executor.ts
src/cli/application/exit-code.policy.ts
src/cli/adapters/diff-file.source.ts
src/cli/adapters/output.writer.ts
src/cli/adapters/renderers.ts
src/cli/contracts/cli.types.ts
src/cli/errors/cli.errors.ts

Keep code minimal & maintainable.

CLI Behavior Spec
Command
ai-debt analyze --diff-file <path> [--format markdown|json] [--out <path>] [--fail-on error|warning] [--tsc-mode fast|full]
Validation

--diff-file required

diff file must exist and non-empty (trim)

invalid enum values -> usage error (exit 2)

Core Integration (important)
Requirement

CLI must call the existing AnalyzeService or existing “analyzeDiff” entry from core.

Implementation approach:

Add a small adapter function createAnalyzer() inside src/cli/application/analyze.executor.ts (or a separate adapter file) that returns an object with:

analyzeDiff(diff: string, opts: { tscMode: "fast" | "full" }): Promise<ReportModel>

Do NOT refactor Midway yet.
If AnalyzeService requires DI, do the minimum manual construction needed in this adapter.

Exit Code Policy

Assume findings have severity: HIGH | MEDIUM | LOW

fail-on=error => exit 1 if any HIGH

fail-on=warning => exit 1 if any HIGH or MEDIUM

If the report model uses different field names, adapt it but keep semantics identical.

Package.json wiring

Add:

{
  "bin": {
    "ai-debt": "dist/cli/index.js"
  }
}

Ensure build produces dist/cli/index.js runnable with node.

Optional but nice:

add shebang in compiled output by keeping #!/usr/bin/env node at top of src/cli/index.ts

Minimal Testing (optional if no test infra)

If repo already has jest/vitest:

add a unit test for resolveExitCode(report, failOn).

Otherwise skip tests.

Quick Manual Smoke Commands (include in PR description)
npm run build
node dist/cli/index.js analyze --diff-file ./fixtures/sample.diff
node dist/cli/index.js analyze --diff-file ./fixtures/sample.diff --format json
node dist/cli/index.js analyze --diff-file ./fixtures/sample.diff --out ./tmp/report.md
echo $?
Deliverables

All new files + minimal changes to package.json

CLI works end-to-end for --diff-file

Exit code policy implemented

Notes / Non-goals

No git diff sources in this task

No AST rules in this task

No Midway refactor in this task

No RAG in this task