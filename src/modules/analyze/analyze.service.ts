import { Provide } from '@midwayjs/core';
import { parseGitDiff } from '../../domain/analyze/diff/diff.parser';
import { DiffFile } from '../../domain/analyze/diff/diff.types';
import { RuleEngine } from '../../domain/analyze/rules/rule.engine';
import { LargeDiffRule } from '../../domain/analyze/rules/rules/large-diff.rule';
import { ConsoleLogRule } from '../../domain/analyze/rules/rules/console-log.rule';
import { AnyTypeRule } from '../../domain/analyze/rules/rules/any-type.rule';
import { AstBoundaryRule } from '../../domain/analyze/rules/rules/ast-boundary.rule';
import { EarlyReturnRule } from '../../domain/analyze/rules/rules/early-return.rule';
import { EslintRunner } from '../../domain/analyze/tools/eslint/eslint.runner';
import { TscRunner } from '../../domain/analyze/tools/tsc/tsc.runner';
import { AnalyzeContext, Finding } from '../../domain/analyze/rules/rule.types';
import { buildReportModel } from '../../domain/analyze/report/report.builder';
import { renderMarkdown } from '../../domain/analyze/report/renderers/markdown.renderer';
import {
  ReportModel,
  RiskLevel,
} from '../../domain/analyze/report/report.model';
import { AiDebtConfig } from '../../domain/analyze/config/config.types';
import { DEFAULT_CONFIG } from '../../domain/analyze/config/default.config';
import { buildImpactAnalysis } from '../../domain/analyze/impact/impact.builder';

export interface AnalyzeOptions {
  requestId?: string;
  traceId?: string;
  tscMode?: 'fast' | 'full';
  cwd?: string;
  config?: AiDebtConfig;
}

export interface AnalyzeResult {
  stats: { filesChanged: number; insertions: number; deletions: number };
  findingsCount: number;
  findings: Finding[];
  meta: { tscMode: 'fast' | 'full' };
  report: ReportModel;
  markdown: string;
}

function riskLevel(findings: Finding[]): RiskLevel {
  if (findings.some(f => f.severity === 'HIGH')) return 'HIGH';
  if (findings.some(f => f.severity === 'MEDIUM')) return 'MEDIUM';
  return 'LOW';
}

/**
 * Normalize changed files from diff to the format expected by rules:
 * - Relative to cwd (no absolute paths)
 * - POSIX separators (/) only
 * - No a/ or b/ prefixes
 * - No leading / or ./
 */
function normalizeChangedFiles(diffFiles: DiffFile[]): string[] {
  return diffFiles
    .map(f => f.newPath ?? f.oldPath)
    .filter(
      (p): p is string => !!p && p !== '/dev/null' && !p.startsWith('/dev/null')
    )
    .map(p => {
      // Remove a/ or b/ prefix if present (git diff format)
      let normalized = p.replace(/^[ab]\//, '');
      // Remove leading / or ./
      normalized = normalized.replace(/^\.?\//, '');
      // Convert backslashes to forward slashes (POSIX)
      normalized = normalized.replace(/\\/g, '/');
      return normalized;
    });
}

@Provide()
export class AnalyzeService {
  async analyzeDiff(
    diff: string,
    opts?: AnalyzeOptions
  ): Promise<AnalyzeResult> {
    const tscMode = opts?.tscMode || 'fast';
    const cwd = opts?.cwd || process.cwd();
    const config = opts?.config || DEFAULT_CONFIG;

    // 1. Parse diff
    const diffFiles = parseGitDiff(diff);

    // 2. Calculate stats
    let insertions = 0;
    let deletions = 0;
    for (const file of diffFiles) {
      for (const hunk of file.hunks) {
        for (const line of hunk.lines) {
          if (line.type === 'add') insertions++;
          if (line.type === 'del') deletions++;
        }
      }
    }

    // 3. Normalize changed files for context
    const changedFiles = normalizeChangedFiles(diffFiles);

    const analyzeCtx: AnalyzeContext = {
      diffFiles,
      stats: { filesChanged: diffFiles.length, insertions, deletions },
      cwd,
      changedFiles,
      config,
    };

    // 4. Run rule engine (hand-written rules including AST boundary)
    const ruleEngine = new RuleEngine([
      new LargeDiffRule(),
      new ConsoleLogRule(),
      new AnyTypeRule(),
      new AstBoundaryRule(),
      new EarlyReturnRule(),
    ]);
    const ruleFindings = ruleEngine.run(analyzeCtx);

    // 5. Run tool runners (ESLint + TSC)
    const toolFindings = [
      ...(await new EslintRunner().run({ cwd, files: changedFiles, ...opts })),
      ...(await new TscRunner().run({
        cwd,
        files: changedFiles,
        tscMode,
        ...opts,
      })),
    ];

    // 6. Merge all findings
    const findings = [...ruleFindings, ...toolFindings];

    // Sort by severity
    const score = (s: string) => (s === 'HIGH' ? 3 : s === 'MEDIUM' ? 2 : 1);
    findings.sort((a, b) => score(b.severity) - score(a.severity));

    const impact = buildImpactAnalysis({
      findings,
      diffFiles,
      stats: analyzeCtx.stats,
      config,
    });

    const reportModel = buildReportModel({
      risk: riskLevel(findings),
      stats: analyzeCtx.stats,
      findings,
      impact,
    });

    const markdown = renderMarkdown(reportModel);

    return {
      stats: analyzeCtx.stats,
      findingsCount: findings.length,
      findings,
      meta: { tscMode },
      report: reportModel,
      markdown,
    };
  }
}
