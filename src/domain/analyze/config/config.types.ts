export interface LayerConfig {
  name: string;
  match: string[]; // glob patterns (POSIX style)
}

export interface BoundaryRuleConfig {
  from: string;
  disallow: string[];
  message?: string;
}

export interface SeverityConfig {
  boundary: 'HIGH' | 'MEDIUM' | 'LOW';
  runtime: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface AiDebtConfig {
  schemaVersion: string;
  layers: LayerConfig[];
  rules: BoundaryRuleConfig[];
  severity: SeverityConfig;
}
