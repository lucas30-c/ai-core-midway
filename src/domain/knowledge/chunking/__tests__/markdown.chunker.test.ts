import { chunkMarkdown } from '../markdown.chunker';

describe('chunkMarkdown', () => {
  it('splits by markdown headers', () => {
    const md = `# Intro
Some intro text.

## Section A
Content of section A.

## Section B
Content of section B.
`;
    const chunks = chunkMarkdown('docs/test.md', md);
    expect(chunks.length).toBe(3);
    expect(chunks[0]).toEqual({
      sourcePath: 'docs/test.md',
      heading: 'Intro',
      content: 'Some intro text.',
    });
    expect(chunks[1].heading).toBe('Section A');
    expect(chunks[2].heading).toBe('Section B');
  });

  it('falls back to paragraph splitting when no headers', () => {
    const md = `First paragraph here.

Second paragraph here.

Third paragraph here.`;
    const chunks = chunkMarkdown('file.md', md);
    expect(chunks.length).toBe(1);
    expect(chunks[0].heading).toBeNull();
    expect(chunks[0].content).toContain('First paragraph');
    expect(chunks[0].content).toContain('Third paragraph');
  });

  it('splits large chunks by paragraph boundary', () => {
    const longParagraph = 'A'.repeat(600);
    const md = `# Title\n${longParagraph}\n\n${'B'.repeat(600)}`;
    const chunks = chunkMarkdown('big.md', md);
    expect(chunks.length).toBe(2);
    expect(chunks[0].content.length).toBeLessThanOrEqual(1000);
    expect(chunks[1].content.length).toBeLessThanOrEqual(1000);
  });

  it('handles content before first heading', () => {
    const md = `Preamble text here.

# Heading
Content after heading.`;
    const chunks = chunkMarkdown('pre.md', md);
    expect(chunks.length).toBe(2);
    expect(chunks[0].heading).toBeNull();
    expect(chunks[0].content).toBe('Preamble text here.');
    expect(chunks[1].heading).toBe('Heading');
  });

  it('handles h3 headers', () => {
    const md = '### Deep heading\nSome content.';
    const chunks = chunkMarkdown('h3.md', md);
    expect(chunks.length).toBe(1);
    expect(chunks[0].heading).toBe('Deep heading');
  });

  it('returns empty array for empty content', () => {
    const chunks = chunkMarkdown('empty.md', '');
    expect(chunks).toEqual([]);
  });

  it('returns empty array for whitespace-only content', () => {
    const chunks = chunkMarkdown('ws.md', '   \n\n  ');
    expect(chunks).toEqual([]);
  });
});
