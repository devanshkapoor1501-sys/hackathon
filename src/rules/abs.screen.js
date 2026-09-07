// Biological Diversity Act / ABS screening. Deterministic; never a binding determination.
export function screenABS(facts = {}) {
  const usesBioresource = (facts.ingredients || []).some(i => i.biologicalResource) ||
    facts.dosageForm === 'raw_herb_powder_bulk' || facts.intendedUse === 'trade_raw_material';
  const commercial = facts.commercialIntent === 'yes_commercial_sale_india' || facts.commercialIntent === 'export_related';
  const researchOnly = facts.commercialIntent === 'research_only';
  const originIndia = facts.biologicalOriginIndia;
  const wildCollected = facts.wildCollected === 'wild_collected';
  const unknowns = [];

  if (!usesBioresource) {
    return { relevance: 'NO_APPARENT_INDICATION', reason: 'No biological resource identified in the described product.', obligations: [], authority: '—', evidence: [], uncertainties: ['Ingredient list is incomplete; re-screen when full composition is known.'], humanReview: false };
  }
  if (originIndia === 'unknown') unknowns.push('Whether the biological resources were accessed from within India.');
  if (facts.wildCollected === 'unknown') unknowns.push('Whether resources are wild-collected or cultivated.');
  if (researchOnly && !commercial) {
    return {
      relevance: 'POSSIBLE',
      reason: 'Research access to Indian biological resources is treated separately from commercial utilisation under the Biological Diversity Act, and later commercialisation changes the obligations.',
      obligations: ['Record source/location of access now', 'Re-screen before any commercial use'],
      authority: 'National Biodiversity Authority / State Biodiversity Board',
      evidence: [{ sourceKey: 'bda_2002', section: 'ss.3-4, 6-7' }],
      uncertainties: unknowns,
      humanReview: false
    };
  }
  if (!commercial) {
    return { relevance: 'INSUFFICIENT_INFORMATION', reason: 'Commercial intent is unclear; ABS obligations cannot be screened without it.', obligations: [], authority: 'NBA/SBB', evidence: [{ sourceKey: 'bda_2002', section: 's.7' }], uncertainties: unknowns.concat(['Clarify whether the activity is commercial']), humanReview: true };
  }
  // Commercial use of bioresources
  let relevance = 'POSSIBLE';
  if (originIndia === 'no') relevance = 'NO_APPARENT_INDICATION';
  if (relevance !== 'NO_APPARENT_INDICATION' && unknowns.length >= 2) relevance = 'POSSIBLE';
  else if (relevance !== 'NO_APPARENT_INDICATION' && wildCollected) relevance = 'YES';

  const obligations = [];
  if (relevance !== 'NO_APPARENT_INDICATION') {
    obligations.push(wildCollected
      ? 'Commercial utilisation of wild-collected Indian biological resources typically requires prior intimation to the State Biodiversity Board and may attract benefit-sharing.'
      : 'Commercial utilisation of cultivated medicinal plants may qualify for a registered ABS certificate pathway under the post-2023 framework — verify current rules.');
    if (facts.traditionalKnowledgeUse === 'direct_traditional_use' || facts.traditionalKnowledgeUse === 'modified_traditional') {
      obligations.push('Use of associated traditional knowledge in results of utilisation implicates NBA approval/benefit-sharing provisions.');
    }
    obligations.push('Patent applications on inventions using Indian biological resources require disclosure of source (BDA s.6).');
  }

  return {
    relevance,
    reason: relevance === 'YES'
      ? 'Commercial utilisation of wild-collected Indian biological resources is indicated by the intake facts.'
      : relevance === 'POSSIBLE'
        ? 'Commercial use involving Indian biological resources exists but key facts (origin/cultivation status) are unresolved.'
        : 'Facts indicate resources were not accessed from India; confirm supply-chain origin.',
    obligations,
    authority: 'National Biodiversity Authority (nbaic.nic.in) and State Biodiversity Boards',
    evidence: [
      { sourceKey: 'bda_2002', section: 's.7' },
      { sourceKey: 'bda_amendment_2023', section: 'cultivated medicinal plants / ABS certificate' },
      ...(facts.newProcess === 'yes' ? [{ sourceKey: 'bda_2002', section: 's.6' }] : [])
    ],
    uncertainties: unknowns.length ? unknowns : ['Confirm species-level sourcing details'],
    humanReview: relevance !== 'NO_APPARENT_INDICATION'
  };
}
