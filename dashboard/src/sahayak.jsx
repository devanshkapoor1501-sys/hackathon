import React, { useEffect, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowRight, BadgeCheck, BookOpen, Check, CheckCircle2, ChevronRight, CircleAlert, Globe2,
  FileSearch, FlaskConical, History, Leaf, Loader2, Plus, Scale, Send, ShieldAlert, ShieldCheck,
  Sparkles, TerminalSquare, Trash2, Upload, X, ExternalLink
} from 'lucide-react';
import { RecoveryHint, InlineLlmBanner, EmptyRecovery } from './recovery.jsx';
import { ClaimsReviewCard, CompliancePassportCard, MarketRoutesCard, FilingPackCard, ChangeAlertsCard, SafetyPostMarketCard, ReviewWorkflowCard, WhatIfCard } from './advanced.jsx';

// KnowledgeGraphCard is the heaviest single sub-component in the case
// workspace. Lazy-load it so the route's initial JS is lighter.
const LazyKnowledgeGraph = React.lazy(() => import('./knowledge-graph.jsx').then(m => ({ default: m.KnowledgeGraph })));

export const SEVERITY = { GREEN: 'sev-green', YELLOW: 'sev-yellow', RED: 'sev-red', GREY: 'sev-grey' };
export const CONF = { HIGH: 'sev-green', MEDIUM: 'sev-yellow', LOW: 'sev-yellow', ESCALATE: 'sev-red' };
const RELEVANCE_ORDER = ['APPLICABLE', 'POSSIBLY_APPLICABLE', 'REVIEW_RECOMMENDED', 'INSUFFICIENT_INFORMATION', 'NOT_CURRENTLY_INDICATED'];
const RISK_OF_RELEVANCE = r => ({ APPLICABLE: 'HIGH', POSSIBLY_APPLICABLE: 'MEDIUM', REVIEW_RECOMMENDED: 'MEDIUM', INSUFFICIENT_INFORMATION: 'GREY', NOT_CURRENTLY_INDICATED: 'LOW' }[r] || 'GREY');

export function Header({ eyebrow, title, subtitle, action }) {
  return <header className="page-head"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{action}</header>;
}
export function Pill({ tone = '', children }) { return <span className={`pill ${tone}`}>{children}</span>; }
export function Spinner() { return <Loader2 size={16} className="spin" />; }

export function JurisdictionSwitch({ value = 'IN', onChange, disabled = false }) {
  return <div className="jurisdiction-control" role="group" aria-label="Answer jurisdiction">
    <span className="jurisdiction-control-label"><Globe2 size={14}/> Legal lens</span>
    <div className="jurisdiction-segmented">
      <button type="button" className={value === 'IN' ? 'active' : ''} aria-pressed={value === 'IN'} disabled={disabled} onClick={() => onChange?.('IN')}>
        <strong>India</strong><small>Acts &amp; regulators</small>
      </button>
      <button type="button" className={value === 'INTL' ? 'active' : ''} aria-pressed={value === 'INTL'} disabled={disabled} onClick={() => onChange?.('INTL')}>
        <strong>International</strong><small>Treaties &amp; routes</small>
      </button>
    </div>
  </div>;
}

async function apiCall(api, path, options) { return api.request(path, options); }

/* ---------------- Cases list ---------------- */
export function SahayakPage({ api, org, onOpenCase }) {
  const [cases, setCases] = useState(null), [creating, setCreating] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(null);
  async function load() { try { setCases(await apiCall(api, `/api/organizations/${org._id}/sahayak/cases`)); } catch (e) { setError(e); } }
  useEffect(() => { load(); }, [org._id]);

  async function createCase(event) {
    event.preventDefault(); setBusy(true); setError(null);
    try {
      const fd = new FormData(event.currentTarget);
      await apiCall(api, `/api/organizations/${org._id}/sahayak/cases`, { method: 'POST', body: JSON.stringify({ title: fd.get('title'), productName: fd.get('title'), productDescription: fd.get('description'), language: fd.get('language'), jurisdictionMode: fd.get('jurisdictionMode') }) });
      setCreating(false); await load();
    } catch (e) { setError(e); } finally { setBusy(false); }
  }
  async function loadDemo() {
    setBusy(true); setError(null);
    try { await apiCall(api, `/api/organizations/${org._id}/sahayak/demo`, { method: 'POST' }); await load(); }
    catch (e) { setError(e); } finally { setBusy(false); }
  }
  async function remove(id) {
    try { await apiCall(api, `/api/organizations/${org._id}/sahayak/cases/${id}`, { method: 'DELETE' }); await load(); } catch (e) { setError(e); }
  }

  return <>
    <Header eyebrow="IP-SAKTI SAHAYAK" title="Ayurvedic IP & regulatory cases" subtitle="Evidence-backed decision support across India and international routes — not a chatbot, not legal advice."
      action={<div className="row-actions"><button className="secondary" onClick={loadDemo} disabled={busy}><Sparkles/> Load SIH demo</button><button className="primary" onClick={() => setCreating(true)} disabled={busy}><Plus/> New case</button></div>}/>
    {error && <RecoveryHint error={error} onRetry={() => { setError(null); load(); }} onLoadDemo={loadDemo} onDismiss={() => setError(null)}/>}
    {cases === null && <section className="card"><Spinner/> Loading cases…</section>}
    {Array.isArray(cases) && !cases.length && <EmptyState onDemo={loadDemo} busy={busy}/>}
    {Array.isArray(cases) && cases.length > 0 && <div className="case-grid">
      {cases.map(kase => <CaseCard key={kase._id} kase={kase} onRemove={() => remove(kase._id)} onOpen={() => onOpenCase(kase._id)}/>)}
    </div>}
    {creating && (
      <Modal title="New product case" onClose={() => setCreating(false)}>
        <form onSubmit={createCase}>
          <label>Case title<input name="title" required minLength="3" maxLength="120" placeholder="Neem-turmeric tablet"/></label>
          <label>Language / भाषा
            <select name="language" defaultValue="en">
              <option value="en">English</option>
              <option value="hi">हिन्दी (Hindi)</option>
            </select>
          </label>
          <label>Legal lens
            <select name="jurisdictionMode" defaultValue="IN">
              <option value="IN">India — Acts &amp; regulators</option>
              <option value="INTL">International — treaties &amp; export routes</option>
            </select>
          </label>
          <label>Describe your product / situation (Hindi, English or Hinglish)<textarea name="description" rows="5" required minLength="20" placeholder="I developed an Ayurvedic formulation using neem and turmeric… I want to sell it in India…"/></label>
          <button className="primary full" disabled={busy}>{busy ? <Spinner/> : <>Create case <ArrowRight size={14}/></>}</button>
        </form>
      </Modal>
    )}
  </>;
}

function EmptyState({ onDemo, busy }) {
  return <section className="card empty-state">
    <Leaf className="empty-leaf"/>
    <h2>Start a product case</h2>
    <p className="muted">Describe an Ayurvedic product or innovation. Sahayak extracts facts, asks only what matters, classifies the product, maps the selected legal layer, and shows the evidence behind every conclusion.</p>
    <div className="row-actions center">
      <button className="primary" onClick={onDemo} disabled={busy}>{busy ? <Spinner/> : <><Sparkles/> Load SIH demo scenario</>}</button>
    </div>
  </section>;
}

function CaseCard({ kase, onRemove, onOpen }) {
  const cls = kase.classification?.primary || kase.latestAssessment?.classification?.primary;
  const conf = kase.classification?.confidence || kase.latestAssessment?.confidence;
  return <article className="card case-card">
    <div className="case-card-top">
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <Pill tone={kase.status === 'escalated' ? 'warning' : kase.status === 'assessed' ? 'success' : ''}>{kase.status}</Pill>
        <span className={`badge ${kase.jurisdictionMode === 'INTL' ? 'sev-yellow' : 'sev-green'}`}>{kase.jurisdictionMode === 'INTL' ? 'INTL' : 'IN'}</span>
        {kase.demoScenario && <span className="demo-flag" title="Loaded from the SIH demo scenario — all data is simulated.">DEMO</span>}
      </div>
      <button className="icon-btn subtle" onClick={onRemove} title={kase.demoScenario ? 'Reset demo case' : 'Delete case'}><Trash2 size={14}/></button>
    </div>
    <h3><Leaf size={15}/> {kase.title}</h3>
    {cls && <p className="case-cat">{cls.replaceAll('_', ' ').toLowerCase()}</p>}
    <div className="case-meta">
      {conf && <span className={`badge ${CONF[conf]}`}>confidence: {conf.toLowerCase()}</span>}
      <small>{new Date(kase.createdAt).toLocaleDateString()}</small>
    </div>
    <button className="case-open" onClick={onOpen}>Open workspace <ChevronRight size={14}/></button>
  </article>;
}

