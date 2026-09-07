import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowRight, BadgeCheck, BookOpen, Building2, Check, ChevronRight, CircleAlert, Clock3,
  ExternalLink, FileSearch, FlaskConical, Globe2, History, Leaf, Loader2, Plus, Scale, Server, ShieldAlert,
  ShieldCheck, Sparkles, Trash2, UserCheck, X
} from 'lucide-react';
import {
  Header, Pill, Spinner, Modal, SEVERITY, CONF,
  ClassificationCard, ComplianceDashboard, IpTkAbsCards, ActionPlan, RiskList,
  EvidencePanel, TimelineCard, HumanReviewCard, NarrativeCard
} from './sahayak.jsx';
import { InlineHelp } from './inline-help.jsx';
import { RecoveryHint, InlineLlmBanner } from './recovery.jsx';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';
async function call(api, path, options) { return api.request(path, options); }

const ROLE_WORKSPACE_META = {
  professional: {
    eyebrow: 'PROFESSIONAL REVIEW DESK', title: 'Review the work that needs expertise',
    subtitle: 'A focused queue for evidence checks, escalations and client-ready next actions.',
    queueTitle: 'Cases waiting for professional review', queueSubtitle: 'Open a case to inspect its classification, citations and escalation context.',
    icon: UserCheck, accent: 'violet'
  },
  government: {
    eyebrow: 'REGULATORY OVERSIGHT DESK', title: 'See the system from an oversight lens',
    subtitle: 'Monitor review queues, source coverage and the separation between India and international guidance.',
    queueTitle: 'Oversight case registry', queueSubtitle: 'Use the registry to understand where cases need evidence or human review.',
    icon: Building2, accent: 'blue'
  },
  platform_admin: {
    eyebrow: 'PLATFORM OPERATIONS', title: 'Keep the evidence layer healthy',
    subtitle: 'A control surface for corpus freshness, evaluation readiness and operational signals.',
    queueTitle: 'Recent workspace activity', queueSubtitle: 'Platform administrators can inspect the seeded role workspaces and their assessment state.',
    icon: Server, accent: 'green'
  }
};

