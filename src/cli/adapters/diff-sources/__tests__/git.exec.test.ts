import { execGitCommand } from '../git.exec';
import { GitExecutionError } from '../../../errors/cli.errors';

// Mock child_process.execFile
jest.mock('child_process', () => ({
  execFile: jest.fn(),
}));

import { execFile } from 'child_process';

const mockExecFile = execFile as unknown as jest.Mock;

type ExecFileCallback = (
  error: Error | null,
  stdout: string,
  stderr: string
) => void;

describe('execGitCommand', () => {
  beforeEach(() => {
    mockExecFile.mockReset();
  });

  it('returns stdout on success', async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: any, cb: ExecFileCallback) => {
        cb(null, 'diff output\n', '');
      }
    );

    const result = await execGitCommand(['show', 'HEAD'], '/tmp');
    expect(result).toBe('diff output\n');
    expect(mockExecFile).toHaveBeenCalledWith(
      'git',
      ['show', 'HEAD'],
      expect.objectContaining({
        cwd: '/tmp',
        encoding: 'utf8',
      }),
      expect.any(Function)
    );
  });

  it('throws GitExecutionError on non-zero exit', async () => {
    const err = new Error('exit code 128');
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: any, cb: ExecFileCallback) => {
        cb(err, '', 'fatal: bad object HEAD');
      }
    );

    await expect(execGitCommand(['show', 'badref'], '/tmp')).rejects.toThrow(
      GitExecutionError
    );

    await expect(execGitCommand(['show', 'badref'], '/tmp')).rejects.toThrow(
      'fatal: bad object HEAD'
    );
  });

  it('throws GitExecutionError when stderr has content', async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: any, cb: ExecFileCallback) => {
        cb(null, '', 'warning: something went wrong');
      }
    );

    await expect(execGitCommand(['diff'], '/tmp')).rejects.toThrow(
      GitExecutionError
    );

    await expect(execGitCommand(['diff'], '/tmp')).rejects.toThrow(
      'warning: something went wrong'
    );
  });

  it('uses error.message when stderr is empty', async () => {
    const err = new Error('Command failed');
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: any, cb: ExecFileCallback) => {
        cb(err, '', '');
      }
    );

    await expect(execGitCommand(['show', 'HEAD'], '/tmp')).rejects.toThrow(
      'Command failed'
    );
  });
});
