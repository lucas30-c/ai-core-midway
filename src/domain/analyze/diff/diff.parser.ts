import { DiffFile, DiffFileStatus, DiffHunk, DiffLine } from './diff.types';

const FILE_RE = /^diff --git a\/(.+) b\/(.+)$/;
const HUNK_RE = /^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/;

/**
 * Status detection priority (highest to lowest):
 * 1. rename from/to → 'renamed'
 * 2. new file mode OR --- /dev/null → 'added'
 * 3. deleted file mode OR +++ /dev/null → 'deleted'
 * 4. default → 'modified'
 */
function resolveStatus(flags: {
  hasRename: boolean;
  hasNewFileMode: boolean;
  hasDeletedFileMode: boolean;
  hasDevNullOld: boolean;
  hasDevNullNew: boolean;
}): DiffFileStatus {
  // Priority 1: rename (highest)
  if (flags.hasRename) return 'renamed';
  // Priority 2: added
  if (flags.hasNewFileMode || flags.hasDevNullOld) return 'added';
  // Priority 3: deleted
  if (flags.hasDeletedFileMode || flags.hasDevNullNew) return 'deleted';
  // Priority 4: modified (default)
  return 'modified';
}

export function parseGitDiff(diffText: string): DiffFile[] {
  const lines = diffText.split('\n');
  const files: DiffFile[] = [];

  let currentFile: DiffFile | null = null;
  let currentHunk: DiffHunk | null = null;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    const fm = line.match(FILE_RE);
    if (fm) {
      if (currentHunk && currentFile) currentFile.hunks.push(currentHunk);
      currentHunk = null;

      currentFile = {
        oldPath: fm[1],
        newPath: fm[2],
        status: 'modified',
        hunks: [],
      };
      files.push(currentFile);
      i++;

      // Collect metadata flags between "diff --git" and first hunk "@@"
      const flags = {
        hasRename: false,
        hasNewFileMode: false,
        hasDeletedFileMode: false,
        hasDevNullOld: false,
        hasDevNullNew: false,
      };
      let renameFrom: string | undefined;
      let renameTo: string | undefined;

      while (i < lines.length) {
        const ml = lines[i];
        if (ml.startsWith('diff --git ') || ml.startsWith('@@ ')) break;

        if (ml.startsWith('new file mode')) {
          flags.hasNewFileMode = true;
        } else if (ml.startsWith('deleted file mode')) {
          flags.hasDeletedFileMode = true;
        } else if (ml.startsWith('rename from ')) {
          flags.hasRename = true;
          renameFrom = ml.slice('rename from '.length);
        } else if (ml.startsWith('rename to ')) {
          flags.hasRename = true;
          renameTo = ml.slice('rename to '.length);
        } else if (ml.startsWith('--- /dev/null')) {
          flags.hasDevNullOld = true;
        } else if (ml.startsWith('+++ /dev/null')) {
          flags.hasDevNullNew = true;
        }

        i++;
      }

      // Apply priority-based status resolution
      const status = resolveStatus(flags);
      currentFile.status = status;

      if (status === 'added') {
        currentFile.oldPath = undefined;
      } else if (status === 'deleted') {
        currentFile.newPath = undefined;
      } else if (status === 'renamed') {
        if (renameFrom) currentFile.oldPath = renameFrom;
        if (renameTo) currentFile.newPath = renameTo;
      }

      continue;
    }

    const hm = line.match(HUNK_RE);
    if (hm && currentFile) {
      if (currentHunk) currentFile.hunks.push(currentHunk);

      const newStart = Number(hm[3]);
      const newLines = Number(hm[4] || '1');

      currentHunk = { header: line, lines: [], newStart, newLines };

      i++;
      // parse hunk body
      let newLineNo = newStart;

      while (i < lines.length) {
        const l = lines[i];
        if (l.startsWith('diff --git ')) break;
        if (l.startsWith('@@ ')) break;

        if (!currentHunk) break;

        const dl: DiffLine = { type: 'ctx', content: l };

        if (l.startsWith('+') && !l.startsWith('+++')) {
          dl.type = 'add';
          dl.content = l.slice(1);
          dl.newLineNumber = newLineNo++;
        } else if (l.startsWith('-') && !l.startsWith('---')) {
          dl.type = 'del';
          dl.content = l.slice(1);
          // newLineNo unchanged
        } else {
          dl.type = 'ctx';
          dl.content = l.startsWith(' ') ? l.slice(1) : l;
          dl.newLineNumber = newLineNo++;
        }

        currentHunk.lines.push(dl);
        i++;
      }

      continue;
    }

    i++;
  }

  if (currentHunk && currentFile) currentFile.hunks.push(currentHunk);
  return files;
}