export function RoleWorkspacePage({ api, org, user, onOpenCase, view = 'dashboard' }) {
  const role = user?.accountRole || 'applicant';
  const meta = ROLE_WORKSPACE_META[role] || ROLE_WORKSPACE_META.professional;
  const [cases, setCases] = useState(null), [system, setSystem] = useState(null), [error, setError] = useState(null);
  const Icon = meta.icon;

  useEffect(() => {
    let active = true;
    call(api, `/api/organizations/${org._id}/sahayak/cases`).then(data => { if (active) setCases(data); }).catch(e => { if (active) setError(e); });
    if (role === 'government' || role === 'platform_admin') call(api, '/api/sahayak/admin/system').then(data => { if (active) setSystem(data); }).catch(() => {});
    return () => { active = false; };
  }, [api, org._id, role]);

  const list = Array.isArray(cases) ? cases : [];
  const reviewCases = list.filter(kase => kase.status === 'escalated' || kase.latestAssessment?.humanReview?.required);
  const internationalCases = list.filter(kase => kase.jurisdictionMode === 'INTL' || kase.latestAssessment?.jurisdictionMode === 'INTL');
  const assessedCases = list.filter(kase => ['assessed', 'classified'].includes(kase.status));
  const rows = view === 'review' ? reviewCases : list;
  const title = view === 'review' ? 'Professional review queue' : view === 'oversight' ? 'Regulatory oversight' : view === 'operations' ? 'Platform operations' : meta.title;
  const subtitle = view === 'review' ? meta.queueSubtitle : view === 'oversight' ? 'A read-only view of cases and evidence signals across this oversight workspace.' : view === 'operations' ? 'Monitor corpus readiness and evaluation signals before releasing new guidance.' : meta.subtitle;
  const systemKb = system?.knowledgeBase;

  return <>
    <Header eyebrow={meta.eyebrow} title={title} subtitle={subtitle}
      action={view === 'dashboard' && role === 'professional' ? <span className="role-command"><Clock3 size={14}/> Triage by evidence strength</span> : <span className={`role-access-badge ${meta.accent}`}><Icon size={14}/> {role === 'government' ? 'Read-only oversight' : meta.eyebrow.toLowerCase()}</span>}/>
    {error && <RecoveryHint error={error} onRetry={() => { setError(null); setCases(null); }} onDismiss={() => setError(null)}/>}
    <section className={`role-hero ${meta.accent}`}>
      <div className="role-hero-mark"><Icon size={22}/></div>
      <div><p className="eyebrow">ROLE-BASED WORKSPACE</p><h2>{meta.title}</h2><p>Signed in as <strong>{user?.name}</strong>. Your navigation and available actions follow this account’s verified role.</p></div>
      <div className="role-hero-chip"><span className="role-dot"/><strong>{meta.eyebrow.toLowerCase()}</strong><small>scope: {org.name}</small></div>
    </section>

    <div className="metrics ipsk-metrics role-metrics">
      <Metric label={role === 'professional' ? 'Awaiting review' : 'Active cases'} value={role === 'professional' ? reviewCases.length : list.filter(kase => !['assessed'].includes(kase.status)).length} icon={role === 'professional' ? UserCheck : FileSearch}/>
      <Metric label="Assessed / classified" value={assessedCases.length} icon={BadgeCheck}/>
      <Metric label="International lens" value={internationalCases.length} icon={Globe2}/>
      <Metric label={role === 'platform_admin' ? 'Authoritative sources' : 'Review flags'} value={role === 'platform_admin' ? (systemKb?.authoritative ?? '—') : reviewCases.length} icon={role === 'platform_admin' ? BookOpen : ShieldAlert}/>
    </div>

    <div className="role-workspace-grid">
      <section className="card role-case-card">
        <div className="card-title"><div><p className="eyebrow">{view === 'review' ? 'TRIAGE QUEUE' : 'ROLE-SCOPED CASES'}</p><h2>{view === 'review' ? meta.queueTitle : 'Recent cases in this workspace'}</h2></div><span className="role-count">{rows.length} record{rows.length === 1 ? '' : 's'}</span></div>
        {cases === null && <p className="muted"><Spinner/> Loading role workspace…</p>}
        {!!cases && !rows.length && <div className="role-empty"><Icon size={21}/><strong>{view === 'review' ? 'No cases are waiting for review.' : 'No role-scoped cases yet.'}</strong><p>New activity will appear here when this workspace receives an assessment.</p></div>}
        {!!rows.length && <div className="role-case-list">{rows.slice(0, 8).map(kase => {
          const assessment = kase.latestAssessment;
          const international = kase.jurisdictionMode === 'INTL' || assessment?.jurisdictionMode === 'INTL';
          return <button key={kase._id} className="role-case-row" onClick={() => onOpenCase(kase._id)}>
            <span className="role-case-icon"><Leaf size={15}/></span>
            <span className="role-case-main"><strong>{kase.productName || kase.title}</strong><small>{kase.status.replaceAll('_', ' ')} · {international ? 'International' : 'India'} lens</small></span>
            {assessment?.confidence && <span className={`badge ${CONF[assessment.confidence]}`}>{assessment.confidence.toLowerCase()}</span>}
            <ChevronRight size={15}/>
          </button>;
        })}</div>}
      </section>

      <div className="role-side-stack">
        <section className="card role-permission-card">
          <div className="card-title"><div><p className="eyebrow">ACCESS PROFILE</p><h2>What this role can do</h2></div><Icon size={18}/></div>
          <div className="role-permission-list">
            {(role === 'professional' ? ['Review escalated cases', 'Inspect verified evidence', 'Prepare professional next actions'] : role === 'government' ? ['Monitor oversight queues', 'Compare India / International coverage', 'Read source and confidence signals'] : ['Monitor corpus health', 'Run evaluation readiness checks', 'Inspect platform activity']).map(item => <div key={item}><Check size={14}/><span>{item}</span></div>)}
          </div>
          <p className="muted small">Permissions are enforced by the signed-in account and organization membership.</p>
        </section>
        {(role === 'government' || role === 'platform_admin') && <section className="card role-system-card">
          <div className="card-title"><div><p className="eyebrow">KNOWLEDGE BASE</p><h2>{role === 'government' ? 'Coverage snapshot' : 'Corpus health snapshot'}</h2></div><Server size={17}/></div>
          <div className="role-system-stats"><div><strong>{systemKb?.documents ?? '—'}</strong><small>documents</small></div><div><strong>{systemKb?.chunks ?? '—'}</strong><small>chunks</small></div><div><strong>{systemKb?.byJurisdiction?.IN ?? '—'} / {systemKb?.byJurisdiction?.INTL ?? '—'}</strong><small>India / Intl</small></div></div>
          <p className="muted small">Source and jurisdiction counts are read from the current backend corpus.</p>
        </section>}
        {role === 'professional' && <section className="card role-review-note"><div className="role-note-icon"><ShieldCheck size={18}/></div><div><strong>Evidence before opinion</strong><p>Every escalated record keeps its sources, uncertainty and jurisdiction visible for human review.</p></div></section>}
      </div>
    </div>
  </>;
}

