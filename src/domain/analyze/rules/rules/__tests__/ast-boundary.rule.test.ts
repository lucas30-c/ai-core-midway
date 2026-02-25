import * as path from 'path';
import { AstBoundaryRule } from '../ast-boundary.rule';
import { AnalyzeContext } from '../../rule.types';
import { DEFAULT_CONFIG } from '../../../config/default.config';
import { AiDebtConfig } from '../../../config/config.types';

describe('AstBoundaryRule', () => {
  const fixturesDir = path.resolve(__dirname, '../../../../../../fixtures/ast');
  const rule = new AstBoundaryRule();

  function makeContext(
    changedFiles: string[],
    cwd: string = fixturesDir,
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

  it('has correct id', () => {
    expect(rule.id).toBe('ast-boundary');
  });

  it('detects pages -> domain violation', () => {
    const ctx = makeContext(['src/pages/home.ts']);
    const findings = rule.run(ctx);

    expect(findings.length).toBeGreaterThan(0);
    const violation = findings.find(f => f.ruleId === 'ast-boundary');
    expect(violation).toBeDefined();
    expect(violation?.message).toContain('pages -> domain');
    expect(violation?.severity).toBe('HIGH');
  });

  it('detects domain -> infra violation', () => {
    const ctx = makeContext(['src/domain/user.ts']);
    const findings = rule.run(ctx);

    expect(findings.length).toBeGreaterThan(0);
    const violation = findings.find(f => f.ruleId === 'ast-boundary');
    expect(violation).toBeDefined();
    expect(violation?.message).toContain('domain -> infra');
  });

  it('allows modules -> domain (no violation)', () => {
    const ctx = makeContext(['src/modules/api.ts']);
    const findings = rule.run(ctx);

    const violations = findings.filter(f => f.ruleId === 'ast-boundary');
    expect(violations).toHaveLength(0);
  });

  it('ignores non-relative imports', () => {
    // infra/db.ts has no relative imports, just exports
    const ctx = makeContext(['src/infra/db.ts']);
    const findings = rule.run(ctx);

    const violations = findings.filter(f => f.ruleId === 'ast-boundary');
    expect(violations).toHaveLength(0);
  });

  it('skips non-existent files', () => {
    const ctx = makeContext(['src/nonexistent.ts']);
    const findings = rule.run(ctx);

    expect(findings).toHaveLength(0);
  });

  it('skips non-ts files', () => {
    const ctx = makeContext(['src/readme.md', 'package.json']);
    const findings = rule.run(ctx);

    expect(findings).toHaveLength(0);
  });

  it('emits runtime-tsconfig finding when tsconfig missing', () => {
    const ctx = makeContext(['src/pages/home.ts'], '/nonexistent/path');
    const findings = rule.run(ctx);

    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('ast-boundary:runtime-tsconfig');
    expect(findings[0].id).toBe('F_AST_RUNTIME_tsconfig');
    expect(findings[0].severity).toBe('LOW'); // default runtime severity
  });

  it('finding IDs are deterministic (no timestamp)', () => {
    const ctx = makeContext(['src/pages/home.ts']);
    const findings1 = rule.run(ctx);
    const findings2 = rule.run(ctx);

    const ids1 = findings1.map(f => f.id).sort();
    const ids2 = findings2.map(f => f.id).sort();
    expect(ids1).toEqual(ids2);
  });

  it('respects custom severity config', () => {
    const customConfig: AiDebtConfig = {
      ...DEFAULT_CONFIG,
      severity: { boundary: 'MEDIUM', runtime: 'HIGH' },
    };
    const ctx = makeContext(['src/pages/home.ts'], fixturesDir, customConfig);
    const findings = rule.run(ctx);

    const violation = findings.find(f => f.ruleId === 'ast-boundary');
    expect(violation?.severity).toBe('MEDIUM');
  });

  it('includes rule message in evidence when provided', () => {
    const customConfig: AiDebtConfig = {
      ...DEFAULT_CONFIG,
      rules: [
        {
          from: 'pages',
          disallow: ['domain', 'infra'],
          message: 'Pages should use modules layer',
        },
        { from: 'modules', disallow: ['infra'] },
        { from: 'domain', disallow: ['infra'] },
      ],
    };
    const ctx = makeContext(['src/pages/home.ts'], fixturesDir, customConfig);
    const findings = rule.run(ctx);

    const violation = findings.find(f => f.ruleId === 'ast-boundary');
    expect(violation?.evidence).toBe('Pages should use modules layer');
  });

  it('returns empty array when no ts files in changedFiles', () => {
    const ctx = makeContext([]);
    const findings = rule.run(ctx);
    expect(findings).toHaveLength(0);
  });
});
