import { readGitStagedDiff } from '../git-staged.source';
import { GitExecutionError } from '../../../errors/cli.errors';

jest.mock('../git.exec', () => ({
  execGitCommand: jest.fn(),
}));

import { execGitCommand } from '../git.exec';

const mockExecGit = execGitCommand as jest.Mock;

describe('readGitStagedDiff', () => {
  beforeEach(() => {
    mockExecGit.mockReset();
  });

  it('returns staged diff on success', async () => {
    mockExecGit.mockResolvedValue('diff --git a/f b/f\n+new line\n');

    const result = await readGitStagedDiff('/repo');
    expect(result).toBe('diff --git a/f b/f\n+new line\n');
    expect(mockExecGit).toHaveBeenCalledWith(
      ['diff', '--no-color', '--cached'],
      '/repo'
    );
  });

  it('returns empty string when nothing staged', async () => {
    mockExecGit.mockResolvedValue('');

    const result = await readGitStagedDiff('/repo');
    expect(result).toBe('');
  });

  it('wraps git error with context', async () => {
    const { GitExecutionError: RealGitError } = jest.requireActual(
      '../../../errors/cli.errors'
    );
    mockExecGit.mockRejectedValue(new RealGitError('git error'));

    await expect(readGitStagedDiff('/repo')).rejects.toThrow(GitExecutionError);
    await expect(readGitStagedDiff('/repo')).rejects.toThrow(
      'Failed to read staged changes'
    );
  });
});
