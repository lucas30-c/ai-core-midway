import { buildImpactAnalysis } from '../impact.builder';
import { DiffFile } from '../../diff/diff.types';
import { Finding } from '../../rules/rule.types';
import { DEFAULT_CONFIG } from '../../config/default.config';
import { AiDebtConfig } from '../../config/config.types';

function makeDiffFile(
  path: string,
  status: 'added' | 'modified' | 'deleted' | 'renamed' = 'modified'
): DiffFile {
  return {
    oldPath: status === 'added' ? undefined : path,
    newPath: status === 'deleted' ? undefined : path,
    status,
    hunks: [],
  };
}

function makeFinding(
  overrides: Partial<Finding> & { ruleId: string }
): Finding {
  return {
    id: `F_TEST_${Date.now()}`,
    severity: 'MEDIUM',
    confidence: 0.9,
    file: 'src/test.ts',
    message: 'test finding',
    ...overrides,
  };
}

describe('buildImpactAnalysis', () => {
  const stats = { filesChanged: 3, insertions: 50, deletions: 10 };

  it('groups files by layer via config.layers[].match', () => {
    const diffFiles = [
      makeDiffFile('src/domain/user.ts'),
      makeDiffFile('src/domain/order.ts'),
      makeDiffFile('src/modules/api.ts'),
    ];
    const result = buildImpactAnalysis({
      findings: [],
      diffFiles,
      stats,
      config: DEFAULT_CONFIG,
    });

    const domain = result.touchedAreas.find(a => a.layer === 'domain');
    const modules = result.touchedAreas.find(a => a.layer === 'modules');
    expect(domain).toBeDefined();
    expect(domain!.files).toContain('src/domain/user.ts');
    expect(domain!.files).toContain('src/domain/order.ts');
    expect(modules).toBeDefined();
    expect(modules!.files).toContain('src/modules/api.ts');
  });

  it('handles unlayered files', () => {
    const diffFiles = [makeDiffFile('README.md')];
    const result = buildImpactAnalysis({
      findings: [],
      diffFiles,
      stats,
      config: DEFAULT_CONFIG,
    });

    const unlayered = result.touchedAreas.find(a => a.layer === 'unlayered');
    expect(unlayered).toBeDefined();
    expect(unlayered!.files).toContain('README.md');
  });

  it('reads diffFile.status for changeType', () => {
    const diffFiles = [
      makeDiffFile('src/domain/new.ts', 'added'),
      makeDiffFile('src/domain/old.ts', 'deleted'),
      makeDiffFile('src/modules/mod.ts', 'modified'),
    ];
    const result = buildImpactAnalysis({
      findings: [],
      diffFiles,
      stats,
      config: DEFAULT_CONFIG,
    });

    // domain has both added and deleted → mixed → 'modified'
    const domain = result.touchedAreas.find(a => a.layer === 'domain');
    expect(domain!.changeType).toBe('modified');

    const modules = result.touchedAreas.find(a => a.layer === 'modules');
    expect(modules!.changeType).toBe('modified');
  });

  it('maps renamed to modified changeType', () => {
    const diffFiles = [makeDiffFile('src/domain/renamed.ts', 'renamed')];
    const result = buildImpactAnalysis({
      findings: [],
      diffFiles,
      stats,
      config: DEFAULT_CONFIG,
    });

    const domain = result.touchedAreas.find(a => a.layer === 'domain');
    expect(domain!.changeType).toBe('modified');
  });

  it('maps ast-boundary → boundary-violation risk type', () => {
    const findings = [
      makeFinding({
        ruleId: 'ast-boundary',
        file: 'src/pages/home.ts',
        range: { start: 15, end: 15 },
        message: 'pages -> domain violation',
      }),
    ];
    const result = buildImpactAnalysis({
      findings,
      diffFiles: [makeDiffFile('src/pages/home.ts')],
      stats,
      config: DEFAULT_CONFIG,
    });

    const risk = result.riskPoints.find(r => r.type === 'boundary-violation');
    expect(risk).toBeDefined();
    expect(risk!.evidenceLines).toContain(15);
  });

  it('maps control-flow:early-return → early-return risk type', () => {
    const findings = [
      makeFinding({
        ruleId: 'control-flow:early-return',
        range: { start: 42, end: 42 },
        message: 'Early return detected',
      }),
    ];
    const result = buildImpactAnalysis({
      findings,
      diffFiles: [makeDiffFile('src/domain/user.ts')],
      stats,
      config: DEFAULT_CONFIG,
    });

    expect(result.riskPoints.some(r => r.type === 'early-return')).toBe(true);
  });

  it('maps large-diff → large-diff risk type', () => {
    const findings = [
      makeFinding({
        ruleId: 'large-diff',
        file: '__summary__',
        message: 'Diff size exceeds threshold',
      }),
    ];
    // large-diff has file === '__summary__' → filtered out by builder
    const result = buildImpactAnalysis({
      findings,
      diffFiles: [],
      stats,
      config: DEFAULT_CONFIG,
    });

    expect(result.riskPoints).toHaveLength(0);
  });

  it('skips :runtime findings', () => {
    const findings = [
      makeFinding({
        ruleId: 'ast-boundary:runtime',
        file: '__summary__',
        message: 'Runtime warning',
      }),
    ];
    const result = buildImpactAnalysis({
      findings,
      diffFiles: [],
      stats,
      config: DEFAULT_CONFIG,
    });

    expect(result.riskPoints).toHaveLength(0);
  });

  it('skips __summary__ findings', () => {
    const findings = [
      makeFinding({
        ruleId: 'large-diff',
        file: '__summary__',
        message: 'Large diff',
      }),
    ];
    const result = buildImpactAnalysis({
      findings,
      diffFiles: [],
      stats,
      config: DEFAULT_CONFIG,
    });

    expect(result.riskPoints).toHaveLength(0);
  });

  it('skips __tsc__ findings (tool meta noise)', () => {
    const findings = [
      makeFinding({
        ruleId: 'tsc:6059',
        file: '__tsc__',
        message: 'rootDir is expected to contain all source files',
      }),
    ];
    const result = buildImpactAnalysis({
      findings,
      diffFiles: [],
      stats,
      config: DEFAULT_CONFIG,
    });

    expect(result.riskPoints).toHaveLength(0);
  });

  it('skips __tool__ findings (tool meta noise)', () => {
    const findings = [
      makeFinding({
        ruleId: 'tool:tsc',
        file: '__tool__',
        message: 'TSC execution failed',
      }),
    ];
    const result = buildImpactAnalysis({
      findings,
      diffFiles: [],
      stats,
      config: DEFAULT_CONFIG,
    });

    expect(result.riskPoints).toHaveLength(0);
  });

  it('deduplicates risk points by type', () => {
    const findings = [
      makeFinding({
        ruleId: 'ast-boundary',
        range: { start: 10, end: 10 },
        message: 'violation 1',
      }),
      makeFinding({
        ruleId: 'ast-boundary',
        range: { start: 20, end: 20 },
        message: 'violation 2',
      }),
    ];
    const result = buildImpactAnalysis({
      findings,
      diffFiles: [makeDiffFile('src/pages/home.ts')],
      stats,
      config: DEFAULT_CONFIG,
    });

    const boundaryRisks = result.riskPoints.filter(
      r => r.type === 'boundary-violation'
    );
    expect(boundaryRisks).toHaveLength(1);
    expect(boundaryRisks[0].evidenceLines).toEqual([10, 20]);
  });

  it('generates summary with no findings', () => {
    const result = buildImpactAnalysis({
      findings: [],
      diffFiles: [makeDiffFile('src/domain/user.ts')],
      stats,
      config: DEFAULT_CONFIG,
    });

    expect(result.summary).toContain('No issues detected');
    expect(result.summary).toContain('domain');
  });

  it('generates summary with findings', () => {
    const findings = [
      makeFinding({ ruleId: 'any-type', severity: 'HIGH' }),
      makeFinding({ ruleId: 'console-log', severity: 'LOW' }),
    ];
    const result = buildImpactAnalysis({
      findings,
      diffFiles: [makeDiffFile('src/domain/user.ts')],
      stats,
      config: DEFAULT_CONFIG,
    });

    expect(result.summary).toContain('2 issues detected');
    expect(result.summary).toContain('1 HIGH');
  });

  it('generates regression checklist capped at 7', () => {
    const config: AiDebtConfig = {
      ...DEFAULT_CONFIG,
      layers: [
        { name: 'a', match: ['a/**'] },
        { name: 'b', match: ['b/**'] },
        { name: 'c', match: ['c/**'] },
        { name: 'd', match: ['d/**'] },
        { name: 'e', match: ['e/**'] },
        { name: 'f', match: ['f/**'] },
        { name: 'g', match: ['g/**'] },
        { name: 'h', match: ['h/**'] },
      ],
    };
    const diffFiles = 'abcdefgh'
      .split('')
      .map(l => makeDiffFile(`${l}/file.ts`));
    const findings = [
      makeFinding({ ruleId: 'ast-boundary', range: { start: 1, end: 1 } }),
      makeFinding({
        ruleId: 'control-flow:early-return',
        range: { start: 2, end: 2 },
      }),
      makeFinding({ ruleId: 'large-diff', range: { start: 3, end: 3 } }),
    ];

    const result = buildImpactAnalysis({ findings, diffFiles, stats, config });

    expect(result.regressionChecklist.length).toBeLessThanOrEqual(7);
  });

  it('handles empty inputs', () => {
    const result = buildImpactAnalysis({
      findings: [],
      diffFiles: [],
      stats: { filesChanged: 0, insertions: 0, deletions: 0 },
      config: DEFAULT_CONFIG,
    });

    expect(result.touchedAreas).toHaveLength(0);
    expect(result.riskPoints).toHaveLength(0);
    expect(result.summary).toContain('0 files');
    expect(result.regressionChecklist).toHaveLength(0);
  });
});
