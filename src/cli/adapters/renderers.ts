import { ReportModel } from '../../domain/analyze/report/report.model';
import { renderMarkdown } from '../../domain/analyze/report/renderers/markdown.renderer';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require('../../../package.json');

export function renderReport(
  report: ReportModel,
  format: 'markdown' | 'json'
): string {
  if (format === 'json') {
    return JSON.stringify(
      {
        schemaVersion: '1.0.0',
        engine: {
          name: pkg.name,
          version: pkg.version,
        },
        analysis: report,
      },
      null,
      2
    );
  }
  return renderMarkdown(report);
}
