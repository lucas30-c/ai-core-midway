import { Finding } from '../rules/rule.types';
import { ReportModel } from './report.model';

export function buildReportModel(input: {
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
  stats: {
    filesChanged: number;
    insertions: number;
    deletions: number;
  };
  findings: Finding[];
}): ReportModel {
  return {
    schemaVersion: '1.0',
    generatedAt: new Date().toISOString(),
    summary: {
      risk: input.risk,
      filesChanged: input.stats.filesChanged,
      insertions: input.stats.insertions,
      deletions: input.stats.deletions,
      findingsCount: input.findings.length,
    },
    items: input.findings.map(f => ({
      ruleId: f.ruleId,
      severity: f.severity,
      file: f.file,
      line: f.range?.start,
      message: f.message,
    })),
  };
}