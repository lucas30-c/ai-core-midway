import { Controller, Post, Body, Inject } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { AnalyzeDiffDTO } from './analyze.dto';
import { parseGitDiff } from '../../domain/analyze/diff/diff.parser';
import { RuleEngine } from '../../domain/analyze/rules/rule.engine';
import { LargeDiffRule } from '../../domain/analyze/rules/rules/large-diff.rule';
import { ConsoleLogRule } from '../../domain/analyze/rules/rules/console-log.rule';
import { AnyTypeRule } from '../../domain/analyze/rules/rules/any-type.rule';
import { EslintRunner } from '../../domain/analyze/tools/eslint/eslint.runner';
import { TscRunner } from '../../domain/analyze/tools/tsc/tsc.runner';
import { AnalyzeContext } from '../../domain/analyze/rules/rule.types';

@Controller('/analyze')
export class AnalyzeController {
  @Inject()
  ctx: Context;

  @Post('/diff')
  async analyzeDiff(@Body() body: AnalyzeDiffDTO) {
    const requestId = this.ctx.state.requestId;
    const traceId = this.ctx.state.traceId;

    // 1. Parse diff
    const diffFiles = parseGitDiff(body.diff);

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

    const analyzeCtx: AnalyzeContext = {
      diffFiles,
      stats: {
        filesChanged: diffFiles.length,
        insertions,
        deletions,
      },
    };

    // 3. Run rule engine (hand-written rules)
    const ruleEngine = new RuleEngine([
      new LargeDiffRule(),
      new ConsoleLogRule(),
      new AnyTypeRule(),
    ]);
    const ruleFindings = ruleEngine.run(analyzeCtx);

    // 4. Extract changed files for tool runners
    const changedFiles = diffFiles
      .map(f => f.newPath)
      .filter(p => !p.startsWith('/dev/null') && p !== '/dev/null');

    // 5. Run tool runners (ESLint + TSC)
    const toolFindings = [
      ...(await new EslintRunner().run({ cwd: process.cwd(), files: changedFiles, requestId, traceId })),
      ...(await new TscRunner().run({ cwd: process.cwd(), files: changedFiles, requestId, traceId })),
    ];

    // 6. Merge all findings
    const findings = [...ruleFindings, ...toolFindings];

    // Sort by severity
    const score = (s: string) => (s === 'HIGH' ? 3 : s === 'MEDIUM' ? 2 : 1);
    findings.sort((a, b) => score(b.severity) - score(a.severity));

    return {
      requestId,
      traceId,
      stats: analyzeCtx.stats,
      findingsCount: findings.length,
      findings,
    };
  }
}
