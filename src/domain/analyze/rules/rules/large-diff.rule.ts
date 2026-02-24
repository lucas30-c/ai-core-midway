import { AnalyzeContext, Finding, Rule } from '../rule.types';

const THRESHOLD = 500;

export class LargeDiffRule implements Rule {
  id = 'large-diff';

  run(ctx: AnalyzeContext): Finding[] {
    const findings: Finding[] = [];
    const total = ctx.stats.insertions + ctx.stats.deletions;

    if (total > THRESHOLD) {
      findings.push({
        id: `F_LARGE_DIFF_${Date.now()}`,
        ruleId: this.id,
        severity: 'MEDIUM',
        confidence: 1,
        file: '__summary__',
        message: `Diff size (${total} lines) exceeds threshold (${THRESHOLD})`,
        evidence: `insertions: ${ctx.stats.insertions}, deletions: ${ctx.stats.deletions}`,
      });
    }

    return findings;
  }
}