/* ---------------- Case workspace ---------------- */
function useWorkspaceLlmStatus(intervalMs = 15000) {
  const [phase, setPhase] = useState('checking');
  const [info, setInfo] = useState(null);
  useEffect(() => {
    let stopped = false;
    async function probe() {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/health/llm`, { cache: 'no-store' });
        const data = await response.json();
        if (stopped) return;
        setInfo(data);
        if (data?.connectivity === 'CONNECTED') setPhase('online');
        else if (data?.status === 'NO_MODEL_LOADED' || data?.status === 'MODEL_MISMATCH') setPhase('warn');
        else setPhase('offline');
      } catch { if (!stopped) { setPhase('offline'); setInfo(null); } }
    }
    probe();
    const t = setInterval(probe, intervalMs);
    return () => { stopped = true; clearInterval(t); };
  }, [intervalMs]);
  return { phase, info };
}

export function CaseWorkspaceView({ api, org, caseId, onBack }) {
  const [kase, setKase] = useState(null), [assessment, setAssessment] = useState(null), [answers, setAnswers] = useState({}), [busy, setBusy] = useState(false), [error, setError] = useState(null), [stage, setStage] = useState('');
  const llm = useWorkspaceLlmStatus(15000);
  async function loadDemo() {
    try { const demo = await apiCall(api, `/api/organizations/${org._id}/sahayak/demo`, { method: 'POST' }); location.hash = `#/case/${demo._id}`; } catch (e) { setError(e); }
  }
  const currentJurisdiction = kase?.jurisdictionMode || assessment?.jurisdictionMode || 'IN';
  const STAGES = currentJurisdiction === 'INTL'
    ? ['Analyzing product…', 'Extracting formulation details…', 'Checking classification…', 'Searching treaty & target-market sources…', 'Verifying jurisdictional evidence…', 'Preparing international route map…']
    : ['Analyzing product…', 'Extracting formulation details…', 'Checking classification…', 'Searching authoritative Indian sources…', 'Verifying evidence…', 'Preparing assessment…'];

  async function load() {
    const data = await apiCall(api, `/api/organizations/${org._id}/sahayak/cases/${caseId}`);
    setKase(data);
    const caseMode = data.jurisdictionMode || 'IN';
    setAssessment(data.latestAssessment && (data.latestAssessment.jurisdictionMode || 'IN') === caseMode ? data.latestAssessment : null);
  }
  useEffect(() => { setKase(null); setAssessment(null); load().catch(e => setError(e)); }, [caseId]);

  useEffect(() => {
    if (!busy) { setStage(''); return; }
    let i = 0; setStage(STAGES[0]);
    const t = setInterval(() => { i = Math.min(i + 1, STAGES.length - 1); setStage(STAGES[i]); }, 1700);
    return () => clearInterval(t);
  }, [busy]);

  async function submitAnswers(event) {
    event.preventDefault(); setBusy(true); setError(null);
    try {
      await apiCall(api, `/api/organizations/${org._id}/sahayak/cases/${kase._id}/clarify`, { method: 'POST', body: JSON.stringify({ answers }) });
      setAnswers({}); await load();
    } catch (e) { setError(e); } finally { setBusy(false); }
  }

  async function runAssessment(includeMalicious = false) {
    setBusy(true); setError(null); setAssessment(null);
    try {
      const result = await apiCall(api, `/api/organizations/${org._id}/sahayak/cases/${kase._id}/assess`, { method: 'POST', body: JSON.stringify(includeMalicious ? { includeMaliciousDocument: true } : {}) });
      setAssessment(result); await load();
    } catch (e) { setError(e); } finally { setBusy(false); }
  }

  async function changeJurisdiction(mode) {
    if (!kase || mode === (kase.jurisdictionMode || 'IN')) return;
    setBusy(true); setError(null);
    try {
      await apiCall(api, `/api/organizations/${org._id}/sahayak/cases/${kase._id}/jurisdiction`, { method: 'PATCH', body: JSON.stringify({ jurisdictionMode: mode }) });
      await load();
    } catch (e) { setError(e); } finally { setBusy(false); }
  }

  if (!kase) return <section className="card">{error ? error : <><Spinner/> Loading case…</>}</section>;
  const openQuestions = (kase.questions || []).filter(q => !q.answered);
  const facts = kase.facts || {};
  const isStale = Boolean(assessment && kase.updatedAt && new Date(kase.updatedAt) > new Date(assessment.createdAt || 0));

  async function exportReport() {
    setBusy(true); setError(null);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/organizations/${org._id}/sahayak/cases/${kase._id}/report.pdf`, {
        headers: { authorization: `Bearer ${api.accessToken}` }
      });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error?.message || 'Report failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `IP-SAKTI-${kase.publicId}.pdf`; anchor.click();
      URL.revokeObjectURL(url);
    } catch (e) { setError(e); } finally { setBusy(false); }
  }

  return <>
    <Header eyebrow={`CASE · ${kase.publicId}${kase.language === 'hi' ? ' · हिन्दी' : ''}`} title={kase.title} subtitle={kase.status}
      action={<div className="row-actions">
        <JurisdictionSwitch value={currentJurisdiction} onChange={changeJurisdiction} disabled={busy}/>
        {onBack && <button className="secondary" onClick={onBack}>← Cases</button>}
        <button className="secondary" onClick={exportReport} disabled={busy || !assessment} title="Professional handoff PDF">Export report</button>
        <button className="secondary" onClick={() => runAssessment(true)} disabled={busy} title="Adds an untrusted test document to prove injection safety"><ShieldAlert size={15}/> Injection test</button>
        <button className="primary ipsk-btn" onClick={() => runAssessment(false)} disabled={busy}><FileSearch size={15}/> Run assessment</button>
      </div>}/>
    {kase.demoScenario && <div className="demo-banner" role="note">
      <strong>DEMO</strong>
      <span>This case was loaded from the SIH demo scenario. All product information is simulated for demonstration — no live regulatory, IP or government data is shown.</span>
    </div>}
    <InlineLlmBanner phase={llm.phase} info={llm.info}/>
    {error && <RecoveryHint error={error} onRetry={() => { setError(null); load(); }} onLoadDemo={loadDemo} onOpenSystem={() => { location.hash = '#/app/System'; }} onDismiss={() => setError(null)}/>}
    {busy && stage && <section className="card pipeline-status"><Spinner/> <span key={stage} className="stage-text">{stage}</span></section>}
    {isStale && <div className="stale-mark" role="status">
      <AlertTriangle size={14}/>
      <span>Product details have changed since the last assessment. <strong>Re-run the assessment</strong> to refresh the classification, regimes, evidence and action plan.</span>
    </div>}

    {/* CASE SUMMARY */}
    <section className="card case-summary">
      <div><small>Product</small><strong>{kase.productName || kase.title}</strong></div>
      <div><small>Goal</small><strong>{facts.commercialIntent === 'research_only' ? 'Research' : facts.targetMarket === 'india_and_export' ? 'Commercialize in India + export' : currentJurisdiction === 'INTL' ? 'International route planning' : 'Commercialize in India'}</strong></div>
      <div><small>Current status</small><strong className="capitalize">{kase.status.replaceAll('_', ' ')}</strong></div>
      {assessment && <div><small>Risk level</small><strong><span className={`badge ${CONF[assessment.confidence]}`}>{assessment.confidence}</span></strong></div>}
      {assessment && <div><small>Assessment</small>
        <strong className="assess-version" title={new Date(assessment.createdAt).toLocaleString()}>
          v{(kase.assessments || []).length} · {new Date(assessment.createdAt).toLocaleString()}
        </strong>
      </div>}
    </section>

    <div className="workspace-grid">
      <section className="card intake-card"><h3 className="card-h"><Leaf size={15}/> Product description</h3><p className="prewrap">{kase.productDescription || '—'}</p></section>

      <ProductProfileCard
        facts={facts}
        onSave={async (patch) => {
          setBusy(true); setError(null);
          try {
            await apiCall(api, `/api/organizations/${org._id}/sahayak/cases/${kase._id}/describe`, { method: 'POST', body: JSON.stringify({ factsPatch: patch }) });
            await load();
          } catch (e) { setError(e); } finally { setBusy(false); }
        }}
        busy={busy}
        isStale={isStale}
      />

      {openQuestions.length > 0 && <section className="card questions-card">
        <h3 className="card-h"><CircleAlert size={15}/> Before we assess this product, we need a few details</h3>
        <p className="muted small">Only questions that materially affect classification are asked.</p>
        <form onSubmit={submitAnswers}>
          {openQuestions.map((q, qi) => <div key={q.key} className="q-item">
            <div className="q-head">
              <strong>
                {qi + 1}. {q.question}
                {q.why && <span className="why-pill" tabIndex={0} role="note" data-tooltip={q.why}>Why this matters</span>}
              </strong>
              <span className="q-count">{qi + 1} of {openQuestions.length}</span>
            </div>
            {q.why && <small className="visible-why">{q.why}</small>}
            {QUESTION_OPTIONS[q.key]
              ? <div className="option-row wrap">{QUESTION_OPTIONS[q.key].map(opt =>
                  <button type="button" key={opt.value} className={`chip ${answers[q.key] === opt.value ? 'active' : ''}`} onClick={() => setAnswers(a => ({ ...a, [q.key]: opt.value }))}>{opt.label}</button>)}</div>
              : <input value={answers[q.key] || ''} onChange={e => setAnswers(a => ({ ...a, [q.key]: e.target.value }))} placeholder="Your answer…" required/>}
          </div>)}
          <button className="primary ipsk-btn" disabled={busy}>{busy ? <Spinner/> : <>Submit answers <Send size={13}/></>}</button>
        </form>
      </section>}

      {(kase.classification || assessment?.classification) && <ClassificationCard data={assessment?.classification || kase.classification}/>}

      {assessment && <>
        <JurisdictionNotice assessment={assessment}/>
        <NarrativeCard narrative={assessment.narrative} confidence={assessment.confidence}/>
        <ComplianceDashboard assessment={assessment}/>
        <CompliancePassportCard api={api} org={org} kase={kase} assessment={assessment}/>
        <ClaimsReviewCard api={api} org={org} kase={kase} assessment={assessment}/>
        <MarketRoutesCard assessment={assessment}/>
        <FilingPackCard assessment={assessment}/>
        <ChangeAlertsCard assessment={assessment}/>
        <SafetyPostMarketCard api={api} org={org} kase={kase} assessment={assessment} onRefresh={load}/>
        <WhatIfCard api={api} org={org} kase={kase}/>
        <KnowledgeGraphCard kase={kase}/>
        {assessment.jurisdictionMode === 'INTL' ? <InternationalPanel assessment={assessment}/> : <IpTkAbsCards assessment={assessment}/>} 
        <ActionPlan actions={assessment.actions}/>
        <RiskList risks={assessment.risks}/>
        <EvidencePanel evidence={assessment.evidence}/>
        <TimelineCard api={api} org={org} kase={kase}/>
        <UnknownsAssumptions unknowns={assessment.unknowns} assumptions={assessment.assumptions}/>
        <HumanReviewCard review={assessment.humanReview}/>
        <ReviewWorkflowCard api={api} org={org} kase={kase} assessment={assessment}/>
        <AssistantPanel api={api} org={org} kase={kase} onRefresh={load}/>
        <MetaStrip assessment={assessment}/>
      </>}
      {!assessment && !busy && !openQuestions.length && <section className="card empty-state">
        <FileSearch className="empty-leaf"/><h2>Ready for assessment</h2>
        <p className="muted">All critical classification questions are answered. Run the assessment to map the selected regulatory/IP layer with evidence.</p>
        <button className="primary ipsk-btn" onClick={() => runAssessment(false)}><FileSearch size={15}/> Run assessment</button>
      </section>}
    </div>
  </>;
}

const QUESTION_OPTIONS = {
  intendedUse: [
    { value: 'therapeutic_treatment', label: 'Treat/prevent disease' },
    { value: 'wellness_general', label: 'General wellness' },
    { value: 'food_consumption', label: 'Food/nutrition' },
    { value: 'external_cosmetic', label: 'Cosmetic' },
    { value: 'research', label: 'Other / research' }
  ],
  routeOfAdministration: [
    { value: 'oral', label: 'Oral' },
    { value: 'topical', label: 'Topical' },
    { value: 'other', label: 'Other' }
  ],
  classicalSource: [
    { value: 'authoritative_text_named', label: 'Yes' },
    { value: 'not_from_any_text_new_formulation', label: 'No' },
    { value: 'unknown', label: 'Not sure' }
  ],
  commercialIntent: [
    { value: 'yes_commercial_sale_india', label: 'Sell commercially in India' },
    { value: 'research_only', label: 'Research only' },
    { value: 'personal_use', label: 'Personal use' },
    { value: 'export_related', label: 'Export related' }
  ],
  newProcess: [
    { value: 'yes', label: 'Yes' },
    { value: 'no', label: 'No' },
    { value: 'unknown', label: 'Not sure' }
  ]
};

const pretty = v => (v == null || v === '' || ['none_stated'].includes(v)) ? '' : String(v).replaceAll('_', ' ').replace(/^./, c => c.toUpperCase());

export function ProductProfileCard({ facts, onEdit, onSave, busy, isStale }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  useEffect(() => { setDraft(facts || {}); }, [facts]);
  const rows = [
    ['Ingredients', (facts.ingredients || []).map(i => i.name).join(', ')],
    ['Claims', (facts.claims || []).join('; ')],
    ['Intended use', pretty(facts.intendedUse)],
    ['Dosage form', pretty(facts.dosageForm)],
    ['Route', pretty(facts.routeOfAdministration)],
    ['Classical formulation', pretty(facts.classicalSource)],
    ['New process', pretty(facts.newProcess)],
    ['Traditional knowledge', pretty(facts.traditionalKnowledgeUse)],
    ['Biological resources', (facts.ingredients || []).some(i => i.biologicalResource) ? 'Yes' : ''],
    ['Manufacturing location', pretty(facts.manufacturingLocation)]
  ];
  const shown = rows.filter(([, v]) => v && v !== '—' && v !== 'Unknown');
  if (!shown.length && !editing) return null;
  function startEdit() { setEditing(true); onEdit?.(); }
  function cancel() { setEditing(false); setDraft(facts || {}); }
  function save() {
    const patch = {};
    for (const k of ['intendedUse', 'dosageForm', 'routeOfAdministration', 'classicalSource', 'newProcess', 'traditionalKnowledgeUse', 'biologicalOriginIndia', 'commercialIntent', 'targetMarket']) {
      if (draft[k] && draft[k] !== facts?.[k]) patch[k] = draft[k];
    }
    onSave?.(patch);
    setEditing(false);
  }
  return <section className="card profile-card">
    <h3 className="card-h">
      <Leaf size={15}/> Product profile
      {!editing && onSave && <button className="edit-facts-trigger" style={{ marginLeft: 'auto' }} onClick={startEdit}>Edit details</button>}
    </h3>
    {isStale && !editing && <div className="stale-mark" role="status">
      <AlertTriangle size={14}/> Product details have changed. The current assessment may need to be recalculated.
    </div>}
    {!editing ? (
      <dl className="profile-dl">{shown.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
    ) : (
      <>
        <div className="fact-edit-grid">
          <label>Intended use<select value={draft.intendedUse || ''} onChange={e => setDraft(d => ({ ...d, intendedUse: e.target.value }))}>
            <option value="">—</option>
            <option value="therapeutic_treatment">Treat / prevent disease</option>
            <option value="wellness_general">General wellness</option>
            <option value="food_consumption">Food / nutrition</option>
            <option value="external_cosmetic">Cosmetic</option>
            <option value="research">Research</option>
            <option value="trade_raw_material">Raw material trade</option>
          </select></label>
          <label>Dosage form<select value={draft.dosageForm || ''} onChange={e => setDraft(d => ({ ...d, dosageForm: e.target.value }))}>
            <option value="">—</option>
            <option value="tablet">Tablet</option>
            <option value="capsule">Capsule</option>
            <option value="powder_churna">Powder / churna</option>
            <option value="liquid_syrup_arishta">Syrup / arishta / kadha</option>
            <option value="oil_taila">Oil / taila</option>
            <option value="cream_ointment">Cream / ointment</option>
            <option value="extract_concentrate">Extract</option>
            <option value="raw_herb_powder_bulk">Raw herb powder (bulk)</option>
            <option value="other">Other</option>
          </select></label>
          <label>Route<select value={draft.routeOfAdministration || ''} onChange={e => setDraft(d => ({ ...d, routeOfAdministration: e.target.value }))}>
            <option value="">—</option>
            <option value="oral">Oral</option>
            <option value="topical">Topical</option>
            <option value="nasal">Nasal</option>
            <option value="other">Other</option>
          </select></label>
          <label>Classical formulation<select value={draft.classicalSource || ''} onChange={e => setDraft(d => ({ ...d, classicalSource: e.target.value }))}>
            <option value="">—</option>
            <option value="authoritative_text_named">Yes — from authoritative text</option>
            <option value="claims_classical_but_unnamed">Claimed classical (text not named)</option>
            <option value="not_from_any_text_new_formulation">No — new formulation</option>
          </select></label>
          <label>New process<select value={draft.newProcess || ''} onChange={e => setDraft(d => ({ ...d, newProcess: e.target.value }))}>
            <option value="">—</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
            <option value="unknown">Not sure</option>
          </select></label>
          <label>Biological resources<select value={draft.biologicalOriginIndia || ''} onChange={e => setDraft(d => ({ ...d, biologicalOriginIndia: e.target.value }))}>
            <option value="">—</option>
            <option value="yes">Yes — sourced in India</option>
            <option value="no">No</option>
            <option value="unknown">Not sure</option>
          </select></label>
          <label>Traditional knowledge<select value={draft.traditionalKnowledgeUse || ''} onChange={e => setDraft(d => ({ ...d, traditionalKnowledgeUse: e.target.value }))}>
            <option value="">—</option>
            <option value="direct_traditional_use">Direct traditional use</option>
            <option value="modified_traditional">Modified traditional</option>
            <option value="fully_novel">Fully novel</option>
          </select></label>
          <label>Commercialization<select value={draft.commercialIntent || ''} onChange={e => setDraft(d => ({ ...d, commercialIntent: e.target.value }))}>
            <option value="">—</option>
            <option value="yes_commercial_sale_india">Sell in India</option>
            <option value="research_only">Research only</option>
            <option value="personal_use">Personal use</option>
            <option value="export_related">Export related</option>
          </select></label>
        </div>
        <div className="recalc-warn">
          <AlertTriangle size={14}/>
          <span>Changing these fields will mark the current assessment as <strong>may need recalculation</strong>. You can re-run the assessment at any time.</span>
        </div>
        <div className="row-actions" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="secondary" onClick={cancel} disabled={busy}>Cancel</button>
          <button className="primary ipsk-btn" onClick={save} disabled={busy}>{busy ? <Spinner/> : 'Save changes'}</button>
        </div>
      </>
    )}
  </section>;
}

/* ---- In-case assistant ("IP-SAKTI Assistant") ---- */
export function AssistantPanel({ api, org, kase, onRefresh }) {
  const [log, setLog] = useState(kase.assistantMessages || []), [text, setText] = useState(''), [sending, setSending] = useState(false), [error, setError] = useState('');
  useEffect(() => { setLog(kase.assistantMessages || []); }, [kase._id]);
  const suggestions = ['Why this classification?', 'What are my next steps?', 'Explain the ABS screen', 'Is my brand name protectable?'];
  async function ask(question) {
    const q = String(question ?? text).trim(); if (!q || sending) return;
    setSending(true); setError(''); setText('');
    setLog(l => [...l, { role: 'user', content: q }, { role: 'assistant', content: '' }]);
    try {
      // Use the streaming endpoint so the judge demo feels live; fall back to JSON if SSE is unavailable.
      const base = (import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`);
      const headers = new Headers({ 'content-type': 'application/json', authorization: `Bearer ${api.accessToken}` });
      let response = await fetch(`${base}/api/organizations/${org._id}/sahayak/cases/${kase._id}/ask-stream`, { method: 'POST', credentials: 'include', headers, body: JSON.stringify({ question: q }) });
      if (!response.ok) {
        const fallback = await apiCall(api, `/api/organizations/${org._id}/sahayak/cases/${kase._id}/ask`, { method: 'POST', body: JSON.stringify({ question: q }) });
        setLog(l => { const copy = [...l]; copy[copy.length - 1] = { role: 'assistant', content: fallback.answer }; return copy; });
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalText = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, idx); buffer = buffer.slice(idx + 2);
          const line = frame.split('\n').find(l => l.startsWith('data: '));
          if (!line) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'token' && event.text) {
              finalText += event.text;
              setLog(l => { const copy = [...l]; copy[copy.length - 1] = { role: 'assistant', content: finalText }; return copy; });
            } else if (event.type === 'done') {
              finalText = event.answer || finalText;
              setLog(l => { const copy = [...l]; copy[copy.length - 1] = { role: 'assistant', content: finalText }; return copy; });
            }
          } catch { /* ignore malformed frame */ }
        }
      }
    } catch (e) { setError(e.message); } finally { setSending(false); onRefresh?.(); }
  }
  return <section className="card assistant-card">
    <h3 className="card-h"><Sparkles size={15}/> IP-SAKTI Assistant <small>case-aware · answers only from this case's verified information</small></h3>
    <div className="assistant-log">
      {!log.length && <p className="muted small">Ask follow-up questions about this case — classification, regimes, sources or next actions.</p>}
      {log.map((m, i) => <div key={i} className={`assistant-msg ${m.role}`}><small>{m.role === 'user' ? 'You' : 'IP-SAKTI Assistant'}</small><p>{m.content || (sending && i === log.length - 1 ? <><span className="thinking-dots"><i/><i/><i/></span> generating…</> : '')}</p></div>)}
    </div>
    <div className="option-row wrap">{suggestions.map(s => <button key={s} type="button" className="chip" onClick={() => ask(s)} disabled={sending}>{s}</button>)}</div>
    <form className="assistant-composer" onSubmit={e => { e.preventDefault(); ask(); }}>
      <input value={text} onChange={e => setText(e.target.value)} placeholder="Ask about this case…" disabled={sending}/>
      <button className="primary ipsk-btn" disabled={sending || !text.trim()}><Send size={14}/></button>
    </form>
    {error && <div className="alert" role="alert">{error}</div>}
  </section>;
}

