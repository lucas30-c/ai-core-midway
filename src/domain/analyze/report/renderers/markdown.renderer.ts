import { ReportModel } from '../report.model';

export function renderMarkdown(report: ReportModel): string {
  const lines: string[] = [];

  lines.push('# Code Risk Report');
  lines.push('');
  lines.push(`**Risk Level**: ${report.summary.risk}`);
  lines.push('');
  lines.push(`- Files Changed: ${report.summary.filesChanged}`);
  lines.push(`- Insertions: ${report.summary.insertions}`);
  lines.push(`- Deletions: ${report.summary.deletions}`);
  lines.push(`- Findings: ${report.summary.findingsCount}`);
  lines.push(`- Generated At: ${report.generatedAt}`);
  lines.push('');

  if (report.items.length > 0) {
    lines.push('## Findings');
    lines.push('| Severity | Rule | File | Line | Message |');
    lines.push('|---|---|---|---|---|');

    for (const item of report.items) {
      lines.push(
        `| ${item.severity} | ${escape(item.ruleId)} | ${escape(item.file)} | ${
          item.line ?? ''
        } | ${escape(item.message)} |`
      );
    }
  } else {
    lines.push('## No Issues Found 🎉');
  }

  return lines.join('\n');
}

function escape(str: string) {
  return str.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}
