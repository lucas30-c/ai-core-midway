import { EarlyReturnRule } from '../early-return.rule';
import { AnalyzeContext } from '../../rule.types';
import { DiffFile } from '../../../diff/diff.types';
import { DEFAULT_CONFIG } from '../../../config/default.config';

function makeContext(diffFiles: DiffFile[]): AnalyzeContext {
  return {
    diffFiles,
    stats: { filesChanged: diffFiles.length, insertions: 0, deletions: 0 },
    cwd: '/tmp',
    changedFiles: diffFiles
      .map(f => (f.newPath ?? f.oldPath ?? '').replace(/^[ab]\//, ''))
      .filter(Boolean),
    config: DEFAULT_CONFIG,
  };
}

function makeDiffFile(
  newPath: string,
  hunkLines: Array<{ type: 'add' | 'del' | 'ctx'; content: string }>,
  status: 'added' | 'modified' = 'modified'
): DiffFile {
  let newLineNo = 1;
  const lines = hunkLines.map(l => ({
    type: l.type,
    content: l.content,
    newLineNumber: l.type !== 'del' ? newLineNo++ : undefined,
  }));
  return {
    oldPath: status === 'added' ? undefined : newPath,
    newPath,
    status,
    hunks: [
      {
        header: '@@ -0,0 +1,' + lines.length + ' @@',
        lines,
        newStart: 1,
        newLines: lines.length,
      },
    ],
  };
}

describe('EarlyReturnRule', () => {
  const rule = new EarlyReturnRule();

  it('has correct id', () => {
    expect(rule.id).toBe('control-flow:early-return');
  });

  it('detects early return in if-block', () => {
    const file = makeDiffFile('src/service.ts', [
      { type: 'add', content: 'function process(x: number) {' },
      { type: 'add', content: '  if (x < 0) {' },
      { type: 'add', content: '    return null;' },
      { type: 'add', content: '  }' },
      { type: 'add', content: '  return x * 2;' },
    ]);
    const findings = rule.run(makeContext([file]));

    expect(findings.length).toBe(1);
    expect(findings[0].ruleId).toBe('control-flow:early-return');
    expect(findings[0].severity).toBe('MEDIUM');
    expect(findings[0].message).toContain('Early return');
    expect(findings[0].evidence).toContain('if');
    expect(findings[0].evidence).toContain('return null;');
  });

  it('detects return in switch-case', () => {
    const file = makeDiffFile('src/handler.ts', [
      { type: 'add', content: 'switch (action) {' },
      { type: 'add', content: '  case "stop":' },
      { type: 'add', content: '    return false;' },
      { type: 'add', content: '  default:' },
      { type: 'add', content: '    return true;' },
    ]);
    const findings = rule.run(makeContext([file]));

    // "return false" has case context + subsequent add lines → fires
    // "return true" is last add line → does not fire
    expect(findings.length).toBe(1);
    expect(findings[0].range?.start).toBe(3);
  });

  it('ignores return as last add line in hunk (normal function end)', () => {
    const file = makeDiffFile('src/simple.ts', [
      { type: 'add', content: 'function getVal() {' },
      { type: 'add', content: '  const x = compute();' },
      { type: 'add', content: '  return x;' },
    ]);
    const findings = rule.run(makeContext([file]));
    expect(findings).toHaveLength(0);
  });

  it('ignores non-ts files', () => {
    const file = makeDiffFile('src/data.json', [
      { type: 'add', content: '  if (true) {' },
      { type: 'add', content: '    return false;' },
      { type: 'add', content: '  }' },
    ]);
    const findings = rule.run(makeContext([file]));
    expect(findings).toHaveLength(0);
  });

  it('skips deleted files', () => {
    const file: DiffFile = {
      oldPath: 'src/old.ts',
      status: 'deleted',
      hunks: [
        {
          header: '@@ -1,3 +0,0 @@',
          lines: [
            { type: 'del', content: '  if (x) {' },
            { type: 'del', content: '    return;' },
            { type: 'del', content: '  }' },
          ],
          newStart: 0,
          newLines: 0,
        },
      ],
    };
    const findings = rule.run(makeContext([file]));
    expect(findings).toHaveLength(0);
  });

  it('generates deterministic finding IDs', () => {
    const file = makeDiffFile('src/test.ts', [
      { type: 'add', content: '  if (err) {' },
      { type: 'add', content: '    return;' },
      { type: 'add', content: '  }' },
      { type: 'add', content: '  doWork();' },
    ]);
    const findings1 = rule.run(makeContext([file]));
    const findings2 = rule.run(makeContext([file]));

    expect(findings1.map(f => f.id)).toEqual(findings2.map(f => f.id));
  });

  it('requires subsequent add lines after return', () => {
    // Return is the last add, but there's a ctx line after → still last ADD
    const file = makeDiffFile('src/edge.ts', [
      { type: 'add', content: '  if (x) {' },
      { type: 'add', content: '    return;' },
      { type: 'ctx', content: '  }' },
    ]);
    const findings = rule.run(makeContext([file]));
    // return is the last add line in the hunk → skipped
    expect(findings).toHaveLength(0);
  });

  it('detects guard clause pattern', () => {
    const file = makeDiffFile('src/guard.tsx', [
      { type: 'ctx', content: 'function validate(input: string) {' },
      { type: 'add', content: '  if (!input) {' },
      { type: 'add', content: '    return false;' },
      { type: 'add', content: '  }' },
      { type: 'add', content: '  return true;' },
    ]);
    const findings = rule.run(makeContext([file]));
    expect(findings.length).toBe(1);
    expect(findings[0].file).toBe('src/guard.tsx');
  });
});
