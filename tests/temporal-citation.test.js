import { describe, it, expect } from 'vitest';
import { verifyCitation } from '../src/evidence/citation-verifier.js';
import { temporalEligible, AUTHORITY_WEIGHT } from '../src/retrieval/legal-retrieval.service.js';

const currentSource = {
  sourceKey: 'bda_2002', title: 'Biological Diversity Act, 2002', authority: 'Parliament of India',
  jurisdiction: 'IN', status: 'CURRENT', effectiveFrom: '2004-07-01', documentType: 'act'
};
const chunk = { text: 'Indian citizens and Indian companies must give prior intimation to the State Biodiversity Board for commercial utilisation of biological resources occurring in India.', sectionLabel: 'Section 7' };
const historicalSource = {
  ...currentSource, status: 'HISTORICAL', effectiveFrom: '2003-05-20', effectiveTo: '2004-12-31'
};
const draftSource = { ...currentSource, status: 'DRAFT' };

describe('citation verification', () => {
  it('supports a claim that the passage directly covers', () => {
    const result = verifyCitation({
      claim: 'Commercial utilisation of biological resources requires prior intimation to the State Biodiversity Board.',
      chunk, source: currentSource
    });
    expect(result.supportLevel).toBe('DIRECTLY_SUPPORTED');
    expect(result.verified).toBe(true);
    expect(result.notes).toHaveLength(0);
  });

  it('marks weak passage overlap as UNSUPPORTED rather than pretending support', () => {
    const result = verifyCitation({ claim: 'Trademark registration requires distinctiveness in India.', chunk, source: currentSource });
    expect(result.supportLevel).toBe('UNSUPPORTED');
    expect(result.verified).toBe(false);
  });

  it('returns UNSUPPORTED when the cited source does not exist — no fabricated citations', () => {
    const result = verifyCitation({ claim: 'anything', chunk: null, source: null });
    expect(result.supportLevel).toBe('UNSUPPORTED');
    expect(result.notes.join(' ')).toMatch(/could not be located/i);
  });

  it('flags historical versions cited for CURRENT-law claims as conflicting authorities', () => {
    const result = verifyCitation({
      claim: 'Commercial utilisation requires prior intimation to the State Biodiversity Board today.',
      chunk, source: historicalSource
    });
    expect(result.supportLevel).toBe('CONFLICTING_AUTHORITIES');
  });

  it('accepts historical versions as evidence when the claim is about that past period', () => {
    const result = verifyCitation({
      claim: 'In 2004, commercial utilisation required prior intimation to the State Biodiversity Board.',
      chunk, source: historicalSource, claimsHistoricalStatus: true, asOf: '2004-06-01'
    });
    expect(result.supportLevel === 'DIRECTLY_SUPPORTED' || result.supportLevel === 'STRONG_INFERENCE').toBe(true);
  });

  it('never lets DRAFT documents support statements about current law', () => {
    const result = verifyCitation({ claim: 'licences are issued digitally within seven days under current rules', chunk: { text: 'PROPOSED licences would be issued digitally within 7 days', sectionLabel: '' }, source: draftSource });
    expect(result.verified).toBe(false);
    expect(result.notes.join(' ')).toMatch(/draft/i);
  });

  it('rejects non-India jurisdictions outright', () => {
    const result = verifyCitation({ claim: 'x'.repeat(60), chunk: { text: 'x'.repeat(60), sectionLabel: '' }, source: { ...currentSource, jurisdiction: 'US' } });
    expect(result.verified).toBe(false);
    expect(result.notes.join(' ')).toMatch(/[Jj]urisdiction mismatch/);
  });
});

describe('temporal eligibility + authority ranking', () => {
  it('excludes future-effective and expired chunks from an as-of retrieval', () => {
    expect(temporalEligible({ metadata: { status: 'CURRENT', effectiveFrom: '2030-01-01' } })).toBe(false);
    expect(temporalEligible({ metadata: { status: 'CURRENT', effectiveTo: '2020-01-01' } })).toBe(false);
    expect(temporalEligible({ metadata: { status: 'CURRENT', effectiveFrom: '2004-07-01' }, }, '2026-08-24')).toBe(true);
    expect(temporalEligible({ metadata: { status: 'HISTORICAL', effectiveTo: '2004-12-31' } }, '2004-06-01')).toBe(true);
  });

  it('never treats DRAFT or PROPOSED items as applicable law at any date', () => {
    expect(temporalEligible({ metadata: { status: 'DRAFT' } })).toBe(false);
    expect(temporalEligible({ metadata: { status: 'PROPOSED' } }, '2099-01-01')).toBe(false);
  });

  it('weights authority so a level-1 Act outranks any blog on equal lexical scores', () => {
    expect(AUTHORITY_WEIGHT(1)).toBeGreaterThan(AUTHORITY_WEIGHT(7) * 5);
    expect(AUTHORITY_WEIGHT(2)).toBeGreaterThan(AUTHORITY_WEIGHT(6));
  });
});
