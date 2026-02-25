Spec: GitHub Actions CI Integration (ai-debt CLI) + Default Gating Policy
Goal

Add a GitHub Actions workflow that runs ai-debt analyze on every Pull Request to main, uploads the markdown report as an artifact, and enforces CI gating via exit code.

Also adjust the CLI default gating policy decision:

Choose a sensible default for --fail-on (recommendation below).

Ensure workflow uses an explicit --fail-on value (so future defaults won’t silently change CI behavior).

Non-goals (for this spec)

Do NOT publish to npm yet.

Do NOT rename package to tech-debt yet (rename will be Step B).

Do NOT add AST v2 features here.

Current State

CLI supports:

--git-range base..head

--format markdown|json

--out <path>

--fail-on error|warning

--cwd

--config

Exit codes:

0 success

1 threshold exceeded

2 runtime/usage error

JSON wrapper already exists (schemaVersion, engine.version, analysis).

Decision: default --fail-on
Recommendation

Default --fail-on should remain error for local developer ergonomics (less noisy).
CI workflow should use --fail-on warning to make it actually “gating” and valuable.

Required Behavior

CLI default stays as currently implemented unless it’s inconsistent.

Workflow always passes --fail-on warning explicitly.

Implementation Plan
Step 1: Create GitHub Actions workflow

Create file:

.github/workflows/tech-debt.yml (or .github/workflows/ai-debt.yml — pick one; recommended: tech-debt.yml to align with future rename, but workflow content still runs current CLI path)

Workflow requirements:

Trigger: pull_request targeting main

Must fetch full git history (fetch-depth: 0)

Must compute base/head properly for PR:

Base ref: origin/${{ github.base_ref }}

Head SHA: ${{ github.sha }}

Must run:

npm ci

npm run build

node dist/cli/index.js analyze --git-range "$BASE..$HEAD" --fail-on warning --format markdown --out tech-debt-report.md

Must upload artifact:

name: tech-debt-report

path: tech-debt-report.md

Job should fail automatically if the CLI exits with 1 or 2 (default shell behavior is fine; don’t swallow exit code).

Workflow template:

name: tech-debt

on:
  pull_request:
    branches: [ main ]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 18

      - run: npm ci
      - run: npm run build

      - name: Run tech-debt (ai-debt CLI)
        run: |
          BASE="origin/${{ github.base_ref }}"
          HEAD="${{ github.sha }}"
          echo "Analyzing range: $BASE..$HEAD"

          # Ensure base exists locally
          git fetch origin "${{ github.base_ref }}"

          node dist/cli/index.js analyze \
            --git-range "$BASE..$HEAD" \
            --fail-on warning \
            --format markdown \
            --out tech-debt-report.md

      - uses: actions/upload-artifact@v4
        with:
          name: tech-debt-report
          path: tech-debt-report.md

Notes:

Keep the command explicit with --fail-on warning.

Keep output name tech-debt-report.md to match product name (even before npm rename).

Step 2: Add lightweight documentation (CI usage note)

Create or update README.md (if exists; otherwise create minimal one) with a short section:

“GitHub Actions CI integration”

How it works on PR

Where to download artifact

How to change threshold (--fail-on error|warning)

Reminder about --cwd if tsconfig is not at repo root

Do NOT add npm publish instructions in this step.

Step 3: Optional: Add a tiny smoke script (local CI simulation)

Add package.json script (optional but recommended):

"ci:tech-debt": "node dist/cli/index.js analyze --git-range origin/main..HEAD --fail-on warning --out tech-debt-report.md"

This helps you replicate CI locally quickly.

Verification Checklist

Qoder must run and report results:

Build:

npm run build

Local simulation (if you have origin/main):

git fetch origin main
node dist/cli/index.js analyze --git-range origin/main..HEAD --fail-on warning --out tech-debt-report.md
echo $?
ls -lh tech-debt-report.md

Workflow syntax sanity:

YAML file exists at .github/workflows/*.yml

No indentation errors

PR validation:

Open a PR to main

Confirm workflow runs

Confirm artifact tech-debt-report exists and contains the report markdown

Deliverables

✅ .github/workflows/tech-debt.yml (or ai-debt.yml, but prefer tech-debt.yml)

✅ README.md updated with CI section

✅ (optional) package.json script: ci:tech-debt

Qoder Output Requirements

After implementation, Qoder must provide:

List of changed files

Copy/paste of workflow file content

Local verification output (commands + exit codes)

Any caveats found (e.g., needs fetch-depth: 0)