/* ================= DASHBOARD ================= */
export function DashboardHome({ api, org, user, membership, onOpenCase, onNewCase }) {
  const [cases, setCases] = useState(null), [error, setError] = useState(null);
  async function load() { try { setCases(await call(api, `/api/organizations/${org._id}/sahayak/cases`)); } catch (e) { setError(e); } }
  useEffect(() => { load(); }, [org._id]);
  async function loadDemo() { try { const demo = await call(api, `/api/organizations/${org._id}/sahayak/demo`, { method: 'POST' }); onOpenCase(demo._id); } catch (e) { setError(e); } }

  const stats = useMemo(() => {
    const list = Array.isArray(cases) ? cases : [];
    return {
      active: list.filter(c => ['intake', 'clarifying', 'classified', 'assessed'].includes(c.status)).length,
      reviews: list.filter(c => c.latestAssessment?.humanReview?.required || c.status === 'escalated').length,
      ipIssues: list.filter(c => c.latestAssessment?.regimes?.some(r => ['PATENT', 'TRADITIONAL_KNOWLEDGE'].includes(r.regime) && ['APPLICABLE', 'POSSIBLY_APPLICABLE', 'REVIEW_RECOMMENDED'].includes(r.relevance))).length,
      regChecks: list.filter(c => c.latestAssessment?.regimes?.some(r => ['AYUSH', 'FOOD', 'COSMETIC', 'BIODIVERSITY_ABS', 'LABELLING_CLAIMS'].includes(r.regime))).length,
      escalated: list.filter(c => c.status === 'escalated').length
    };
  }, [cases]);

  return <>
    <Header eyebrow="SIH 26045 · GOVERNMENT OF INDIA PROBLEM STATEMENT" title="IP-SAKTI Sahayak"
      subtitle="Jurisdiction-aware AI decision support for Ayurvedic IP and regulatory pathways."
      action={<button className="primary ipsk-btn" onClick={onNewCase}><Plus/> Create New Case</button>}/>
    <InlineHelp id="dashboard" title="Your workspace at a glance"
      body="Cases store every product assessment. Active Cases are still being worked on; Reviews Required means a professional should look at the case. Open any case to walk through Classification, Evidence, Action Plan and Human Review."/>
    {error && <RecoveryHint error={error} onRetry={() => { setError(null); load(); }} onLoadDemo={loadDemo} onDismiss={() => setError(null)}/>}
    <div className="metrics ipsk-metrics">
      <Metric label="Active Cases" value={stats.active} icon={FileSearch}/>
      <Metric label="Pending Reviews" value={stats.escalated} icon={CircleAlert}/>
      <Metric label="Potential IP Issues" value={stats.ipIssues} icon={ShieldAlert}/>
      <Metric label="Regulatory Checks" value={stats.regChecks} icon={BookOpen}/>
      <Metric label="Human Reviews Required" value={stats.reviews} icon={ShieldCheck}/>
    </div>

    <section className="card">
      <div className="card-title"><div><p className="eyebrow">RECENT CASES</p><h2>Your Ayurvedic product assessments</h2></div></div>
      {cases === null && <p><Spinner/> Loading…</p>}
      {Array.isArray(cases) && !cases.length && <div className="empty-state">
        <Leaf className="empty-leaf"/>
        <h2>No cases yet.</h2>
        <p className="muted">Create your first IP-SAKTI case to assess an Ayurvedic product.</p>
        <button className="primary ipsk-btn" onClick={onNewCase}><Plus/> Create New Case</button>
      </div>}
      {!!cases?.length && <div className="recent-list">
        {cases.slice(0, 6).map(kase => {
          const a = kase.latestAssessment;
          const cls = kase.classification?.primary || a?.classification?.primary;
          return (
            <button key={kase._id} className="recent-row" onClick={() => onOpenCase(kase._id)}>
              <Leaf size={15} className="row-leaf"/>
              <span className="recent-main">
                <strong>{kase.productName || kase.title}{kase.demoScenario && <span className="demo-flag" style={{ marginLeft: 8 }}>DEMO</span>}</strong>
                <small>Status: {kase.status.replaceAll('_', ' ')}{cls ? ` · Classification: ${cls.replaceAll('_', ' ').toLowerCase()}` : ''}</small>
              </span>
              {(a?.confidence || kase.classification?.confidence) && <span className={`badge ${CONF[a?.confidence || kase.classification.confidence]}`}>Risk: {(a?.confidence || kase.classification.confidence).toLowerCase()}</span>}
              <small className="muted">{new Date(a?.createdAt || kase.createdAt).toLocaleDateString()}</small>
              <ChevronRight size={15}/>
            </button>
          );
        })}
      </div>}
    </section>

    <section className="ipsk-strip">
      <div><BadgeCheck/><strong>Classification-first.</strong><span>The system determines what your product actually is before any legal question.</span></div>
      <div><BookOpen/><strong>Evidence-backed.</strong><span>Every conclusion links to an authoritative source for the selected jurisdiction.</span></div>
      <div><ShieldCheck/><strong>Human-review ready.</strong><span>Uncertainty is surfaced, never hidden.</span></div>
    </section>
  </>;
}

function Metric({ label, value, icon: Icon }) {
  return <article className="metric"><div className="metric-head"><span>{label}</span><Icon/></div><strong>{value ?? '—'}</strong></article>;
}

/* ================= NEW CASE ================= */
const STRUCTURED_FIELDS = [
  { key: 'productName', label: 'Product Name', placeholder: 'Neem-Turmeric Herbal Tablet' },
  { key: 'ingredients', label: 'Ingredients', placeholder: 'neem, turmeric' },
  { key: 'claims', label: 'Claims', placeholder: 'relieves inflammation; boosts immunity' },
  { key: 'manufacturingMethod', label: 'Manufacturing Method', placeholder: 'novel cold extraction process' }
];
const SELECT_FIELDS = [
  { key: 'intendedUse', label: 'Intended Use', options: [['', '—'], ['therapeutic_treatment', 'Treat/prevent disease'], ['wellness_general', 'General wellness'], ['food_consumption', 'Food/nutrition'], ['external_cosmetic', 'Cosmetic'], ['research', 'Research only']] },
  { key: 'dosageForm', label: 'Dosage Form', options: [['', '—'], ['tablet', 'Tablet'], ['capsule', 'Capsule'], ['powder_churna', 'Powder / churna'], ['liquid_syrup_arishta', 'Syrup / arishta / kadha'], ['oil_taila', 'Oil / taila'], ['cream_ointment', 'Cream / ointment'], ['extract_concentrate', 'Extract'], ['raw_herb_powder_bulk', 'Raw herb powder (bulk)']] },
  { key: 'classicalSource', label: 'Classical Formulation?', options: [['', '—'], ['authoritative_text_named', 'Yes — from an authoritative text'], ['claims_classical_but_unnamed', 'Claimed classical (text not named)'], ['not_from_any_text_new_formulation', 'No — new formulation']] },
  { key: 'newProcess', label: 'New Process Developed?', options: [['', '—'], ['yes', 'Yes'], ['no', 'No']] },
  { key: 'traditionalKnowledgeUse', label: 'Traditional Knowledge Used?', options: [['', '—'], ['direct_traditional_use', 'Direct traditional use'], ['modified_traditional', 'Modified traditional'], ['fully_novel', 'Fully novel']] },
  { key: 'biologicalOriginIndia', label: 'Biological Resources Used?', options: [['', '—'], ['yes', 'Yes — sourced in India'], ['no', 'No'], ['unknown', 'Not sure']] },
  { key: 'commercialIntent', label: 'Commercialization Stage', options: [['', '—'], ['yes_commercial_sale_india', 'Ready to sell in India'], ['export_related', 'Export planning'], ['research_only', 'Research stage'], ['personal_use', 'Personal use']] },
  { key: 'targetMarket', label: 'Target Market', options: [['', '—'], ['india_only', 'India only'], ['india_and_export', 'India + export']] }
];