export function TimelineCard({ api, org, kase }) {
  const [timeline, setTimeline] = useState(null);
  useEffect(() => {
    if (!kase?.latestAssessment) return;
    apiCall(api, `/api/organizations/${org._id}/sahayak/cases/${kase._id}/timeline`).then(setTimeline).catch(() => setTimeline({ nodes: [], edges: [] }));
  }, [kase?._id, Boolean(kase?.latestAssessment)]);
  if (!kase.latestAssessment || !timeline) return null;
  const edgesFor = key => timeline.edges.filter(e => e.from === key || e.to === key);
  return <section className="card">
    <h3 className="card-h"><History size={15}/> Legal timeline of cited sources</h3>
    {!timeline.nodes.length && <p className="muted small">No cited sources yet.</p>}
    <div className="timeline">
      {timeline.nodes.map(node => (
        <div key={node.sourceKey} className={`tl-item ${node.cited ? 'tl-cited' : ''}`}>
          <i className="tl-dot"/>
          <div className="tl-body">
            <strong>{node.title}</strong>
            <div className="tl-meta">
              <span className={`badge ${node.status === 'CURRENT' ? SEVERITY.GREEN : node.status === 'HISTORICAL' ? SEVERITY.GREY : node.status === 'DRAFT' ? SEVERITY.RED : SEVERITY.GREY}`}>{node.status}</span>
              <small>{node.effectiveFrom || node.publicationDate || 'date n/a'}{node.effectiveTo ? ` → ${node.effectiveTo}` : ''}</small>
              {node.cited && <span className="badge sev-green">cited in this case</span>}
            </div>
            {edgesFor(node.sourceKey).map((edge, i) => (
              <small key={i} className="tl-edge">{edge.from === node.sourceKey ? `↔ ${edge.type}: ${edge.to}` : `↖ ${edge.type} from ${edge.from}`}</small>
            ))}
          </div>
        </div>
      ))}
    </div>
  </section>;
}

