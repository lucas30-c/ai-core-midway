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

  // Impact Analysis section
  if (report.impact) {
    lines.push('## Impact Analysis');
    lines.push('');
    lines.push(report.impact.summary);
    lines.push('');

    if (report.impact.touchedAreas.length > 0) {
      lines.push('### Changed Areas');
      for (const area of report.impact.touchedAreas) {
        const count = area.files.length;
        const label = count === 1 ? '1 file' : `${count} files`;
        lines.push(
          `- **${escape(area.layer)}** (${label}): ${area.files
            .map(escape)
            .join(', ')}`
        );
      }
      lines.push('');
    }

    if (report.impact.riskPoints.length > 0) {
      lines.push('### Risk Points');
      for (const rp of report.impact.riskPoints) {
        const linesStr =
          rp.evidenceLines.length > 0
            ? ` (lines: ${rp.evidenceLines.join(', ')})`
            : '';
        lines.push(
          `- **${escape(rp.type)}**: ${escape(rp.description)}${linesStr}`
        );
      }
      lines.push('');
    }
  }

  // Key Findings table
  if (report.items.length > 0) {
    lines.push('## Key Findings');
    lines.push('| Severity | Rule | File | Line | Message |');
    lines.push('|---|---|---|---|---|');

    for (const item of report.items) {
      lines.push(
        `| ${item.severity} | ${escape(item.ruleId)} | ${escape(item.file)} | ${
          item.line ?? ''
        } | ${escape(item.message)} |`
      );
    }
    lines.push('');
  } else {
    lines.push('## No Issues Found');
    lines.push('');
  }

  // Suggested Actions section
  if (report.impact && report.impact.regressionChecklist.length > 0) {
    lines.push('## Suggested Actions');
    for (const item of report.impact.regressionChecklist) {
      lines.push(`- [ ] ${escape(item)}`);
    }
  }

  return lines.join('\n');
}

function escape(str: string) {
  return str.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}