const ANALYZE_STAGES = ['Analyzing product…', 'Extracting formulation details…', 'Identifying missing information…', 'Checking classification…'];
export function NewCasePage({ api, org, onOpenCase }) {
  const [busy, setBusy] = useState(false), [stage, setStage] = useState(''), [showManual, setShowManual] = useState(false), [error, setError] = useState(null);
  useEffect(() => {
    if (!busy) { setStage(''); return; }
    let i = 0; setStage(ANALYZE_STAGES[0]);
    const t = setInterval(() => { i = Math.min(i + 1, ANALYZE_STAGES.length - 1); setStage(ANALYZE_STAGES[i]); }, 1500);
    return () => clearInterval(t);
  }, [busy]);
  async function loadDemo() {
    setBusy(true); setError(null);
    try { const demo = await call(api, `/api/organizations/${org._id}/sahayak/demo`, { method: 'POST' }); onOpenCase(demo._id); }
    catch (e) { setError(e); } finally { setBusy(false); }
  }
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const fd = new FormData(event.currentTarget);
      const description = String(fd.get('description') || '').trim();
      const factsPatch = {};
      if (showManual) {
        for (const f of STRUCTURED_FIELDS) if (f.key !== 'productName' && String(fd.get(f.key) || '').trim()) factsPatch[f.key] = fd.get(f.key);
        for (const f of SELECT_FIELDS) if (String(fd.get(f.key) || '').trim()) factsPatch[f.key] = fd.get(f.key);
        if (String(fd.get('labelText') || '').trim()) factsPatch.labelText = String(fd.get('labelText')).slice(0, 5000);
      }
      // Compose manual-only details into the natural-language description so extraction sees them too
      let composed = description;
      if (!composed && showManual && String(fd.get('ingredients') || '').trim()) {
        composed = `Ayurvedic product ${fd.get('productName') || ''} containing ${fd.get('ingredients')}. Intended use: ${fd.get('intendedUse') || 'not stated'}. Claims: ${fd.get('claims') || 'none stated'}.`;
      }
      const kase = await call(api, `/api/organizations/${org._id}/sahayak/cases`, {
        method: 'POST',
        body: JSON.stringify({
          title: fd.get('productName') || (description.split(/[.\n]/)[0] || 'Ayurvedic product case').slice(0, 80),
          productName: fd.get('productName'),
          productDescription: composed,
          language: fd.get('language'),
          jurisdictionMode: fd.get('jurisdictionMode'),
          factsPatch: showManual ? factsPatch : {}
        })
      });
      onOpenCase(kase._id);
    } catch (e) { setError(e); } finally { setBusy(false); }
  }

  return <>
    <Header eyebrow="NEW ASSESSMENT" title="Start a New IP-SAKTI Assessment"
      subtitle="Tell us about your Ayurvedic product or innovation. You can provide as much or as little information as you currently have."
      action={<button className="secondary" onClick={loadDemo} disabled={busy}><Sparkles size={14}/> Load demo case</button>}/>
    <InlineHelp id="newcase" title="What to enter here"
      body="Describe the product as you would to a colleague — ingredients, intended use, any new process you developed. Missing details are asked later as quick option-chip questions. You can also load the SIH demo to see the full flow instantly."/>
    {error && <RecoveryHint error={error} onRetry={() => setError(null)} onLoadDemo={loadDemo} onDismiss={() => setError(null)}/>}
    {busy && stage ? <section className="card pipeline-status"><Spinner/> <span key={stage}>{stage}</span></section> :
      <form onSubmit={submit}>
        <section className="card newcase-card">
          <label className="big-label">Describe your product naturally (English or हिन्दी)</label>
          <textarea name="description" rows="6" required minLength="20" disabled={busy}
            placeholder="Example: I developed an Ayurvedic tablet containing neem and turmeric for inflammation. I created a new extraction process and want to sell it in India."/>
          <div className="newcase-row">
            <label className="inline-label">Language / भाषा
              <select name="language" defaultValue="en"><option value="en">English</option><option value="hi">हिन्दी</option></select>
            </label>
            <label className="inline-label">Legal lens
              <select name="jurisdictionMode" defaultValue="IN"><option value="IN">India — Acts &amp; regulators</option><option value="INTL">International — treaties &amp; export routes</option></select>
            </label>
            <button type="button" className="linklike" onClick={() => setShowManual(v => !v)}>
              {showManual ? '− Hide structured fields' : '+ Or enter details manually'}
            </button>
            <span className="flex-spacer"/>
            <span className="muted small">No legal terminology needed — missing critical details will be asked later.</span>
            <button className="primary ipsk-btn" disabled={busy}><FlaskConical size={15}/> Analyze Product</button>
          </div>
        </section>

        {showManual && <section className="card manual-grid-card">
          <h3 className="card-h"><Leaf size={15}/> Structured details <small>(all optional)</small></h3>
          <div className="manual-grid">
            {STRUCTURED_FIELDS.map(f => <label key={f.key}>{f.label}<input name={f.key} placeholder={f.placeholder} maxLength="200"/></label>)}
            <label className="manual-wide">Draft label / advertisement<textarea name="labelText" rows="3" maxLength="5000" placeholder="Paste exact label or marketing wording for the claim review"/></label>
            {SELECT_FIELDS.map(f => <label key={f.key}>{f.label}
              <select name={f.key} defaultValue="">{f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </label>)}
          </div>
        </section>}
      </form>}
  </>;
}

