// International layer for IP-SAKTI. This module is deliberately separate from
// the Indian rules so a jurisdiction switch cannot accidentally blend the two
// answer sets or their evidence.

export const INTERNATIONAL_JURISDICTION = 'INTL';
export const INTERNATIONAL_VERIFIED = '2026-08-24';

export const INTERNATIONAL_REGIME_LABELS = {
  TRIPS: 'TRIPS baseline (WTO)',
  CBD_NAGOYA: 'CBD / Nagoya Protocol',
  WIPO_GRATK: 'WIPO genetic resources & traditional knowledge treaty',
  PCT: 'PCT international patent route',
  MADRID: 'Madrid international trademark route',
  HAGUE: 'Hague international design route',
  BUDAPEST: 'Budapest microorganism deposit route',
  EXPORT_MARKET_ACCESS: 'Export-market regulatory access'
};

/**
 * Map only international instruments and export-market pointers. The output is
 * intentionally phrased as a route to investigate, never as a grant/approval
 * or a conclusion about a target country's law.
 */
export function mapInternationalRegimes(classification, facts = {}) {
  const entries = [];
  const add = (regime, relevance, why, whatToDo, evidenceKeys, humanReview = true) =>
    entries.push({ regime, relevance, why, whatToDo, evidenceKeys, humanReview });

  add(
    'TRIPS',
    'REVIEW_RECOMMENDED',
    'TRIPS provides a baseline for patent, trademark, design and other IP protection, but rights still depend on the law and procedure of each target jurisdiction.',
    ['List the target countries and map each intended right to local filing and eligibility rules'],
    ['trips_wto']
  );

  const hasBiologicalResource = (facts.ingredients || []).some(i => i.biologicalResource) || facts.biologicalOriginIndia === 'yes';
  const hasTk = ['direct_traditional_use', 'modified_traditional'].includes(facts.traditionalKnowledgeUse) || hasBiologicalResource;
  if (hasBiologicalResource || facts.targetMarket === 'india_and_export' || facts.commercialIntent === 'export_related') {
    add(
      'CBD_NAGOYA',
      hasBiologicalResource ? 'POSSIBLY_APPLICABLE' : 'REVIEW_RECOMMENDED',
      'Cross-border work involving genetic resources or associated traditional knowledge can engage access-and-benefit-sharing obligations; the source country and the target activity must be checked separately.',
      ['Record source country, provider/community, permits and mutually agreed terms', 'Check whether Nagoya Protocol implementation applies in each source and target jurisdiction'],
      ['cbd_1992', 'nagoya_2010']
    );
  } else {
    add('CBD_NAGOYA', 'NOT_CURRENTLY_INDICATED', 'No biological-resource or associated traditional-knowledge facts are currently recorded for this case.', ['Revisit this screen if ingredient provenance or associated knowledge changes'], ['cbd_1992', 'nagoya_2010'], false);
  }

  if (hasTk) {
    add(
      'WIPO_GRATK',
      'POSSIBLY_APPLICABLE',
      'The 2024 WIPO Treaty introduces a disclosure-focused international reference point for patent applications based on genetic resources or associated traditional knowledge; domestic implementation and treaty status vary.',
      ['Ask patent counsel to check disclosure requirements in each intended filing jurisdiction', 'Preserve provenance and traditional-knowledge screening records'],
      ['wipo_gratk_2024']
    );
  } else {
    add('WIPO_GRATK', 'REVIEW_RECOMMENDED', 'International genetic-resource and traditional-knowledge relevance cannot be resolved from the current facts.', ['Confirm whether any genetic resource or associated traditional knowledge informs the invention'], ['wipo_gratk_2024']);
  }

  if (facts.newProcess === 'yes' || classification?.primary === 'PROPRIETARY_ASU_MEDICINE') {
    add(
      'PCT',
      'POSSIBLY_APPLICABLE',
      'A genuinely new technical process or product may be a candidate for an international patent filing strategy, subject to novelty, inventive step, exclusions and national-phase decisions.',
      ['Run a novelty and prior-art search before public disclosure', 'Compare PCT timing with the first filing and priority strategy'],
      ['pct_system']
    );
  } else {
    add('PCT', 'NOT_CURRENTLY_INDICATED', 'No new technical process or product contribution is recorded yet.', ['Revisit after the technical contribution and filing strategy are defined'], ['pct_system'], false);
  }

  if (facts.commercialIntent === 'export_related' || facts.targetMarket === 'india_and_export') {
    add('MADRID', 'POSSIBLY_APPLICABLE', 'A commercial brand may be planned through the Madrid System where the applicant and designated countries meet system requirements.', ['Clear the mark nationally first, then compare Madrid designations with direct filings'], ['madrid_system']);
    add('HAGUE', 'REVIEW_RECOMMENDED', 'The Hague System may be relevant to a distinctive product or package design where the applicant and designated countries are eligible.', ['Capture dated product/package drawings before launch and check Hague eligibility'], ['hague_system']);
    add('EXPORT_MARKET_ACCESS', 'REVIEW_RECOMMENDED', 'An export route requires a separate product classification, claims, labelling and evidence review in every target market.', ['Choose target markets first', 'Classify the product separately in each market and verify the official regulator route'], ['eu_herbal_products_route', 'us_botanical_products_route']);
  } else {
    add('MADRID', 'NOT_CURRENTLY_INDICATED', 'No export or international brand strategy is recorded yet.', ['Revisit if the brand will be protected outside India'], ['madrid_system'], false);
    add('HAGUE', 'NOT_CURRENTLY_INDICATED', 'No export or international design strategy is recorded yet.', ['Revisit if product or package design protection is planned abroad'], ['hague_system'], false);
    add('EXPORT_MARKET_ACCESS', 'INSUFFICIENT_INFORMATION', 'No target export market has been selected, so market-access requirements cannot be mapped safely.', ['Select target countries before relying on an export pathway'], ['eu_herbal_products_route', 'us_botanical_products_route']);
  }

  const processText = `${facts.processDescription || ''} ${(facts.ingredients || []).map(i => i.name).join(' ')}`;
  if (/micro[s-]?organism|bacteria|fungus|yeast|culture/i.test(processText)) {
    add('BUDAPEST', 'REVIEW_RECOMMENDED', 'A microorganism-related invention may need a recognised deposit strategy for patent disclosure in selected jurisdictions.', ['Confirm whether the claimed subject matter is a microorganism and whether a Budapest Treaty deposit is needed'], ['budapest_treaty']);
  } else {
    add('BUDAPEST', 'NOT_CURRENTLY_INDICATED', 'No microorganism-related subject matter is recorded in the current facts.', ['Revisit if a microorganism, culture or biological strain becomes part of the claims'], ['budapest_treaty'], false);
  }

  return entries;
}

