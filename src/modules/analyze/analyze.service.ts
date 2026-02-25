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
import {
  enrichImpact,
  LlmDraft,
} from '../../domain/analyze/impact/impact.enricher';
import {
  KnowledgeProvider,
  KnowledgeChunk,
  RetrievedKnowledgeChunk,
} from '../../domain/knowledge/kb.types';
import { LlmProvider } from '../../core/llm/llm.types';

export interface AnalyzeOptions {
  requestId?: string;
  traceId?: string;
  tscMode?: 'fast' | 'full';
  cwd?: string;
  config?: AiDebtConfig;
  kbProvider?: KnowledgeProvider | null;
  llmProvider?: LlmProvider | null;
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

function normalizeChangedFiles(diffFiles: DiffFile[]): string[] {
  return diffFiles
    .map(f => f.newPath ?? f.oldPath)
    .filter(
      (p): p is string => !!p && p !== '/dev/null' && !p.startsWith('/dev/null')
    )
    .map(p => {
      let normalized = p.replace(/^[ab]\//, '');
      normalized = normalized.replace(/^\.?\//, '');
      normalized = normalized.replace(/\\/g, '/');
      return normalized;
    });
}

function formatExcerpt(content: string, maxLen = 200): string {
  const collapsed = content.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= maxLen) return collapsed;
  return collapsed.slice(0, maxLen - 1) + '\u2026';
}

function toRetrievedChunks(
  chunks: KnowledgeChunk[]
): RetrievedKnowledgeChunk[] {
  return chunks.map(c => ({
    sourcePath: c.sourcePath,
    heading: c.heading,
    excerpt: formatExcerpt(c.content),
  }));
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

    // 4. Run rule engine
    const ruleEngine = new RuleEngine([
      new LargeDiffRule(),
      new ConsoleLogRule(),
      new AnyTypeRule(),
      new AstBoundaryRule(),
      new EarlyReturnRule(),
    ]);
    const ruleFindings = ruleEngine.run(analyzeCtx);

    // 5. Run tool runners
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
    const score = (s: string) => (s === 'HIGH' ? 3 : s === 'MEDIUM' ? 2 : 1);
    findings.sort((a, b) => score(b.severity) - score(a.severity));

    // 7. Build deterministic impact analysis (Phase 1)
    let impact = buildImpactAnalysis({
      findings,
      diffFiles,
      stats: analyzeCtx.stats,
      config,
    });

    // 8. Phase 2: KB retrieval
    let retrievedChunks: KnowledgeChunk[] = [];
    const kbProvider = opts?.kbProvider;
    if (kbProvider && kbProvider.isAvailable()) {
      const query =
        impact.summary +
        ' ' +
        impact.riskPoints.map(r => r.description).join(' ');
      retrievedChunks = await kbProvider.search(query);
    }

    // 9. Phase 2: LLM enrichment
    let llmDraft: LlmDraft | null = null;
    const llmProvider = opts?.llmProvider;
    if (llmProvider) {
      const diffSummary = `${
        analyzeCtx.stats.filesChanged
      } files changed, ${insertions} insertions, ${deletions} deletions. Risk: ${riskLevel(
        findings
      )}.`;
      const result = await enrichImpact(
        impact,
        diffSummary,
        retrievedChunks,
        llmProvider
      );
      impact = result.enrichedImpact;
      llmDraft = result.llmDraft;
    }

    // 10. Build report
    const reportModel = buildReportModel({
      risk: riskLevel(findings),
      stats: analyzeCtx.stats,
      findings,
      impact,
      retrievedKnowledge:
        retrievedChunks.length > 0
          ? { provider: 'local', chunks: toRetrievedChunks(retrievedChunks) }
          : undefined,
      llmDraft,
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