export function ClassificationCard({ data }) {
  return <section className="card classify-card">
    <h3 className="card-h"><BadgeCheck size={15}/> Product classification</h3>
    <div className="classify-main">
      <strong>{data.labelLocalized || data.primary?.replaceAll('_', ' ')}</strong>
      {data.labelLocalized && <small className="muted">{data.primary.replaceAll('_', ' ')}</small>}
      <span className={`badge ${CONF[data.confidence] || ''}`}>Confidence: {data.confidence}</span>
    </div>
    <p className="muted">{data.rationale}</p>
    {!!data.missingInformation?.length && <p><small>Missing critical facts: {data.missingInformation.join(', ')}</small></p>}
    {!!data.alternatives?.length && <p><small>Possible alternatives: {data.alternatives.map(x => x.replaceAll('_', ' ')).join(', ')}</small></p>}
  </section>;
}

export function NarrativeCard({ narrative, confidence }) {
  return <section className="card narrative-card">
    <h3 className="card-h"><Scale size={15}/> Assessment</h3>
    <p className="narrative-assessment">{narrative?.assessment}</p>
    <p className="muted">{narrative?.meaning}</p>
    <span className={`badge ${CONF[confidence]}`}>Derived confidence: {confidence}</span>
  </section>;
}

export function ComplianceDashboard({ assessment }) {
  const regimes = [...(assessment.regimes || [])].sort((a, b) =>
    RELEVANCE_ORDER.indexOf(a.relevance) - RELEVANCE_ORDER.indexOf(b.relevance));
  return <section className="card regimes-card">
    <h3 className="card-h"><BookOpen size={15}/> Applicable Indian regimes</h3>
    <div className="regime-grid">
      {regimes.map(r => {
        const sev = r.relevance === 'APPLICABLE' ? 'sev-red-border' : r.relevance === 'POSSIBLY_APPLICABLE' ? 'sev-yellow-border' : r.relevance === 'REVIEW_RECOMMENDED' ? 'sev-yellow-border soft' : 'sev-grey-border';
        return <article key={r.regime} className={`regime-card ${sev}`}>
          <header><strong>{r.labelLocalized || r.regime.replaceAll('_', ' & / ')}</strong><small>{r.label}</small></header>
          <span className="relevance">{r.relevanceLocalized || r.relevance.replaceAll('_', ' ').toLowerCase()}</span>
          <p className="muted small">{r.why}</p>
          {!!r.whatToDo?.length && <ul className="tiny-list">{r.whatToDo.map((t, i) => <li key={i}>{t}</li>)}</ul>}
        </article>;
      })}
    </div>
  </section>;
}

