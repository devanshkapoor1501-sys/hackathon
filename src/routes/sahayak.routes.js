import { CaseWorkspace, LegalSource, LegalChunk, EvaluationRun } from '../models/legal.js';
import { OrganizationMember } from '../models/index.js';
import { caseService } from '../services/case.service.js';
import { intakeService } from '../services/intake.service.js';
import { getProvider, createProvider } from '../ai/index.js';
import { runEvaluation } from '../evaluation/runner.js';
import { buildSourceTimeline } from '../evidence/timeline.js';
import { chunkLegalDocument, buildIngestPayload, flagChunks } from '../ingestion/legal-document-ingestor.js';
import { extractSource } from '../ingestion/extract.js';
import { detectInjection } from '../retrieval/legal-retrieval.service.js';
import { renderCaseReportPDF } from '../reports/case-report.pdf.js';
import fs from 'node:fs/promises';
import { env } from '../config/env.js';
import { authenticate, authorizeOrganization, authorizeAccount } from '../middleware/auth.js';
import { forbidden } from '../utils/errors.js';
import { classifyProduct } from '../rules/classification.engine.js';
import { mapRegimes } from '../rules/regimes.js';
import { analyzeClaims, buildCompliancePassport, buildMarketRoutes } from '../rules/compliance-intelligence.js';

export async function llmHealth() {
  const active = getProvider();
  const info = active.getModelInfo();
  const health = await active.healthCheck();
  const activeAttempt = health.attempts?.find(attempt => attempt.provider === health.activeProvider);
  const reportedProvider = health.activeProvider || (active.id === 'hybrid' ? null : active.id);
  const hasActiveProvider = Boolean(reportedProvider);
  return {
    provider: env.LLM_PROVIDER,
    activeProvider: reportedProvider,
    fallbackUsed: Boolean(health.fallbackUsed),
    providerAttempts: health.attempts || [],
    model: activeAttempt?.model || (hasActiveProvider ? info.reasoningModel : null) || '(not configured — deterministic mode)',
    embeddingModel: activeAttempt?.embeddingModel || (hasActiveProvider ? info.embeddingModel : null) || '(not configured — lexical retrieval)',
    baseURL: activeAttempt?.baseURL || (hasActiveProvider ? info.baseURL : null),
    connectivity: health.connected ? 'CONNECTED' : 'OFFLINE',
    status: health.status || (health.connected ? 'READY' : 'OFFLINE'),
    reason: health.reason || undefined,
    latencyMs: health.latencyMs ?? null,
    modelsAvailable: health.models || [],
    structuredOutput: health.structuredOutput || 'unknown',
    note: health.connected ? undefined
      : 'Assessment falls back to deterministic template output; no answers are fabricated.'
  };
}

