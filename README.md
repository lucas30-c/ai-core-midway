# my_midway_project

## QuickStart

<!-- add docs here for user -->

see [midway docs][midway] for more detail.

### Development

```bash
$ npm i
$ npm run dev
$ open http://localhost:7001/
```

### Deploy

```bash
$ npm start
```

### npm scripts

- Use `npm run lint` to check code style.
- Use `npm test` to run unit test.

## GitHub Actions CI Integration

This project includes automated technical debt analysis on every Pull Request.

> **Note:** Workflow name is `tech-debt` (for future product rename). The CLI command remains `ai-debt`.

### How It Works

1. On PR to `main`, the `tech-debt` workflow runs automatically
2. Analyzes code changes between PR base and head
3. Generates a markdown report with findings
4. Fails the check if any HIGH or MEDIUM severity issues found (`--fail-on warning`)

### CI Environment

- **Node version:** 18 (CI standard, local dev may use 20)
- **Build:** `npm ci && npm run build`

### Downloading the Report

After the workflow runs, download the report:
1. Go to the PR's "Checks" tab
2. Click "tech-debt" workflow
3. Download "tech-debt-report" artifact

### Customizing the Threshold

| Flag | Behavior |
|------|----------|
| `--fail-on error` | Only fail on HIGH severity (default for local) |
| `--fail-on warning` | Fail on HIGH or MEDIUM (CI default) |

### Notes

- If `tsconfig.json` is not at repo root, add `--cwd <path>` to the workflow
- Runtime errors (exit 2) also fail the workflow
- Manual analysis available via `AI Debt Analysis (Manual)` workflow (workflow_dispatch)


[midway]: https://midwayjs.org
