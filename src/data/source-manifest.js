import { createHash } from 'node:crypto';

// Source-rights and provenance metadata used by corpus seeding and training
// preparation. The manifest is deliberately separate from the legal text so a
// source can be catalogued without reproducing restricted or unlicensed data.

export const TRAINING_ELIGIBILITY = ['RETRIEVAL_ONLY', 'TRAINING_ELIGIBLE', 'EXCLUDED'];

export const SUPPLEMENTAL_SOURCE_CATALOG = [
  {
    sourceKey: 'wipo_pct_legal_texts_2026',
    title: 'WIPO PCT Legal Texts — Treaty, Regulations, Administrative Instructions and Guidelines',
    authority: 'World Intellectual Property Organization',
    jurisdiction: 'INTL', documentType: 'guidance', regimes: ['PCT'], sourceLevel: 1,
    publicationDate: '2026-01-01', effectiveFrom: '2026-01-01', effectiveTo: null,
    version: 'in force from 2026-01-01', status: 'CURRENT',
    url: 'https://www.wipo.int/en/web/pct-system/texts/index',
    lastVerifiedAt: '2026-09-15', language: 'en',
    trainingEligibility: 'TRAINING_ELIGIBLE', ingestionStatus: 'CATALOG_ONLY',
    attribution: 'WIPO PCT System',
    notes: 'Use official text versions with attribution; verify the applicable version before relying on a procedural rule.'
  },
  {
    sourceKey: 'wipo_paris_convention',
    title: 'Paris Convention for the Protection of Industrial Property',
    authority: 'World Intellectual Property Organization',
    jurisdiction: 'INTL', documentType: 'treaty', regimes: ['PATENT', 'TRADEMARK', 'GI'], sourceLevel: 1,
    publicationDate: '1883-03-20', effectiveFrom: '1979-09-28', effectiveTo: null,
    version: 'WIPO treaty text', status: 'CURRENT',
    url: 'https://www.wipo.int/treaties/en/ip/paris/',
    lastVerifiedAt: '2026-09-15', language: 'en',
    trainingEligibility: 'TRAINING_ELIGIBLE', ingestionStatus: 'CATALOG_ONLY',
    attribution: 'WIPO Paris Convention',
    notes: 'International baseline for national treatment, priority and common industrial-property rules; national law still controls implementation.'
  },
  {
    sourceKey: 'wipo_patent_law_treaty',
    title: 'Patent Law Treaty — Authentic Text and Regulations',
    authority: 'World Intellectual Property Organization',
    jurisdiction: 'INTL', documentType: 'treaty', regimes: ['PATENT'], sourceLevel: 1,
    publicationDate: '2000-06-01', effectiveFrom: '2005-04-28', effectiveTo: null,
    version: 'WIPO treaty text', status: 'CURRENT',
    url: 'https://www.wipo.int/wipolex/en/treaties/textdetails/12642',
    lastVerifiedAt: '2026-09-15', language: 'en',
    trainingEligibility: 'TRAINING_ELIGIBLE', ingestionStatus: 'CATALOG_ONLY',
    attribution: 'WIPO Patent Law Treaty',
    notes: 'Procedural harmonisation reference; confirm each office\'s reservations and implementing rules.'
  },
  {
    sourceKey: 'wipo_madrid_legal_texts',
    title: 'WIPO Madrid System Legal Texts and Regulations',
    authority: 'World Intellectual Property Organization',
    jurisdiction: 'INTL', documentType: 'guidance', regimes: ['MADRID', 'TRADEMARK'], sourceLevel: 1,
    publicationDate: '1891-04-14', effectiveFrom: '1891-04-14', effectiveTo: null,
    version: 'WIPO system legal texts', status: 'CURRENT',
    url: 'https://www.wipo.int/en/web/madrid-system/legal_texts',
    lastVerifiedAt: '2026-09-15', language: 'en',
    trainingEligibility: 'TRAINING_ELIGIBLE', ingestionStatus: 'CATALOG_ONLY',
    attribution: 'WIPO Madrid System',
    notes: 'Use the current Agreement, Protocol, Regulations and Administrative Instructions; designated offices apply local law.'
  },
  {
    sourceKey: 'wipo_hague_legal_texts',
    title: 'WIPO Hague System Legal Texts and Regulations',
    authority: 'World Intellectual Property Organization',
    jurisdiction: 'INTL', documentType: 'guidance', regimes: ['HAGUE', 'DESIGN'], sourceLevel: 1,
    publicationDate: '1925-11-06', effectiveFrom: '1925-11-06', effectiveTo: null,
    version: 'WIPO system legal texts', status: 'CURRENT',
    url: 'https://www.wipo.int/en/web/hague-system/legal_texts',
    lastVerifiedAt: '2026-09-15', language: 'en',
    trainingEligibility: 'TRAINING_ELIGIBLE', ingestionStatus: 'CATALOG_ONLY',
    attribution: 'WIPO Hague System',
    notes: 'Use current Common Regulations and Administrative Instructions; substantive protection remains jurisdiction-specific.'
  },
  {
    sourceKey: 'wipo_budapest_legal_texts',
    title: 'WIPO Budapest Treaty Legal Texts and Regulations',
    authority: 'World Intellectual Property Organization',
    jurisdiction: 'INTL', documentType: 'treaty', regimes: ['BUDAPEST'], sourceLevel: 1,
    publicationDate: '1977-04-28', effectiveFrom: '1980-08-19', effectiveTo: null,
    version: 'WIPO treaty text', status: 'CURRENT',
    url: 'https://www.wipo.int/treaties/en/registration/budapest/',
    lastVerifiedAt: '2026-09-15', language: 'en',
    trainingEligibility: 'TRAINING_ELIGIBLE', ingestionStatus: 'CATALOG_ONLY',
    attribution: 'WIPO Budapest Treaty',
    notes: 'Use only for microorganism-deposit questions and verify the applicable patent office requirements.'
  },
  {
    sourceKey: 'wipo_tk_gr_global_reference',
    title: 'WIPO Global Reference on Genetic Resources, Traditional Knowledge and Traditional Cultural Expressions',
    authority: 'World Intellectual Property Organization',
    jurisdiction: 'INTL', documentType: 'guidance', regimes: ['WIPO_GRATK', 'TRADITIONAL_KNOWLEDGE', 'BIODIVERSITY_ABS'], sourceLevel: 2,
    publicationDate: '2024-05-24', effectiveFrom: '2024-05-24', effectiveTo: null,
    version: 'WIPO reference portal', status: 'CURRENT',
    url: 'https://www.wipo.int/en/web/traditional-knowledge/global-reference',
    lastVerifiedAt: '2026-09-15', language: 'en',
    trainingEligibility: 'RETRIEVAL_ONLY', ingestionStatus: 'CATALOG_ONLY',
    attribution: 'WIPO Traditional Knowledge resources',
    notes: 'Use as a navigation and context source; prefer the linked official law, treaty or authority text for conclusions.'
  },
  {
    sourceKey: 'wipo_gratk_resource_center',
    title: 'WIPO GRATK Treaty Resource Center and official treaty materials',
    authority: 'World Intellectual Property Organization',
    jurisdiction: 'INTL', documentType: 'treaty', regimes: ['WIPO_GRATK', 'TRADITIONAL_KNOWLEDGE'], sourceLevel: 1,
    publicationDate: '2024-05-24', effectiveFrom: '2024-05-24', effectiveTo: null,
    version: 'adopted treaty and official resources', status: 'CURRENT',
    url: 'https://www.wipo.int/en/web/treaties/ip/gratk/index',
    lastVerifiedAt: '2026-09-15', language: 'en',
    trainingEligibility: 'TRAINING_ELIGIBLE', ingestionStatus: 'CATALOG_ONLY',
    attribution: 'WIPO GRATK Treaty',
    notes: 'Treaty adoption does not by itself establish domestic implementation in every jurisdiction.'
  },
  {
    sourceKey: 'wipo_lex_country_laws',
    title: 'WIPO Lex country-level IP laws and treaty profiles',
    authority: 'World Intellectual Property Organization',
    jurisdiction: 'INTL', documentType: 'database', regimes: ['PATENT', 'TRADEMARK', 'DESIGN', 'TRADITIONAL_KNOWLEDGE'], sourceLevel: 3,
    publicationDate: '', effectiveFrom: '', effectiveTo: null,
    version: 'live database pointer', status: 'CURRENT',
    url: 'https://www.wipo.int/en/web/wipolex',
    lastVerifiedAt: '2026-09-15', language: 'en',
    trainingEligibility: 'RETRIEVAL_ONLY', ingestionStatus: 'CATALOG_ONLY',
    attribution: 'WIPO Lex and original national authority',
    notes: 'Use country records for India, EU target jurisdictions, the United States and UAE; record the original authority and exact text version per import.'
  },
  {
    sourceKey: 'wipo_patentscope_bibliographic_excluded',
    title: 'WIPO PATENTSCOPE bibliographic data — deferred pending explicit permission',
    authority: 'World Intellectual Property Organization',
    jurisdiction: 'INTL', documentType: 'database', regimes: ['PATENT'], sourceLevel: 4,
    publicationDate: '', effectiveFrom: '', effectiveTo: null,
    version: 'deferred', status: 'UNKNOWN',
    url: 'https://www.wipo.int/en/web/patentscope',
    lastVerifiedAt: '2026-09-15', language: 'en',
    trainingEligibility: 'EXCLUDED', ingestionStatus: 'CATALOG_ONLY',
    attribution: 'WIPO PATENTSCOPE',
    notes: 'No PATENTSCOPE records are imported by the first release. Add only a separately documented, explicitly licensed subset.'
  }
];

