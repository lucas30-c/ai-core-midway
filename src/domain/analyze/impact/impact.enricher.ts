import { ImpactAnalysis } from './impact.types';
import { KnowledgeChunk } from '../../knowledge/kb.types';
import { LlmProvider, ChatMessage } from '../../../core/llm/llm.types';

export interface LlmDraft {
  model: string;
  summary: string;
  riskExplanations: Array<{ riskType: string; explanation: string }>;
  additionalChecklist: string[];
}

interface LlmEnrichmentResponse {
  summary: string;
  riskExplanations: Array<{ riskType: string; explanation: string }>;
  additionalChecklist: string[];
}

const MAX_CHUNK_CHARS = 500;
const MAX_TOTAL_KB_CHARS = 3000;

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + '\u2026';
}

function buildKbContext(chunks: KnowledgeChunk[]): string {
  let total = 0;
  const parts: string[] = [];

  for (const c of chunks) {
    const heading = c.heading ?? 'Untitled';
    const content = truncate(c.content, MAX_CHUNK_CHARS);
    const section = `### ${heading}\n${content}`;

    if (total + section.length > MAX_TOTAL_KB_CHARS) break;
    total += section.length;
    parts.push(section);
  }

  return parts.join('\n\n');
}

function buildUserMessage(
  diffSummary: string,
  impact: ImpactAnalysis,
  chunks: KnowledgeChunk[]
): string {
  const kbContext = buildKbContext(chunks);

  return `## Diff Summary
${diffSummary}

## Deterministic Impact Analysis
${JSON.stringify(impact)}

## Relevant Knowledge
${kbContext || 'No knowledge base available.'}

## Task
Generate a JSON response with this exact structure:
{
  "summary": "A concise summary of the impact (1-2 sentences)",
  "riskExplanations": [
    { "riskType": "boundary-violation", "explanation": "Why this is risky" }
  ],
  "additionalChecklist": ["Additional regression test items"]
}`;
}

function parseLlmJson(text: string): LlmEnrichmentResponse | null {
  // Step 1: try direct parse
  try {
    const parsed = JSON.parse(text);
    if (isValidResponse(parsed)) return parsed;
  } catch {
    // continue
  }

  // Step 2: extract first top-level JSON object
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      const parsed = JSON.parse(text.slice(firstBrace, lastBrace + 1));
      if (isValidResponse(parsed)) return parsed;
    } catch {
      // fall through
    }
  }

  return null;
}

function isValidResponse(obj: any): obj is LlmEnrichmentResponse {
  return (
    obj &&
    typeof obj.summary === 'string' &&
    Array.isArray(obj.additionalChecklist)
  );
}

export async function enrichImpact(
  impact: ImpactAnalysis,
  diffSummary: string,
  chunks: KnowledgeChunk[],
  llm: LlmProvider
): Promise<{
  enrichedImpact: ImpactAnalysis;
  llmDraft: LlmDraft | null;
}> {
  try {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          'You are a senior tech lead reviewing code changes. Output JSON only, no markdown, no extra text.',
      },
      {
        role: 'user',
        content: buildUserMessage(diffSummary, impact, chunks),
      },
    ];

    const result = await llm.chat(messages, { temperature: 0.3 });
    const parsed = parseLlmJson(result.text);

    if (!parsed) {
      return { enrichedImpact: impact, llmDraft: null };
    }

    // Merge: replace summary, append checklist (dedupe, cap 7)
    const existingChecklist = [...impact.regressionChecklist];
    const newItems = parsed.additionalChecklist.filter(
      item => !existingChecklist.includes(item)
    );
    const mergedChecklist = [...existingChecklist, ...newItems].slice(0, 7);

    const enrichedImpact: ImpactAnalysis = {
      ...impact,
      summary: parsed.summary || impact.summary,
      regressionChecklist: mergedChecklist,
      // touchedAreas and riskPoints are NOT changed
    };

    const llmDraft: LlmDraft = {
      model: result.model,
      summary: parsed.summary,
      riskExplanations: Array.isArray(parsed.riskExplanations)
        ? parsed.riskExplanations
        : [],
      additionalChecklist: parsed.additionalChecklist,
    };

    return { enrichedImpact, llmDraft };
  } catch {
    // LLM call error: keep deterministic impact
    return { enrichedImpact: impact, llmDraft: null };
  }
}
