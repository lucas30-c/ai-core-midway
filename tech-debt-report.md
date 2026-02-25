# Code Risk Report

**Risk Level**: HIGH

- Files Changed: 63
- Insertions: 2494
- Deletions: 151
- Findings: 15
- Generated At: 2026-02-25T07:52:50.461Z

## Findings
| Severity | Rule | File | Line | Message |
|---|---|---|---|---|
| HIGH | tsc:6059 | __tsc__ |  | File '/Users/wuzhenguo/Desktop/吴镇国/code/ai/ai-core-midway/fixtures/ast/src/modules/api.ts' is not under 'rootDir' '/Users/wuzhenguo/Desktop/吴镇国/code/ai/ai-core-midway/src'. 'rootDir' is expected to contain all source files.   The file is in the program because:     Root file specified for compilation |
| HIGH | tsc:6059 | __tsc__ |  | File '/Users/wuzhenguo/Desktop/吴镇国/code/ai/ai-core-midway/fixtures/ast/src/pages/home.ts' is not under 'rootDir' '/Users/wuzhenguo/Desktop/吴镇国/code/ai/ai-core-midway/src'. 'rootDir' is expected to contain all source files.   The file is in the program because:     Root file specified for compilation |
| HIGH | tsc:6059 | fixtures/ast/src/domain/user.ts | 1 | File '/Users/wuzhenguo/Desktop/吴镇国/code/ai/ai-core-midway/fixtures/ast/src/infra/db.ts' is not under 'rootDir' '/Users/wuzhenguo/Desktop/吴镇国/code/ai/ai-core-midway/src'. 'rootDir' is expected to contain all source files.   The file is in the program because:     Imported via '../infra/db' from file '/Users/wuzhenguo/Desktop/吴镇国/code/ai/ai-core-midway/fixtures/ast/src/domain/user.ts'     Root file specified for compilation |
| HIGH | tsc:6059 | fixtures/ast/src/modules/api.ts | 1 | File '/Users/wuzhenguo/Desktop/吴镇国/code/ai/ai-core-midway/fixtures/ast/src/domain/user.ts' is not under 'rootDir' '/Users/wuzhenguo/Desktop/吴镇国/code/ai/ai-core-midway/src'. 'rootDir' is expected to contain all source files.   The file is in the program because:     Root file specified for compilation     Imported via '../domain/user' from file '/Users/wuzhenguo/Desktop/吴镇国/code/ai/ai-core-midway/fixtures/ast/src/modules/api.ts'     Imported via '../domain/user' from file '/Users/wuzhenguo/Desktop/吴镇国/code/ai/ai-core-midway/fixtures/ast/src/pages/home.ts' |
| MEDIUM | large-diff | __summary__ |  | Diff size (2645 lines) exceeds threshold (500) |
| MEDIUM | any-type | src/cli/adapters/diff-sources/__tests__/git.exec.test.ts | 26 | Explicit `any` type detected |
| MEDIUM | any-type | src/cli/adapters/diff-sources/__tests__/git.exec.test.ts | 47 | Explicit `any` type detected |
| MEDIUM | any-type | src/cli/adapters/diff-sources/__tests__/git.exec.test.ts | 63 | Explicit `any` type detected |
| MEDIUM | any-type | src/cli/adapters/diff-sources/__tests__/git.exec.test.ts | 80 | Explicit `any` type detected |
| MEDIUM | any-type | src/cli/adapters/diff-sources/git-commit.source.ts | 13 | Explicit `any` type detected |
| MEDIUM | any-type | src/cli/adapters/diff-sources/git-range.source.ts | 24 | Explicit `any` type detected |
| MEDIUM | any-type | src/cli/adapters/diff-sources/git-staged.source.ts | 7 | Explicit `any` type detected |
| MEDIUM | eslint:@typescript-eslint/no-unused-vars | fixtures/ast/src/infra/db.ts | 1 | '_table' is defined but never used. |
| MEDIUM | eslint:node/no-unpublished-import | src/domain/analyze/tools/tsc/tsc.adapter.ts | 1 | "typescript" is not published. |
| MEDIUM | eslint:node/no-unpublished-import | src/domain/analyze/tools/tsc/tsc.runner.ts | 1 | "typescript" is not published. |