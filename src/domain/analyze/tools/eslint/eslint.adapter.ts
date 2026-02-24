import { Finding } from '../../rules/rule.types';

export function adaptEslintJsonToFindings(eslintJson: any[]): Finding[] {
  const out: Finding[] = [];

  for (const fileReport of eslintJson || []) {
    const filePath = fileReport.filePath || fileReport.filePath?.toString?.() || '';
    const messages = fileReport.messages || [];

    for (const m of messages) {
      // ESLint severity: 2 error, 1 warning
      const severity = m.severity === 2 ? 'HIGH' : 'MEDIUM';

      out.push({
        id: `F_ESLINT_${hash(`${filePath}:${m.line}:${m.ruleId}:${m.message}`)}`,
        ruleId: `eslint:${m.ruleId || 'unknown'}`,
        severity,
        confidence: 0.95,
        file: normalizeFile(filePath),
        range: m.line ? { start: m.line, end: m.endLine || m.line } : undefined,
        message: m.message || 'ESLint issue',
        evidence: m.source || undefined,
      });
    }
  }

  return out;
}

function normalizeFile(p: string) {
  // eslint 给的是绝对路径时，尽量转成相对（展示更友好）
  return p.replace(process.cwd() + '/', '');
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}