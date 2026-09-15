import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/ai/index.js', () => ({
  getProviderForTask: () => ({ chatModel: '', healthCheck: vi.fn().mockResolvedValue({ connected: false }) })
}));

import { CaseService } from '../src/services/case.service.js';
import { LegalSource } from '../src/models/legal.js';
import { buildFilingPack } from '../src/rules/compliance-intelligence.js';
import { CORPUS } from '../scripts/seed-legal-corpus.js';

describe('IP-SAKTI evidence and assistant citations', () => {
  it('includes Section 2(1)(ja) when the facts identify a new process', () => {
    const service = new CaseService();
    const classification = { primary: 'PROPRIETARY_ASU_MEDICINE' };
    const regimes = [{ regime: 'PATENT', relevance: 'APPLICABLE' }];
    const citations = service.collectRuleCitations({ classification, regimes, absScreen: {}, facts: { newProcess: 'yes' } });
    expect(citations).toEqual(expect.arrayContaining([expect.objectContaining({ section: 's.2(1)(ja)' })]));
  });

  it('builds an international filing pack with international authorities', () => {
    const pack = buildFilingPack({
      classification: { primary: 'PROPRIETARY_ASU_MEDICINE' },
      regimes: [{ regime: 'PCT', relevance: 'APPLICABLE', whatToDo: [] }],
      jurisdictionMode: 'INTL'
    });
    expect(pack[0]).toMatchObject({ regime: 'PCT', authority: 'World Intellectual Property Organization' });
    expect(pack[0].officialUrl).toMatch(/wipo\.int\/pct/);
  });

  it('adds only verified retrieved passages from the selected jurisdiction', async () => {
    const service = new CaseService();
    const source = CORPUS.find(item => item.sourceKey === 'patents_act_1970_current');
    const original = LegalSource.findOne;
    LegalSource.findOne = vi.fn(() => ({ lean: vi.fn().mockResolvedValue(source) }));
    try {
      const evidence = await service.buildRetrievedEvidence({
        expectedJurisdiction: 'IN',
        retrieved: [{
          sourceKey: source.sourceKey,
          sectionLabel: source.chunks[0].sectionLabel,
          text: source.chunks[0].text,
          chunk: { sourceKey: source.sourceKey, sectionLabel: source.chunks[0].sectionLabel, text: source.chunks[0].text, metadata: { jurisdiction: 'IN' } },
          metadata: { jurisdiction: 'IN' },
          flagged: false
        }]
      });
      expect(evidence).toHaveLength(1);
      expect(evidence[0]).toMatchObject({ sourceKey: source.sourceKey, verified: true, evidenceOrigin: 'RETRIEVAL' });
    } finally {
      LegalSource.findOne = original;
    }
  });

  it('exposes verified citations in normal and streaming assistant responses', async () => {
    const service = new CaseService();
    const kase = {
      latestAssessment: {
        jurisdictionMode: 'IN',
        evidence: [{ sourceKey: 'patents_act_1970_current', sourceTitle: 'Patents Act', section: 's.2(1)(j)', url: 'https://example.test/patents', status: 'CURRENT', supportLevel: 'DIRECTLY_SUPPORTED', verified: true }]
      },
      assistantMessages: [],
      save: vi.fn()
    };
    const normal = await service.askAssistant(kase, 'Why this classification?');
    expect(normal.citations).toEqual([expect.objectContaining({ sourceKey: 'patents_act_1970_current', verified: true })]);
    const events = [];
    for await (const event of service.askAssistantStream(kase, 'What is the source?')) events.push(event);
    expect(events.at(-1)).toMatchObject({ type: 'done', citations: normal.citations });
    expect(kase.assistantMessages.at(-1).citations).toEqual(normal.citations);
  });
});