/* ================= CASE-SCOPED MODULE PAGES ================= */
export function useCaseSelector(api, org) {
  const [cases, setCases] = useState(null), [selectedId, setSelectedId] = useState(() => { try { return localStorage.getItem('ipsk.selectedCase') || ''; } catch { return ''; } }), [kase, setKase] = useState(null), [error, setError] = useState('');
  useEffect(() => { call(api, `/api/organizations/${org._id}/sahayak/cases`).then(setCases).catch(e => setError(e.message)); }, [org._id]);
  useEffect(() => {
    if (!selectedId) { setKase(null); return; }
    try { localStorage.setItem('ipsk.selectedCase', selectedId); } catch { /* private mode */ }
    call(api, `/api/organizations/${org._id}/sahayak/cases/${selectedId}`).then(setKase).catch(e => setError(e.message));
  }, [selectedId]);
  return { cases, selectedId, setSelectedId, kase, error };
}

export function CaseScopeBar({ cases, selectedId, setSelectedId, page }) {
  if (!cases) return <section className="card"><Spinner/></section>;
  if (!cases.length) return null;
  return <div className="scope-bar">
    <select value={selectedId} onChange={e => setSelectedId(e.target.value)} aria-label={`Select case for ${page}`}>
      <option value="">— Select a case —</option>
      {cases.map(c => <option key={c._id} value={c._id}>{c.productName || c.title} ({c.status.replaceAll('_', ' ')})</option>)}
    </select>
  </div>;
}

function NeedsCase({ page }) {
  return <section className="card empty-state">
    <FileSearch className="empty-leaf"/><h2>No case selected</h2>
    <p className="muted">{page} works on a specific product case. Create or select one from the switcher above, or load the SIH demo from <strong>New Case</strong> to see the full flow.</p>
  </section>;
}

function NoAssessment() {
  return <section className="card empty-state">
    <FlaskConical className="empty-leaf"/><h2>Assessment not run yet</h2>
    <p className="muted">Open this case in the workspace, answer the clarifying questions, and click <strong>Run assessment</strong> — results will appear here automatically.</p>
  </section>;
}

function NoEvidence() {
  return <section className="card empty-state">
    <ShieldCheck className="empty-leaf"/><h2>No authoritative evidence found</h2>
    <p className="muted">The system could not verify a reliable authority for the selected jurisdiction and current case. This is not a failure — it means <strong>human review is recommended</strong> for this area. IP-SAKTI never invents sources.</p>
  </section>;
}

function JurisdictionBoundary({ kase }) {
  const international = (kase?.latestAssessment?.jurisdictionMode || kase?.jurisdictionMode || 'IN') === 'INTL';
  return <div className={`jurisdiction-notice ${international ? 'international' : 'india'}`} role="status">
    <div className="jurisdiction-notice-icon"><Globe2 size={18}/></div>
    <div><strong>{international ? 'International answer set' : 'India answer set'}</strong><p>{international ? 'Treaties, filing systems and export-market pointers only. Verify each target-country rule before acting.' : 'Indian statutes, rules, regulators and TK/ABS pathways only.'}</p></div>
    <span className="jurisdiction-lock">{international ? 'India sources excluded' : 'International sources excluded'}</span>
  </div>;
}

function InternationalModuleView({ assessment, title = 'International route map' }) {
  return <div className="workspace-grid">
    <section className="card international-panel">
      <div className="international-panel-head"><div><p className="eyebrow">INTERNATIONAL LAYER</p><h2>{title}</h2></div><span className="badge sev-yellow">Target-country review</span></div>
      <p className="muted small">Treaty-level sources and filing-system pointers are kept separate from Indian law. They do not grant a worldwide patent, mark or product approval.</p>
      <div className="international-grid">{(assessment.regimes || []).filter(r => r.regime !== 'OTHER').map(r => <article className="international-route" key={r.regime}>
        <div className="international-route-top"><strong>{r.label || r.regime}</strong><span className={`badge ${r.relevance === 'POSSIBLY_APPLICABLE' ? SEVERITY.YELLOW : r.relevance === 'INSUFFICIENT_INFORMATION' ? SEVERITY.GREY : SEVERITY.GREEN}`}>{r.relevance.replaceAll('_', ' ')}</span></div>
        <p>{r.why}</p>
        {!!r.whatToDo?.length && <ul className="tiny-list">{r.whatToDo.slice(0, 2).map((todo, i) => <li key={i}>{todo}</li>)}</ul>}
      </article>)}</div>
    </section>
    {!!(assessment.evidence || []).length && <EvidencePanel evidence={assessment.evidence}/>} 
  </div>;
}