export function KnowledgeGraphCard({ kase }) {
  return <section className="card">
    <h3 className="card-h"><Sparkles size={15}/> Case knowledge graph
      <small style={{ marginLeft: 'auto', fontWeight: 400, color: '#7a7a92' }}>Product · Ingredients · Classification · Regimes · Evidence</small>
    </h3>
    <React.Suspense fallback={<div className="muted small" style={{ padding: '20px', textAlign: 'center' }}>Loading graph…</div>}>
      <LazyKnowledgeGraph kase={kase}/>
    </React.Suspense>
  </section>;
}

function JurisdictionNotice({ assessment }) {
  const international = assessment?.jurisdictionMode === 'INTL';
  return <section className={`jurisdiction-notice ${international ? 'international' : 'india'}`} role="status">
    <div className="jurisdiction-notice-icon"><Globe2 size={18}/></div>
    <div><strong>{international ? 'International answer set' : 'India answer set'}</strong><p>{assessment?.jurisdictionNote || (international ? 'Treaty, filing-system and export-market pointers only. Verify target-country law before acting.' : 'Indian statutes, rules, regulators and TK/ABS pathways only.')}</p></div>
    <span className="jurisdiction-lock">{international ? 'India sources excluded' : 'International sources excluded'}</span>
  </section>;
}

function InternationalPanel({ assessment }) {
  const regimes = (assessment?.regimes || []).filter(r => r.regime !== 'OTHER');
  return <section className="card international-panel">
    <div className="international-panel-head"><div><p className="eyebrow">INTERNATIONAL ROUTE MAP</p><h3 className="card-h"><Globe2 size={16}/> Treaties, filing systems &amp; market access</h3></div><span className="badge sev-yellow">Target-country review</span></div>
    <p className="muted small">These are separated pointers, not a worldwide approval or patentability opinion. Each route keeps its official source attached in Evidence &amp; Sources.</p>
    <div className="international-grid">
      {regimes.map(r => <article key={r.regime} className="international-route">
        <div className="international-route-top"><strong>{r.label || r.regime}</strong><span className={`badge ${r.relevance === 'POSSIBLY_APPLICABLE' ? 'sev-yellow' : r.relevance === 'INSUFFICIENT_INFORMATION' ? 'sev-grey' : 'sev-green'}`}>{r.relevance.replaceAll('_', ' ')}</span></div>
        <p>{r.why}</p>
        {!!r.whatToDo?.length && <ul className="tiny-list">{r.whatToDo.slice(0, 2).map((todo, i) => <li key={i}>{todo}</li>)}</ul>}
      </article>)}
    </div>
  </section>;
}

export function IpTkAbsCards({ assessment }) {
  const ip = assessment.ipConsiderations || {};
  const tk = assessment.tkConsiderations || {};
  const abs = assessment.absScreen || {};
  return <section className="card">
    <h3 className="card-h"><FlaskConical size={15}/> IP · Traditional knowledge · ABS screens</h3>
    <div className="screen-grid">
      <div className="screen-block">
        <h4>Patent considerations <em>never a patentability opinion</em></h4>
        <p className="small">{ip.patent?.note}</p>
        <ul className="tiny-list">{(ip.patent?.points || []).map((p, i) => <li key={i}>{p}</li>)}</ul>
      </div>
      <div className="screen-block">
        <h4>Traditional knowledge / s.3(p)</h4>
        <span className={`badge ${tk.level === 'NO_POTENTIAL_ISSUE_IDENTIFIED' ? SEVERITY.GREY : SEVERITY.YELLOW}`}>{tk.level?.replaceAll('_', ' ')}</span>
        <p className="small muted">{tk.why}</p>
        <ul className="tiny-list">{(tk.whatToVerify || []).map((p, i) => <li key={i}>{p}</li>)}</ul>
      </div>
      <div className="screen-block">
        <h4>Biodiversity / ABS screen</h4>
        <span className={`badge ${abs.relevance === 'NO_APPARENT_INDICATION' ? SEVERITY.GREEN : abs.relevance === 'YES' ? SEVERITY.RED : SEVERITY.YELLOW}`}>
          ABS relevance: {abs.relevance?.replaceAll('_', ' ')}
        </span>
        <p className="small muted">{abs.reason}</p>
        <ul className="tiny-list">{(abs.obligations || []).map((p, i) => <li key={i}>{p}</li>)}</ul>
        <small>Authority: {abs.authority}</small>
      </div>
    </div>
  </section>;
}

export function ActionPlan({ actions }) {
  const [openIdx, setOpenIdx] = useState(null);
  if (!actions?.length) return null;
  return <section className="card">
    <h3 className="card-h"><Check size={15}/> What should I do next? <small>click an action to see why it was recommended</small></h3>
    <ol className="action-list">
      {[...actions].sort((a, b) => ({ HIGH: 0, MEDIUM: 1, LOW: 2 })[a.priority] - ({ HIGH: 0, MEDIUM: 1, LOW: 2 })[b.priority]).map((a, i) =>
        <li key={i} className={a.requiresProfessional ? 'pro-action' : ''}>
          <button type="button" className="action-row" onClick={() => setOpenIdx(openIdx === i ? null : i)}>
            <span className={`priority p-${a.priority.toLowerCase()}`}>{a.priority}</span>
            <div className="action-text"><strong>{a.title}</strong>{a.regime && <small> · {a.regime.replaceAll('_', ' ')}</small>}{a.requiresProfessional && <small> · professional recommended</small>}</div>
            {a.why && <ChevronRight size={14} className={`chev ${openIdx === i ? 'open' : ''}`}/>}
          </button>
          {openIdx === i && a.why && <p className="action-why"><strong>Why:</strong> {a.why}</p>}
        </li>)}
    </ol>
  </section>;
}

