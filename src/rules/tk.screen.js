// Traditional knowledge / Section 3(p) screening — potential-issue flags only, never a patentability determination.
const CLASSICAL_TEXTS = ['charaka', 'sushruta', 'ashtanga hridayam', 'ashtanga sangraha', 'bhavaprakasha', 'sharangadhara', 'ayurvedic formulary of india', 'ayurvedic pharmacopoeia of india'];

export function screenTraditionalKnowledge(facts = {}, classification = {}) {
  const ingredients = (facts.ingredients || []).map(i => i.name.toLowerCase()).filter(Boolean);
  const therapeuticClaims = (facts.claims || []).join(' ').toLowerCase();

  if (classification?.primary === 'CLASSICAL_ASU_MEDICINE') {
    return {
      level: 'POTENTIAL_TK_CONTEXT',
      why: 'The formulation is classical/traditional in nature: it is already part of public traditional knowledge, which affects novelty of the composition as such and interacts with s.3(p) if patenting is contemplated.',
      flags: ['Composition appears to be documented traditional knowledge', 'Patent claims over the composition "as such" would likely face s.3(p) exclusion analysis'],
      source: [
        { sourceKey: 'patents_act_1970_current', section: 's.3(p)' },
        { sourceKey: 'tkdl_pointer', section: 'access workflow' }
      ],
      whatToVerify: ['Search classical texts (Charaka/Sushruta/Bhavaprakasha) and AFI/API for the exact combination', 'Request a TK/prior-art search via a registered patent agent (TKDL access is restricted to examiners)'],
      humanReview: true
    };
  }

  if (!ingredients.length) {
    return { level: 'INSUFFICIENT_INFORMATION', why: 'Ingredient composition is unknown; TK overlap cannot be screened.', flags: [], source: [{ sourceKey: 'patents_act_1970_current', section: 's.3(p)' }], whatToVerify: ['Full ingredient list'], humanReview: true };
  }

  const flags = [];
  let level = 'NO_POTENTIAL_ISSUE_IDENTIFIED';
  let why = 'No traditional-knowledge overlap was indicated by the available facts.';
  level = 'POTENTIAL_TK_ISSUE';
  why = `Ingredients (${ingredients.slice(0, 4).join(', ')}) have documented traditional uses; combining known substances with known properties can attract the s.3(p) exclusion and TK prior-art.`;
  flags.push('Known Ayurvedic ingredients identified');
  if (/treat|cure|anti[- ]?inflam|immun/.test(therapeuticClaims)) flags.push('Therapeutic claims may match documented traditional properties');

  if (facts.newProcess === 'yes') {
    flags.push('A genuinely new process may be assessed separately from the TK composition, subject to other exclusions (e.g., s.3(d)).');
  }

  return {
    level,
    why,
    flags,
    source: [
      { sourceKey: 'patents_act_1970_current', section: 's.3(p)' },
      { sourceKey: 'tkdl_pointer', section: 'access workflow' }
    ],
    whatToVerify: [
      'Search classical texts (Charaka/Sushruta/Bhavaprakasha) and AFI/API for the exact combination',
      'Request a TK/prior-art search via a registered patent agent (TKDL access is restricted to examiners)',
      'Document any technical contribution beyond traditional use'
    ],
    humanReview: level !== 'NO_POTENTIAL_ISSUE_IDENTIFIED'
  };
}

export function ipConsiderations(facts = {}, classification = {}) {
  const tk = screenTraditionalKnowledge(facts, classification);
  const considerations = {
    patent: {
      status: facts.newProcess === 'yes' ? 'POTENTIAL_SUBJECT_MATTER_IDENTIFIED' : 'REVIEW_RECOMMENDED',
      note: 'Potential patent-relevant subject matter may exist. This system does NOT determine patentability.',
      points: [
        'Novelty and inventive step must be established against prior art (Indian and foreign)',
        ...(facts.newProcess === 'yes' ? ['New process claims are assessed separately from product claims'] : []),
        'Screen excluded subject matter: ss.3(c), 3(d) (new form/efficacy), 3(e), 3(i), 3(p) (traditional knowledge)',
        'Biological-resource sourcing disclosure obligations apply (BDA s.6)',
        'Conduct a formal prior-art search before filing or public disclosure'
      ],
      tkScreen: tk,
      evidence: [
        { sourceKey: 'patents_act_1970_current', section: 's.2(1)(j)' },
        { sourceKey: 'patents_act_1970_current', section: 's.2(1)(ja)' },
        { sourceKey: 'patents_act_1970_current', section: 's.3(p)' }
      ]
    },
    trademark: {
      status: facts.commercialIntent === 'yes_commercial_sale_india' ? 'REVIEW_RECOMMENDED' : 'NOT_CURRENTLY_INDICATED',
      note: 'Brand names/logos for commercial products can be protected under the Trade Marks Act; clearance searching is advised.',
      evidence: [{ sourceKey: 'trademarks_act_1999', section: 's.9, s.11' }]
    },
    gi: { status: 'NOT_CURRENTLY_INDICATED', note: 'GI applies where quality/reputation is attributable to a geographic origin (relevant to producers/associations, not single formulations).' },
    plantVariety: {
      status: classification?.primary === 'PLANT_VARIETY_INNOVATION' ? 'POSSIBLY_APPLICABLE' : 'NOT_CURRENTLY_INDICATED',
      evidence: [{ sourceKey: 'ppvfr_2001', section: 'criteria' }]
    },
    tradeSecret: {
      status: 'REVIEW_RECOMMENDED',
      note: 'Confidential business information (formulation details, process parameters) is protectable through contractual/confidentiality measures rather than registration.'
    }
  };
  return considerations;
}
