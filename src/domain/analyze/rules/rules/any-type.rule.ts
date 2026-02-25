import { AnalyzeContext, Finding, Rule } from '../rule.types';

export class AnyTypeRule implements Rule {
  id = 'any-type';

  run(ctx: AnalyzeContext): Finding[] {
    const findings: Finding[] = [];

    for (const file of ctx.diffFiles) {
      // Only check TS files
      if (!/\.(ts|tsx)$/.test(file.newPath)) continue;

      for (const hunk of file.hunks) {
        for (const line of hunk.lines) {
          // Detect `: any` or `as any` in added lines
          if (
            line.type === 'add' &&
            /:\s*any\b|as\s+any\b/.test(line.content)
          ) {
            findings.push({
              id: `F_ANY_TYPE_${Date.now()}_${Math.random()
                .toString(36)
                .slice(2, 6)}`,
              ruleId: this.id,
              severity: 'MEDIUM',
              confidence: 0.85,
              file: file.newPath,
              range: line.newLineNumber
                ? { start: line.newLineNumber, end: line.newLineNumber }
                : undefined,
              message: 'Explicit `any` type detected',
              evidence: line.content.trim(),
            });
          }
        }
      }
    }

    return findings;
  }
}
