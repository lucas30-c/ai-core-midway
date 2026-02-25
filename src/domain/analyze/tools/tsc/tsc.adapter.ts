import * as ts from 'typescript';
import { Finding } from '../../rules/rule.types';

export function adaptTscDiagnosticsToFindings(
  diags: readonly ts.Diagnostic[],
  cwd: string,
  toolOverrides?: Record<string, 'HIGH' | 'MEDIUM' | 'LOW'>
): Finding[] {
  const out: Finding[] = [];

  for (const d of diags) {
    const msg = ts.flattenDiagnosticMessageText(d.messageText, '\n');
    const code = d.code;
    const ruleId = `tsc:${code}`;
    let severity: 'HIGH' | 'MEDIUM' | 'LOW' =
      d.category === ts.DiagnosticCategory.Error ? 'HIGH' : 'MEDIUM';
    if (toolOverrides?.[ruleId]) {
      severity = toolOverrides[ruleId];
    }

    let file = '__tsc__';
    let range: { start: number; end: number } | undefined;

    if (d.file && typeof d.start === 'number') {
      file = d.file.fileName.replace(cwd + '/', '');
      const pos = d.file.getLineAndCharacterOfPosition(d.start);
      range = { start: pos.line + 1, end: pos.line + 1 };
    }

    out.push({
      id: `F_TSC_${code}_${hash(`${file}:${range?.start ?? 0}:${msg}`)}`,
      ruleId,
      severity,
      confidence: 0.98,
      file,
      range,
      message: msg,
      evidence: `TS${code}`,
    });
  }

  return out;
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}
