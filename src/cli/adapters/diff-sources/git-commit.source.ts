import { execGitCommand } from './git.exec';
import { GitExecutionError } from '../../errors/cli.errors';

export async function readGitCommitDiff(
  commit: string,
  cwd: string
): Promise<string> {
  try {
    return await execGitCommand(
      ['show', '--format=', '--no-color', '--patch', commit],
      cwd
    );
  } catch (err: any) {
    if (err instanceof GitExecutionError) {
      throw new GitExecutionError(`Failed to resolve git commit ${commit}`);
    }
    throw err;
  }
}
