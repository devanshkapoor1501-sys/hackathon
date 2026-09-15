import mongoose from 'mongoose';

const { Schema, model, models } = mongoose;
const timestamps = { timestamps: true, versionKey: false };
const named = (name, schema) => models[name] || model(name, schema);

export const SOURCE_STATUSES = ['CURRENT', 'HISTORICAL', 'SUPERSEDED', 'DRAFT', 'PROPOSED', 'UNKNOWN'];
export const REGIMES = [
  'AYUSH', 'FOOD', 'COSMETIC', 'PATENT', 'TRADEMARK', 'GI', 'DESIGN', 'COPYRIGHT', 'PLANT_VARIETY',
  'BIODIVERSITY_ABS', 'TRADITIONAL_KNOWLEDGE', 'LABELLING_CLAIMS',
  'TRIPS', 'CBD_NAGOYA', 'WIPO_GRATK', 'PCT', 'MADRID', 'HAGUE', 'BUDAPEST', 'EXPORT_MARKET_ACCESS',
  'OTHER'
];

export const CLASSIFICATIONS = [
  'CLASSICAL_ASU_MEDICINE',
  'PROPRIETARY_ASU_MEDICINE',
  'NEW_ASU_CANDIDATE_REVIEW',
  'AYURVEDA_AAHARA',
  'FOOD_NUTRACEUTICAL',
  'COSMETIC',
  'PLANT_VARIETY_INNOVATION',
  'RAW_BIORESOURCE_TRADE',
  'RESEARCH_BIOLOGICAL_MATERIAL',
  'MIXED_AMBIGUOUS',
  'UNKNOWN_HUMAN_REVIEW'
];

export const FACT_FIELDS = [
  'intendedUse', 'claims', 'dosageForm', 'routeOfAdministration', 'ingredients', 'formulationName',
  'manufacturingMethod', 'manufacturingLocation', 'classicalSource', 'newProcess', 'processDescription',
  'biologicalOriginIndia', 'wildCollected', 'traditionalKnowledgeUse', 'commercialIntent', 'targetMarket',
  'targetMarkets', 'targetMarketOther', 'userType', 'labelText'
];

const factSheetSchema = {
  intendedUse: { type: String, enum: ['therapeutic_treatment', 'wellness_general', 'food_consumption', 'external_cosmetic', 'research', 'trade_raw_material', 'unknown'], default: 'unknown' },
  claims: { type: [String], default: [] },
  dosageForm: { type: String, enum: ['tablet', 'capsule', 'powder_churna', 'liquid_syrup_arishta', 'oil_taila', 'cream_ointment', 'raw_herb_powder_bulk', 'extract_concentrate', 'other', 'none_stated'], default: 'none_stated' },
  routeOfAdministration: { type: String, enum: ['oral', 'topical', 'nasal', 'other', 'not_applicable', 'unknown'], default: 'unknown' },
  ingredients: [{ name: String, biologicalResource: Boolean, classicalIngredient: Boolean }],
  formulationName: { type: String, default: '' },
  manufacturingMethod: { type: String, default: '' },
  manufacturingLocation: { type: String, enum: ['india', 'unknown', 'outside_india'], default: 'unknown' },
  classicalSource: { type: String, enum: ['authoritative_text_named', 'claims_classical_but_unnamed', 'not_from_any_text_new_formulation', 'unknown'], default: 'unknown' },
  newProcess: { type: String, enum: ['yes', 'no', 'unknown'], default: 'unknown' },
  processDescription: { type: String, default: '' },
  biologicalOriginIndia: { type: String, enum: ['yes', 'no', 'unknown'], default: 'unknown' },
  wildCollected: { type: String, enum: ['wild_collected', 'cultivated', 'unknown'], default: 'unknown' },
  traditionalKnowledgeUse: { type: String, enum: ['direct_traditional_use', 'modified_traditional', 'fully_novel', 'unknown'], default: 'unknown' },
  commercialIntent: { type: String, enum: ['yes_commercial_sale_india', 'research_only', 'personal_use', 'export_related', 'unknown'], default: 'unknown' },
  targetMarket: { type: String, enum: ['india_only', 'india_and_export', 'unknown'], default: 'unknown' },
  targetMarkets: { type: [String], enum: ['EU', 'US', 'UAE', 'OTHER'], default: [] },
  targetMarketOther: { type: String, maxlength: 120, default: '' },
  userType: { type: String, enum: ['startup_msme', 'practitioner', 'researcher_student', 'manufacturer', 'farmer_grower', 'other', 'unknown'], default: 'unknown' },
  labelText: { type: String, default: '' }
};