export function ClassificationPage({ api, org, onNewCase, onOpenCase }) {
  const { cases, selectedId, setSelectedId, kase, error } = useCaseSelector(api, org);
  const assessment = kase?.latestAssessment;
  const classification = assessment?.classification || kase?.classification;
  const reasons = classification ? splitReasons(classification.rationale) : [];
  return <>
    <Header eyebrow="MODULE" title="Product Classification"
      subtitle="The first thing IP-SAKTI determines is what kind of product this actually is."/>
    <InlineHelp id="classification" title="What is this?"
      body="Classification estimates the regulatory category of your product (proprietary ASU medicine, Ayurveda Aahara, cosmetic, etc.) based on the facts you provided. The LLM does not decide this — a deterministic engine does, and the LLM only explains the result. Confidence reflects how many critical facts are resolved."/>
    {!cases?.length ? <NeedsCase page="Product Classification" action="Create"/> :
      <>
        <CaseScopeBar cases={cases} selectedId={selectedId} setSelectedId={setSelectedId} page="classification"/>
        <JurisdictionBoundary kase={kase}/>
        {error && <div className="alert page-alert">{error}</div>}
        {!kase ? null : !classification ? <NoAssessment/> : <div className="workspace-grid">
          <section className="card classify-hero">
            <p className="eyebrow">LIKELY CLASSIFICATION</p>
            <h2>{classification.labelLocalized || classification.primary.replaceAll('_', ' ')}</h2>
            <span className={`badge ${CONF[classification.confidence]}`}>Confidence: {classification.confidence}</span>
          </section>
          <section className="card">
            <h3 className="card-h"><Check size={15}/> Why this classification?</h3>
            <ul className="tiny-list reasons">{reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
            <NarrativeCard narrative={assessment.narrative} confidence={assessment.confidence}/>
          </section>
          <section className="card">
            <h3 className="card-h"><CircleAlert size={15}/> What could change the classification?</h3>
            {!!classification.missingInformation?.length
              ? <ul className="tiny-list">{classification.missingInformation.map((m, i) => <li key={i}>Unresolved fact affects the medicines/food/cosmetics boundary: {m.replace(/([A-Z])/g, ' $1').toLowerCase()}</li>)}</ul>
              : <p className="muted small">All critical classification facts are currently resolved.</p>}
            {!!classification.alternatives?.length && <p><small>Possible alternatives: {classification.alternatives.map(x => x.replaceAll('_', ' ')).join(', ')}</small></p>}
            <div className="related-regimes">
              <p className="eyebrow">RELATED REGULATORY AREAS</p>
              <div className="chips">{(assessment.regimes || []).filter(r => r.regime !== 'OTHER').map(r =>
                <span key={r.regime} className="chip static">{r.regime.replaceAll('_', ' & ')} · {r.relevanceLocalized || r.relevance.toLowerCase()}</span>)}</div>
            </div>
          </section>
          <div className="row-actions center"><button className="secondary" onClick={() => onOpenCase(kase._id)}>Open full workspace <ArrowRight size={14}/></button></div>
        </div>}
      </>}
  </>;
}
function splitReasons(text = '') {
  return String(text).split(/(?<=\.)\s+/).map(s => s.trim()).filter(s => s.length > 12).slice(0, 5);
}

export function IpAssessmentPage({ api, org }) {
  const { cases, selectedId, setSelectedId, kase, error } = useCaseSelector(api, org);
  const a = kase?.latestAssessment;
  const international = (a?.jurisdictionMode || kase?.jurisdictionMode || 'IN') === 'INTL';
  const ip = a?.ipConsiderations || {};
  const tk = a?.tkConsiderations || {};
  const ipRegimes = (a?.regimes || []).filter(r => ['PATENT', 'TRADEMARK', 'GI', 'DESIGN', 'COPYRIGHT', 'PLANT_VARIETY', 'TRADITIONAL_KNOWLEDGE'].includes(r.regime));
  const evidenceFor = regime => (a?.evidence || []).filter(e => e.regime === regime);
  return <>
    <Header eyebrow="MODULE" title={international ? 'International IP Routes' : 'IP Assessment'} subtitle={international ? 'Treaty and filing-system pointers by selected target jurisdiction — never a grant or registrability opinion.' : 'Potential Indian IP relevance — never a patentability or registrability opinion.'}/>
    <InlineHelp id="ip" title="Why is IP assessed before legal questions?"
      body="For an Ayurvedic product, the category (proprietary ASU, classical, Aahara, cosmetic, etc.) decides which IP and regulatory regimes are even relevant. IP-SAKTI maps each area (Patents, Trademarks, Traditional Knowledge, GI, Plant Variety, Trade Secret) and tells you which to investigate — never claiming any product is patentable or registrable."/>
    {!cases?.length ? <NeedsCase page="IP Assessment"/> :
      <>
        <CaseScopeBar cases={cases} selectedId={selectedId} setSelectedId={setSelectedId} page="IP"/>
        <JurisdictionBoundary kase={kase}/>
        {!kase ? null : !a ? <NoAssessment/> : international ? <InternationalModuleView assessment={a} title="Treaties, filing systems & export routes"/> : <div className="workspace-grid">

          <section className="card ip-patent">
            <div className="ip-head"><Scale size={17}/><h3>Patent</h3><span className={`badge ${CONF.MEDIUM}`}>MEDIUM</span></div>
            <p className="ip-status">Potential Patent-Relevant Subject Matter</p>
            <dl className="ip-dl">
              <dt>Novelty</dt><dd>Needs Assessment</dd>
              <dt>Inventive step</dt><dd>Needs Assessment</dd>
              <dt>Traditional knowledge</dt><dd>{tk.level === 'NO_POTENTIAL_ISSUE_IDENTIFIED' ? 'No concern identified yet' : 'Potential Concern'}</dd>
              <dt>Section 3(p)</dt><dd>Review Relevant</dd>
              <dt>Prior art</dt><dd>Search Recommended</dd>
              <dt>Biological-resource disclosure</dt><dd>Required if filing (BDA s.6)</dd>
            </dl>
            <ul className="tiny-list">{(ip.patent?.points || []).map((p, i) => <li key={i}>{p}</li>)}</ul>
          </section>

          <section className="card ip-grid2">
            <div className="ip-block">
              <div className="ip-head"><BookOpen size={16}/><h4>Trademark</h4><span className={`badge ${SEVERITY.YELLOW}`}>{ip.trademark?.status === 'REVIEW_RECOMMENDED' ? 'MEDIUM' : 'LOW'}</span></div>
              <p className="small">{ip.trademark?.note}</p>
              <p className="small muted">Search status: not searched — clearance search recommended on the IP India registry before branding spend.</p>
              <p className="small"><strong>Next:</strong> Run trademark availability search.</p>
            </div>
            <div className="ip-block">
              <div className="ip-head"><ShieldAlert size={16}/><h4>Traditional Knowledge</h4><span className={`badge ${tk.level === 'NO_POTENTIAL_ISSUE_IDENTIFIED' ? SEVERITY.GREY : SEVERITY.RED}`}>{tk.level === 'NO_POTENTIAL_ISSUE_IDENTIFIED' ? 'LOW' : 'HIGH'}</span></div>
              <p className="small">{tk.why}</p>
              <ul className="tiny-list">{(tk.flags || []).map((f, i) => <li key={i}>{f}</li>)}</ul>
            </div>
            <div className="ip-block">
              <div className="ip-head"><GlobePlaceholder/><h4>GI / Design / Copyright / Plant Variety</h4><span className={`badge ${SEVERITY.GREY}`}>{ip.plantVariety?.status === 'POSSIBLY_APPLICABLE' ? 'REVIEW' : 'NOT INDICATED'}</span></div>
              <p className="small">{ip.gi?.note}</p>
              <p className="small muted">{ip.tradeSecret?.note}</p>
            </div>
            <div className="ip-block">
              <div className="ip-head"><LockIcon/><h4>Trade Secret / Confidential Information</h4><span className={`badge ${SEVERITY.YELLOW}`}>MEDIUM</span></div>
              <p className="small">Formulation details and process parameters can be protected via confidentiality measures instead of registration — keep documentation controlled.</p>
            </div>
          </section>

          {!!ipRegimes.length && <section className="card">
            <h3 className="card-h"><BookOpen size={15}/> Regime conclusions & evidence</h3>
            {ipRegimes.map(r => <div key={r.regime} className="regime-line">
              <strong>{r.regime.replaceAll('_', ' ')}</strong>
              <span className={`badge ${r.relevance === 'APPLICABLE' ? SEVERITY.RED : r.relevance === 'NOT_CURRENTLY_INDICATED' ? SEVERITY.GREEN : SEVERITY.YELLOW}`}>{r.relevance.replaceAll('_', ' ')}</span>
              <p className="small muted">{r.why}</p>
              <EvidenceMiniList items={evidenceFor(r.regime)}/>
            </div>)}
          </section>}
          {!!(a.evidence || []).length && <EvidencePanel evidence={a.evidence.filter(e => e.regime && ['PATENT', 'TRADEMARK', 'TRADITIONAL_KNOWLEDGE', 'PLANT_VARIETY', 'GI'].includes(e.regime))}/>}
        </div>}
      </>}
  </>;
}
const GlobePlaceholder = () => <BookOpen size={16}/>;
const LockIcon = () => <ShieldCheck size={16}/>;

export function RegulatoryAssessmentPage({ api, org }) {
  const { cases, selectedId, setSelectedId, kase, error } = useCaseSelector(api, org);
  const a = kase?.latestAssessment;
  const international = (a?.jurisdictionMode || kase?.jurisdictionMode || 'IN') === 'INTL';
  const AUTHORITY = {
    AYUSH: 'State AYUSH Licensing Authority · Ministry of AYUSH',
    FOOD: 'FSSAI',
    COSMETIC: 'State Drugs Controller (D&C Rules — cosmetics)',
    BIODIVERSITY_ABS: 'National Biodiversity Authority · State Biodiversity Boards',
    LABELLING_CLAIMS: 'Department of Consumer Affairs (Legal Metrology)',
    TRADITIONAL_KNOWLEDGE: 'CSIR / Ministry of AYUSH (TKDL access policy)',
    OTHER: '—'
  };
  const regRegimes = (a?.regimes || []).filter(r => ['AYUSH', 'FOOD', 'COSMETIC', 'BIODIVERSITY_ABS', 'LABELLING_CLAIMS', 'OTHER'].includes(r.regime));
  return <>
    <Header eyebrow="MODULE" title={international ? 'International Market Access' : 'Regulatory Assessment'} subtitle={international ? 'Market-classification and target-country regulatory pointers, kept separate from Indian law.' : 'Indian regulatory areas that may apply to this product, each with its authority and required next step.'}/>
    <InlineHelp id="regulatory" title="How to read this"
      body="Each card is a regulatory regime in India that may apply to your product (AYUSH, FSSAI / Ayurveda Aahara, Biodiversity/ABS, Labelling & Claims, etc.). The 'Authority' is the relevant Indian body. 'Status' is a derived relevance, not a legal opinion — the system shows the next investigative step rather than claiming an approval status."/>
    {!cases?.length ? <NeedsCase page="Regulatory Assessment"/> :
      <>
        <CaseScopeBar cases={cases} selectedId={selectedId} setSelectedId={setSelectedId} page="regulatory"/>
        <JurisdictionBoundary kase={kase}/>
        {!kase ? null : !a ? <NoAssessment/> : international ? <InternationalModuleView assessment={a} title="Market classification before export"/> : <div className="workspace-grid">
          {regRegimes.map(r => {
            const tone = r.relevance === 'APPLICABLE' ? SEVERITY.RED : r.relevance === 'POSSIBLY_APPLICABLE' ? SEVERITY.YELLOW : r.relevance === 'INSUFFICIENT_INFORMATION' ? SEVERITY.GREY : SEVERITY.GREEN;
            return <section key={r.regime} className={`card regime-detail sev-left-${tone.replace('sev-', '')}`}>
              <div className="ip-head"><BookOpen size={16}/><h3>{r.labelLocalized || r.label}</h3>
                <span className={`badge ${tone}`}>{r.relevanceLocalized || r.relevance.replaceAll('_', ' ')}</span>
                <span className={`badge ${CONF[r.confidence] || ''}`}>{r.confidence || ''}</span>
              </div>
              <p><strong>Why:</strong> {r.why}</p>
              <p><strong>Authority:</strong> {AUTHORITY[r.regime] || '—'}</p>
              {!!r.whatToDo?.length && <p><strong>Next action:</strong> {r.whatToDo.join(' · ')}</p>}
              <EvidenceMiniList items={(a.evidence || []).filter(e => e.regime === r.regime)}/>
              {r.humanReview && <p className="small warnline">Professional verification recommended for this area.</p>}
            </section>;
          })}
          {a.absScreen && <HumanReviewCard review={{ required: a.absScreen.humanReview, reason: a.absScreen.reason, unresolvedQuestions: a.absScreen.uncertainties, recommendedProfessional: a.absScreen.authority }}/>}
        </div>}
      </>
    }</>;
}

function EvidenceMiniList({ items }) {
  if (!items?.length) return null;
  return <div className="evidence-mini">
    <p className="eyebrow">EVIDENCE</p>
    {items.map((e, i) => <div key={i} className="mini-ev">
      <span className={`dot ${e.supportLevel === 'DIRECTLY_SUPPORTED' ? SEVERITY.GREEN : e.supportLevel === 'UNSUPPORTED' || e.supportLevel === 'CONFLICTING_AUTHORITIES' ? SEVERITY.RED : SEVERITY.YELLOW}`}/>
      <span>{e.claim}</span>
      <em>{e.sourceTitle}{e.section ? ` · ${e.section}` : ''}</em>
      {e.url && <a href={e.url} target="_blank" rel="noreferrer">View Source <ExternalLink size={10}/></a>}
    </div>)}
  </div>;
}

export function EvidencePage({ api, org }) {
  const { cases, selectedId, setSelectedId, kase } = useCaseSelector(api, org);
  const a = kase?.latestAssessment;
  return <>
    <Header eyebrow="MODULE" title="Evidence & Sources" subtitle="Every material conclusion and where it comes from. Unverifiable statements are marked UNSUPPORTED — sources are never invented."/>
    <InlineHelp id="evidence" title="Why evidence is the centerpiece"
      body="Every important conclusion in this system traces to a specific source (act, section, status, effective date). Click any evidence item to expand the citation. Support levels: DIRECTLY SUPPORTED · STRONG INFERENCE · INTERPRETATION REQUIRED · UNSUPPORTED · CONFLICTING AUTHORITIES. A claim marked UNSUPPORTED is NOT fabricated — it is flagged so you can investigate further."/>
    {!cases?.length ? <NeedsCase page="Evidence & Sources"/> :
      <>
        <CaseScopeBar cases={cases} selectedId={selectedId} setSelectedId={setSelectedId} page="evidence"/>
        <JurisdictionBoundary kase={kase}/>
        <div className="legend-row">
          {[['CURRENT', 'sev-green'], ['HISTORICAL', 'sev-grey'], ['DRAFT', 'sev-red'], ['SUPERSEDED', 'sev-grey'], ['UNKNOWN', 'sev-grey']].map(([s, tone]) =>
            <span key={s} className={`badge ${tone}`}>{s}</span>)}
          <small className="muted">A document's existence does not mean it is currently applicable — status is tracked per source.</small>
        </div>
        {!kase ? null : !a ? <NoAssessment/> : <>
          {(a.evidence && a.evidence.length) ? <EvidencePanel evidence={a.evidence}/> : <NoEvidence/>}
          <TimelineCard api={api} org={org} kase={kase}/>
        </>}
      </>}
  </>;
}

export function ActivityPage({ api, org }) {
  const { cases, selectedId, setSelectedId, kase } = useCaseSelector(api, org);
  return <>
    <Header eyebrow="MODULE" title="Activity / Timeline" subtitle="Assessment history and how the law behind this case evolved over time."/>
    <InlineHelp id="activity" title="What is the timeline?"
      body="The top section lists every assessment you have run for this case. The lower section shows the legal/regulatory sources that were cited, with their status (CURRENT / HISTORICAL / DRAFT) and effective dates. If a source is marked DRAFT, it is never treated as current law."/>
    {!cases?.length ? <NeedsCase page="Activity"/> :
      <>
        <CaseScopeBar cases={cases} selectedId={selectedId} setSelectedId={setSelectedId} page="activity"/>
        <JurisdictionBoundary kase={kase}/>
        {kase && <>
          <section className="card">
            <h3 className="card-h"><History size={15}/> Assessment runs</h3>
            {!kase.assessments?.length && <p className="muted small">No assessments yet.</p>}
            {[...(kase.assessments || [])].reverse().map((asmt, i) => <div key={i} className="risk-row sev-grey">
              <i/>
              <span><strong>{new Date(asmt.createdAt).toLocaleString()}</strong> — confidence {asmt.confidence}, classification {asmt.classification?.primary?.replaceAll('_', ' ').toLowerCase()}</span>
            </div>)}
          </section>
          <TimelineCard api={api} org={org} kase={kase}/>
        </>}
      </>}
  </>;
}
