import { resolveExitCode } from '../exit-code.policy';
import { ExitCode } from '../../contracts/cli.types';
import { ReportModel } from '../../../domain/analyze/report/report.model';

function makeReport(
  items: Array<{ severity: 'HIGH' | 'MEDIUM' | 'LOW' }>
): ReportModel {
  return {
    schemaVersion: '1.0',
    generatedAt: new Date().toISOString(),
    summary: {
      risk: 'LOW',
      filesChanged: 1,
      insertions: 10,
      deletions: 5,
      findingsCount: items.length,
    },
    items: items.map((item, i) => ({
      ruleId: `test-rule-${i}`,
      severity: item.severity,
      file: 'test.ts',
      message: `Finding ${i}`,
    })),
  };
}

describe('resolveExitCode', () => {
  it('returns SUCCESS for empty items', () => {
    const report = makeReport([]);
    expect(resolveExitCode(report, 'error')).toBe(ExitCode.SUCCESS);
  });

  it('returns SUCCESS for only LOW findings with failOn=error', () => {
    const report = makeReport([{ severity: 'LOW' }]);
    expect(resolveExitCode(report, 'error')).toBe(ExitCode.SUCCESS);
  });

  it('returns SUCCESS for only LOW findings with failOn=warning', () => {
    const report = makeReport([{ severity: 'LOW' }]);
    expect(resolveExitCode(report, 'warning')).toBe(ExitCode.SUCCESS);
  });

  it('returns THRESHOLD_EXCEEDED for HIGH finding with failOn=error', () => {
    const report = makeReport([{ severity: 'HIGH' }]);
    const code = resolveExitCode(report, 'error');
    expect(code).toBe(ExitCode.THRESHOLD_EXCEEDED);
  });

  it('returns THRESHOLD_EXCEEDED for HIGH finding with failOn=warning', () => {
    const report = makeReport([{ severity: 'HIGH' }]);
    const code = resolveExitCode(report, 'warning');
    expect(code).toBe(ExitCode.THRESHOLD_EXCEEDED);
  });

  it('returns SUCCESS for MEDIUM finding with failOn=error', () => {
    const report = makeReport([{ severity: 'MEDIUM' }]);
    expect(resolveExitCode(report, 'error')).toBe(ExitCode.SUCCESS);
  });

  it('returns THRESHOLD_EXCEEDED for MEDIUM finding with failOn=warning', () => {
    const report = makeReport([{ severity: 'MEDIUM' }]);
    const code = resolveExitCode(report, 'warning');
    expect(code).toBe(ExitCode.THRESHOLD_EXCEEDED);
  });

  it('returns THRESHOLD_EXCEEDED for mixed HIGH+MEDIUM with failOn=error', () => {
    const report = makeReport([{ severity: 'HIGH' }, { severity: 'MEDIUM' }]);
    const code = resolveExitCode(report, 'error');
    expect(code).toBe(ExitCode.THRESHOLD_EXCEEDED);
  });
});
