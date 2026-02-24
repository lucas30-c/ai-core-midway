export interface DiffFile {
  oldPath?: string;
  newPath: string;
  hunks: DiffHunk[];
}

export interface DiffHunk {
  header: string; // @@ -a,b +c,d @@
  lines: DiffLine[];
  newStart: number;
  newLines: number;
}

export type DiffLineType = 'add' | 'del' | 'ctx';

export interface DiffLine {
  type: DiffLineType;
  content: string; // without prefix +/-
  newLineNumber?: number; // only for ctx/add
}