import { AnalyzeContext, Finding, Rule } from '../rule.types';

const RETURN_RE = /^\s*(return\b)/;
const COND_RE = /\b(if|else|switch|case|while|for|catch)\b/;
const TS_EXT_RE = /\.(ts|tsx)$/;
const CONTEXT_WINDOW = 5;

export class EarlyReturnRule implements Rule {
  id = 'control-flow:early-return';

  run(ctx: AnalyzeContext): Finding[] {
    const findings: Finding[] = [];

    for (const file of ctx.diffFiles) {
      // Use newPath ?? oldPath for rename/modified/added cases
      const filePath = file.newPath ?? file.oldPath;
      if (!filePath) continue;
      if (file.status === 'deleted') continue;
      if (!TS_EXT_RE.test(filePath)) continue;

      const normalizedPath = filePath.replace(/^[ab]\//, '');

      for (const hunk of file.hunks) {
        const addLines = hunk.lines
          .map((line, idx) => ({ ...line, idx }))
          .filter(l => l.type === 'add');

        for (let ai = 0; ai < addLines.length; ai++) {
          const line = addLines[ai];
          if (!RETURN_RE.test(line.content)) continue;
          if (typeof line.newLineNumber !== 'number') continue;

          // Skip if this is the last add line in the hunk (normal function end)
          if (ai === addLines.length - 1) continue;

          // Look back up to CONTEXT_WINDOW lines in full hunk for conditional context
          const startIdx = Math.max(0, line.idx - CONTEXT_WINDOW);
          let contextLine: { content: string } | null = null;
          for (let j = startIdx; j < line.idx; j++) {
            if (COND_RE.test(hunk.lines[j].content)) {
              contextLine = hunk.lines[j];
            }
          }

          if (!contextLine) continue;

          findings.push({
            id: `F_EARLY_RETURN_${sanitize(normalizedPath)}_${
              line.newLineNumber
            }`,
            ruleId: this.id,
            severity: 'MEDIUM',
            confidence: 0.75,
            file: normalizedPath,
            range: { start: line.newLineNumber, end: line.newLineNumber },
            message:
              'Early return in conditional block may skip subsequent logic',
            evidence: `${contextLine.content.trim()} → ${line.content.trim()}`,
          });
        }
      }
    }

    return findings;
  }
}

function sanitize(filePath: string): string {
  return filePath.replace(/[^a-zA-Z0-9]/g, '_');
}
