# Spec: Local Knowledge Base (RAG) + LLM Enrichment — Phase 2

## Goal

Upgrade the Phase 1 deterministic report into an "engineering-grade semantic report" by adding:

1. **Framework-agnostic LLM provider core** — usable by CLI and Midway
2. **Local KB indexing & retrieval** — SQLite + FTS5, embeddings optional
3. **LLM-based ImpactAnalysis enrichment** — LLM improves wording/checklists only, never overwrites deterministic truth

Phase 2 MUST be backward compatible with Phase 1:

- `schemaVersion` stays **"2.0.0"**
- Phase 2 adds **OPTIONAL** fields only
- Default behavior remains deterministic if no flags/env are provided

---

## Non-goals

- No external/company KB integration in Phase 2
- No web search — only local KB dirs from user repo
- No changing risk calculation policy introduced in Phase 1
- No streaming LLM responses for Phase 2 enrichment

---

## Part A — LLM Provider Refactoring

### Hard Constraint

Files under `src/core/llm/core/*` **MUST NOT** import `@midwayjs/*` or any Midway decorators.

### A.1 New Files

| File | Purpose |
|------|---------|
| `src/core/llm/core/llm-config.types.ts` | Provider configuration types |
| `src/core/llm/core/openai-compatible.provider.ts` | Framework-agnostic OpenAI-compatible provider |
| `src/core/llm/core/mock.provider.ts` | Mock provider for tests |
| `src/core/llm/core/llm.factory.ts` | Factory to create providers |
| `src/cli/adapters/llm/llm.adapter.ts` | CLI adapter for LLM initialization |

### A.2 Type Definitions

**IMPORTANT:** Reuse existing `LlmProvider` interface from `src/core/llm/llm.types.ts`. Do NOT create a separate `CoreLlmProvider` interface.

```ts
// Existing types in src/core/llm/llm.types.ts (DO NOT DUPLICATE)
export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  model?: string;
}

export interface ChatResult {
  text: string;
  usage?: any;
  model: string;
  fallbackUsed: boolean;
}

export interface LlmProvider {
  name: string;
  chat(messages: ChatMessage[], opts?: ChatOptions): Promise<ChatResult>;
  chatStream(
    messages: ChatMessage[],
    opts: ChatOptions & { onToken: (t: string) => void }
  ): Promise<{ model: string; fallbackUsed: boolean }>;
}
```

```ts
// NEW: src/core/llm/core/llm-config.types.ts (config only, no new provider interface)

export interface LlmProviderConfig {
  provider: 'openai-compatible' | 'mock';
  baseUrl: string;           // WITHOUT /v1 suffix (e.g. "https://api.openai.com")
  apiKey: string;
  model: string;
  fallbackModel?: string;
  temperature?: number;      // default 0.3
  maxTokens?: number;        // default 2048
  timeout?: number;          // default 30000ms
}
```

### A.3 openai-compatible.provider.ts Requirements

1. Uses global `fetch` (Node 18+)
2. **Implements `LlmProvider` interface** (existing interface, not a new one)
3. Accepts `LlmProviderConfig`
4. Calls OpenAI-compatible endpoint:
   - `POST {baseUrl}/v1/chat/completions`
   - **baseUrl convention:** MUST NOT contain `/v1` suffix
   - Provider internally appends `/v1/chat/completions`
   - Example: `baseUrl = "https://api.openai.com"` → `POST https://api.openai.com/v1/chat/completions`
   - Headers:
     - `Authorization: Bearer ${apiKey}`
     - `Content-Type: application/json`
5. Must support response parsing for common OpenAI-compatible formats
6. Errors throw plain `Error` with useful message, **no Midway AppError dependency**
7. `chatStream` can throw `Error('Not implemented')` for Phase 2 (enrichment uses `chat` only)
#### Base URL Normalization (MUST)

To avoid user misconfiguration (e.g. passing a baseUrl ending with `/v1`), the provider MUST normalize baseUrl before building endpoint URLs:

