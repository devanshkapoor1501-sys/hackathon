import { detectInjection } from '../retrieval/legal-retrieval.service.js';

const STOP = new Set('a an and are as at be by for from has have in is it its of on or that the this to was were will with shall may under section act rules the'.split(' '));
const tokensOf = text => String(text).toLowerCase().replace(/[^a-z0-9\u0900-\u097F\s.]/g, ' ').split(/\s+/).filter(t => t.length > 1 && !STOP.has(t));

function overlapRatio(claimTokens, passageTokens) {
  if (!claimTokens.length) return 0;
  const passageSet = new Set(passageTokens);
  const hits = claimTokens.filter(t => passageSet.has(t)).length;
  return hits / claimTokens.length;
}

/** Pick the passage within a source that best supports the claim (legal docs have many sections). */
export function selectBestChunk(claim, chunks = []) {
  const claimTokens = tokensOf(claim);
  let best = null, bestScore = -1;
  for (const chunk of chunks) {
    const score = overlapRatio(claimTokens, tokensOf(`${chunk.sectionLabel || ''} ${chunk.text}`));
    if (score > bestScore) { bestScore = score; best = chunk; }
  }
  return best;
}

/**
 * Verify a claim against its cited chunk. A claim is only as strong as:
 *  1. source existence        2. jurisdiction match      3. current/historical status vs claim date
 *  4. effective-date validity 5. cited-section presence  6. passage relevance
 *  7. passage support (token entailment heuristic)
 */
export function verifyCitation({ claim, chunk, source, asOf, claimsHistoricalStatus = false, expectedJurisdiction = 'IN' }) {
  const notes = [];
  if (!chunk || !source) {
    return { supportLevel: 'UNSUPPORTED', verified: false, notes: ['Source or chunk could not be located in the corpus'] };
  }
  // Defense-in-depth: instruction-like text in a document is untrusted data and
  // can NEVER support any material claim, however high the token overlap is.
  if (detectInjection(chunk.text) || chunk.metadata?.containsInstructionPatterns) {
    return { supportLevel: 'UNSUPPORTED', verified: false, notes: ['Document contains instruction-like text; treated as untrusted data only'] };
  }
  let verified = true;

  const sourceJurisdiction = source.jurisdiction || 'IN';
  if (sourceJurisdiction !== expectedJurisdiction) { verified = false; notes.push(`Jurisdiction mismatch: expected ${expectedJurisdiction}, received ${sourceJurisdiction}`); }

  const status = source.status;
  const effectiveFrom = source.effectiveFrom ? new Date(source.effectiveFrom) : null;
  const effectiveTo = source.effectiveTo ? new Date(source.effectiveTo) : null;
  const asOfDate = asOf ? new Date(asOf) : new Date();

  if (claimsHistoricalStatus) {
    // Claim about a past date: historical versions ARE valid evidence.
    if (status !== 'HISTORICAL' && status !== 'SUPERSEDED' && status !== 'CURRENT') notes.push(`Unusual status for historical query: ${status}`);
    if (effectiveFrom && asOfDate < effectiveFrom) notes.push('As-of date predates this version');
    if (effectiveTo && asOfDate > effectiveTo) notes.push('As-of date is after this version ceased');
  } else {
    if (status === 'DRAFT' || status === 'PROPOSED') {
      verified = false;
      notes.push('Draft/proposed documents cannot support statements about current law');
    }
    if (status === 'HISTORICAL' || status === 'SUPERSEDED') {
      return { supportLevel: 'CONFLICTING_AUTHORITIES', verified: false, notes: ['Cited version is historical/superseded; a current version exists — temporal resolution required'] };
    }
    if (effectiveFrom && asOfDate < effectiveFrom) { verified = false; notes.push('Not yet effective at assessment date'); }
  }

  const sectionMentioned = !source.sectionRequired ||
    tokensOf(source.sectionLabel ?? '').every(t => tokensOf(chunk.text).includes(t)) || !chunk.sectionLabel ||
    overlapRatio(tokensOf(claim), tokensOf(chunk.text)) > 0.2;

  const relevance = overlapRatio(tokensOf(claim), tokensOf(`${chunk.sectionLabel} ${chunk.text}`));
  if (relevance < 0.25) {
    notes.push(`Low passage relevance (${relevance.toFixed(2)})`);
    verified = false;
    return { supportLevel: 'UNSUPPORTED', verified, notes };
  }
  if (!sectionMentioned) notes.push('Cited section label not confirmed inside passage');

  let supportLevel = 'INTERPRETATION_REQUIRED';
  if (verified && relevance >= 0.55) supportLevel = 'DIRECTLY_SUPPORTED';
  else if (verified && relevance >= 0.35) supportLevel = 'STRONG_INFERENCE';
  if (!notes.length && !verified) notes.push('Verification failed');

  return { supportLevel, verified: verified && supportLevel !== 'UNSUPPORTED', notes };
}

/** Build evidence entries for rules outputs; each rule cites seeded sources directly and gets verified here. */
export async function buildEvidence({ ruleCitations = [], lookupChunkBySourceKey, lookupSource, asOf, expectedJurisdiction = 'IN' }) {
  const evidence = [];
  for (const citation of ruleCitations) {
    const source = await lookupSource(citation.sourceKey);
    const chunk = await lookupChunkBySourceKey(citation.sourceKey);
    if (!source) {
      evidence.push({
        ...citation, sourceTitle: null, authority: null, supportLevel: 'UNSUPPORTED',
        verified: false, verificationNotes: ['Cited source missing from corpus — never fabricate']
      });
      continue;
    }
    const result = verifyCitation({
      claim: `${citation.claimContext || citation.section || ''} ${citation.title || source.title}`,
      chunk, source, asOf,
      claimsHistoricalStatus: citation.claimsHistoricalStatus,
      expectedJurisdiction
    });
    evidence.push({
      claim: citation.claim || `Regime basis: ${source.title}`,
      sourceKey: source.sourceKey,
      sourceTitle: source.title,
      authority: source.authority,
      section: citation.section,
      url: source.url,
      status: source.status,
      effectiveFrom: source.effectiveFrom,
      regime: citation.regime,
      ...result
    });
  }
  return evidence;
}