export function RiskList({ risks }) {
  if (!risks?.length) return null;
  return <section className="card">
    <h3 className="card-h"><AlertTriangle size={15}/> Risks</h3>
    {risks.map((r, i) => <div key={i} className={`risk-row ${SEVERITY[r.severity] || SEVERITY.GREY}`}>
      <i/>{r.description}{r.evidenceRefs?.length && <small> [{r.evidenceRefs.join(', ')}]</small>}
    </div>)}
  </section>;
}

// Sort evidence so the strongest verified claim appears first; mark it as "top" so we can pin it.
function rankEvidence(evidence) {
  const score = e => {
    if (e.untrustedDocumentFlagged) return 0;
    if (e.supportLevel === 'DIRECTLY_SUPPORTED' && e.verified) return 100;
    if (e.supportLevel === 'STRONG_INFERENCE' && e.verified) return 80;
    if (e.supportLevel === 'INTERPRETATION_REQUIRED' && e.verified) return 60;
    if (e.supportLevel === 'CONFLICTING_AUTHORITIES') return 20;
    if (e.supportLevel === 'UNSUPPORTED') return 10;
    return 40;
  };
  return [...(evidence || [])]
    .map((e, i) => ({ e, i, s: score(e) }))
    .sort((a, b) => b.s - a.s);
}

export function EvidencePanel({ evidence }) {
  const [openKey, setOpenKey] = useState(null);
  if (!evidence?.length) return null;
  const ranked = rankEvidence(evidence);
  const topIdx = ranked.length ? ranked[0].i : -1;
  return <section className="card">
    <h3 className="card-h"><FileSearch size={15}/> Evidence & citations <small>({evidence.filter(e => e.verified).length}/{evidence.length} verified · strongest is pinned first)</small></h3>
    {ranked.map(({ e, i }) => {
      const key = `${e.sourceKey}-${i}`;
      const tone = e.untrustedDocumentFlagged ? SEVERITY.RED : e.supportLevel === 'DIRECTLY_SUPPORTED' ? SEVERITY.GREEN : e.supportLevel === 'UNSUPPORTED' || e.supportLevel === 'CONFLICTING_AUTHORITIES' ? SEVERITY.RED : e.supportLevel === 'STRONG_INFERENCE' ? SEVERITY.YELLOW : SEVERITY.GREY;
      const isPinned = i === topIdx && e.verified && (e.supportLevel === 'DIRECTLY_SUPPORTED' || e.supportLevel === 'STRONG_INFERENCE');
      return <details key={key} className={`evidence-item ${tone} ${isPinned ? 'pin-top' : ''}`} open={openKey === key || isPinned}>
        <summary onClick={ev => { ev.preventDefault(); setOpenKey(openKey === key ? null : key); }}>
          <span className={`dot ${tone}`}/>
          {isPinned && <span className="pin-badge">Top evidence</span>}
          <span className="ev-claim">{e.claim}</span>
          <span className="ev-src">{e.sourceTitle || e.sourceKey}</span>
          <span className={`badge ${tone}`}>{e.untrustedDocumentFlagged ? 'untrusted doc' : e.supportLevel?.replaceAll('_', ' ').toLowerCase()}</span>
        </summary>
        <div className="ev-body">
          <dl>
            <dt>Authority</dt><dd>{e.authority || '—'} {e.status && `(status: ${e.status}${e.effectiveFrom ? `, effective ${e.effectiveFrom}` : ''})`}</dd>
            <dt>Section</dt><dd>{e.section || '—'}</dd>
            <dt>Jurisdiction</dt><dd>IN (India only corpus)</dd>
            <dt>Verification notes</dt><dd>{e.verificationNotes?.length ? e.verificationNotes.join('; ') : 'Passed source, jurisdiction, status, date and passage checks.'}</dd>
            {e.url && <><dt>Official URL</dt><dd><a href={e.url} target="_blank" rel="noreferrer">{e.url} <ExternalLink size={11}/></a></dd></>}
            {e.passage && <><dt>Supporting passage</dt><dd><blockquote className="evidence-passage">{e.passage}</blockquote></dd></>}
          </dl>
        </div>
      </details>;
    })}
  </section>;
}

export function UnknownsAssumptions({ unknowns, assumptions }) {
  return <section className="card two-col-cards">
    <div><h3 className="card-h"><X size={15}/> What we don't know</h3><ul className="tiny-list">{unknowns.map((u, i) => <li key={i}>{u}</li>)}</ul></div>
    <div><h3 className="card-h">Assumptions</h3><ul className="tiny-list">{assumptions.map((u, i) => <li key={i}>{u}</li>)}</ul></div>
  </section>;
}

export function HumanReviewCard({ review }) {
  if (!review) return null;
  return <section className={`card human-review ${review.required ? 'hr-required' : ''}`}>
    <h3 className="card-h"><ShieldCheck size={15}/> Human review {review.required ? 'REQUIRED' : '(optional)'}</h3>
    <p><strong>Why:</strong> {review.reason}</p>
    {!!review.unresolvedQuestions?.length && <p><strong>Unresolved:</strong> {review.unresolvedQuestions.join('; ')}</p>}
    <p><strong>Recommended professional:</strong> {review.recommendedProfessional}</p>
  </section>;
}

function MetaStrip({ assessment }) {
  return <p className="meta-strip">
    {assessment.llmUsed ? 'Explanation synthesised by LLM over verified evidence' : 'LLM unavailable — deterministic template output (nothing fabricated)'}
    {' '}· as of {assessment.asOfDate} · {assessment.jurisdictionLabel || 'India'} corpus
    {assessment.createdAt && <> · assessment generated {new Date(assessment.createdAt).toLocaleString()}</>}
  </p>;
}

/* ---------------- Legal sources (KB UI) ---------------- */
export function LegalSourcesPage({ api }) {
  const [sources, setSources] = useState(null), [statusFilter, setStatusFilter] = useState('*'), [jurisdictionFilter, setJurisdictionFilter] = useState('*'), [openSource, setOpenSource] = useState(null), [chunks, setChunks] = useState(null);
  useEffect(() => { apiCall(api, '/api/sahayak/sources').then(setSources).catch(() => setSources([])); }, []);
  async function open(key) {
    setOpenSource(key); setChunks(null);
    const data = await apiCall(api, `/api/sahayak/sources/${key}/chunks`);
    setChunks(data);
  }
  const filtered = (sources || []).filter(s => (statusFilter === '*' || s.status === statusFilter) && (jurisdictionFilter === '*' || (s.jurisdiction || 'IN') === jurisdictionFilter));
  return <>
    <Header eyebrow="AUTHORITY-AWARE CORPUS" title="Jurisdiction-tagged legal knowledge base" subtitle="Every conclusion in this system traces to a source tagged by jurisdiction. Levels: 1 Act/Treaty · 2 Regulation/guidance · 3 Official portals · 4 Restricted official databases."/>
    <div className="kb-filters">
      {['*', 'CURRENT', 'HISTORICAL', 'DRAFT', 'UNKNOWN'].map(s =>
        <button key={s} className={`chip ${statusFilter === s ? 'active' : ''}`} onClick={() => setStatusFilter(s)}>{s === '*' ? 'All' : s}</button>)}
      <span className="kb-filter-divider" aria-hidden="true"/>
      {['*', 'IN', 'INTL'].map(s => <button key={s} className={`chip ${jurisdictionFilter === s ? 'active' : ''}`} onClick={() => setJurisdictionFilter(s)}>{s === '*' ? 'All jurisdictions' : s === 'IN' ? 'India' : 'International'}</button>)}
    </div>
    {!sources && <section className="card"><Spinner/></section>}
    <div className="card kb-table">
      <div className="table-head"><span>Document</span><span>Jurisdiction</span><span>Authority</span><span>Lvl</span><span>Status</span><span>Effective</span><span>Chunks</span><span>Last verified</span></div>
      {filtered.map(s => <>
        <div key={s.sourceKey} className={`table-row clickable ${openSource === s.sourceKey ? 'active-row' : ''}`} onClick={() => open(s.sourceKey)}>
          <span className="source-name"><BookOpen/><span><strong>{s.title}</strong><small>{s.sourceKey}</small></span></span>
          <span><span className={`badge ${(s.jurisdiction || 'IN') === 'INTL' ? 'sev-yellow' : 'sev-green'}`}>{s.jurisdiction || 'IN'}</span></span><span>{s.authority}</span><span>{s.sourceLevel}</span>
          <span><span className={`badge ${s.status === 'CURRENT' ? SEVERITY.GREEN : s.status === 'HISTORICAL' ? SEVERITY.GREY : s.status === 'DRAFT' ? SEVERITY.RED : SEVERITY.GREY}`}>{s.status}</span></span>
          <span>{s.effectiveFrom || '—'}</span><span>{s.chunkCount}</span><span>{s.lastVerifiedAt || '—'}</span>
        </div>
        {openSource === s.sourceKey && <div key={`${s.sourceKey}-detail`} className="chunk-detail">
          {!chunks && <Spinner/>}
          {chunks && <>
            <p className="small muted">{chunks.source.notes} {chunks.source.url && <a href={chunks.source.url} target="_blank" rel="noreferrer">official source <ExternalLink size={11}/></a>}</p>
            {chunks.chunks.map(c => <blockquote key={c.chunkIndex}>
              <strong>{c.sectionLabel || '§ general'}</strong>
              <p>{c.text}</p>
              <footer>{c.metadata?.version && `version ${c.metadata.version} · `}status {c.metadata?.status}{c.metadata?.containsInstructionPatterns ? ' · ⚠ instruction-like text flagged' : ''}</footer>
            </blockquote>)}
          </>}
        </div>}
      </>)}
    </div>
  </>;
}

