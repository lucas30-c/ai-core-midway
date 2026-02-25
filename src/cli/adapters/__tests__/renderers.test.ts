import { renderReport } from '../renderers';
import { ReportModel } from '../../../domain/analyze/report/report.model';

const mockReport: ReportModel = {
  schemaVersion: '1.0',
  generatedAt: '2026-02-25T12:00:00.000Z',
  summary: {
    risk: 'LOW',
    filesChanged: 2,
    insertions: 10,
    deletions: 5,
    findingsCount: 1,
  },
  items: [
    {
      ruleId: 'test-rule',
      severity: 'LOW',
      file: 'test.ts',
      message: 'Test finding',
    },
  ],
};

describe('renderReport', () => {
  describe('JSON format', () => {
    it('wraps report with schemaVersion', () => {
      const result = renderReport(mockReport, 'json');
      const parsed = JSON.parse(result);
      expect(parsed.schemaVersion).toBe('1.0.0');
    });

    it('includes engine metadata', () => {
      const result = renderReport(mockReport, 'json');
      const parsed = JSON.parse(result);
      expect(parsed.engine.name).toBe('@luyu/tech-debt');
      expect(typeof parsed.engine.version).toBe('string');
      expect(parsed.engine.version).toMatch(/^\d+\.\d+\.\d+/);
    });

    it('includes analysis with full report', () => {
      const result = renderReport(mockReport, 'json');
      const parsed = JSON.parse(result);
      expect(parsed.analysis).toEqual(mockReport);
    });

    it('does NOT have root-level generatedAt', () => {
      const result = renderReport(mockReport, 'json');
      const parsed = JSON.parse(result);
      expect(parsed).not.toHaveProperty('generatedAt');
      // generatedAt should only be inside analysis
      expect(parsed.analysis.generatedAt).toBe('2026-02-25T12:00:00.000Z');
    });
  });

  describe('Markdown format', () => {
    it('returns markdown string', () => {
      const result = renderReport(mockReport, 'markdown');
      expect(result).toContain('# Code Risk Report');
      expect(result).toContain('**Risk Level**: LOW');
    });

    it('does not include JSON wrapper', () => {
      const result = renderReport(mockReport, 'markdown');
      expect(result).not.toContain('schemaVersion');
      expect(result).not.toContain('"engine"');
    });
  });
});