// Concise, source-linked paraphrase records for the international MVP corpus.
// They are pointers for decision support; users must consult the official texts
// and current domestic implementation before acting.
export const INTERNATIONAL_CORPUS = [
  {
    sourceKey: 'trips_wto', title: 'Agreement on Trade-Related Aspects of Intellectual Property Rights (TRIPS)',
    authority: 'World Trade Organization', jurisdiction: INTERNATIONAL_JURISDICTION, documentType: 'treaty', regimes: ['TRIPS'],
    publicationDate: '1994-04-15', effectiveFrom: '1995-01-01', version: 'current treaty text', status: 'CURRENT',
    url: 'https://www.wto.org/english/docs_e/legal_e/27-trips.pdf', sourceLevel: 1, lastVerifiedAt: INTERNATIONAL_VERIFIED,
    relations: [], notes: 'International baseline; domestic law and filing procedure still control the practical route.',
    chunks: [{ sectionLabel: 'Article 27.1', text: 'TRIPS Article 27.1 requires patents to be available for inventions, whether products or processes, in all fields of technology, provided they are new, involve an inventive step and are capable of industrial application, subject to the Agreement and its permitted exclusions.' }]
  },
  {
    sourceKey: 'cbd_1992', title: 'Convention on Biological Diversity',
    authority: 'Convention on Biological Diversity Secretariat', jurisdiction: INTERNATIONAL_JURISDICTION, documentType: 'treaty', regimes: ['CBD_NAGOYA'],
    publicationDate: '1992-06-05', effectiveFrom: '1993-12-29', version: 'current convention text', status: 'CURRENT',
    url: 'https://www.cbd.int/convention/text/', sourceLevel: 1, lastVerifiedAt: INTERNATIONAL_VERIFIED,
    relations: [{ relationType: 'IMPLEMENTED_BY', targetKey: 'nagoya_2010', note: 'access and benefit-sharing protocol' }], notes: 'Recognises sovereign rights over biological resources and national access rules.',
    chunks: [{ sectionLabel: 'Article 15', text: 'CBD Article 15 recognises the sovereign rights of States over their natural resources. Access to genetic resources is subject to the prior informed consent of the provider country and access on mutually agreed terms, subject to the Convention.' }]
  },
  {
    sourceKey: 'nagoya_2010', title: 'Nagoya Protocol on Access and Benefit-sharing',
    authority: 'Convention on Biological Diversity Secretariat', jurisdiction: INTERNATIONAL_JURISDICTION, documentType: 'treaty', regimes: ['CBD_NAGOYA'],
    publicationDate: '2010-10-29', effectiveFrom: '2014-10-12', version: 'current protocol text', status: 'CURRENT',
    url: 'https://www.cbd.int/abs/text/', sourceLevel: 1, lastVerifiedAt: INTERNATIONAL_VERIFIED,
    relations: [{ relationType: 'UNDER', targetKey: 'cbd_1992', note: 'protocol under the Convention on Biological Diversity' }], notes: 'Implementation is country-specific; this is not a substitute for a source-country permit review.',
    chunks: [{ sectionLabel: 'Access and benefit-sharing', text: 'The Nagoya Protocol establishes a framework for access to genetic resources and fair and equitable sharing of benefits arising from their utilisation. Users should check prior informed consent, mutually agreed terms and compliance measures in each relevant country.' }]
  },
  {
    sourceKey: 'wipo_gratk_2024', title: 'WIPO Treaty on Intellectual Property, Genetic Resources and Associated Traditional Knowledge',
    authority: 'World Intellectual Property Organization', jurisdiction: INTERNATIONAL_JURISDICTION, documentType: 'treaty', regimes: ['WIPO_GRATK', 'TRADITIONAL_KNOWLEDGE'],
    publicationDate: '2024-05-24', effectiveFrom: '2024-05-24', version: 'adopted treaty', status: 'CURRENT',
    url: 'https://www.wipo.int/wipolex/en/text/592806', sourceLevel: 1, lastVerifiedAt: INTERNATIONAL_VERIFIED,
    relations: [], notes: 'Adopted in 2024. Treaty participation, entry into force and domestic implementation must be checked for each jurisdiction.',
    chunks: [{ sectionLabel: 'Patent disclosure requirement', text: 'The 2024 WIPO Treaty on Intellectual Property, Genetic Resources and Associated Traditional Knowledge establishes a patent applicant disclosure requirement when an invention is based on genetic resources or associated traditional knowledge. Treaty status and domestic implementation vary by jurisdiction.' }]
  },
  {
    sourceKey: 'pct_system', title: 'Patent Cooperation Treaty (PCT) — international patent filing system',
    authority: 'World Intellectual Property Organization', jurisdiction: INTERNATIONAL_JURISDICTION, documentType: 'guidance', regimes: ['PCT'],
    publicationDate: '1970-06-19', effectiveFrom: '1978-06-01', version: 'system overview', status: 'CURRENT',
    url: 'https://www.wipo.int/pct/en/', sourceLevel: 2, lastVerifiedAt: INTERNATIONAL_VERIFIED,
    relations: [], notes: 'The PCT does not itself grant a worldwide patent; national or regional offices decide grant.',
    chunks: [{ sectionLabel: 'International application route', text: 'The PCT provides a single international patent application route that preserves the option to pursue patent protection in selected national or regional offices. The PCT does not grant a worldwide patent; each designated office applies its own law.' }]
  },
  {
    sourceKey: 'madrid_system', title: 'Madrid System for the international registration of marks',
    authority: 'World Intellectual Property Organization', jurisdiction: INTERNATIONAL_JURISDICTION, documentType: 'guidance', regimes: ['MADRID'],
    publicationDate: '1891-04-14', effectiveFrom: '1891-04-14', version: 'system overview', status: 'CURRENT',
    url: 'https://www.wipo.int/madrid/en/', sourceLevel: 2, lastVerifiedAt: INTERNATIONAL_VERIFIED,
    relations: [], notes: 'Eligibility, basic mark requirements and refusals are country-specific.',
    chunks: [{ sectionLabel: 'International trademark route', text: 'The Madrid System enables one international trademark application for selected member countries through a central filing and management system. Each designated country can apply its own substantive law and issue a refusal.' }]
  },
  {
    sourceKey: 'hague_system', title: 'Hague System for the international registration of industrial designs',
    authority: 'World Intellectual Property Organization', jurisdiction: INTERNATIONAL_JURISDICTION, documentType: 'guidance', regimes: ['HAGUE'],
    publicationDate: '1925-11-06', effectiveFrom: '1925-11-06', version: 'system overview', status: 'CURRENT',
    url: 'https://www.wipo.int/hague/en/', sourceLevel: 2, lastVerifiedAt: INTERNATIONAL_VERIFIED,
    relations: [], notes: 'Applicant eligibility and substantive design protection remain jurisdiction-specific.',
    chunks: [{ sectionLabel: 'International design route', text: 'The Hague System allows applicants to seek industrial design protection in multiple designated jurisdictions through one international application. Designated jurisdictions retain the ability to examine and refuse protection under local law.' }]
  },
  {
    sourceKey: 'budapest_treaty', title: 'Budapest Treaty on the International Recognition of the Deposit of Microorganisms',
    authority: 'World Intellectual Property Organization', jurisdiction: INTERNATIONAL_JURISDICTION, documentType: 'treaty', regimes: ['BUDAPEST'],
    publicationDate: '1977-04-28', effectiveFrom: '1980-08-19', version: 'current treaty text', status: 'CURRENT',
    url: 'https://www.wipo.int/treaties/en/registration/budapest/', sourceLevel: 1, lastVerifiedAt: INTERNATIONAL_VERIFIED,
    relations: [], notes: 'Relevant only where the invention and applicable patent office rules call for a microorganism deposit.',
    chunks: [{ sectionLabel: 'Recognised microorganism deposits', text: 'The Budapest Treaty supports international recognition of a microorganism deposit for patent procedure. A deposit made with an international depositary authority can satisfy the deposit-related disclosure requirement of contracting states, subject to each office\'s law.' }]
  },
  {
    sourceKey: 'eu_herbal_products_route', title: 'European Union herbal-product market access pointer',
    authority: 'European Commission', jurisdiction: INTERNATIONAL_JURISDICTION, documentType: 'guidance', regimes: ['EXPORT_MARKET_ACCESS'],
    publicationDate: '2001-11-06', effectiveFrom: '2001-11-06', version: 'route pointer', status: 'CURRENT',
    url: 'https://health.ec.europa.eu/medicinal-products/herbal-medicinal-products_en', sourceLevel: 2, lastVerifiedAt: INTERNATIONAL_VERIFIED,
    relations: [], notes: 'Entry point only; Member State classification, claims, formulation and evidence requirements must be checked.',
    chunks: [{ sectionLabel: 'Classification before export', text: 'EU herbal product market access depends on whether a product is treated as a medicinal product, food supplement or cosmetic. Classification, claims, labelling, safety and member-state requirements must be checked before marketing.' }]
  },
  {
    sourceKey: 'us_botanical_products_route', title: 'United States botanical-product market access pointer',
    authority: 'U.S. Food and Drug Administration', jurisdiction: INTERNATIONAL_JURISDICTION, documentType: 'guidance', regimes: ['EXPORT_MARKET_ACCESS'],
    publicationDate: '2016-06-01', effectiveFrom: '2016-06-01', version: 'route pointer', status: 'CURRENT',
    url: 'https://www.fda.gov/drugs/guidance-compliance-regulatory-information/guidances-drugs', sourceLevel: 2, lastVerifiedAt: INTERNATIONAL_VERIFIED,
    relations: [], notes: 'Entry point only; product claims determine the regulatory route and evidence obligations.',
    chunks: [{ sectionLabel: 'Claims and classification', text: 'US botanical products may follow a dietary supplement or botanical drug route. FDA classification, ingredient status, claims, labelling, manufacturing controls and evidence requirements must be checked before marketing.' }]
  }
];