/* ---------------- Evaluation harness page ---------------- */
export function EvaluationPage({ api, org }) {
  const [latest, setLatest] = useState(null), [history, setHistory] = useState([]), [running, setRunning] = useState(false), [error, setError] = useState('');
  async function load() {
    const data = await apiCall(api, `/api/organizations/${org._id}/sahayak/evaluation`);
    setLatest(data.latest); setHistory(data.history || []);
  }
  useEffect(() => { load().catch(e => setError(e.message)); }, [org._id]);
  async function run() {
    setRunning(true); setError('');
    try { await apiCall(api, `/api/organizations/${org._id}/sahayak/evaluation/run`, { method: 'POST' }); await load(); }
    catch (e) { setError(e.message); } finally { setRunning(false); }
  }

  return <>
    <Header eyebrow="QUALITY ASSURANCE" title="Evaluation harness" subtitle="Reproducible benchmark suite over the deterministic engines: classification accuracy, temporal reasoning, citation integrity, ABS screening, prompt-injection safety and Hindi intake consistency."
      action={<button className="primary" onClick={run} disabled={running}>{running ? <><Spinner/> Running suite…</> : <><FlaskConical size={15}/> Run evaluation</>}</button>}/>
    {error && <div className="alert page-alert" role="alert">{error}</div>}
    {latest && <>
      <div className="metrics">
        <Metric label="Pass rate" value={`${latest.summary.passRate}%`} sub={`${latest.summary.passed}/${latest.summary.total} cases passed`}/>
        <Metric label="Duration" value={`${latest.durationMs} ms`} sub="engine-only (no LLM calls)"/>
        <Metric label="Suite" value={latest.suiteVersion} sub={`run ${new Date(latest.createdAt).toLocaleString()}`}/>
        <Metric label="Environment" value={(latest.environment?.provider || '').toUpperCase()} sub={latest.environment?.model}/>
      </div>
      <section className="card">
        <h3 className="card-h"><BadgeCheck size={15}/> Dimension breakdown</h3>
        <div className="dim-grid">
          {Object.entries(latest.summary.dimensions || {}).map(([name, dim]) => (
            <div key={name} className="dim-item">
              <div className="dim-head"><small>{name.replaceAll('_', ' ')}</small><strong className={dim.rate === 100 ? 'sev-green-text' : dim.rate >= 60 ? '' : 'sev-red-text'}>{dim.rate}%</strong></div>
              <i className="dim-bar"><b style={{ width: `${dim.rate}%`, background: dim.rate === 100 ? '#22c55e' : dim.rate >= 60 ? '#eab308' : '#ef4444' }}/></i>
              <small className="muted">{dim.passed}/{dim.total}</small>
            </div>
          ))}
        </div>
      </section>
      <section className="card">
        <h3 className="card-h"><FileSearch size={15}/> Case results</h3>
        {latest.results.map((r, i) => (
          <details key={i} className={`evidence-item ${r.passed ? SEVERITY.GREEN : SEVERITY.RED}`}>
            <summary>
              <span className={`dot ${r.passed ? SEVERITY.GREEN : SEVERITY.RED}`}/>
              <span className="ev-claim">{r.name}</span>
              <span className="ev-src">{r.dimension}</span>
              <span className={`badge ${r.passed ? SEVERITY.GREEN : SEVERITY.RED}`}>{r.passed ? 'pass' : 'fail'}</span>
            </summary>
            <div className="ev-body"><dl>
              <dt>Expected</dt><dd>{String(r.expected)}</dd>
              <dt>Actual</dt><dd>{r.actual}</dd>
              {r.detail && <><dt>Detail</dt><dd>{r.detail}</dd></>}
            </dl></div>
          </details>
        ))}
      </section>
    </>}
    {!latest && !running && !error && <EmptyStateInline title="No evaluation runs yet" text="Run the benchmark suite to verify engine behaviour before your demo — it takes under a second."/>}
    {!!history.length && <section className="card"><h3 className="card-h"><History size={15}/> Run history</h3>
      {history.map((h, i) => <div key={i} className="risk-row sev-grey"><i/><strong>{new Date(h.createdAt).toLocaleString()}</strong><span>{h.summary?.passRate ?? '—'}% · {h.durationMs}ms</span></div>)}
    </section>}
  </>;
}

function EmptyStateInline({ title, text }) {
  return <section className="card empty-state"><FlaskConical className="empty-leaf"/><h2>{title}</h2><p className="muted">{text}</p></section>;
}