- If `baseUrl` ends with `/v1` or `/v1/`, strip it.
- Always call `POST {normalizedBaseUrl}/v1/chat/completions`.

Example normalization:

```ts
function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/v1\/?$/, '');
}

const base = normalizeBaseUrl(config.baseUrl);
const url = `${base}/v1/chat/completions`;

```ts
// Response format to parse
interface OpenAIResponse {
  id: string;
  choices: Array<{
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
```

### A.4 mock.provider.ts

```ts
// Returns deterministic responses for testing
// Implements existing LlmProvider interface
export class MockLlmProvider implements LlmProvider {
  name = 'mock';

  async chat(messages: ChatMessage[], opts?: ChatOptions): Promise<ChatResult> {
    return {
      text: JSON.stringify({
        summary: 'Mock LLM summary',
        riskExplanations: [],
        additionalChecklist: ['Mock checklist item']
      }),
      model: 'mock',
      fallbackUsed: false,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    };
  }

  async chatStream(): Promise<{ model: string; fallbackUsed: boolean }> {
    throw new Error('MockLlmProvider does not support streaming');
  }
}
```

### A.5 llm.factory.ts

```ts
import { LlmProvider } from '../llm.types';

export function createLlmProvider(config: LlmProviderConfig): LlmProvider {
  switch (config.provider) {
    case 'openai-compatible':
      return new OpenAICompatibleProvider(config);
    case 'mock':
      return new MockLlmProvider();
    default:
      throw new Error(`Unknown LLM provider: ${config.provider}`);
  }
}
```

### A.6 Midway Wrapper Update (openrouter.provider.ts)

Convert existing Midway provider to thin delegate:

1. Keep Midway decorators (`@Provide`, `@Init`, `@Config`)
2. Instantiate core provider in `onModuleInit`
3. Delegate `chat`/`chatStream` to core

### A.7 CLI LLM Adapter

```ts
// src/cli/adapters/llm/llm.adapter.ts
import { LlmProvider } from '../../../core/llm/llm.types';

export interface LlmAdapterOptions {
  llmOff?: boolean;
  llmProvider?: string;
  llmModel?: string;
  llmBaseUrl?: string;
  llmApiKey?: string;
}

export function initLlmProvider(opts: LlmAdapterOptions): LlmProvider | null {
  // 1. If llmOff => return null
  // 2. Load config from env
  // 3. Apply CLI overrides
  // 4. If missing apiKey OR missing model => return null (graceful)
  // 5. Return createLlmProvider(config)
}
```

**Environment Variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `TECH_DEBT_LLM_PROVIDER` | `openai-compatible` | Provider type |
| `TECH_DEBT_LLM_MODEL` | (required if LLM enabled) | Model name |
| `TECH_DEBT_LLM_BASE_URL` | `https://openrouter.ai/api` | API base URL (**WITHOUT /v1**) |
| `TECH_DEBT_LLM_API_KEY` | (required if LLM enabled) | API key |

**IMPORTANT:** `baseUrl` must NOT contain `/v1` suffix. Provider internally appends `/v1/chat/completions`.

---

## Part B — Local Knowledge Base (SQLite + FTS5 + Optional Embeddings)

### B.1 User Experience

```bash
tech-debt analyze --git-range origin/main..HEAD --cwd . --kb-dir ./docs --kb-dir ./adr
```

Tool writes indexing data under:
- `${cwd}/.tech-debt/kb.sqlite`
- `${cwd}/.tech-debt/meta.json`

### B.2 New Files

| File | Purpose |
|------|---------|
| `src/domain/knowledge/kb.types.ts` | Type definitions |
| `src/domain/knowledge/kb.storage.ts` | SQLite database operations |
| `src/domain/knowledge/kb.indexer.ts` | Incremental file indexing |
| `src/domain/knowledge/kb.retriever.ts` | Search/retrieval logic |
| `src/domain/knowledge/chunking/markdown.chunker.ts` | Markdown splitting |
| `src/domain/knowledge/embedding/embedding.client.ts` | Embeddings API client |
| `src/domain/knowledge/embedding/mock.embedder.ts` | Mock embedder for tests |
| `src/domain/knowledge/meta.manager.ts` | meta.json management |
| `src/domain/knowledge/providers/local.provider.ts` | Local KB provider |
| `src/cli/adapters/kb/kb.adapter.ts` | CLI KB initialization |

### B.3 Type Definitions

```ts
// src/domain/knowledge/kb.types.ts

/**
 * Internal storage row (DB layer only)
 * Contains fields needed for incremental indexing
 */
export interface DbChunkRow {
  id: number;
  source_path: string;
  heading: string | null;
  content: string;
  hash: string;
  updated_at: string;
}

/**
 * External output type (for retrieval results and report output)
 * Lightweight, does NOT expose internal fields (hash/updatedAt)
 */
export interface KnowledgeChunk {
  id: number;
  sourcePath: string;
  heading: string | null;
  content: string;
  score?: number;  // optional: relevance score (only for search results)
}

export interface KnowledgeMeta {
  version: '1.0';
  kbDirs: string[];
  kbGlob: string;
  lastIndexedAt: string;
  fileHashes: Record<string, string>;  // path -> "sha256:..."
}

export interface KbSearchOptions {
  topK?: number;  // default 8
}

/**
 * KnowledgeProvider interface
 * - initialize(): async setup (indexing happens here)
 * - isAvailable(): check if provider is ready
 * - search(): retrieve relevant chunks
 */
export interface KnowledgeProvider {
  type: 'local';
  initialize(): Promise<void>;
  isAvailable(): boolean;
  search(query: string, options?: KbSearchOptions): Promise<KnowledgeChunk[]>;
  close(): void;
}

export interface EmbeddingClient {
  embed(texts: string[]): Promise<Float32Array[] | null>;
}
```

### KnowledgeProvider Availability Contract (MUST)

- `initialize()` MUST NOT crash the analyze flow.
  - On failure (e.g. SQLite cannot be created), it may `console.error` a warning,
    then mark itself unavailable and continue.
- `isAvailable()` MUST return:
  - `true` only if DB is initialized and ready for `search()`
  - `false` if initialize failed or provider is disabled
- If `isAvailable()` is false, the executor MUST skip retrieval and proceed deterministically.

### B.4 Storage Schema (Idempotent Init)

```sql
-- Chunks table
CREATE TABLE IF NOT EXISTS chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_path TEXT NOT NULL,
  heading TEXT,
  content TEXT NOT NULL,
  hash TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chunks_source ON chunks(source_path);
CREATE INDEX IF NOT EXISTS idx_chunks_hash ON chunks(hash);

-- FTS5 virtual table (content synced from chunks)
CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
  content, heading, content='chunks', content_rowid='id'
);

-- Optional embeddings table
CREATE TABLE IF NOT EXISTS embeddings (
  chunk_id INTEGER PRIMARY KEY REFERENCES chunks(id) ON DELETE CASCADE,
  vector BLOB NOT NULL,
  model TEXT NOT NULL
);
```

### B.4.1 FTS5 Sync Triggers (MUST)

FTS5 does NOT automatically stay in sync with the `chunks` table just by declaring `content='chunks'`.
We MUST create triggers to keep `chunks_fts` consistent on insert/update/delete.

The following triggers MUST be created during DB init (idempotent):

```sql
-- Insert trigger
CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
  INSERT INTO chunks_fts(rowid, content, heading)
  VALUES (new.id, new.content, new.heading);
END;

-- Delete trigger
CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
  INSERT INTO chunks_fts(chunks_fts, rowid, content, heading)
  VALUES ('delete', old.id, old.content, old.heading);
END;

-- Update trigger (delete old row then insert new)
CREATE TRIGGER IF NOT EXISTS chunks_au AFTER UPDATE ON chunks BEGIN
  INSERT INTO chunks_fts(chunks_fts, rowid, content, heading)
  VALUES ('delete', old.id, old.content, old.heading);
  INSERT INTO chunks_fts(rowid, content, heading)
  VALUES (new.id, new.content, new.heading);
END;

### B.5 Embedding BLOB Format (Mandatory)

- Store vectors as `Float32Array` raw buffer in SQLite BLOB
- **Never JSON serialize vectors**

```ts
// Encoding
function encodeVector(vec: Float32Array): Buffer {
  return Buffer.from(vec.buffer);
}

// Decoding (with validation)
function decodeVector(blob: Buffer): Float32Array | null {
  // MUST validate: byteLength divisible by 4
  // If not, treat as corrupted and return null (fallback to FTS5)
  if (blob.length % 4 !== 0) {
    return null;  // corrupted, ignore this embedding row
  }
  return new Float32Array(blob.buffer, blob.byteOffset, blob.length / 4);
}
```

**Corruption handling:** If `decodeVector` returns `null`, skip this embedding row and fall back to FTS5 for that chunk.

#### Encoding/Decoding (MUST)

When encoding, MUST respect `byteOffset`/`byteLength` (Float32Array may be a view):

```ts
// Encoding (MUST respect byteOffset/byteLength)
function encodeVector(vec: Float32Array): Buffer {
  return Buffer.from(vec.buffer, vec.byteOffset, vec.byteLength);
}

// Decoding (with validation)
function decodeVector(blob: Buffer): Float32Array | null {
  if (blob.length % 4 !== 0) return null;
  return new Float32Array(blob.buffer, blob.byteOffset, blob.length / 4);
}

### B.6 meta.json Format

```json
{
  "version": "1.0",
  "kbDirs": ["./docs", "./adr"],
  "kbGlob": "**/*.md",
  "lastIndexedAt": "2026-02-25T10:30:00.000Z",
  "fileHashes": {
    "docs/arch.md": "sha256:abc123...",
    "docs/api.md": "sha256:def456..."
  }
}
```

### B.7 Indexing Rules (Incremental)

1. Resolve `kb-dir` paths relative to `cwd`, **not** `process.cwd()`
2. Scan files matching `kbGlob` within each `kb-dir`
3. Hash each file content (SHA256)
4. If file hash unchanged, **skip**
5. For changed/new files:
   - Delete existing chunks by `source_path`
   - Chunk markdown into sections
   - Insert chunks
   - Update FTS table accordingly (via `content=chunks` mechanism)
6. **Deleted file detection:**
   - After scanning completes, compare current scan results with `meta.fileHashes`
   - Paths present in `meta.fileHashes` but NOT found in current scan are **deleted files**
   - For each deleted file path:
     - `DELETE FROM chunks WHERE source_path = ?`
     - Remove entry from `meta.fileHashes`
7. Update `meta.json` with new `fileHashes` and `lastIndexedAt`

**IMPORTANT:** Never index `node_modules`

**Path & Glob Matching Rules (MUST):**
- All scanned file paths MUST be normalized to POSIX (`/`) before applying `kbGlob` matching.
- `kbGlob` matching MUST use the same glob engine as other parts of the repo (recommended: `minimatch`).
- `kbGlob` is applied to the file path relative to `cwd` (POSIX form), e.g. `docs/arch.md`.
- MUST ignore any path containing `/node_modules/` (hard skip), even if glob matches.

### B.8 Chunking (markdown.chunker.ts)

**Header-based splitting:**

```ts
// Regex pattern for headers
const HEADER_RE = /^(#{1,3})\s+(.+)$/gm;
```

**Chunking rules:**

1. Split on headings `^(#{1,3})\s+(.+)$` (multiline)
2. Each chunk contains:
   - `sourcePath`
   - `heading` (nullable)
   - `content`
3. **Max size:** 1000 chars
4. If exceeded, split by paragraph boundary (`\n\n`)
5. If no headings, split by `\n\n`

```ts
export interface ChunkResult {
  sourcePath: string;
  heading: string | null;
  content: string;
}

export function chunkMarkdown(sourcePath: string, content: string): ChunkResult[];
```

### B.9 Retrieval (kb.retriever.ts)

**API:**

```ts
search(query: string, options?: { topK?: number }): Promise<KnowledgeChunk[]>
```

**Retrieval Strategy:**

1. **If embeddings enabled AND embeddings table has rows:**
   - Compute query embedding
   - Cosine similarity with stored vectors
   - Return topK (higher similarity = more relevant)

2. **Else fallback to FTS5:**
   - Build FTS query from input:
     - Split by non-word characters
     - Drop tokens < 3 chars
     - Remove stopwords (hardcoded set)
     - Cap at 8 tokens
     - Join with `OR`
   - Query:

```sql
SELECT c.id, c.source_path, c.heading, c.content
FROM chunks_fts f
JOIN chunks c ON c.id = f.rowid
WHERE chunks_fts MATCH ?
ORDER BY bm25(chunks_fts) ASC  -- SQLite FTS5: more negative = more relevant
LIMIT ?
```

**Score Semantics (IMPORTANT):**

| Source | Raw Score | Convention in KnowledgeChunk.score |
|--------|-----------|-----------------------------------|
| FTS5 bm25() | More negative = better | **Do NOT expose** raw bm25 score to output |
| Embeddings cosine | Higher = better | Can expose if needed |

**Recommendation:** `KnowledgeChunk.score` is optional and used for **ordering only**. Do NOT include score in `retrievedKnowledge` output to avoid consumer confusion. Results are already sorted by relevance.

**Stopwords (hardcoded set):**

```ts
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
  'this', 'that', 'these', 'those', 'it', 'its'
]);
```

### B.10 Embeddings Client Behavior

**Disabled by default:**

- If `TECH_DEBT_EMBEDDINGS_MODEL` empty => never call embeddings endpoint

**One attempt, no retries:**

- On error/non-200/timeout => return `null` => fallback to FTS5

**Environment Variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `TECH_DEBT_EMBEDDINGS_BASE_URL` | `= TECH_DEBT_LLM_BASE_URL` | Embeddings API URL |
| `TECH_DEBT_EMBEDDINGS_MODEL` | (empty = disabled) | Embeddings model name |
| `TECH_DEBT_EMBEDDINGS_API_KEY` | `= TECH_DEBT_LLM_API_KEY` | API key (can reuse) |

---

## Part C — LLM Impact Enrichment (Safe Merge)

### C.1 New File

`src/domain/analyze/impact/impact.enricher.ts`

### C.2 Input

- `deterministic: ImpactAnalysis` — from Phase 1 builder
- `diffSummary: string` — deterministic string derived from stats + touched areas + risk points
- `chunks: KnowledgeChunk[]` — topK results from KB
- `llm: LlmProvider` — LLM provider instance (existing interface)

### C.3 Output (JSON only from LLM)

Expected JSON structure from LLM:

```ts
interface LlmEnrichmentResponse {
  summary: string;
  riskExplanations: Array<{
    riskType: string;      // e.g. "boundary-violation"
    explanation: string;
  }>;
  additionalChecklist: string[];
}
```

### C.4 Prompt Contract

**System prompt:**

```
You are a senior tech lead reviewing code changes. Output JSON only, no markdown, no extra text.
```

**Requirements:**

- Temperature: `<= 0.3`
- Provide the deterministic impact + KB chunks + explicit JSON schema in user message

**Token Limits (MANDATORY to prevent token overflow):**

| Content | Limit |
|---------|-------|
| Each KB chunk content | **Truncate to 500 chars** |
| Total KB context | **Cap at 3000 chars** (stop adding chunks once exceeded) |
| Diff summary | No truncation (already deterministic and bounded) |

**User message template:**

```
## Diff Summary
{diffSummary}

## Deterministic Impact Analysis
{JSON.stringify(deterministicImpact)}

## Relevant Knowledge
{truncatedChunks.map(c => `### ${c.heading ?? 'Untitled'}\n${truncate(c.content, 500)}`).join('\n\n')}

## Task
Generate a JSON response with this exact structure:
{
  "summary": "A concise summary of the impact (1-2 sentences)",
  "riskExplanations": [
    { "riskType": "boundary-violation", "explanation": "Why this is risky" }
  ],
  "additionalChecklist": ["Additional regression test items"]
}
```

**Truncation helper:**

```ts
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + '…';
}
```

### C.5 Merge Strategy (MUST NOT Override Truth)

| Field | Merge Rule |
|-------|------------|
| `impact.summary` | Replace with LLM summary **if valid** |
| `impact.regressionChecklist` | **Append** `additionalChecklist` (dedupe, cap 7 total) |
| `impact.touchedAreas` | **DO NOT CHANGE** |
| `impact.riskPoints` | **DO NOT CHANGE** |

### C.6 Report Fields

- Save LLM output into `report.llmDraft` (optional) including model name
- Save KB topK into `report.retrievedKnowledge` (optional)

### C.7 Failure Handling

- Invalid JSON => **ignore**, keep deterministic impact
- LLM call error => **ignore**, keep deterministic impact
- **Always produce a valid report**

```ts
export async function enrichImpact(
  impact: ImpactAnalysis,
  diffSummary: string,
  chunks: KnowledgeChunk[],
  llm: LlmProvider
): Promise<{
  enrichedImpact: ImpactAnalysis;
  llmDraft: LlmDraft | null;
}>;
```

### LLM JSON Parsing (MUST, Controlled Tolerance)

LLM output may include code fences or extra text. Parsing MUST follow this strict order:

1. Try `JSON.parse(text)` directly.
2. If fails, try extracting the first top-level JSON object substring and parse:
   - Find the first `{` and the last `}` and parse that substring.
   - If multiple objects exist, only consider the outermost `{...}`.
3. If still fails, treat as invalid and ignore (fallback to deterministic impact).

Security:
- MUST NOT use `eval`
- MUST NOT parse YAML
- MUST NOT execute any code

This guarantees robustness without accepting arbitrary formats.

---

## CLI UX (Phase 2)

### New Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--kb-dir <path>` | (none) | Knowledge base directory (repeatable) |
| `--kb-glob <pattern>` | `"**/*.md"` | Files to index within each kb-dir |
| `--kb-off` | false | Disable KB even if `--kb-dir` is set (useful for scripts) |
| `--llm-off` | false | Disable LLM enrichment |
| `--llm-provider <name>` | from env | `openai-compatible` or `mock` |
| `--llm-model <name>` | from env | Model override |
| `--llm-base-url <url>` | from env | Base URL override (**without /v1**) |
| `--llm-api-key <key>` | from env | API key override |

### Degradation Rules (Must Never Crash)

| Condition | Behavior |
|-----------|----------|
| No `--kb-dir` or `--kb-off` | Skip KB entirely |
| `--kb-dir` but no embeddings env | Use FTS5 only |
| Embedding request fails | Fallback to FTS5 (single attempt) |
| No API key or `--llm-off` | Skip LLM enrichment |
| LLM request fails | Keep deterministic ImpactAnalysis |

**Priority:** `--kb-off` takes highest priority (skips KB even if `--kb-dir` provided)

---

## Output Schema (Still "2.0.0")

### RetrievedKnowledge Output Rules (MUST)

- `retrievedKnowledge.chunks` MUST be derived from `KnowledgeProvider.search()` results (already relevance-sorted).
- Each output chunk MUST be mapped as:
  - `sourcePath`: from result
  - `heading`: from result
  - `excerpt`: `formatExcerpt(result.content, 200)` (whitespace-collapsed, single-line)
- The number of output chunks MUST be capped by `topK` (default 8).
- Do NOT include raw `score` in `retrievedKnowledge` output to avoid consumer confusion.

### Wrapper (Unchanged)

```ts
{
  schemaVersion: "2.0.0",
  engine: { name: string, version: string },
  analysis: ReportModel
}
```

### ReportModel (Phase 2 Additions)

```ts
export interface ReportModel {
  schemaVersion: "2.0.0";
  generatedAt: string;
  summary: {
    risk: string;
    filesChanged: number;
    insertions: number;
    deletions: number;
    findingsCount: number;
  };
  items: ReportItem[];
  impact?: ImpactAnalysis;  // Phase 1

  // Phase 2 additions (optional)
  retrievedKnowledge?: {
    provider: string;                    // e.g. "local"
    chunks: RetrievedKnowledgeChunk[];   // lightweight output format
  };

  llmDraft?: {
    model: string;
    summary: string;
    riskExplanations: Array<{ riskType: string; explanation: string }>;
    additionalChecklist: string[];
  };
}

/**
 * Lightweight chunk for report output (no internal fields like hash/updatedAt)
 */
export interface RetrievedKnowledgeChunk {
  sourcePath: string;
  heading: string | null;
  excerpt: string;  // truncated content (max 200 chars)
}
```

---

## Renderer Updates

### Markdown Renderer

Add optional section (only if `retrievedKnowledge` exists):

```markdown
## Retrieved Knowledge

| Source | Heading | Excerpt |
|--------|---------|---------|
| docs/arch.md | Architecture | First 200 chars... |
```

**Excerpt Truncation Rules:**

1. Collapse multiple whitespace/newlines to single space
2. Trim leading/trailing whitespace
3. If length > 200 chars, truncate and append `…`
4. Never show raw `\n` in table cell

```ts
function formatExcerpt(content: string, maxLen = 200): string {
  const collapsed = content.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= maxLen) return collapsed;
  return collapsed.slice(0, maxLen - 1) + '…';
}
```

**Note:** Do not show `llmDraft` raw JSON; only use it to generate better `impact.summary` and checklist.

### JSON Renderer

- Wrapper `schemaVersion` MUST be `"2.0.0"`
- `analysis.schemaVersion` MUST be `"2.0.0"`
- Optional fields appear only when present

---

## Architecture Overview

### High-Level Flow (Analyze Executor)

```
1. loadConfig (existing)
2. resolveDiffSource (existing)
3. initKbProvider (NEW; only if --kb-dir provided AND not --kb-off)
   └─ provider.initialize() handles indexing internally
4. initLlmProvider (NEW; only if API key exists AND not --llm-off)
5. analyze service:
   a. run deterministic tools + rules (existing)
   b. build deterministic ImpactAnalysis (Phase 1)
   c. if kbProvider?.isAvailable(): retrieve topK chunks via provider.search()
   d. if llmProvider available: enrich ImpactAnalysis summary/checklist
6. render report (markdown/json) with optional KB + LLM sections
7. kbProvider?.close() (cleanup SQLite connection)
8. exit code policy unchanged
```

---

## Tests & Acceptance

### Unit Tests (Phase 2)

| Test File | Coverage |
|-----------|----------|
| `openai-compatible.provider.test.ts` | Mock fetch, parse response, error handling |
| `llm.factory.test.ts` | Provider selection, mock mode |
| `markdown.chunker.test.ts` | Headers, paragraph fallback, max chunk |
| `kb.storage.test.ts` | Schema init, insert/delete, FTS query, embeddings blob roundtrip |
| `kb.indexer.test.ts` | Incremental indexing with meta hashes, multi-dir, deleted file |
| `kb.retriever.test.ts` | FTS query builder, topK limit, embedding path (mocked) |
| `impact.enricher.test.ts` | Strict JSON parsing, merge strategy, failure fallback |
| `analyze.executor.test.ts` | End-to-end with mock KB + mock LLM |

### Acceptance Script (Manual)

1. Create a small repo under `/tmp`:
   - `docs/` contains 1-2 markdown files
   - Code change triggers boundary violation

2. Run:
```bash
TECH_DEBT_LLM_API_KEY=xxx TECH_DEBT_LLM_MODEL=... \
TECH_DEBT_EMBEDDINGS_MODEL="" \
node dist/cli/index.js analyze --git-range HEAD~1..HEAD --cwd /tmp/repo --kb-dir ./docs --format json
```

3. Expect:
   - `schemaVersion` = `"2.0.0"`
   - `analysis.impact` exists
   - `retrievedKnowledge` exists (FTS5)
   - `llmDraft` exists if LLM key provided
   - `impact.summary` is enriched (not the deterministic template)

---

## Implementation Constraints

1. **Do not introduce new heavy dependencies** — use `better-sqlite3` already present
2. **All paths must resolve from `--cwd`**
3. **Never index `node_modules`**
4. **Never crash on missing configs / keys**
5. **Core LLM files must not import Midway**

---

## Deliverables

### New Files

| Path | Description |
|------|-------------|
| `src/core/llm/core/llm-config.types.ts` | LLM config types |
| `src/core/llm/core/openai-compatible.provider.ts` | OpenAI-compatible provider |
| `src/core/llm/core/mock.provider.ts` | Mock provider |
| `src/core/llm/core/llm.factory.ts` | Provider factory |
| `src/cli/adapters/llm/llm.adapter.ts` | CLI LLM adapter |
| `src/domain/knowledge/kb.types.ts` | KB types |
| `src/domain/knowledge/kb.storage.ts` | SQLite storage |
| `src/domain/knowledge/kb.indexer.ts` | File indexer |
| `src/domain/knowledge/kb.retriever.ts` | Search retriever |
| `src/domain/knowledge/chunking/markdown.chunker.ts` | Markdown chunker |
| `src/domain/knowledge/embedding/embedding.client.ts` | Embeddings client |
| `src/domain/knowledge/embedding/mock.embedder.ts` | Mock embedder |
| `src/domain/knowledge/meta.manager.ts` | meta.json manager |
| `src/domain/knowledge/providers/local.provider.ts` | Local KB provider |
| `src/cli/adapters/kb/kb.adapter.ts` | CLI KB adapter |
| `src/domain/analyze/impact/impact.enricher.ts` | Impact enricher |

### Modified Files

| Path | Changes |
|------|---------|
| `src/core/llm/providers/openrouter.provider.ts` | Delegate to core provider |
| `src/domain/analyze/report/report.model.ts` | Add optional Phase 2 fields |
| `src/domain/analyze/report/renderers/markdown.renderer.ts` | Add KB section |
| `src/modules/analyze/analyze.service.ts` | Integrate KB + LLM enrichment |
| `src/cli/commands/analyze.command.ts` | Add new CLI flags |

### Test Files

| Path |
|------|
| `src/core/llm/core/__tests__/openai-compatible.provider.test.ts` |
| `src/core/llm/core/__tests__/llm.factory.test.ts` |
| `src/domain/knowledge/__tests__/kb.storage.test.ts` |
| `src/domain/knowledge/__tests__/kb.indexer.test.ts` |
| `src/domain/knowledge/__tests__/kb.retriever.test.ts` |
| `src/domain/knowledge/chunking/__tests__/markdown.chunker.test.ts` |
| `src/domain/analyze/impact/__tests__/impact.enricher.test.ts` |

---

## Verification Checklist

- [ ] All unit tests pass
- [ ] TypeScript compiles without errors
- [ ] Lint passes
- [ ] Manual acceptance test passes with mock LLM
- [ ] Manual acceptance test passes with real LLM (if API key available)
- [ ] KB indexing creates `.tech-debt/kb.sqlite` and `meta.json`
- [ ] Incremental indexing skips unchanged files
- [ ] FTS5 search returns relevant chunks
- [ ] LLM enrichment merges without overwriting deterministic fields
- [ ] Report degrades gracefully when KB/LLM unavailable
