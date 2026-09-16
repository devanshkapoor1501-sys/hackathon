import { describe, expect, it } from 'vitest';
import pdf from 'pdf-parse';
import { renderCaseReportPDF } from '../src/reports/case-report.pdf.js';

const longText = (label, count = 12) => Array.from({ length: count }, (_, index) => `${label} ${index + 1} records a source-backed verification detail that must remain readable in the exported report.`).join(' ');

function reportFixture() {
  return {
    kase: {
      publicId: 'SIH-26045-LONG',
      productName: 'Ayurvedic botanical tablet with a deliberately long product name for layout testing',
      productDescription: longText('The product description', 10),
      language: 'en',
      facts: {
        ingredients: [{ name: 'Neem extract' }, { name: 'Turmeric extract' }, { name: 'Ashwagandha' }],
        claims: [longText('The recorded claim', 8)],
        intendedUse: 'therapeutic_treatment',
        dosageForm: 'tablet',
        routeOfAdministration: 'oral',
        classicalSource: 'new_process',
        commercialIntent: 'commercial_sale',
        processDescription: longText('Low-temperature extraction and spray drying process', 9),
        targetMarkets: ['EU', 'US', 'UAE']
      },
      assessments: [{}]
    },
    assessment: {
      asOfDate: '2026-09-16',
      language: 'en',
      jurisdictionMode: 'INTL',
      confidence: 'MEDIUM',
      classification: {
        primary: 'PROPRIETARY_ASU_MEDICINE',
        rationale: longText('Classification rationale', 8)
      },
      narrative: {
        assessment: longText('Executive assessment', 10),
        meaning: longText('Decision meaning', 8)
      },
      regimes: Array.from({ length: 8 }, (_, index) => ({
        regime: `REGIME_${index + 1}`,
        label: `Regulatory area ${index + 1}`,
        relevance: index % 2 ? 'POSSIBLY_APPLICABLE' : 'REVIEW_RECOMMENDED',
        why: longText(`Why regime ${index + 1} appears`, 4),
        whatToDo: [longText(`First verification step ${index + 1}`, 3)]
      })),
      actions: Array.from({ length: 18 }, (_, index) => ({
        priority: index % 3 === 0 ? 'HIGH' : 'MEDIUM',
        title: `Action ${index + 1}: ${longText('complete the evidence-backed verification', 2)}`,
        why: longText('Why this action matters', 3),
        requiresProfessional: index % 2 === 0
      })),
      risks: Array.from({ length: 12 }, (_, index) => ({ severity: 'YELLOW', description: longText(`Risk ${index + 1}`, 3) })),
      unknowns: Array.from({ length: 10 }, (_, index) => longText(`Unresolved fact ${index + 1}`, 2)),
      marketRoutes: Array.from({ length: 6 }, (_, index) => ({
        id: `ROUTE_${index + 1}`,
        name: `Target market route ${index + 1}`,
        status: 'REVIEW_REQUIRED',
        authority: `Market authority ${index + 1}`,
        steps: [longText('Verify classification, claims, safety, labelling, importer and licensing requirements', 4)]
      })),
      userSummary: {
        overview: longText('Plain-language overview', 7),
        keyPoints: Array.from({ length: 5 }, (_, index) => longText(`Key point ${index + 1}`, 2)),
        nextSteps: Array.from({ length: 4 }, (_, index) => longText(`Summary next step ${index + 1}`, 2)),
        caveat: longText('Summary caveat', 3)
      },
      evidence: Array.from({ length: 24 }, (_, index) => ({
        claim: longText(`Evidence claim ${index + 1}`, 7),
        authority: `Official authority ${index + 1}`,
        section: `Section ${index + 1}`,
        status: 'CURRENT',
        supportLevel: 'DIRECT',
        verified: true,
        url: `https://example.gov.in/official/source/${index + 1}?jurisdiction=international&reference=${'x'.repeat(90)}`
      })),
      humanReview: {
        required: true,
        reason: longText('Professional review is required because', 5),
        recommendedProfessional: 'Qualified IP and regulatory professional'
      },
      llmUsed: true
    }
  };
}

describe('assessment PDF report', () => {
  it('renders long assessments without clipped sections and with correct page numbers', async () => {
    const output = await renderCaseReportPDF(reportFixture());
    expect(output.subarray(0, 5).toString()).toBe('%PDF-');

    const parsed = await pdf(output);
    expect(parsed.numpages).toBeGreaterThan(5);
    expect(parsed.text).toContain('Decision Brief');
    expect(parsed.text).toContain('Evidence appendix');
    expect(parsed.text).toContain('Human review handoff');
    expect(parsed.text).toContain('https://example.gov.in/official/source/1');

    const pageMarkers = [...parsed.text.matchAll(/Page (\d+) of (\d+)/g)].map(match => [Number(match[1]), Number(match[2])]);
    expect(pageMarkers.length).toBe(parsed.numpages);
    expect(new Set(pageMarkers.map(([, total]) => total))).toEqual(new Set([parsed.numpages]));
    expect(pageMarkers.map(([page]) => page)).toEqual(Array.from({ length: parsed.numpages }, (_, index) => index + 1));
  });
});