/* ---------------- Dev / admin panel ---------------- */
export function DevPanelPage({ api }) {
  const [system, setSystem] = useState(null), [error, setError] = useState('');
  useEffect(() => {
    const load = () => apiCall(api, '/api/sahayak/admin/system').then(setSystem).catch(e => setError(e.message));
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);
  if (error) return <section className="alert page-alert">{error}</section>;
  if (!system) return <section className="card"><Spinner/></section>;
  const { llm, retrieval, knowledgeBase: kb } = system;
  return <>
    <Header eyebrow="DEVELOPER" title="System panel" subtitle="Provider, connectivity, retrieval, corpus status and admin ingestion for the SIH demo."/>
    <div className="metrics dev-metrics">
      <Metric label="LLM provider" value={(llm.provider || '').toUpperCase()} sub={llm.baseURL}/>
      <Metric label="Model" value={llm.model || '—'} sub={llm.embeddingModel ? `embeddings: ${llm.embeddingModel}` : 'no embeddings configured'}/>
      <Metric label="LLM connection" value={llm.connectivity} sub={llm.latencyMs != null ? `${llm.latencyMs} ms` : llm.note}/>
      <Metric label="Retrieval" value="READY" sub={retrieval.mode}/>
    </div>
    <CorpusHealthCard kb={kb}/>
    <CorpusIngestPanel api={api}/>
    <KnowledgeBaseStatsCard kb={kb}/>
    <ConfigCard llm={llm}/>
  </>;
}

function CorpusHealthCard({ kb }) {
  const lat = kb.retrievalLatencyMs || { p50: 0, p95: 0, samples: 0 };
  const total = Math.max(1, (kb.byRegime ? Object.values(kb.byRegime).reduce((a, b) => a + b, 0) : 0));
  return <section className="card">
    <h3 className="card-h"><Activity size={15}/> Corpus health</h3>
    <div className="kb-stats">
      <div><strong>{lat.p50} ms</strong><small>retrieval p50</small></div>
      <div><strong>{lat.p95} ms</strong><small>retrieval p95</small></div>
      <div><strong>{lat.samples}</strong><small>live samples</small></div>
      <div><strong>{kb.authoritative}</strong><small>authoritative</small></div>
    </div>
    <p className="eyebrow" style={{ marginTop: 14 }}>PER REGIME</p>
    <div className="status-badges">
      {Object.entries(kb.byRegime || {}).sort((a, b) => b[1] - a[1]).map(([r, c]) => <span key={r} className="chip static">{r}: {c}</span>)}
    </div>
    <p className="eyebrow" style={{ marginTop: 14 }}>PER AUTHORITY LEVEL</p>
    <div className="status-badges">
      {Object.entries(kb.byLevel || {}).map(([l, c]) => <span key={l} className="chip static">{l}: {c}</span>)}
    </div>
    <p className="eyebrow" style={{ marginTop: 14 }}>FRESHNESS</p>
    <div className="status-badges">
      <span className="chip static">&lt; 1 year: {kb.freshness?.last_year || 0}</span>
      <span className="chip static">1–3 years: {kb.freshness?.['1_to_3_years'] || 0}</span>
      <span className="chip static">3–10 years: {kb.freshness?.['3_to_10_years'] || 0}</span>
      <span className="chip static">older: {kb.freshness?.older || 0}</span>
      <span className="chip static">no date: {kb.freshness?.no_date || 0}</span>
    </div>
  </section>;
}

function CorpusIngestPanel({ api }) {
  const [busy, setBusy] = useState(false), [result, setResult] = useState(null), [error, setError] = useState(''), [mode, setMode] = useState('text');
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(''); setResult(null);
    try {
      const form = event.currentTarget;
      const fd = new FormData(form);
      const meta = {
        title: fd.get('title'), authority: fd.get('authority'), documentType: fd.get('documentType'),
        regimes: fd.get('regimes'), status: fd.get('status'), sourceLevel: fd.get('sourceLevel'),
        effectiveFrom: fd.get('effectiveFrom') || null, effectiveTo: fd.get('effectiveTo') || null,
        url: fd.get('url'), notes: fd.get('notes'), jurisdiction: fd.get('jurisdiction')
      };
      let response;
      if (mode === 'file') {
        const upload = new FormData();
        upload.append('file', fd.get('file'));
        for (const [key, value] of Object.entries(meta)) if (value != null) upload.append(key, value);
        response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/sahayak/admin/corpus/ingest-file`, {
          method: 'POST', headers: { authorization: `Bearer ${api.accessToken}` }, body: upload
        });
      } else {
        response = await apiCall(api, '/api/sahayak/admin/corpus/ingest-text', { method: 'POST', body: JSON.stringify({ ...meta, text: fd.get('text') }) });
        if (!response.ok && typeof response === 'object' && !response.source) throw new Error(response.error?.message || 'Ingest failed');
        setResult(response); form.reset(); return;
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || 'Ingest failed');
      setResult(data); form.reset();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  return <section className="card">
    <h3 className="card-h"><Upload size={15}/> Ingest authoritative document</h3>
    <p className="muted small">Adds a jurisdiction-tagged document to the retrieval corpus. Text is chunked by legal structure (Act/Treaty → Chapter → Section/Rule). Injection-like content is flagged as untrusted data, never obeyed.</p>
    <div className="kb-filters">
      {['text', 'file'].map(m => <button key={m} type="button" className={`chip ${mode === m ? 'active' : ''}`} onClick={() => setMode(m)}>{m === 'text' ? 'Paste text' : 'Upload PDF / DOCX / TXT'}</button>)}
    </div>
    <form onSubmit={submit} className="ingest-grid">
      <label>Title<input name="title" required minLength="4" placeholder="Gazette notification title"/></label>
      <label>Authority<input name="authority" required placeholder="Ministry of AYUSH"/></label>
      <label>Type<select name="documentType" defaultValue="notification">{['act','rules','regulation','notification','gazette','treaty','guidance'].map(x => <option key={x} value={x}>{x}</option>)}</select></label>
      <label>Jurisdiction<select name="jurisdiction" defaultValue="IN"><option value="IN">IN · India</option><option value="INTL">INTL · International</option></select></label>
      <label>Status<select name="status" defaultValue="CURRENT">{['CURRENT','HISTORICAL','DRAFT','UNKNOWN'].map(x => <option key={x} value={x}>{x}</option>)}</select></label>
      <label>Authority level (1–7)<input name="sourceLevel" type="number" min="1" max="7" defaultValue="1" required/></label>
      <label>Regimes (comma-separated)<input name="regimes" placeholder="AYUSH, FOOD"/></label>
      <label>Effective from{false && '*'}<input name="effectiveFrom" type="date"/></label>
      <label>Effective until<input name="effectiveTo" type="date"/></label>
      <label className="ingest-wide">Official URL<input name="url" type="url" placeholder="https://egazette.gov.in/..."/></label>
      {mode === 'text'
        ? <label className="ingest-wide">Document text<textarea name="text" rows="8" required minLength="40" placeholder={'CHAPTER II\n\nSECTION 4: No person shall...'} /></label>
        : <label className="ingest-wide">File<input name="file" type="file" accept=".pdf,.txt,.docx" required/></label>}
      <div className="ingest-actions ingest-wide">
        <button className="primary" disabled={busy}>{busy ? <Spinner/> : <>Ingest document <Plus size={14}/></>}</button>
      </div>
    </form>
    {error && <div className="alert" role="alert">{error}</div>}
    {result && <div className="inline-success page-alert" role="status">
      <CheckCircle2/> Ingested “{result.source?.title}” — {result.chunks} structured chunks{result.injectionFlaggedChunks ? `, ${result.injectionFlaggedChunks} flagged as instruction-like` : ''}.
    </div>}
  </section>;
}

function KnowledgeBaseStatsCard({ kb }) {
  return <section className="card">
    <h3 className="card-h"><TerminalSquare size={15}/> Knowledge base</h3>
    <div className="kb-stats">
      <div><strong>{kb.documents}</strong><small>documents</small></div>
      <div><strong>{kb.chunks}</strong><small>indexed chunks</small></div>
      <div><strong>{kb.authoritative}</strong><small>authoritative (level ≤ 3)</small></div>
      <div><strong>{kb.lastSourceUpdate ? new Date(kb.lastSourceUpdate).toLocaleString() : '—'}</strong><small>last update</small></div>
    </div>
    <div className="status-badges">
      {Object.entries(kb.byJurisdiction || {}).map(([jurisdiction, count]) =>
        <span key={jurisdiction} className={`chip static ${jurisdiction === 'INTL' ? 'jurisdiction-stat-intl' : ''}`}>{jurisdiction === 'INTL' ? 'International' : 'India'}: {count}</span>)}
      {Object.entries(kb.statuses || {}).map(([status, count]) =>
        <span key={status} className="chip static">{status}: {count}</span>)}
    </div>
  </section>;
}

function ConfigCard({ llm }) {
  return <section className="card">
    <h3 className="card-h"><History size={15}/> Configuration</h3>
    <pre className="config-pre">{`LLM_PROVIDER=${llm.provider}\n# hybrid: cloud → LM Studio → deterministic\nNVIDIA_API_KEY=<optional cloud key>\nLMSTUDIO_BASE_URL=${llm.baseURL || 'http://localhost:1234/v1'}\nLMSTUDIO_MODEL=<optional loaded model id>\nMAIN_REASONING_MODEL=<optional model id>\nEMBEDDING_MODEL=<optional embedding model or blank>`}</pre>
    <p className="small muted">Hybrid mode uses cloud AI first, then optional LM Studio, then deterministic mode. Switch providers via environment variables and restart the backend. The browser never talks directly to either AI endpoint.</p>
  </section>;
}

function Metric({ label, value, sub }) {
  const connected = value === 'CONNECTED';
  return <article className="metric">
    <div className="metric-head"><span>{label}</span><i className={`state-dot ${connected ? 'green' : value === 'OFFLINE' ? 'red' : ''}`}/></div>
    <strong className="metric-value-sm">{value}</strong>
    <small className="mono-sub">{sub || ''}</small>
  </article>;
}

export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <section className="modal" role="dialog" aria-modal="true">
      <button className="modal-close" onClick={onClose} aria-label="Close"><X/></button>
      <h2>{title}</h2>{children}
    </section>
  </div>;
}
