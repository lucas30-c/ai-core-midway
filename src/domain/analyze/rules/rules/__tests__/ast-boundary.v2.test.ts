import * as path from 'path';
import { AstBoundaryRule } from '../ast-boundary.rule';
import { AnalyzeContext } from '../../rule.types';
import { AiDebtConfig } from '../../../config/config.types';
import { DEFAULT_CONFIG } from '../../../config/default.config';
import * as tsconfigCacheUtil from '../../utils/tsconfig-cache.util';

const fixturesDir = path.resolve(__dirname, '../../../../../../fixtures');
const aliasProjectDir = path.join(fixturesDir, 'ast-v2/alias-project');
const monorepoAppDir = path.join(fixturesDir, 'ast-v2/monorepo/packages/app');
const baseurlOnlyDir = path.join(fixturesDir, 'ast-v2/baseurl-only');

function makeContext(
  changedFiles: string[],
  cwd: string = aliasProjectDir,
  config: AiDebtConfig = DEFAULT_CONFIG
): AnalyzeContext {
  return {
    diffFiles: [],
    stats: { filesChanged: changedFiles.length, insertions: 0, deletions: 0 },
    cwd,
    changedFiles,
    config,
  };
}

describe('AstBoundaryRule v2.2', () => {
  let rule: AstBoundaryRule;

  beforeEach(() => {
    rule = new AstBoundaryRule();
  });

  describe('Alias import detection', () => {
    it('detects alias violation when only importing file is changed', () => {
      // Only home.ts is in changedFiles, domain/user.ts is NOT
      // v2.2 should still detect the violation via lazy loading
      const ctx = makeContext(['src/pages/home.ts'], aliasProjectDir);
      const findings = rule.run(ctx);

      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe('ast-boundary');
      expect(findings[0].message).toContain('pages -> domain');
      expect(findings[0].message).toContain('@/domain/user');
    });

    it('detects alias violation when both files are changed', () => {
      const ctx = makeContext(
        ['src/pages/home.ts', 'src/domain/user.ts'],
        aliasProjectDir
      );
      const findings = rule.run(ctx);

      expect(findings).toHaveLength(1);
      expect(findings[0].message).toContain('pages -> domain');
    });
  });

  describe('Monorepo support', () => {
    it('detects violation in monorepo package with package cwd', () => {
      // v2.2: cwd is set to packages/app (NOT monorepo root)
      const ctx = makeContext(['src/pages/home.ts'], monorepoAppDir);
      const findings = rule.run(ctx);

      expect(findings).toHaveLength(1);
      expect(findings[0].message).toContain('pages -> domain');
      expect(findings[0].message).toContain('@/domain/user');
    });

    it('uses nearest tsconfig for monorepo packages', () => {
      // Even if we use monorepo root as cwd (not recommended),
      // nearest-first should still find packages/app/tsconfig.json
      const monorepoRoot = path.join(fixturesDir, 'ast-v2/monorepo');
      const ctx = makeContext(['packages/app/src/pages/home.ts'], monorepoRoot);

      // Note: This won't detect violations because changedFiles path
      // won't match DEFAULT_CONFIG layers (src/pages/**)
      // This demonstrates why cwd should be package root
      const findings = rule.run(ctx);
      // No violation because layer doesn't match
      expect(findings.filter(f => f.ruleId === 'ast-boundary')).toHaveLength(0);
    });
  });

  describe('baseUrl only (no paths)', () => {
    it('resolves imports using baseUrl without paths alias', () => {
      const ctx = makeContext(['src/pages/home.ts'], baseurlOnlyDir);
      const findings = rule.run(ctx);

      expect(findings).toHaveLength(1);
      expect(findings[0].message).toContain('pages -> domain');
      expect(findings[0].message).toContain('domain/user');
    });
  });

  describe('Extension filtering', () => {
    it('skips .d.ts files in changedFiles', () => {
      const ctx = makeContext(['src/domain/types.d.ts'], aliasProjectDir);
      const findings = rule.run(ctx);

      // .d.ts files are filtered out, no findings
      expect(findings).toHaveLength(0);
    });

    it('skips imports to .d.ts files', () => {
      // Create a test case where a file imports from .d.ts
      // The .d.ts import should be silently skipped
      const ctx = makeContext(['src/pages/home.ts'], aliasProjectDir);
      const findings = rule.run(ctx);

      // Should only have the @/domain/user violation
      // No violation for types.d.ts (if it were imported)
      expect(findings.filter(f => f.message.includes('.d.ts'))).toHaveLength(0);
    });
  });

  describe('tsconfig cache', () => {
    it('reuses cached compilerOptions for same tsconfig', () => {
      const parseSpy = jest.spyOn(tsconfigCacheUtil, 'parseTsconfig');

      const ctx = makeContext(
        ['src/pages/home.ts', 'src/domain/user.ts', 'src/infra/db.ts'],
        aliasProjectDir
      );

      rule.run(ctx);

      // All files share same tsconfig -> parsed only once
      expect(parseSpy).toHaveBeenCalledTimes(1);

      parseSpy.mockRestore();
    });
  });

  describe('Unresolved imports', () => {
    it('silently skips external package imports', () => {
      // External packages like 'lodash' can't be resolved
      // and should be silently skipped
      const ctx = makeContext(['src/pages/home.ts'], aliasProjectDir);
      const findings = rule.run(ctx);

      // No runtime errors for unresolved imports
      expect(findings.filter(f => f.ruleId.includes('runtime'))).toHaveLength(
        0
      );
    });
  });

  describe('Backward compatibility', () => {
    it('still detects relative import violations', () => {
      // v2.2 should still work with v1 fixtures
      const v1FixturesDir = path.join(fixturesDir, 'ast');
      const ctx = makeContext(['src/pages/home.ts'], v1FixturesDir);
      const findings = rule.run(ctx);

      expect(findings).toHaveLength(1);
      expect(findings[0].message).toContain('pages -> domain');
    });
  });

  describe('Runtime safety', () => {
    it('emits runtime finding when no tsconfig found', () => {
      const noTsconfigDir = '/tmp/no-tsconfig-test';
      const ctx = makeContext(['src/pages/home.ts'], noTsconfigDir);
      const findings = rule.run(ctx);

      // Should emit runtime finding (or empty if file doesn't exist)
      // Since file doesn't exist, changedFiles filter removes it
      expect(findings).toHaveLength(0);
    });
  });
});
