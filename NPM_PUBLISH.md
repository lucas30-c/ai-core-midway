Spec: Publish tech-debt@0.1.0 (Rename + NPM Release)
Goal

Rename npm package from current name to tech-debt

Rename global CLI binary from ai-debt to tech-debt

Prepare a clean, minimal publish artifact (dist + docs)

Add release scripts + prepublish checks

Publish tech-debt@0.1.0 to npm (manual step)

Non-goals

No new analyzer features

No AST v2

No RAG

No CI auto-publish yet (manual publish only)

Decisions

Package name: tech-debt

Binary name: tech-debt

Keep internal workflow file name tech-debt.yml as-is (already done).

Backward compat ai-debt command: not provided in v0.1.0 (too early; clean cut)

Required Changes
1) package.json (rename + bin + publish hygiene)

Modify fields:

name: "tech-debt"

version: "0.1.0"

bin: { "tech-debt": "dist/cli/index.js" }

Add "files" to avoid publishing source/test fixtures:

Include only dist/**, README.md, LICENSE

Add "repository", "homepage", "bugs" (optional but recommended for open-source)

Ensure main is not required, but ok if present.

Ensure type stays consistent with your build output (CommonJS is fine)

Scripts to add/update:

prepublishOnly: run build + test + lint

"prepublishOnly": "npm run build && npm test && npm run lint"

release:dry: local pack smoke test

"release:dry": "npm pack --dry-run"

release:pack: generate .tgz for local install testing

"release:pack": "npm pack"

Keep existing scripts like ci:tech-debt.

2) README.md (rename commands + install instructions)

Update all CLI usage examples:

from ai-debt ... → tech-debt ...
Add a quickstart:

npm i -g tech-debt
tech-debt analyze --git-range origin/main..HEAD --fail-on warning --out tech-debt-report.md

Add a “Local project usage (npx)” section:

npx tech-debt analyze --git HEAD
3) src/cli/index.ts (CLI name display)

Ensure commander program name matches new binary:

program.name('tech-debt')

description can remain, but ensure help shows tech-debt analyze ...

Hard constraint: keep require.main === module guard.

4) JSON wrapper engine.name

Currently JSON wrapper uses engine.name: 'ai-debt'. Change to:

engine.name: 'tech-debt'

Keep schemaVersion the same.

5) Add LICENSE (if missing)

Add a standard MIT LICENSE file (or your preferred license).
If you already have one, ensure included in publish files.

Publish Verification Checklist (Local)
A. Build & test
npm run build
npm test
npm run lint
B. Verify CLI in dist
node dist/cli/index.js --help
node dist/cli/index.js analyze --help

Expect help header shows tech-debt analyze.

C. Pack dry-run (confirm publish contents)
npm run release:dry

Confirm NOT including:

src/**

fixtures/**

.github/**

*.test.*
Confirm includes:

dist/**

README.md

LICENSE

package.json

D. Local install from packed tarball (golden smoke)
TGZ=$(npm run -s release:pack | tail -n 1)
mkdir -p /tmp/tech-debt-smoke && cd /tmp/tech-debt-smoke
npm init -y
npm i -g "/absolute/path/to/$TGZ"
tech-debt --help
tech-debt analyze --help
E. End-to-end analyze smoke

Run inside a git repo:

tech-debt analyze --git HEAD --format json | node -e "const r=require('fs').readFileSync(0,'utf8'); const j=JSON.parse(r); console.log(j.engine.name,j.engine.version,!!j.analysis)"

Expect:

engine.name = tech-debt

engine.version = 0.1.0

analysis exists

Publish Steps (Manual)

Login:

npm login
npm whoami

Publish:

npm publish

Verify:

npm view tech-debt version