export async function sahayakRoutes(app) {
  // Public LLM health endpoint (spec: GET /health/llm)
  app.get('/health/llm', async () => llmHealth());

  app.addHook('preHandler', async request => {
    if (request.url.startsWith('/health/')) return;
    await authenticate(request);
  });

  async function requireCorpusAdmin(request) {
    const membership = await OrganizationMember.findOne({
      userId: request.user._id, role: { $in: ['owner', 'admin'] }, status: 'active'
    });
    if (!membership) throw forbidden('Only organization owners/admins can manage the legal corpus');
  }

  function sanitizeSourceKey(title) {
    const base = String(title).toLowerCase().replace(/[^a-z0-9\u0900-\u097F]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);
    return `user_${base || 'document'}_${Date.now().toString(36)}`;
  }

  // ---- Cases ----
  app.post('/api/organizations/:organizationId/sahayak/cases', { preHandler: [authorizeOrganization()] }, async request => {
    const kase = await caseService.createCase({ organizationId: request.organizationId, userId: request.user._id, ...request.body });
    if (kase.productDescription || request.body?.factsPatch) await caseService.runIntake(kase, kase.productDescription, request.body?.factsPatch || {});
    return kase;
  });

  app.get('/api/organizations/:organizationId/sahayak/cases', { preHandler: [authorizeOrganization()] }, async request =>
    caseService.listCases(request.organizationId));

  app.get('/api/organizations/:organizationId/sahayak/cases/:id', { preHandler: [authorizeOrganization()] }, async request =>
    caseService.getCase(request.organizationId, request.params.id));

  // The jurisdiction switch is explicit and persisted with the case. Changing
  // it updates the case timestamp, which makes any previous assessment visibly
  // stale until the user reruns it under the selected legal lens.
  app.patch('/api/organizations/:organizationId/sahayak/cases/:id/jurisdiction', { preHandler: [authorizeOrganization()] }, async request => {
    const mode = String(request.body?.jurisdictionMode || '').toUpperCase();
    if (!['IN', 'INTL'].includes(mode)) return reply400(['jurisdictionMode must be IN or INTL']);
    const kase = await caseService.getCase(request.organizationId, request.params.id);
    kase.jurisdictionMode = mode;
    // Do not expose the prior lens as the current result. Historical runs stay
    // in `assessments` for the timeline, but the selected lens must be rerun.
    kase.latestAssessment = undefined;
    kase.status = (kase.questions || []).some(question => !question.answered) ? 'clarifying' : 'classified';
    await kase.save();
    return { jurisdictionMode: mode, assessmentStale: true };
  });

  app.delete('/api/organizations/:organizationId/sahayak/cases/:id', { preHandler: [authorizeOrganization(['owner', 'admin'])] }, async request => {
    await CaseWorkspace.deleteOne({ _id: request.params.id, organizationId: request.organizationId });
    return { ok: true };
  });

  app.post('/api/organizations/:organizationId/sahayak/cases/:id/describe', { preHandler: [authorizeOrganization()] }, async request => {
    const kase = await caseService.getCase(request.organizationId, request.params.id);
    const result = await caseService.runIntake(kase, String(request.body?.description || '').slice(0, 8000), request.body?.factsPatch || {});
    return {
      facts: result.facts,
      questions: result.questions,
      classificationComplete: result.done,
      llmUsed: result.llmUsed
    };
  });

  // Optional on-demand explanation. The service owns the provider fallback and
  // always persists the latest safe summary alongside the current assessment.
  app.post('/api/organizations/:organizationId/sahayak/cases/:id/summary', { preHandler: [authorizeOrganization()] }, async request => {
    const kase = await caseService.getCase(request.organizationId, request.params.id);
    return caseService.generatePlainLanguageSummary(kase);
  });

  // ---- Compliance passport, claim intelligence and review workflow ----
  app.post('/api/organizations/:organizationId/sahayak/cases/:id/claims/check', { preHandler: [authorizeOrganization()] }, async request => {
    const kase = await caseService.getCase(request.organizationId, request.params.id);
    const facts = { ...(kase.facts?.toObject?.() || kase.facts || {}), ...(request.body?.factsPatch || {}) };
    if (request.body?.labelText != null) { kase.facts.labelText = String(request.body.labelText).slice(0, 5000); await kase.save(); facts.labelText = kase.facts.labelText; }
    const classification = kase.latestAssessment?.classification || kase.classification || classifyProduct(facts);
    return analyzeClaims({ facts, classification, labelText: String(request.body?.labelText || facts.labelText || '') });
  });

  app.post('/api/organizations/:organizationId/sahayak/cases/:id/dossier/documents', { preHandler: [authorizeOrganization()] }, async request => {
    const kase = await caseService.getCase(request.organizationId, request.params.id);
    const body = request.body || {};
    const type = String(body.type || '').trim().slice(0, 40);
    const name = String(body.name || '').trim().slice(0, 200);
    if (!type || !name) return reply400(['Document type and name are required']);
    kase.dossierDocuments.push({ type, name, notes: String(body.notes || '').slice(0, 1000), status: 'ADDED' });
    await kase.save();
    const classification = kase.latestAssessment?.classification || kase.classification || classifyProduct(kase.facts || {});
    return buildCompliancePassport({ facts: kase.facts || {}, classification, documents: kase.dossierDocuments });
  });

  app.post('/api/organizations/:organizationId/sahayak/cases/:id/safety-events', { preHandler: [authorizeOrganization()] }, async request => {
    const kase = await caseService.getCase(request.organizationId, request.params.id);
    const body = request.body || {};
    const type = String(body.type || 'consumer_complaint').slice(0, 40);
    const description = String(body.description || '').trim().slice(0, 1500);
    if (!description) return reply400(['Event description is required']);
    kase.safetyEvents.push({ type, description, batch: String(body.batch || '').slice(0, 100), occurredAt: String(body.occurredAt || new Date().toISOString().slice(0, 10)).slice(0, 30), status: type === 'recall' ? 'REVIEW_REQUIRED' : 'RECORDED' });
    await kase.save();
    return kase.latestAssessment?.safetySummary || { events: kase.safetyEvents };
  });

  app.patch('/api/organizations/:organizationId/sahayak/cases/:id/review', { preHandler: [authorizeOrganization()] }, async request => {
    const kase = await caseService.getCase(request.organizationId, request.params.id);
    const body = request.body || {};
    kase.reviewWorkflow = { status: String(body.status || 'IN_REVIEW').slice(0, 40), reviewerRole: String(body.reviewerRole || '').slice(0, 120), comments: String(body.comments || '').slice(0, 2000), updatedAt: new Date() };
    await kase.save();
    return kase.reviewWorkflow;
  });

  app.get('/api/organizations/:organizationId/sahayak/cases/:id/changes', { preHandler: [authorizeOrganization()] }, async request => {
    const kase = await caseService.getCase(request.organizationId, request.params.id);
    return { alerts: kase.latestAssessment?.changeAlerts || [], reassessmentRecommended: Boolean((kase.latestAssessment?.changeAlerts || []).length) };
  });

  app.post('/api/organizations/:organizationId/sahayak/cases/:id/scenarios/compare', { preHandler: [authorizeOrganization()] }, async request => {
    const kase = await caseService.getCase(request.organizationId, request.params.id);
    const baseFacts = kase.facts?.toObject?.() || kase.facts || {};
    const patch = request.body?.factsPatch || {};
    const project = facts => {
      const classification = classifyProduct(facts);
      const regimes = mapRegimes(classification, facts).filter(r => ['APPLICABLE', 'POSSIBLY_APPLICABLE', 'REVIEW_RECOMMENDED'].includes(r.relevance)).map(r => r.regime);
      return { classification: classification.primary, regimes, claims: analyzeClaims({ facts, classification, labelText: facts.labelText }).summary };
    };
    const current = project(baseFacts); const next = project({ ...baseFacts, ...patch });
    return { patch, current, next, changed: { classification: current.classification !== next.classification, regimes: JSON.stringify(current.regimes) !== JSON.stringify(next.regimes), claims: JSON.stringify(current.claims) !== JSON.stringify(next.claims) } };
  });

  app.post('/api/organizations/:organizationId/sahayak/cases/:id/ask', { preHandler: [authorizeOrganization()] }, async request => {
    const kase = await caseService.getCase(request.organizationId, request.params.id);
    const question = String(request.body?.question || '').trim();
    if (!question) return reply400('Question is required');
    return caseService.askAssistant(kase, question.slice(0, 1000));
  });

  app.post('/api/organizations/:organizationId/sahayak/cases/:id/ask-stream', { preHandler: [authorizeOrganization()] }, async (request, reply) => {
    const kase = await caseService.getCase(request.organizationId, request.params.id);
    const question = String(request.body?.question || '').trim();
    if (!question) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Question is required' } });
    reply.hijack();
    reply.raw.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive', 'x-accel-buffering': 'no' });
    try {
      for await (const event of caseService.askAssistantStream(kase, question.slice(0, 1000))) {
        reply.raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      }
    } catch (error) {
      reply.raw.write(`event: error\ndata: ${JSON.stringify({ type: 'error', message: String(error.message || error) })}\n\n`);
    } finally {
      reply.raw.end();
    }
  });

  app.post('/api/organizations/:organizationId/sahayak/cases/:id/clarify', { preHandler: [authorizeOrganization()] }, async request => {
    const kase = await caseService.getCase(request.organizationId, request.params.id);
    const result = await caseService.answerQuestions(kase, request.body?.answers || {});
    return {
      facts: result.facts,
      remainingQuestions: result.remainingQuestions.map(q => ({ key: q.key, question: q.question, why: q.why })),
      criticalUnknowns: result.criticalUnknowns
    };
  });

  app.post('/api/organizations/:organizationId/sahayak/cases/:id/assess', { preHandler: [authorizeOrganization()] }, async request => {
    const kase = await caseService.getCase(request.organizationId, request.params.id);
    const assessment = await caseService.assess(kase, {
      historicalQuestionDate: request.body?.asOfDate,
      maliciousDocument: Boolean(request.body?.includeMaliciousDocument),
      jurisdictionMode: request.body?.jurisdictionMode
    });
    return assessment;
  });

  app.post('/api/organizations/:organizationId/sahayak/demo', { preHandler: [authorizeOrganization()] }, async request => {
    const description = `I have created an Ayurvedic herbal tablet containing neem and turmeric. I am using a new extraction process that I developed myself. I want to sell it commercially in India. I have not yet filed a patent. I am not sure whether it counts as a classical Ayurvedic formulation or a proprietary medicine.`;
    const kase = await caseService.createCase({
      organizationId: request.organizationId, userId: request.user._id,
      title: 'SIH Demo — Neem & Turmeric tablet (new extraction process)',
      productName: 'Neem-Turmeric tablet', productDescription: description
    });
    kase.demoScenario = true;
    await caseService.runIntake(kase, description);
    return kase;
  });

  // ---- Knowledge base / sources ----
  app.get('/api/sahayak/sources', { preHandler: [] }, async () => {
    const sources = await LegalSource.find().sort({ sourceLevel: 1, title: 1 }).lean();
    const chunkCounts = await LegalChunk.aggregate([{ $group: { _id: '$sourceKey', chunks: { $sum: 1 } } }]);
    const counts = new Map(chunkCounts.map(c => [c._id, c.chunks]));
    return sources.map(source => ({ ...source, chunkCount: counts.get(source.sourceKey) || 0 }));
  });

  app.get('/api/sahayak/sources/:sourceKey/chunks', { preHandler: [] }, async request => {
    const source = await LegalSource.findOne({ sourceKey: request.params.sourceKey }).lean();
    if (!source) return null;
    const chunks = await LegalChunk.find({ sourceKey: request.params.sourceKey }).select('-embedding').sort('chunkIndex').lean();
    return { source, chunks };
  });

  app.get('/api/sahayak/admin/system', { preHandler: [authorizeAccount(['platform_admin', 'government'])] }, async () => {
    const [llm] = await Promise.all([llmHealth()]);
    const documents = await LegalSource.countDocuments();
    const chunks = await LegalChunk.countDocuments();
    const authoritative = await LegalSource.countDocuments({ sourceLevel: { $lte: 3 } });
    const lastUpdate = await LegalSource.findOne().sort({ updatedAt: -1 }).select('updatedAt');
    const statuses = {};
    for (const status of ['CURRENT', 'HISTORICAL', 'SUPERSEDED', 'DRAFT', 'PROPOSED', 'UNKNOWN']) statuses[status] = await LegalSource.countDocuments({ status });

    // Per-regime + per-authority breakdown
    const all = await LegalSource.find().select('regimes authority sourceLevel status effectiveFrom publicationDate').lean();
    const regimeCounts = {};
    for (const s of all) for (const r of (s.regimes || [])) regimeCounts[r] = (regimeCounts[r] || 0) + 1;
    const authorityCounts = {};
    for (const s of all) authorityCounts[s.authority] = (authorityCounts[s.authority] || 0) + 1;
    const jurisdictionCounts = {};
    for (const s of all) { const jurisdiction = s.jurisdiction || 'IN'; jurisdictionCounts[jurisdiction] = (jurisdictionCounts[jurisdiction] || 0) + 1; }
    const byLevel = { '1 (Act/Rules)': 0, '2 (Regulation/guidance)': 0, '3 (Portal)': 0, '4 (Restricted DB)': 0, '5-7 (Other)': 0 };
    for (const s of all) {
      if (s.sourceLevel === 1) byLevel['1 (Act/Rules)']++;
      else if (s.sourceLevel === 2) byLevel['2 (Regulation/guidance)']++;
      else if (s.sourceLevel === 3) byLevel['3 (Portal)']++;
      else if (s.sourceLevel === 4) byLevel['4 (Restricted DB)']++;
      else byLevel['5-7 (Other)']++;
    }
    // Freshness: bucket by year of effectiveFrom
    const now = new Date();
    const freshness = { 'last_year': 0, '1_to_3_years': 0, '3_to_10_years': 0, 'older': 0, 'no_date': 0 };
    for (const s of all) {
      if (!s.effectiveFrom) { freshness.no_date++; continue; }
      const yrs = (now - new Date(s.effectiveFrom)) / (1000 * 60 * 60 * 24 * 365);
      if (yrs < 1) freshness.last_year++;
      else if (yrs < 3) freshness['1_to_3_years']++;
      else if (yrs < 10) freshness['3_to_10_years']++;
      else freshness.older++;
    }

    // Retrieval latency sample: time a fresh query (in-memory, no DB write)
    const { buildSourceTimeline } = await import('../evidence/timeline.js');
    const samples = [];
    for (let i = 0; i < 7; i++) {
      const start = Date.now();
      const tmpKase = { latestAssessment: { evidence: [{ sourceKey: 'patents_act_1970_current', section: 'Section 3(p)', status: 'CURRENT', effectiveFrom: '2005-01-01' }] } };
      await buildSourceTimeline(tmpKase.latestAssessment.evidence.map(evidence => evidence.sourceKey));
      samples.push(Date.now() - start);
    }
    samples.sort((a, b) => a - b);
    const p = q => samples[Math.min(samples.length - 1, Math.floor(samples.length * q))];

    return {
      llm, retrieval: { ready: true, mode: 'hybrid-bm25+vector' },
      knowledgeBase: {
        documents, chunks, authoritative, statuses, lastSourceUpdate: lastUpdate?.updatedAt || null,
        byRegime: regimeCounts, byAuthority: authorityCounts, byJurisdiction: jurisdictionCounts, byLevel, freshness,
        retrievalLatencyMs: { p50: p(0.5), p95: p(0.95), samples: samples.length, samplesMs: samples }
      }
    };
  });

  // ---- Admin corpus ingestion (PDF/TXT/DOCX upload or pasted text) ----
  async function persistIngestedDocument(request, fields, text) {
    const payload = buildIngestPayload({ ...fields });
    if (!payload.ok) return reply400( payload.errors);
    const structuredChunks = chunkLegalDocument(text);
    if (!structuredChunks.length) return reply400( ['No extractable text — the document may be scanned images']);
    const flagged = flagChunks(structuredChunks);
    const injectionCount = flagged.filter(c => c.flagged).length;

    const sourceKey = sanitizeSourceKey(payload.source.title);
    await LegalSource.deleteOne({ sourceKey });
    await LegalChunk.deleteMany({ sourceKey });
    const created = await LegalSource.create({ ...payload.source, sourceKey });
    try {
      const embeddings = [];
      const provider = getProvider();
      if (provider.embeddingModel) {
        const texts = flagged.map(c => c.text);
        for (let i = 0; i < texts.length; i += 16) embeddings.push(...await provider.embed(texts.slice(i, i + 16)));
      }
      await LegalChunk.insertMany(flagged.map((chunk, index) => ({
        sourceKey, text: chunk.text, sectionLabel: chunk.sectionLabel, subsection: chunk.subsection || '',
        chunkIndex: chunk.chunkIndex ?? index,
        ...(embeddings.length === flagged.length ? { embedding: embeddings[index] } : {}),
        metadata: {
          authority: payload.source.authority, documentType: payload.source.documentType,
          sourceLevel: payload.source.sourceLevel, status: payload.source.status,
          effectiveFrom: payload.source.effectiveFrom, effectiveTo: payload.source.effectiveTo,
          version: payload.source.version, regimes: payload.source.regimes,
          jurisdiction: payload.source.jurisdiction, containsInstructionPatterns: chunk.flagged
        }
      })));
    } catch (error) {
      // embedding failure must not lose the document; lexical retrieval still works
      request.log.warn({ err: error.message }, 'Embedding failed during ingest; stored text-only');
    }
    return { ok: true, source: created, chunks: flagged.length, injectionFlaggedChunks: injectionCount };
  }

  function reply400(errors) {
    const error = new Error(Array.isArray(errors) ? errors.join('; ') : String(errors));
    error.statusCode = 400;
    throw error;
  }

  app.post('/api/sahayak/admin/corpus/ingest-text', { preHandler: [] }, async request => {
    await requireCorpusAdmin(request);
    const { title, authority, documentType, regimes, status, sourceLevel, effectiveFrom, effectiveTo, url, notes, language, jurisdiction, text } = request.body || {};
    if (!text || String(text).trim().length < 40) return reply400( ['Paste at least 40 characters of document text']);
    return persistIngestedDocument(request, { title, authority, documentType, regimes, status, sourceLevel, effectiveFrom, effectiveTo, url, notes, language, jurisdiction }, String(text));
  });

  app.post('/api/sahayak/admin/corpus/ingest-file', { preHandler: [] }, async (request, reply) => {
    await requireCorpusAdmin(request);
    const file = await request.file({ limits: { fileSize: env.MAX_UPLOAD_BYTES } });
    if (!file) return reply400( ['Multipart file field is required']);
    const allowed = /\.(pdf|txt|docx)$/i.test(file.filename);
    const allowedTypes = ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowed && !allowedTypes.includes(file.mimetype)) return reply400( ['Only PDF, TXT and DOCX files are accepted']);
    const buffer = await file.toBuffer();
    const tempPath = `${process.cwd()}/.ingest-${Date.now()}-${file.filename.replace(/[^\w.-]/g, '_')}`;
    await fs.writeFile(tempPath, buffer);
    try {
      const text = await extractSource({ type: file.filename.toLowerCase().endsWith('.pdf') ? 'pdf' : file.filename.toLowerCase().endsWith('.docx') ? 'docx' : 'txt', filePath: tempPath });
      const fields = Object.fromEntries(Object.entries(file.fields || {}).map(([key, value]) => [key, typeof value === 'object' && value !== null && 'value' in value ? value.value : value]));
      return await persistIngestedDocument(request, fields, text);
    } finally {
      await fs.rm(tempPath, { force: true });
    }
  });

  app.delete('/api/sahayak/sources/:sourceKey', { preHandler: [] }, async request => {
    await requireCorpusAdmin(request);
    const protectedKeys = ['patents_act_1970_current', 'bda_2002', 'tkdl_pointer']; // seeded fixtures stay
    if (protectedKeys.includes(request.params.sourceKey)) return reply400( ['Seeded fixture documents cannot be deleted from the demo panel']);
    await LegalChunk.deleteMany({ sourceKey: request.params.sourceKey });
    const result = await LegalSource.deleteOne({ sourceKey: request.params.sourceKey });
    return { ok: result.deletedCount > 0 };
  });

  // ---- Evaluation harness ----
  app.post('/api/organizations/:organizationId/sahayak/evaluation/run', { preHandler: [authorizeOrganization(['owner', 'admin'])] }, async request => {
    const result = await runEvaluation({ organizationId: request.organizationId, userId: request.user._id });
    const record = await EvaluationRun.create({
      organizationId: request.organizationId, createdBy: request.user._id,
      suiteVersion: result.suiteVersion, durationMs: result.durationMs,
      summary: result.summary, results: result.results, environment: result.environment
    });
    return { id: record._id, ...result };
  });

  app.get('/api/organizations/:organizationId/sahayak/evaluation', { preHandler: [authorizeOrganization()] }, async request => ({
    latest: await EvaluationRun.findOne({ organizationId: request.organizationId }).sort({ createdAt: -1 }).lean(),
    history: await EvaluationRun.find({ organizationId: request.organizationId }).sort({ createdAt: -1 }).limit(10)
      .select('createdAt durationMs summary.passRate environment').lean()
  }));

  // ---- Timeline of cited sources + relations ----
  app.get('/api/organizations/:organizationId/sahayak/cases/:id/timeline', { preHandler: [authorizeOrganization()] }, async request => {
    const kase = await caseService.getCase(request.organizationId, request.params.id);
    const evidence = kase.latestAssessment?.evidence || [];
    return buildSourceTimeline([...new Set(evidence.map(e => e.sourceKey))]);
  });

  // ---- Exportable PDF case report ----
  app.get('/api/organizations/:organizationId/sahayak/cases/:id/report.pdf', { preHandler: [authorizeOrganization()] }, async (request, reply) => {
    const kase = await caseService.getCase(request.organizationId, request.params.id);
    if (!kase.latestAssessment) return reply400( ['Run an assessment before exporting a report']);
    const pdf = await renderCaseReportPDF({ kase, assessment: kase.latestAssessment });
    reply.header('content-type', 'application/pdf');
    reply.header('content-disposition', `attachment; filename="IP-SAKTI-${kase.publicId}.pdf"`);
    return reply.send(pdf);
  });
}

export { sahayakRoutes as default };
