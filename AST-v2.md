📄 SPEC: AST Module Boundary Rules v2 (Alias + Monorepo Support)
Title

AST Module Boundary Rules v2 — Path Alias & Monorepo Support

Goal

Upgrade the existing ast-boundary rule to support:

TypeScript baseUrl

compilerOptions.paths alias resolution

Non-relative imports (e.g. @/domain/user)

Monorepo projects with multiple tsconfig.json

Preserve diff-based analysis (no full repo scan)

Maintain runtime safety (never crash CLI)

Non-Goals

No dependency graph visualization

No cross-package dependency policy enforcement (yet)

No auto-fix

No dynamic import() resolution

No JS support

No performance regression

Current Architecture

Rule: AstBoundaryRule

Uses: ts-morph.Project

Only resolves:

relative imports (./, ../)

Single tsconfig resolution

Single project per run

🧱 Required Enhancements
1️⃣ Import Resolution Strategy Upgrade
Replace manual path resolution with:

Use ts-morph resolution API:

const sourceFile = project.getSourceFile(filePath);
const importDecls = sourceFile.getImportDeclarations();

for (const decl of importDecls) {
  const resolved = decl.getModuleSpecifierSourceFile();
}

If resolved file exists:

Use resolved.getFilePath()

Determine layer from resolved absolute path

This automatically supports:

baseUrl

paths alias

node resolution

tsconfig config

2️⃣ Support Non-Relative Imports

Previously filtered:

if (!specifier.startsWith('./') && !specifier.startsWith('../')) skip

Remove this restriction.

New rule:

If getModuleSpecifierSourceFile() resolves successfully → evaluate boundary.

If unresolved:

ignore silently

do NOT emit runtime error

3️⃣ Monorepo Support
Strategy:

For each changed file:

Traverse upward from file path

Find nearest tsconfig.json

Group files by tsconfig root

Create ONE ts-morph Project per unique tsconfig

Reuse project for all files under same config

Pseudo:

const tsconfigMap = new Map<string, Project>();

function getProjectForFile(filePath) {
  const tsconfigPath = findNearestTsconfig(filePath);
  if (!tsconfigMap.has(tsconfigPath)) {
    tsconfigMap.set(tsconfigPath, new Project({ tsConfigFilePath: tsconfigPath }));
  }
  return tsconfigMap.get(tsconfigPath);
}

Constraint:

Still only analyze changed files

Do NOT add entire repo

4️⃣ Layer Matching Must Use Absolute Paths

Change layer matching strategy:

Previously:

matched using relative path in diff

Now:

Always match using absolute normalized path

Convert to POSIX style before minimatch

const normalized = filePath.replace(/\\/g, '/');

Layer glob match must remain configurable.

5️⃣ Performance Constraints

Max one Project per tsconfig

No project.addSourceFilesAtPaths('**/*')

Only add changed files explicitly

No full graph traversal

6️⃣ Runtime Safety Rules

Any of the following must NOT crash:

Missing tsconfig

Invalid tsconfig

Path resolution failure

ts-morph parsing error

On failure:
Emit:

ruleId: ast-boundary:runtime
severity: LOW
file: summary

Never affect exit code.

📁 Files To Modify
Action	File
MODIFY	src/domain/analyze/rules/rules/ast-boundary.rule.ts
MODIFY	rule.types.ts (if context changes)
ADD	find-tsconfig.util.ts
ADD	normalize-path.util.ts
ADD	ast-boundary.v2.test.ts
🧪 New Test Cases Required
Case 1: Alias import

tsconfig:

{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}

Code:

import { getUser } from '@/domain/user';

Should resolve to:
src/domain/user.ts

Boundary must detect violation.

Case 2: Monorepo

Structure:

packages/
  app/
    tsconfig.json
  core/
    tsconfig.json

Each package analyzed independently.

Case 3: Unresolved import
import foo from 'unknown-lib';

Should be ignored silently.

Case 4: baseUrl only
{
  "compilerOptions": {
    "baseUrl": "src"
  }
}

Import:

import { getUser } from 'domain/user';

Must resolve correctly.

🧠 Exit Code Behavior

No changes.

Boundary violations:
→ respect severity.boundary

Runtime findings:
→ ignored for exit policy

📦 Deliverables

Updated ast-boundary.rule.ts

Monorepo-aware project creation

Alias resolution working

All tests passing

No regression in existing tests

Performance not degraded

🧪 Verification Checklist

After implementation:

npm run build
npm test
npm run lint

Manual smoke:

npx @finn_ryu/tech-debt analyze --git HEAD

Alias test project:
Should detect boundary violation using @/alias.

🚀 Expected Outcome

After AST v2:

tech-debt becomes:

Enterprise-ready

Monorepo-compatible

Alias-aware

Architecturally enforceable

Comparable to Nx boundary enforcement

Strong CV-level project