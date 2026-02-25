import { ReportModel } from '../../domain/analyze/report/report.model';
import { ExitCode } from '../contracts/cli.types';

export function resolveExitCode(
  report: ReportModel,
  failOn: 'error' | 'warning'
): ExitCode {
  // Filter out runtime findings - they never affect exit code
  const actionableItems = report.items.filter(
    item => !item.ruleId.includes(':runtime')
  );

  if (failOn === 'error') {
    const hasHigh = actionableItems.some(item => item.severity === 'HIGH');
    return hasHigh ? ExitCode.THRESHOLD_EXCEEDED : ExitCode.SUCCESS;
  }

  // failOn === 'warning'
  const hasHighOrMedium = actionableItems.some(
    item => item.severity === 'HIGH' || item.severity === 'MEDIUM'
  );
  return hasHighOrMedium ? ExitCode.THRESHOLD_EXCEEDED : ExitCode.SUCCESS;
}
