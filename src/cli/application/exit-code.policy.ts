import { ReportModel } from '../../domain/analyze/report/report.model';
import { ExitCode } from '../contracts/cli.types';

export function resolveExitCode(
  report: ReportModel,
  failOn: 'error' | 'warning'
): ExitCode {
  const hasHigh = report.items.some(item => item.severity === 'HIGH');
  const hasMedium = report.items.some(item => item.severity === 'MEDIUM');

  if (failOn === 'error' && hasHigh) return ExitCode.THRESHOLD_EXCEEDED;
  if (failOn === 'warning' && (hasHigh || hasMedium))
    return ExitCode.THRESHOLD_EXCEEDED;

  return ExitCode.SUCCESS;
}
