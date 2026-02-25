import { execGitCommand } from './git.exec';
import { GitExecutionError, UsageError } from '../../errors/cli.errors';

export async function readGitRangeDiff(
  range: string,
  cwd: string
): Promise<string> {
  const dotIdx = range.indexOf('..');
  if (dotIdx < 0) {
    throw new UsageError(
      `Invalid git range format "${range}". Expected base..head`
    );
  }
  const base = range.slice(0, dotIdx);
  const head = range.slice(dotIdx + 2);
  if (base.length === 0 || head.length === 0) {
    throw new UsageError(
      `Invalid git range "${range}". Both base and head must be non-empty`
    );
  }

  try {
    return await execGitCommand(['diff', '--no-color', range], cwd);
  } catch (err: any) {
    if (err instanceof GitExecutionError) {
      throw new GitExecutionError(`Failed to resolve git range ${range}`);
    }
    throw err;
  }
}
