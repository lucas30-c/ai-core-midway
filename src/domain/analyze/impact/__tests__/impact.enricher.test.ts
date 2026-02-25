import { enrichImpact } from '../impact.enricher';
import { ImpactAnalysis } from '../impact.types';
import { KnowledgeChunk } from '../../../knowledge/kb.types';
import { LlmProvider } from '../../../../core/llm/llm.types';

function makeImpact(overrides?: Partial<ImpactAnalysis>): ImpactAnalysis {
  return {
    summary: 'Deterministic summary',
    touchedAreas: [
      { layer: 'domain', files: ['src/a.ts'], changeType: 'modified' },
    ],
    riskPoints: [
      { type: 'boundary-violation', description: 'test', evidenceLines: [10] },
    ],
    regressionChecklist: ['Check A', 'Check B'],
    ...overrides,
  };
}

function makeChunks(): KnowledgeChunk[] {
  return [
    {
      id: 1,
      sourcePath: 'docs/arch.md',
      heading: 'Architecture',
      content: 'Layered design.',
    },
    {
      id: 2,
      sourcePath: 'docs/api.md',
      heading: 'API',
      content: 'REST endpoints.',
    },
  ];
}

function mockLlm(text: string): LlmProvider {
  return {
    name: 'test',
    chat: jest
      .fn()
      .mockResolvedValue({ text, model: 'test-model', fallbackUsed: false }),
    chatStream: jest.fn(),
  };
}

describe('enrichImpact', () => {
  it('replaces summary and appends checklist from valid LLM response', async () => {
    const llmResponse = JSON.stringify({
      summary: 'LLM enriched summary',
      riskExplanations: [
        { riskType: 'boundary-violation', explanation: 'Crossing layers' },
      ],
      additionalChecklist: ['New check C'],
    });

    const { enrichedImpact, llmDraft } = await enrichImpact(
      makeImpact(),
      'diff summary',
      makeChunks(),
      mockLlm(llmResponse)
    );

    expect(enrichedImpact.summary).toBe('LLM enriched summary');
    expect(enrichedImpact.regressionChecklist).toEqual([
      'Check A',
      'Check B',
      'New check C',
    ]);
    // touchedAreas and riskPoints unchanged
    expect(enrichedImpact.touchedAreas).toEqual(makeImpact().touchedAreas);
    expect(enrichedImpact.riskPoints).toEqual(makeImpact().riskPoints);

    expect(llmDraft).not.toBeNull();
    expect(llmDraft!.model).toBe('test-model');
    expect(llmDraft!.summary).toBe('LLM enriched summary');
  });

  it('deduplicates checklist items', async () => {
    const llmResponse = JSON.stringify({
      summary: 'Summary',
      riskExplanations: [],
      additionalChecklist: ['Check A', 'Check B', 'New item'],
    });

    const { enrichedImpact } = await enrichImpact(
      makeImpact(),
      'diff',
      [],
      mockLlm(llmResponse)
    );

    expect(enrichedImpact.regressionChecklist).toEqual([
      'Check A',
      'Check B',
      'New item',
    ]);
  });

  it('caps checklist at 7 items', async () => {
    const llmResponse = JSON.stringify({
      summary: 'Summary',
      riskExplanations: [],
      additionalChecklist: ['C3', 'C4', 'C5', 'C6', 'C7', 'C8'],
    });

    const { enrichedImpact } = await enrichImpact(
      makeImpact(),
      'diff',
      [],
      mockLlm(llmResponse)
    );

    expect(enrichedImpact.regressionChecklist.length).toBeLessThanOrEqual(7);
  });

  it('parses JSON wrapped in code fences', async () => {
    const wrapped =
      '```json\n{"summary":"fenced","riskExplanations":[],"additionalChecklist":["item"]}\n```';

    const { enrichedImpact, llmDraft } = await enrichImpact(
      makeImpact(),
      'diff',
      [],
      mockLlm(wrapped)
    );

    expect(enrichedImpact.summary).toBe('fenced');
    expect(llmDraft).not.toBeNull();
  });

  it('returns deterministic impact on invalid JSON', async () => {
    const original = makeImpact();
    const { enrichedImpact, llmDraft } = await enrichImpact(
      original,
      'diff',
      [],
      mockLlm('this is not json at all')
    );

    expect(enrichedImpact.summary).toBe(original.summary);
    expect(enrichedImpact.regressionChecklist).toEqual(
      original.regressionChecklist
    );
    expect(llmDraft).toBeNull();
  });

  it('returns deterministic impact on LLM error', async () => {
    const failLlm: LlmProvider = {
      name: 'fail',
      chat: jest.fn().mockRejectedValue(new Error('API timeout')),
      chatStream: jest.fn(),
    };

    const original = makeImpact();
    const { enrichedImpact, llmDraft } = await enrichImpact(
      original,
      'diff',
      [],
      failLlm
    );

    expect(enrichedImpact.summary).toBe(original.summary);
    expect(llmDraft).toBeNull();
  });

  it('passes temperature 0.3 to LLM', async () => {
    const llm = mockLlm(
      '{"summary":"s","riskExplanations":[],"additionalChecklist":[]}'
    );
    await enrichImpact(makeImpact(), 'diff', [], llm);

    expect(llm.chat).toHaveBeenCalledTimes(1);
    const [, opts] = (llm.chat as jest.Mock).mock.calls[0];
    expect(opts.temperature).toBe(0.3);
  });

  it('truncates chunk content to 500 chars in prompt', async () => {
    const longChunk: KnowledgeChunk = {
      id: 1,
      sourcePath: 'docs/long.md',
      heading: 'Long',
      content: 'X'.repeat(800),
    };

    const llm = mockLlm(
      '{"summary":"s","riskExplanations":[],"additionalChecklist":[]}'
    );
    await enrichImpact(makeImpact(), 'diff', [longChunk], llm);

    const [messages] = (llm.chat as jest.Mock).mock.calls[0];
    const userMsg = messages[1].content;
    // The chunk content in prompt should be truncated (500 chars max)
    expect(userMsg).not.toContain('X'.repeat(600));
  });

  it('caps total KB context to 3000 chars', async () => {
    const manyChunks: KnowledgeChunk[] = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      sourcePath: `docs/${i}.md`,
      heading: `Doc ${i}`,
      content: 'Y'.repeat(400),
    }));

    const llm = mockLlm(
      '{"summary":"s","riskExplanations":[],"additionalChecklist":[]}'
    );
    await enrichImpact(makeImpact(), 'diff', manyChunks, llm);

    const [messages] = (llm.chat as jest.Mock).mock.calls[0];
    const kbSection =
      messages[1].content
        .split('## Relevant Knowledge')[1]
        ?.split('## Task')[0] ?? '';
    expect(kbSection.length).toBeLessThanOrEqual(3200); // allow for heading markup
  });
});
