import { readGitRangeDiff } from '../git-range.source';
import { UsageError } from '../../../errors/cli.errors';

// Mock execGitCommand
jest.mock('../git.exec', () => ({
  execGitCommand: jest.fn(),
}));

import { execGitCommand } from '../git.exec';

const mockExecGit = execGitCommand as jest.Mock;

describe('readGitRangeDiff', () => {
  beforeEach(() => {
    mockExecGit.mockReset();
  });

  describe('range format validation', () => {
    it('throws UsageError when .. is missing', async () => {
      await expect(readGitRangeDiff('main', '/tmp')).rejects.toThrow(
        UsageError
      );

      await expect(readGitRangeDiff('main', '/tmp')).rejects.toThrow(
        'Invalid git range format'
      );
    });

    it('throws UsageError when base is empty', async () => {
      await expect(readGitRangeDiff('..HEAD', '/tmp')).rejects.toThrow(
        UsageError
      );

      await expect(readGitRangeDiff('..HEAD', '/tmp')).rejects.toThrow(
        'Both base and head must be non-empty'
      );
    });

    it('throws UsageError when head is empty', async () => {
      await expect(readGitRangeDiff('main..', '/tmp')).rejects.toThrow(
        UsageError
      );

      await expect(readGitRangeDiff('main..', '/tmp')).rejects.toThrow(
        'Both base and head must be non-empty'
      );
    });

    it('does not call git for invalid format', async () => {
      try {
        await readGitRangeDiff('main', '/tmp');
      } catch {
        // expected
      }
      expect(mockExecGit).not.toHaveBeenCalled();
    });
  });

  describe('git execution', () => {
    it('returns diff output on success', async () => {
      mockExecGit.mockResolvedValue('diff --git a/f b/f\n');

      const result = await readGitRangeDiff('main..HEAD', '/repo');
      expect(result).toBe('diff --git a/f b/f\n');
      expect(mockExecGit).toHaveBeenCalledWith(
        ['diff', '--no-color', 'main..HEAD'],
        '/repo'
      );
    });

    it('wraps git error with range context', async () => {
      const { GitExecutionError } = jest.requireActual(
        '../../../errors/cli.errors'
      );
      mockExecGit.mockRejectedValue(
        new GitExecutionError('fatal: bad revision')
      );

      await expect(readGitRangeDiff('bad..refs', '/repo')).rejects.toThrow(
        'Failed to resolve git range bad..refs'
      );
    });
  });
});
