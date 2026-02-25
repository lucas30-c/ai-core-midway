# Phase 2 Engineering Spec — Local KB (RAG) + LLM Enrichment

## Goal
Upgrade the Phase 1 deterministic report into an “engineering-grade semantic report” by adding:
1) framework-agnostic LLM provider core (usable by CLI and Midway),
2) local KB indexing & retrieval (SQLite + FTS5, embeddings optional),
3) LLM-based ImpactAnalysis enrichment (LLM improves wording/checklists only, never overwrites deterministic truth).

Phase 2 MUST be backward compatible with Phase 1:
- schemaVersion stays **"2.0.0"**
- Phase 2 adds OPTIONAL fields only
- Default behavior remains deterministic if no flags/env are provided

---

## Non-goals
- No external/company KB integration in Phase 2.
- No web search. Only local KB dirs from user repo.
- No changing risk calculation policy introduced in Phase 1.

---

## CLI UX (Phase 2)

### New flags
- `--kb-dir <path>` (repeatable): knowledge base directories inside the target repo.
  Example: `--kb-dir ./docs --kb-dir ./adr`
- `--kb-glob <pattern>` default `"**/*.md"`: which files to index within each kb-dir.
- `--llm-off`: disable LLM enrichment even if API key exists.
- `--llm-provider <name>` optional: default from env. For Phase 2, support at least:
  - `openai-compatible`
  - `mock` (tests)
- `--llm-model <name>` optional override
- `--llm-base-url <url>` optional override (OpenAI-compatible base URL)
- `--llm-api-key <key>` optional override (otherwise from env)

### Env vars
Chat completion:
- `TECH_DEBT_LLM_PROVIDER` default `openai-compatible`
- `TECH_DEBT_LLM_MODEL` (required if LLM enabled)
- `TECH_DEBT_LLM_BASE_URL` default `https://openrouter.ai/api/v1`
- `TECH_DEBT_LLM_API_KEY`

Embeddings (optional; disabled by default):
- `TECH_DEBT_EMBEDDINGS_BASE_URL` default = `TECH_DEBT_LLM_BASE_URL` if set
- `TECH_DEBT_EMBEDDINGS_MODEL` default empty => embeddings disabled
- `TECH_DEBT_EMBEDDINGS_API_KEY` default = `TECH_DEBT_LLM_API_KEY` if set (optional; can reuse same key)

### Degradation rules (must never crash)
- No `--kb-dir` => skip KB.
- `--kb-dir` but no embeddings env => use FTS5 only.
- Embedding request fails => fallback to FTS5 (single attempt, fail fast).
- No API key or `--llm-off` => skip LLM.
- LLM request fails => keep deterministic ImpactAnalysis.

---

## Output Schema (still "2.0.0")