export function eligibilityForSource(entry) {
  if (entry.documentType === 'test' || entry.sourceKey.includes('tkdl')) return 'EXCLUDED';
  if (entry.trainingEligibility === 'EXCLUDED') return 'EXCLUDED';
  // A catalog pointer is useful for retrieval navigation but is not the
  // official text itself. Never train on pointer prose or unlicensed text.
  if (entry.ingestionStatus === 'CATALOG_ONLY') return 'RETRIEVAL_ONLY';
  if (entry.trainingEligibility) return entry.trainingEligibility;
  return 'TRAINING_ELIGIBLE';
}

export function buildSourceManifest(corpus = [], { usageContext = 'non-commercial-research-demo' } = {}) {
  const byKey = new Map([...corpus, ...SUPPLEMENTAL_SOURCE_CATALOG].map(entry => [entry.sourceKey, entry]));
  const sources = [...byKey.values()].map(entry => ({
    sourceKey: entry.sourceKey,
    title: entry.title,
    authority: entry.authority,
    jurisdiction: entry.jurisdiction || 'IN',
    documentType: entry.documentType,
    regimes: entry.regimes || [],
    url: entry.url || '',
    version: entry.version || '1',
    publicationDate: entry.publicationDate || '',
    effectiveFrom: entry.effectiveFrom || '',
    effectiveTo: entry.effectiveTo || null,
    status: entry.status || 'CURRENT',
    sourceLevel: entry.sourceLevel,
    lastVerifiedAt: entry.lastVerifiedAt || '',
    retrievalDate: entry.retrievalDate || entry.lastVerifiedAt || '',
    checksum: entry.checksum || '',
    license: entry.license || 'Official source; use subject to the source authority terms',
    trainingEligibility: eligibilityForSource(entry),
    ingestionStatus: entry.ingestionStatus || 'SEEDED_SUMMARY',
    attribution: entry.attribution || entry.authority,
    notes: entry.notes || ''
  }));
  return {
    manifestVersion: '1.1',
    usageContext,
    patentscopePolicy: 'EXCLUDED_PENDING_EXPLICIT_LICENSE',
    sources
  };
}

export function sourceManifestHash(manifest) {
  return createHash('sha256').update(JSON.stringify(manifest, null, 2) + '\n').digest('hex');
}

export function catalogEntryAsPointer(entry) {
  return {
    sourceKey: entry.sourceKey,
    title: entry.title,
    authority: entry.authority,
    jurisdiction: entry.jurisdiction,
    documentType: entry.documentType,
    regimes: entry.regimes,
    publicationDate: entry.publicationDate || '',
    effectiveFrom: entry.effectiveFrom || '',
    effectiveTo: entry.effectiveTo || undefined,
    version: entry.version,
    status: entry.status,
    url: entry.url,
    sourceLevel: entry.sourceLevel,
    lastVerifiedAt: entry.lastVerifiedAt,
    relations: [],
    notes: entry.notes,
    trainingEligibility: eligibilityForSource(entry),
    ingestionStatus: entry.ingestionStatus,
    chunks: [{
      sectionLabel: 'Official source pointer',
      text: `${entry.title} is catalogued as an official source pointer. Consult the linked source and the exact current text before relying on a legal conclusion. ${entry.notes}`
    }]
  };
}
