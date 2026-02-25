export interface TouchedArea {
  layer: string;
  files: string[];
  changeType: 'added' | 'modified' | 'deleted';
}

export interface RiskPoint {
  type: string;
  description: string;
  evidenceLines: number[];
}

export interface ImpactAnalysis {
  summary: string;
  touchedAreas: TouchedArea[];
  riskPoints: RiskPoint[];
  regressionChecklist: string[];
  suggestedReviewers?: string[];
}
