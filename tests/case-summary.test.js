import { describe, expect, it } from 'vitest';
import { CaseService, buildDeterministicSummary, humanizeFactKey } from '../src/services/case.service.js';

const assessment = {
  language: 'en',
  confidence: 'MEDIUM',
  classification: { primary: 'PROPRIETARY_ASU_MEDICINE', missingInformation: ['newProcess'], factsUsed: ['intendedUse', 'claims'] },
  regimes: [{ regime: 'AYUSH', label: 'AYUSH medicines', relevance: 'APPLICABLE' }],
  evidence: [{ verified: true, claim: 'A verified claim' }],
  actions: [{ title: 'Confirm the licensing pathway', priority: 'HIGH' }],
  unknowns: ['Missing fact affects classification/regime mapping: newProcess'],
  risks: [{ description: 'Result may change', severity: 'YELLOW' }],
  humanReview: { required: true }
};

describe('plain-language assessment summary', () => {
  it('humanizes stored fact keys', () => expect(humanizeFactKey('newProcess')).toBe('whether the process is genuinely new'));

  it('returns an explicitly deterministic English summary with safe caveat', () => {
    const result = buildDeterministicSummary({ kase: { language: 'en', facts: {} }, assessment });
    expect(result).toMatchObject({ language: 'en', mode: 'DETERMINISTIC', provider: null });
    expect(result.overview).toMatch(/appears to be/i);
    expect(result.nextSteps).toContain('Confirm the licensing pathway');
    expect(result.caveat).toMatch(/not legal advice/i);
  });

  it('returns a Hindi summary when the case language is Hindi', () => {
    const result = buildDeterministicSummary({ kase: { language: 'hi', facts: {} }, assessment: { ...assessment, language: 'hi' }, language: 'hi' });
    expect(result).toMatchObject({ language: 'hi', mode: 'DETERMINISTIC' });
    expect(result.overview).toMatch(/[अ-ह]/);
  });

  it('rejects summary generation until an assessment exists', async () => {
    await expect(new CaseService().generatePlainLanguageSummary({ language: 'en' })).rejects.toMatchObject({ statusCode: 400, code: 'ASSESSMENT_REQUIRED' });
  });
});
