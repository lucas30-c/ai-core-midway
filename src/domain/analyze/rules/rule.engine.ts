import { AnalyzeContext, Finding, Rule } from './rule.types';

export class RuleEngine {
  constructor(private rules: Rule[]) {}

  run(ctx: AnalyzeContext): Finding[] {
    const findings: Finding[] = [];
    for (const rule of this.rules) {
      const out = rule.run(ctx);
      for (const f of out) findings.push(f);
    }
    // 按严重度排序：HIGH > MEDIUM > LOW
    const score = (s: string) => (s === 'HIGH' ? 3 : s === 'MEDIUM' ? 2 : 1);
    findings.sort((a, b) => score(b.severity) - score(a.severity));
    return findings;
  }
}