### Wrapper (unchanged)
```ts
{
  schemaVersion: "2.0.0",
  engine: { name: string, version: string },
  analysis: ReportModel
}

ReportModel (Phase 2 adds optional fields)
export interface ReportModel {
  schemaVersion: "2.0.0";
  generatedAt: string;
  summary: { risk: string; filesChanged: number; insertions: number; deletions: number; findingsCount: number };
  items: ReportItem[];
  impact?: ImpactAnalysis; // already in Phase 1

  // Phase 2 additions (optional)
  retrievedKnowledge?: {
    provider: string;         // e.g. "local"
    chunks: KnowledgeChunk[]; // topK results
  };

  llmDraft?: {
    model: string;
    summary: string;
    riskExplanations: Array<{ riskType: string; explanation: string }>;
    additionalChecklist: string[];
  };
}
Architecture Overview
High-level flow (Analyze Executor)

loadConfig (existing)

resolveDiffSource (existing)

initKbProvider (NEW; only if --kb-dir provided)

initLlmProvider (NEW; only if API key exists AND not --llm-off)

analyze service:

run deterministic tools + rules (existing)

build deterministic ImpactAnalysis (Phase 1)

if kbProvider available: retrieve topK chunks

if llmProvider available: enrich ImpactAnalysis summary/checklist (do not overwrite truth)

render report (markdown/json) with optional KB + LLM sections

exit code policy unchanged

Part A — LLM Provider Refactoring
Hard constraint

Files under src/core/llm/core/* MUST NOT import @midwayjs/* or any Midway decorators.

New files

src/core/llm/core/llm-config.types.ts

src/core/llm/core/openai-compatible.provider.ts

src/core/llm/core/mock.provider.ts

src/core/llm/core/llm.factory.ts

src/cli/adapters/llm/llm.adapter.ts

LlmProvider interface (existing)

Use existing src/core/llm/llm.types.ts interface; do not break Midway usage.

openai-compatible.provider.ts requirements

Uses global fetch (Node 18+).

Implements chat() (non-stream is enough for Phase 2 enrichment).

Accepts { baseUrl, apiKey, model, fallbackModel? }.

Calls OpenAI-compatible endpoint:

POST {baseUrl}/v1/chat/completions

Headers:

Authorization: Bearer ${apiKey}

Content-Type: application/json

Must support response parsing for common OpenAI-compatible formats.

Errors throw plain Error with useful message, no Midway AppError dependency.

openrouter.provider.ts (existing Midway wrapper)

Convert to thin delegate:

Keep Midway decorators (@Provide, @Init, @Config)

Instantiate core provider in onModuleInit

Delegate chat/chatStream to core

CLI LLM init adapter

initLlmProvider(opts):

if opts.llmOff => null

load config from env

apply CLI overrides

if missing apiKey OR missing model => return null (graceful)

return createLlmProvider(config)

Part B — Local Knowledge Base (SQLite + FTS5 + optional embeddings)
User experience requirement

User runs in their repo:

tech-debt analyze --git-range origin/main..HEAD --cwd . --kb-dir ./docs --kb-dir ./adr

Tool writes indexing data under:

${cwd}/.tech-debt/kb.sqlite

${cwd}/.tech-debt/meta.json

New files

src/domain/knowledge/kb.types.ts

src/domain/knowledge/kb.storage.ts

src/domain/knowledge/kb.indexer.ts

src/domain/knowledge/kb.retriever.ts

src/domain/knowledge/chunking/markdown.chunker.ts

src/domain/knowledge/embedding/embedding.client.ts

src/domain/knowledge/embedding/mock.embedder.ts

src/domain/knowledge/meta.manager.ts

src/domain/knowledge/providers/local.provider.ts

src/cli/adapters/kb/kb.adapter.ts

Storage schema (idempotent init)
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

CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
  content, heading, content='chunks', content_rowid='id'
);

CREATE TABLE IF NOT EXISTS embeddings (
  chunk_id INTEGER PRIMARY KEY REFERENCES chunks(id) ON DELETE CASCADE,
  vector BLOB NOT NULL,
  model TEXT NOT NULL
);
Embedding BLOB format (mandatory)

Store vectors as Float32Array raw buffer in SQLite BLOB.

Never JSON serialize vectors.

meta.json
{
  "version": "1.0",
  "kbDirs": ["./docs", "./adr"],
  "kbGlob": "**/*.md",
  "lastIndexedAt": "ISO",
  "fileHashes": { "docs/arch.md": "sha256:..." }
}
Indexing rules (incremental)

Resolve kb-dir paths relative to cwd, not process.cwd().

Scan files matching kbGlob within each kb-dir.

Hash each file content (SHA256).

If file hash unchanged, skip.

For changed/new files:

delete existing chunks by source_path

chunk markdown into sections

insert chunks

update FTS table accordingly (via content=chunks mechanism)

For deleted files:

remove chunks for that path and clean meta.

Chunking (markdown.chunker.ts)

Regex-based header splitting:

split on headings ^(#{1,3})\s+(.+)$ (multiline)

Each chunk:

sourcePath, heading?, content

Max size: 1000 chars; if exceeded, split by paragraph boundary (\n\n)

If no headings, split by \n\n

Retrieval (kb.retriever.ts)

API: search(query, { topK=8 }) => KnowledgeChunk[]

If embeddings enabled AND embeddings table has rows:

compute query embedding

cosine similarity with stored vectors

return topK

Else fallback:

FTS5 keyword query builder:

split by non-word

drop tokens <3 chars

remove stopwords (hardcoded set)

cap 8 tokens

join with OR

query:

SELECT rowid, bm25(chunks_fts) AS score
FROM chunks_fts
WHERE chunks_fts MATCH ?
ORDER BY score
LIMIT ?
Embeddings client behavior

Embeddings disabled by default:

if TECH_DEBT_EMBEDDINGS_MODEL empty => never call embeddings endpoint

One attempt, no retries:

on error/non-200/timeout => return null => fallback to FTS5

Part C — LLM Impact Enrichment (safe merge)
New file

src/domain/analyze/impact/impact.enricher.ts

Input

deterministic ImpactAnalysis

diffSummary (deterministic string, can be derived from stats + touched areas + risk points)

KnowledgeChunk[] topK

LlmProvider

Output (JSON only from LLM)

Expected JSON:

{
  "summary": "string",
  "riskExplanations": [
    { "riskType": "boundary-violation", "explanation": "string" }
  ],
  "additionalChecklist": ["string"]
}
Prompt contract

System: senior tech lead, output JSON only, no markdown, no extra text.

Temperature <= 0.3

Provide the deterministic impact + KB chunks + explicit JSON schema.

Merge strategy (MUST NOT override truth)

Replace impact.summary with LLM summary if valid.

Append additionalChecklist to impact.regressionChecklist (dedupe, cap 7 total).

DO NOT change:

touchedAreas

riskPoints

Save LLM output into report.llmDraft (optional) including model name.

Save KB topK into report.retrievedKnowledge (optional).

Failure handling

Invalid JSON => ignore and keep deterministic impact.

LLM call error => ignore and keep deterministic impact.

Always produce a valid report.

Renderer updates
Markdown renderer

Add optional sections:

## Retrieved Knowledge (only if retrievedKnowledge exists)

show each chunk: sourcePath + heading + short excerpt (truncate to 200 chars)

No need to show llmDraft raw JSON; only use it to generate better impact.summary and checklist.

JSON renderer

Wrapper schemaVersion MUST be "2.0.0"

analysis.schemaVersion MUST be "2.0.0"

Optional fields appear only when present.

Tests & Acceptance
Unit tests (Phase 2)

openai-compatible.provider.test.ts: mock fetch, parse response, error handling

llm.factory.test.ts: provider selection, mock mode

markdown.chunker.test.ts: headers, paragraph fallback, max chunk

kb.storage.test.ts: schema init, insert/delete, fts query, embeddings blob roundtrip

kb.indexer.test.ts: incremental indexing with meta hashes, multi-dir, deleted file

kb.retriever.test.ts: fts query builder, topK limit, embedding path (mocked)

impact.enricher.test.ts: strict JSON parsing, merge strategy, failure fallback

analyze.executor.test.ts: end-to-end with mock KB + mock LLM

Acceptance script (manual)

Create a small repo under /tmp:

docs/ contains 1-2 markdown files

code change triggers boundary violation

Run:

TECH_DEBT_LLM_API_KEY=xxx TECH_DEBT_LLM_MODEL=... \
TECH_DEBT_EMBEDDINGS_MODEL="" \
node dist/cli/index.js analyze --git-range HEAD~1..HEAD --cwd /tmp/repo --kb-dir ./docs --format json

Expect:

schemaVersion "2.0.0"

analysis.impact exists

retrievedKnowledge exists (FTS5)

llmDraft exists if LLM key provided

impact.summary is enriched (not the deterministic template)

Implementation constraints

Do not introduce new heavy dependencies.

Use better-sqlite3 already present.

All paths must resolve from --cwd.

Never index node_modules.

Never crash on missing configs / keys.