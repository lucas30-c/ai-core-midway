import { minimatch } from 'minimatch';
import { DiffFile } from '../diff/diff.types';
import { Finding } from '../rules/rule.types';
import { AiDebtConfig } from '../config/config.types';
import { ImpactAnalysis, RiskPoint, TouchedArea } from './impact.types';

const RULE_TO_RISK: Record<string, string> = {
  'ast-boundary': 'boundary-violation',
  'control-flow:early-return': 'early-return',
  'large-diff': 'large-diff',
};

const MAX_CHECKLIST = 7;

export function buildImpactAnalysis(input: {
  findings: Finding[];
  diffFiles: DiffFile[];
  stats: { filesChanged: number; insertions: number; deletions: number };
  config: AiDebtConfig;
}): ImpactAnalysis {
  const { findings, diffFiles, config } = input;

  const touchedAreas = buildTouchedAreas(diffFiles, config);
  const filteredFindings = findings.filter(
    f =>
      !f.ruleId.includes(':runtime') &&
      f.file !== '__summary__' &&
      f.file !== '__tsc__' &&
      f.file !== '__tool__'
  );
  const riskPoints = buildRiskPoints(filteredFindings);
  const summary = buildSummary(touchedAreas, filteredFindings);
  const regressionChecklist = buildChecklist(
    touchedAreas,
    riskPoints,
    filteredFindings
  );

  return { summary, touchedAreas, riskPoints, regressionChecklist };
}

function resolveFilePath(file: DiffFile): string {
  const raw = file.newPath ?? file.oldPath ?? '';
  // Remove a/ or b/ prefix and normalize to POSIX
  return raw.replace(/^[ab]\//, '').replace(/\\/g, '/');
}

/**
 * Match file to layer using config.layers[].match glob patterns.
 * First match wins: layers are checked in order, first matching layer is returned.
 */
function matchLayer(
  filePath: string,
  layers: AiDebtConfig['layers']
): string | null {
  for (const layer of layers) {
    for (const pattern of layer.match) {
      if (minimatch(filePath, pattern)) return layer.name;
    }
  }
  return null;
}

function resolveChangeType(file: DiffFile): 'added' | 'modified' | 'deleted' {
  if (file.status === 'added') return 'added';
  if (file.status === 'deleted') return 'deleted';
  return 'modified';
}

function buildTouchedAreas(
  diffFiles: DiffFile[],
  config: AiDebtConfig
): TouchedArea[] {
  const grouped = new Map<
    string,
    { files: Set<string>; changeTypes: Set<string> }
  >();

  for (const file of diffFiles) {
    const filePath = resolveFilePath(file);
    if (!filePath) continue;
    const layer = matchLayer(filePath, config.layers) ?? 'unlayered';
    const changeType = resolveChangeType(file);

    if (!grouped.has(layer)) {
      grouped.set(layer, { files: new Set(), changeTypes: new Set() });
    }
    const entry = grouped.get(layer)!;
    entry.files.add(filePath);
    entry.changeTypes.add(changeType);
  }

  const areas: TouchedArea[] = [];
  for (const [layer, entry] of grouped) {
    // If a layer has mixed change types, use 'modified'
    let changeType: 'added' | 'modified' | 'deleted';
    const types = Array.from(entry.changeTypes);
    if (types.length === 1) {
      changeType = types[0] as 'added' | 'modified' | 'deleted';
    } else {
      changeType = 'modified';
    }

    areas.push({
      layer,
      files: Array.from(entry.files),
      changeType,
    });
  }

  return areas;
}

function buildRiskPoints(findings: Finding[]): RiskPoint[] {
  const grouped = new Map<
    string,
    { descriptions: Set<string>; evidenceLines: Set<number> }
  >();

  for (const f of findings) {
    const type = RULE_TO_RISK[f.ruleId] ?? f.ruleId;
    if (!grouped.has(type)) {
      grouped.set(type, { descriptions: new Set(), evidenceLines: new Set() });
    }
    const entry = grouped.get(type)!;
    entry.descriptions.add(f.message);
    if (f.range?.start) {
      entry.evidenceLines.add(f.range.start);
    }
  }

  const points: RiskPoint[] = [];
  for (const [type, entry] of grouped) {
    points.push({
      type,
      description: Array.from(entry.descriptions).join('; '),
      evidenceLines: Array.from(entry.evidenceLines).sort((a, b) => a - b),
    });
  }

  return points;
}

function buildSummary(areas: TouchedArea[], findings: Finding[]): string {
  const fileCount = areas.reduce((sum, a) => sum + a.files.length, 0);
  const layerNames = areas.map(a => a.layer).join(', ');

  if (findings.length === 0) {
    return `Modified ${fileCount} files across ${layerNames}. No issues detected.`;
  }

  const highCount = findings.filter(f => f.severity === 'HIGH').length;
  return `Modified ${fileCount} files across ${layerNames}. ${findings.length} issues detected (${highCount} HIGH).`;
}

function buildChecklist(
  areas: TouchedArea[],
  riskPoints: RiskPoint[],
  findings: Finding[]
): string[] {
  const items: string[] = [];

  const hasType = (t: string) => riskPoints.some(r => r.type === t);

  if (hasType('boundary-violation')) {
    const layers = areas.map(a => a.layer).join(', ');
    items.push(`Test cross-layer integration for ${layers}`);
  }

  if (hasType('early-return')) {
    const files = findings
      .filter(f => f.ruleId === 'control-flow:early-return')
      .map(f => f.file)
      .filter((v, i, a) => a.indexOf(v) === i);
    items.push(`Verify control flow paths in ${files.join(', ')}`);
  }

  if (hasType('large-diff')) {
    items.push('Review all modified functions for logic changes');
  }

  for (const area of areas) {
    if (area.layer !== 'unlayered') {
      items.push(`Run ${area.layer} unit tests`);
    }
  }

  return items.slice(0, MAX_CHECKLIST);
}
