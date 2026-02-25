import { ImpactAnalysis } from '../impact/impact.types';
import { RetrievedKnowledgeChunk } from '../../knowledge/kb.types';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface ReportItem {
  ruleId: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  file: string;
  line?: number;
  message: string;
}

export interface ReportModel {
  schemaVersion: '2.0.0';
  generatedAt: string;
  summary: {
    risk: RiskLevel;
    filesChanged: number;
    insertions: number;
    deletions: number;
    findingsCount: number;
  };
  items: ReportItem[];
  impact?: ImpactAnalysis;

  // Phase 2 additions (optional)
  retrievedKnowledge?: {
    provider: string;
    chunks: RetrievedKnowledgeChunk[];
  };

  llmDraft?: {
    model: string;
    summary: string;
    riskExplanations: Array<{ riskType: string; explanation: string }>;
    additionalChecklist: string[];
  };
}
