import { execGitCommand } from './git.exec';
import { GitExecutionError } from '../../errors/cli.errors';

export async function readGitStagedDiff(cwd: string): Promise<string> {
  try {
    return await execGitCommand(['diff', '--no-color', '--cached'], cwd);
  } catch (err: any) {
    if (err instanceof GitExecutionError) {
      throw new GitExecutionError('Failed to read staged changes');
    }
    throw err;
  }
}