const questionSchema = new Schema({
  key: { type: String, required: true },
  question: { type: String, required: true },
  why: { type: String, default: '' },
  answered: { type: Boolean, default: false },
  answer: { type: Schema.Types.Mixed, default: null },
  askedAt: Date
}, { _id: true });

const evidenceClaimSchema = new Schema({
  claim: { type: String, required: true },
  sourceKey: { type: String, required: true },
  sourceTitle: String,
  authority: String,
  section: String,
  url: String,
  status: String,
  effectiveFrom: String,
  sourceVersion: String,
  retrievedAt: String,
  passage: String,
  supportLevel: { type: String, enum: ['DIRECTLY_SUPPORTED', 'STRONG_INFERENCE', 'INTERPRETATION_REQUIRED', 'UNSUPPORTED', 'CONFLICTING_AUTHORITIES'] },
  verified: Boolean,
  verificationNotes: [String],
  regime: String,
  jurisdiction: { type: String, enum: ['IN', 'INTL'] },
  untrustedDocumentFlagged: Boolean
}, { _id: false });

const actionItemSchema = new Schema({
  title: { type: String, required: true },
  detail: { type: String, default: '' },
  regime: { type: String, default: 'GENERAL' },
  priority: { type: String, enum: ['HIGH', 'MEDIUM', 'LOW'], default: 'MEDIUM' },
  requiresProfessional: { type: Boolean, default: false }
}, { _id: false });

const escalationSchema = new Schema({
  required: Boolean,
  reason: String,
  unresolvedQuestions: [String],
  recommendedProfessional: String
}, { _id: false });

const classificationSchema = new Schema({
  primary: { type: String, enum: CLASSIFICATIONS },
  alternatives: [String],
  confidence: { type: String, enum: ['HIGH', 'MEDIUM', 'LOW', 'ESCALATE'], default: 'LOW' },
  rationale: String,
  factsUsed: [String],
  missingInformation: [String],
  engineVersion: { type: String, default: 'v1' }
}, { _id: false });

const regimeAssessmentSchema = new Schema({
  regime: { type: String, enum: REGIMES, required: true },
  relevance: { type: String, enum: ['APPLICABLE', 'POSSIBLY_APPLICABLE', 'REVIEW_RECOMMENDED', 'NOT_CURRENTLY_INDICATED', 'INSUFFICIENT_INFORMATION'], required: true },
  why: String,
  whatToDo: [String],
  confidence: { type: String, enum: ['HIGH', 'MEDIUM', 'LOW', 'ESCALATE'] },
  humanReview: Boolean,
  evidenceRefs: [String]
}, { _id: false });

const assessmentSchema = new Schema({
  createdAt: { type: Date, default: Date.now },
  asOfDate: String,
  jurisdictionMode: { type: String, enum: ['IN', 'INTL'], default: 'IN' },
  jurisdictionLabel: String,
  jurisdictionNote: String,
  language: { type: String, enum: ['en', 'hi'], default: 'en' },
  narrative: {
    assessment: String,
    meaning: String
  },
  userSummary: {
    overview: String,
    keyPoints: [String],
    nextSteps: [String],
    caveat: String,
    language: { type: String, enum: ['en', 'hi'] },
    mode: { type: String, enum: ['AI', 'DETERMINISTIC'] },
    provider: String,
    generatedAt: Date
  },
  classification: classificationSchema,
  regimes: [regimeAssessmentSchema],
  ipConsiderations: Schema.Types.Mixed,
  tkConsiderations: Schema.Types.Mixed,
  absScreen: Schema.Types.Mixed,
  actions: [actionItemSchema],
  risks: [{ description: String, severity: { type: String, enum: ['GREEN', 'YELLOW', 'RED', 'GREY'] }, evidenceRefs: [String] }],
  assumptions: [String],
  unknowns: [String],
  evidence: [evidenceClaimSchema],
  confidence: { type: String, enum: ['HIGH', 'MEDIUM', 'LOW', 'ESCALATE'] },
  confidenceFactors: Schema.Types.Mixed,
  humanReview: escalationSchema,
  claimFindings: Schema.Types.Mixed,
  compliancePassport: Schema.Types.Mixed,
  marketRoutes: Schema.Types.Mixed,
  filingPack: Schema.Types.Mixed,
  safetySummary: Schema.Types.Mixed,
  changeAlerts: Schema.Types.Mixed,
  reviewWorkflow: Schema.Types.Mixed,
  llmUsed: Boolean,
  llmProviderInfo: Schema.Types.Mixed
});

const caseSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  publicId: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  status: { type: String, enum: ['draft', 'intake', 'clarifying', 'classified', 'assessed', 'escalated'], default: 'draft' },
  productDescription: { type: String, default: '' },
  productName: { type: String, default: '' },
  jurisdictionMode: { type: String, enum: ['IN', 'INTL'], default: 'IN' },
  facts: { type: factSheetSchema, default: () => ({}) },
  language: { type: String, enum: ['en', 'hi'], default: 'en' },
  questions: [questionSchema],
  assistantMessages: [{ role: { type: String, enum: ['user', 'assistant'] }, content: String, at: { type: Date, default: Date.now } }],
  classification: classificationSchema,
  assessments: [assessmentSchema],
  latestAssessment: assessmentSchema,
  demoScenario: Boolean,
  dossierDocuments: [{ type: { type: String }, name: String, notes: String, status: String, addedAt: { type: Date, default: Date.now } }],
  safetyEvents: [{ type: { type: String }, description: String, batch: String, occurredAt: String, status: String, createdAt: { type: Date, default: Date.now } }],
  reviewWorkflow: { status: { type: String, default: 'NOT_STARTED' }, reviewerRole: String, comments: String, updatedAt: Date }
}, { ...timestamps, strict: false });
caseSchema.index({ organizationId: 1, createdAt: -1 });

const legalSourceSchema = new Schema({
  sourceKey: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  authority: { type: String, required: true },
  jurisdiction: { type: String, default: 'IN' },
  documentType: { type: String, enum: ['act', 'rules', 'regulation', 'notification', 'gazette', 'treaty', 'guidance', 'database', 'registry', 'webpage', 'formulary', 'test'], required: true },
  regimes: { type: [String], default: [] },
  publicationDate: String,
  effectiveFrom: String,
  effectiveTo: String,
  supersededDate: String,
  version: { type: String, default: '1' },
  status: { type: String, enum: SOURCE_STATUSES, default: 'CURRENT' },
  url: String,
  language: { type: String, default: 'en' },
  sourceLevel: { type: Number, min: 1, max: 7, required: true },
  lastVerifiedAt: String,
  relations: [{ relationType: String, targetKey: String, note: String }],
  notes: String
}, timestamps);

const legalChunkSchema = new Schema({
  sourceKey: { type: String, required: true, index: true },
  text: { type: String, required: true },
  sectionLabel: { type: String, default: '' },
  subsection: { type: String, default: '' },
  chunkIndex: { type: Number, required: true },
  embedding: { type: [Number], select: false },
  metadata: {
    authority: String,
    documentType: String,
    sourceLevel: Number,
    status: String,
    effectiveFrom: String,
    effectiveTo: String,
    version: String,
    regimes: [String],
    jurisdiction: { type: String, default: 'IN' },
    containsInstructionPatterns: Boolean
  }
}, timestamps);
legalChunkSchema.index({ sourceKey: 1, chunkIndex: 1 }, { unique: true });
legalChunkSchema.index({ 'metadata.status': 1 });

export const LegalSource = named('LegalSource', legalSourceSchema);
export const LegalChunk = named('LegalChunk', legalChunkSchema);
export const CaseWorkspace = named('CaseWorkspace', caseSchema);

const evaluationRunSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  suiteVersion: { type: String, default: 'v1' },
  durationMs: Number,
  summary: {
    total: Number,
    passed: Number,
    failed: Number,
    passRate: Number,
    dimensions: { type: Schema.Types.Mixed, default: {} }
  },
  results: [{
    name: String,
    dimension: String,
    passed: Boolean,
    expected: Schema.Types.Mixed,
    actual: Schema.Types.Mixed,
    detail: String,
    latencyMs: Number
  }],
  environment: { type: Schema.Types.Mixed, default: {} }
}, timestamps);
evaluationRunSchema.index({ organizationId: 1, createdAt: -1 });
export const EvaluationRun = named('EvaluationRun', evaluationRunSchema);
