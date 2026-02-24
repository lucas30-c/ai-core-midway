export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface ReportItem {
  ruleId: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  file: string;
  line?: number;
  message: string;
}

export interface ReportModel {
  schemaVersion: '1.0';
  generatedAt: string;
  summary: {
    risk: RiskLevel;
    filesChanged: number;
    insertions: number;
    deletions: number;
    findingsCount: number;
  };
  items: ReportItem[];
}