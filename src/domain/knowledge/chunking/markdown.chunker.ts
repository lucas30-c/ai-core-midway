export interface ChunkResult {
  sourcePath: string;
  heading: string | null;
  content: string;
}

const HEADER_RE = /^(#{1,3})\s+(.+)$/gm;
const MAX_CHUNK_SIZE = 1000;

export function chunkMarkdown(sourcePath: string, text: string): ChunkResult[] {
  if (!text.trim()) return [];

  const results: ChunkResult[] = [];
  const matches: Array<{ index: number; heading: string }> = [];

  let m: RegExpExecArray | null;
  while ((m = HEADER_RE.exec(text)) !== null) {
    matches.push({ index: m.index, heading: m[2].trim() });
  }

  if (matches.length === 0) {
    return splitByParagraph(sourcePath, null, text);
  }

  // Content before first heading
  if (matches[0].index > 0) {
    const preamble = text.slice(0, matches[0].index).trim();
    if (preamble) {
      results.push(...splitByParagraph(sourcePath, null, preamble));
    }
  }

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const heading = matches[i].heading;
    // Remove the heading line itself from content
    const headingLineEnd = text.indexOf('\n', start);
    const contentStart = headingLineEnd === -1 ? end : headingLineEnd + 1;
    const body = text.slice(contentStart, end).trim();
    if (body) {
      results.push(...splitByParagraph(sourcePath, heading, body));
    }
  }

  return results;
}

function splitByParagraph(
  sourcePath: string,
  heading: string | null,
  content: string
): ChunkResult[] {
  if (content.length <= MAX_CHUNK_SIZE) {
    return [{ sourcePath, heading, content }];
  }

  const paragraphs = content.split(/\n\n+/);
  const results: ChunkResult[] = [];
  let buffer = '';

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    if (buffer && buffer.length + 1 + trimmed.length > MAX_CHUNK_SIZE) {
      results.push({ sourcePath, heading, content: buffer });
      buffer = trimmed;
    } else {
      buffer = buffer ? buffer + '\n\n' + trimmed : trimmed;
    }
  }

  if (buffer) {
    results.push({ sourcePath, heading, content: buffer });
  }

  return results;
}
