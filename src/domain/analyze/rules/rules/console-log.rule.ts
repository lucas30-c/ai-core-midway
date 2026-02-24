import { AnalyzeContext, Finding, Rule } from '../rule.types';

export class ConsoleLogRule implements Rule {
  id = 'console-log';

  run(ctx: AnalyzeContext): Finding[] {
    const findings: Finding[] = [];

    for (const file of ctx.diffFiles) {
      for (const hunk of file.hunks) {
        for (const line of hunk.lines) {
          if (line.type === 'add' && /console\.(log|warn|error|debug|info)\(/.test(line.content)) {
            findings.push({
              id: `F_CONSOLE_LOG_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              ruleId: this.id,
              severity: 'LOW',
              confidence: 0.9,
              file: file.newPath,
              range: line.newLineNumber ? { start: line.newLineNumber, end: line.newLineNumber } : undefined,
              message: 'console.log detected in new code',
              evidence: line.content.trim(),
            });
          }
        }
      }
    }

    return findings;
  }
}
