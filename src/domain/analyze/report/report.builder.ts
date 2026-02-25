import { Finding } from '../rules/rule.types';
import { ImpactAnalysis } from '../impact/impact.types';
import { ReportModel } from './report.model';
import { RetrievedKnowledgeChunk } from '../../knowledge/kb.types';
import { LlmDraft } from '../impact/impact.enricher';

export function buildReportModel(input: {
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
  stats: {
    filesChanged: number;
    insertions: number;
    deletions: number;
  };
  findings: Finding[];
  impact?: ImpactAnalysis;
  retrievedKnowledge?: {
    provider: string;
    chunks: RetrievedKnowledgeChunk[];
  };
  llmDraft?: LlmDraft | null;
}): ReportModel {
  const report: ReportModel = {
    schemaVersion: '2.0.0',
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
    impact: input.impact,
  };

  if (input.retrievedKnowledge) {
    report.retrievedKnowledge = input.retrievedKnowledge;
  }

  if (input.llmDraft) {
    report.llmDraft = input.llmDraft;
  }

  return report;
}
