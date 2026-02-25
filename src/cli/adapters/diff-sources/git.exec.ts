import { execFile } from 'child_process';
import { GitExecutionError } from '../../errors/cli.errors';

const MAX_BUFFER = 20 * 1024 * 1024; // 20 MB

export async function execGitCommand(
  args: string[],
  cwd: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'git',
      args,
      { cwd, maxBuffer: MAX_BUFFER, encoding: 'utf8' },
      (error, stdout, stderr) => {
        if (error) {
          reject(new GitExecutionError(stderr?.trim() || error.message));
          return;
        }
        if (stderr && stderr.trim().length > 0) {
          reject(new GitExecutionError(stderr.trim()));
          return;
        }
        resolve(stdout);
      }
    );
  });
}
