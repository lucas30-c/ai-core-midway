import { parseGitDiff } from '../diff.parser';

describe('parseGitDiff – status detection', () => {
  it('detects added file from "new file mode"', () => {
    const diff = [
      'diff --git a/src/new.ts b/src/new.ts',
      'new file mode 100644',
      'index 0000000..abc1234',
      '--- /dev/null',
      '+++ b/src/new.ts',
      '@@ -0,0 +1,3 @@',
      '+export const x = 1;',
      '+export const y = 2;',
      '+export const z = 3;',
    ].join('\n');

    const files = parseGitDiff(diff);
    expect(files).toHaveLength(1);
    expect(files[0].status).toBe('added');
    expect(files[0].oldPath).toBeUndefined();
    expect(files[0].newPath).toBe('src/new.ts');
    expect(files[0].hunks).toHaveLength(1);
    expect(files[0].hunks[0].lines).toHaveLength(3);
  });

  it('detects deleted file from "deleted file mode"', () => {
    const diff = [
      'diff --git a/src/old.ts b/src/old.ts',
      'deleted file mode 100644',
      'index abc1234..0000000',
      '--- a/src/old.ts',
      '+++ /dev/null',
      '@@ -1,2 +0,0 @@',
      '-export const a = 1;',
      '-export const b = 2;',
    ].join('\n');

    const files = parseGitDiff(diff);
    expect(files).toHaveLength(1);
    expect(files[0].status).toBe('deleted');
    expect(files[0].oldPath).toBe('src/old.ts');
    expect(files[0].newPath).toBeUndefined();
    expect(files[0].hunks).toHaveLength(1);
  });

  it('detects added file via --- /dev/null fallback (no "new file mode" line)', () => {
    const diff = [
      'diff --git a/src/fallback.ts b/src/fallback.ts',
      'index 0000000..abc1234',
      '--- /dev/null',
      '+++ b/src/fallback.ts',
      '@@ -0,0 +1,1 @@',
      '+console.log("hello");',
    ].join('\n');

    const files = parseGitDiff(diff);
    expect(files).toHaveLength(1);
    expect(files[0].status).toBe('added');
    expect(files[0].oldPath).toBeUndefined();
  });

  it('detects deleted file via +++ /dev/null fallback', () => {
    const diff = [
      'diff --git a/src/gone.ts b/src/gone.ts',
      'index abc1234..0000000',
      '--- a/src/gone.ts',
      '+++ /dev/null',
      '@@ -1,1 +0,0 @@',
      '-const x = 1;',
    ].join('\n');

    const files = parseGitDiff(diff);
    expect(files).toHaveLength(1);
    expect(files[0].status).toBe('deleted');
    expect(files[0].newPath).toBeUndefined();
  });

  it('detects renamed file from rename headers', () => {
    const diff = [
      'diff --git a/src/old-name.ts b/src/new-name.ts',
      'similarity index 95%',
      'rename from src/old-name.ts',
      'rename to src/new-name.ts',
      'index abc1234..def5678 100644',
      '--- a/src/old-name.ts',
      '+++ b/src/new-name.ts',
      '@@ -1,3 +1,3 @@',
      ' export const x = 1;',
      '-export const old = 2;',
      '+export const renamed = 2;',
      ' export const z = 3;',
    ].join('\n');

    const files = parseGitDiff(diff);
    expect(files).toHaveLength(1);
    expect(files[0].status).toBe('renamed');
    expect(files[0].oldPath).toBe('src/old-name.ts');
    expect(files[0].newPath).toBe('src/new-name.ts');
  });

  it('defaults to modified for normal changes', () => {
    const diff = [
      'diff --git a/src/existing.ts b/src/existing.ts',
      'index abc1234..def5678 100644',
      '--- a/src/existing.ts',
      '+++ b/src/existing.ts',
      '@@ -1,3 +1,3 @@',
      ' export const x = 1;',
      '-export const old = 2;',
      '+export const updated = 2;',
      ' export const z = 3;',
    ].join('\n');

    const files = parseGitDiff(diff);
    expect(files).toHaveLength(1);
    expect(files[0].status).toBe('modified');
    expect(files[0].oldPath).toBe('src/existing.ts');
    expect(files[0].newPath).toBe('src/existing.ts');
  });

  it('handles multiple files with mixed statuses', () => {
    const diff = [
      'diff --git a/src/new.ts b/src/new.ts',
      'new file mode 100644',
      '--- /dev/null',
      '+++ b/src/new.ts',
      '@@ -0,0 +1,1 @@',
      '+const a = 1;',
      'diff --git a/src/mod.ts b/src/mod.ts',
      'index 111..222 100644',
      '--- a/src/mod.ts',
      '+++ b/src/mod.ts',
      '@@ -1,1 +1,1 @@',
      '-const b = 1;',
      '+const b = 2;',
      'diff --git a/src/del.ts b/src/del.ts',
      'deleted file mode 100644',
      '--- a/src/del.ts',
      '+++ /dev/null',
      '@@ -1,1 +0,0 @@',
      '-const c = 1;',
    ].join('\n');

    const files = parseGitDiff(diff);
    expect(files).toHaveLength(3);
    expect(files[0].status).toBe('added');
    expect(files[1].status).toBe('modified');
    expect(files[2].status).toBe('deleted');
  });
});
