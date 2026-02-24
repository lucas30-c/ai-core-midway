import { DiffFile, DiffHunk, DiffLine } from './diff.types';

const FILE_RE = /^diff --git a\/(.+) b\/(.+)$/;
const HUNK_RE = /^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/;

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

      currentFile = { oldPath: fm[1], newPath: fm[2], hunks: [] };
      files.push(currentFile);
      i++;
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