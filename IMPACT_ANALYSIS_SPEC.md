You are a Staff+ level software architect.

Generate a production-grade Engineering Specification (SPEC ONLY, no implementation code)
for extending the npm CLI package "@finn_ryu/tech-debt" with:

1) Impact Analysis (primary KPI feature)
2) Local Knowledge Base (RAG)
3) LLM-based readable report generation
4) Future-ready External Knowledge Adapter (design only, not implementation)

The system must remain deterministic-first, LLM-augmented.

========================================
BACKGROUND
========================================

The CLI already supports:

- git diff / git range analysis
- rule engine
- AST boundary rule v2.2 (alias + monorepo support)
- markdown and JSON output
- schemaVersioned output

We now enter Day 3: Industrial Impact Analysis + RAG + LLM report.

========================================
CORE PRODUCT GOALS (MANDATORY)
========================================

1) Impact Analysis (MOST IMPORTANT FEATURE)
The report must look like it deeply understands the code changes.

- Based on git diff + rule findings
- Must produce structured JSON schema (ImpactAnalysis)
- Must be included in markdown output
- Must not rely purely on LLM for factual extraction

2) Local Knowledge Base (RAG)
Users place knowledge files inside THEIR OWN REPOSITORY.

CLI usage example:

  tech-debt analyze \
    --git-range origin/main..HEAD \
    --kb-dir ./docs \
    --kb-dir ./adr

Requirements:
- Multiple --kb-dir supported
- Must not require external server or database
- Must create local cache under:
    <project>/.tech-debt/
- Must support incremental indexing
- Must not scan entire repo automatically unless specified
- Must gracefully degrade if no KB present

3) LLM Report Generation
- LLM generates structured JSON draft only
- Markdown rendered from deterministic template
- Must support provider abstraction:
    - OpenAI-compatible endpoint
    - OpenRouter
    - Mock provider (offline)
- Must support environment variables:
    TECH_DEBT_LLM_PROVIDER
    TECH_DEBT_LLM_MODEL
    TECH_DEBT_LLM_BASE_URL
    TECH_DEBT_LLM_API_KEY
- Must support --llm-off

4) Early Return Risk Detection
We previously had production issues caused by early return logic.

Spec must define:
- Heuristic detection strategy based on diff + AST
- Avoid excessive false positives
- Emit rule id: control-flow:early-return
- Severity default: MEDIUM
- Included in ImpactAnalysis.riskPoints

========================================
KNOWLEDGE BASE DESIGN
========================================

Local KB behavior:

- Index location:
    <cwd>/.tech-debt/kb.sqlite (recommended)
    OR kb.jsonl (justify choice)
- Metadata:
    meta.json containing:
        kbDirs
        version
        lastIndexedAt
        fileHashes

Chunking strategy:
- Markdown header-aware splitting
- Fallback paragraph split
- Max chunk size defined in spec
- Each chunk must contain:
    id
    sourcePath
    heading
    content
    hash
    updatedAt

Retrieval:
- topK configurable (default 6-10)
- Embedding provider abstraction
- Must work offline in mock mode

========================================
IMPACT ANALYSIS STRUCTURE
========================================

Define TypeScript schema:

ImpactAnalysis {
  summary: string
  touchedAreas: Array<{
    layer: string
    files: string[]
    changeType: string
  }>
  riskPoints: Array<{
    type: string
    description: string
    evidenceLines: number[]
  }>
  regressionChecklist: string[]
  suggestedReviewers?: string[]
}

========================================
OUTPUT REQUIREMENTS
========================================

JSON Output:
- Must extend existing schemaVersion
- Must include:
    analysis.findings
    analysis.impact
    analysis.retrievedKnowledge (optional)
    analysis.llmDraft (optional)

Markdown Output:
Sections in fixed order:
1. Summary
2. Impact Analysis
3. Key Findings
4. Suggested Actions
5. Retrieved Knowledge (if any)

LLM must not directly write Markdown.

========================================
EXTERNAL KNOWLEDGE ADAPTER (DESIGN ONLY)
========================================

We must future-proof the system for when:

User has NO local KB,
but wants to query:
- Internal company KB
- Confluence exports
- Centralized risk database
- Public documentation

Spec must define:

KnowledgeProvider interface:
  - type: local | http | internal | hybrid
  - search(query): Promise<KnowledgeChunk[]>

Design:
- Local provider (mandatory)
- External provider (interface only)
- Must not block current CLI
- Must not require authentication for MVP
- Must define extension mechanism

========================================
CLI PARAMETERS TO DEFINE
========================================

--kb-dir <path> (repeatable)
--kb-glob <pattern>
--llm-provider
--llm-model
--llm-base-url
--llm-api-key
--llm-off
--impact-level <low|med|high>

========================================
NON-FUNCTIONAL REQUIREMENTS
========================================

- Node >= 18
- Must not crash
- Deterministic mode must always work
- Performance: no full repo scan
- Incremental indexing required
- Tests must cover:
    - multi kb-dir
    - early-return detection
    - mock LLM provider
    - KB incremental update
    - no-KB fallback

========================================
DELIVERABLE FORMAT
========================================

Spec must include:

- File creation / modification table
- Interfaces and type definitions
- CLI behavior
- Error handling
- Version migration strategy
- Verification checklist (manual and automated)
- Degradation strategies

NO IMPLEMENTATION CODE.
SPEC ONLY.