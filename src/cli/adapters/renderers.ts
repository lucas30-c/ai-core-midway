import { ReportModel } from '../../domain/analyze/report/report.model';
import { renderMarkdown } from '../../domain/analyze/report/renderers/markdown.renderer';

export function renderReport(
  report: ReportModel,
  format: 'markdown' | 'json'
): string {
  if (format === 'json') {
    return JSON.stringify(report, null, 2);
  }
  return renderMarkdown(report);
}
