import React, { useEffect, useState } from 'react';
import { AlertTriangle, BellRing, Check, ChevronRight, ClipboardCheck, ExternalLink, FileText, Globe2, HeartPulse, Plus, RefreshCw, ShieldCheck } from 'lucide-react';

const apiCall = (api, path, options) => api.request(path, options);
const tone = value => value === 'RED' || value === 'MISSING' || value === 'RECALL_REVIEW_REQUIRED' ? 'sev-red' : value === 'YELLOW' || value === 'REVIEW_REQUIRED' || value === 'GAPS_REMAIN' ? 'sev-yellow' : 'sev-green';

export function ClaimsReviewCard({ api, org, kase, assessment }) {
  const [labelText, setLabelText] = useState(kase.facts?.labelText || '');
  const [data, setData] = useState(assessment?.claimFindings || null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setData(assessment?.claimFindings || null); setLabelText(kase.facts?.labelText || ''); }, [kase._id, assessment?.createdAt]);
  async function check(e) {
    e.preventDefault(); setBusy(true);
    try { setData(await apiCall(api, `/api/organizations/${org._id}/sahayak/cases/${kase._id}/claims/check`, { method: 'POST', body: JSON.stringify({ labelText }) })); }
    finally { setBusy(false); }
  }
  const findings = data?.findings || [];
  return <section className="card advanced-card claims-card">
    <h3 className="card-h"><ClipboardCheck size={15}/> Claims &amp; label review <small>deterministic pre-publication check</small></h3>
    <p className="muted small">Paste the exact label or advertisement wording. Flags are review triggers, never an approval decision.</p>
    <form onSubmit={check} className="advanced-form">
      <textarea value={labelText} onChange={e => setLabelText(e.target.value)} maxLength="5000" rows="3" placeholder="Example: Supports daily wellness. Do not use to treat diabetes…"/>
      <button className="secondary" disabled={busy}>{busy ? <RefreshCw className="spin" size={14}/> : <Check size={14}/>} Check wording</button>
    </form>
    <div className="finding-list">
      {findings.map((f, i) => <details key={`${f.type}-${i}`} className={`finding ${tone(f.severity)}`}>
        <summary><span className={`badge ${tone(f.severity)}`}>{f.severity}</span><strong>{f.title}</strong><span className="finding-claim">{f.claim || 'No claim text provided'}</span><ChevronRight size={14}/></summary>
        <div className="finding-body"><p>{f.reason}</p><p><strong>Suggested handling:</strong> {f.suggestion}</p>
          {f.evidence ? <details className="passage"><summary>View supporting passage · {f.evidence.sourceTitle}</summary><blockquote>{f.evidence.passage}</blockquote><small>{f.evidence.section} · {f.evidence.supportLevel}</small></details> : <small className="muted">Evidence: UNSUPPORTED — attach the relevant official source before relying on this finding.</small>}
        </div>
      </details>)}
    </div>
  </section>;
}

export function CompliancePassportCard({ api, org, kase, assessment }) {
  const [passport, setPassport] = useState(assessment?.compliancePassport || null);
  const [form, setForm] = useState({ type: 'formulation', name: '', notes: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => setPassport(assessment?.compliancePassport || null), [kase._id, assessment?.createdAt]);
  async function addDocument(e) {
    e.preventDefault(); if (!form.name.trim()) return; setBusy(true);
    try { setPassport(await apiCall(api, `/api/organizations/${org._id}/sahayak/cases/${kase._id}/dossier/documents`, { method: 'POST', body: JSON.stringify(form) })); setForm({ ...form, name: '', notes: '' }); }
    finally { setBusy(false); }
  }
  const checks = passport?.checks || [];
  return <section className="card advanced-card passport-card">
    <div className="advanced-head"><h3 className="card-h"><ShieldCheck size={15}/> Product Compliance Passport <small>facts · documents · readiness</small></h3><span className={`badge ${tone(passport?.status)}`}>{passport?.completeness ?? 0}% complete</span></div>
    <p className="muted small">Evidence readiness for professional review, not a compliance certificate.</p>
    <div className="passport-progress"><i style={{ width: `${passport?.completeness || 0}%` }}/></div>
    <div className="passport-checks">{checks.map(c => <span key={c.type} className={`passport-check ${c.status === 'ADDED' ? 'done' : 'missing'}`}><i>{c.status === 'ADDED' ? '✓' : '!'}</i>{c.label}</span>)}</div>
    {!!passport?.missing?.length && <p className="warnline"><AlertTriangle size={13}/> Missing: {passport.missing.join(' · ')}</p>}
    <form onSubmit={addDocument} className="passport-add">
      <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} aria-label="Evidence type"><option value="formulation">Formula / ingredient sheet</option><option value="ingredients">Species and source provenance</option><option value="label">Draft label / advertisement</option><option value="quality">Quality / laboratory evidence</option><option value="manufacturing">Manufacturing / process record</option><option value="licence">Licence / application reference</option></select>
      <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Document or evidence name" aria-label="Document name"/>
      <button className="secondary" disabled={busy}><Plus size={14}/> Add evidence</button>
    </form>
  </section>;
}

export function MarketRoutesCard({ assessment }) {
  const routes = assessment?.marketRoutes || [];
  return <section className="card advanced-card">
    <h3 className="card-h"><Globe2 size={15}/> Market routes <small>explicit jurisdiction packs</small></h3>
    <div className="market-grid">{routes.map(r => <article key={r.id} className="market-route"><div className="advanced-head"><strong>{r.name}</strong><span className={`badge ${r.status === 'MARKET_SELECTION_REQUIRED' ? 'sev-yellow' : r.status === 'MARKET_CHECKLIST' ? 'sev-grey' : 'sev-green'}`}>{r.status.replaceAll('_', ' ')}</span></div><small>{r.authority}</small><ul className="tiny-list">{(r.steps || []).map((s, i) => <li key={i}>{s}</li>)}</ul>{r.officialUrl && <a href={r.officialUrl} target="_blank" rel="noreferrer">Official source <ExternalLink size={11}/></a>}{r.disclaimer && <small className="route-disclaimer">{r.disclaimer}</small>}</article>)}</div>
    {!routes.some(r => r.id !== 'IN' && r.id !== 'WIPO') && <p className="muted small">Select a target market above to attach a separate verification checklist.</p>}
  </section>;
}

export function FilingPackCard({ assessment }) {
  const packs = assessment?.filingPack || [];
  return <section className="card advanced-card filing-card"><h3 className="card-h"><FileText size={15}/> Filing-ready action pack <small>professional preparation checklist</small></h3><p className="muted small">The pack points to official portals and documents to prepare. It never submits an application or payment.</p><div className="filing-list">{packs.map((pack, i) => <details key={`${pack.regime}-${i}`} className="filing-item"><summary><strong>{pack.title}</strong><span>{pack.authority}</span><ChevronRight size={14}/></summary><div><p className="small"><strong>Prepare:</strong> {(pack.requiredDocuments || []).join(' · ')}</p><ul className="tiny-list">{(pack.nextActions || []).map((a, j) => <li key={j}>{a}</li>)}</ul>{pack.officialUrl && <a href={pack.officialUrl} target="_blank" rel="noreferrer">Open official portal <ExternalLink size={11}/></a>}<small className="muted">Last checked: {pack.lastVerified}</small></div></details>)}</div>{!packs.length && <p className="muted small">Run an assessment to generate route-specific preparation items.</p>}</section>;
}

export function ChangeAlertsCard({ assessment }) {
  const alerts = assessment?.changeAlerts || [];
  return <section className="card advanced-card change-card"><h3 className="card-h"><BellRing size={15}/> Regulatory change watch <small>cited-source freshness</small></h3>{alerts.length ? <>{alerts.map((a, i) => <div key={i} className="change-alert"><span className="badge sev-yellow">{a.status}</span><div><strong>{a.title}</strong><p>{a.message}</p></div></div>)}<p className="warnline"><AlertTriangle size={13}/> Re-run this assessment before relying on affected conclusions.</p></> : <p className="muted small"><Check size={13}/> No historical or superseded cited sources were detected in this assessment.</p>}</section>;
}

export function SafetyPostMarketCard({ api, org, kase, assessment, onRefresh }) {
  const [form, setForm] = useState({ type: 'consumer_complaint', description: '', batch: '' });
  const [busy, setBusy] = useState(false);
  const summary = assessment?.safetySummary || { required: [], events: [] };
  async function submit(e) {
    e.preventDefault(); if (!form.description.trim()) return; setBusy(true);
    try { await apiCall(api, `/api/organizations/${org._id}/sahayak/cases/${kase._id}/safety-events`, { method: 'POST', body: JSON.stringify(form) }); setForm({ ...form, description: '', batch: '' }); onRefresh?.(); }
    finally { setBusy(false); }
  }
  return <section className="card advanced-card safety-card">
    <div className="advanced-head"><h3 className="card-h"><HeartPulse size={15}/> Safety &amp; post-market <small>traceability · complaints · recall readiness</small></h3><span className={`badge ${tone(summary.readiness)}`}>{summary.readiness || 'PRE-MARKET'}</span></div>
    <div className="safety-required">{(summary.required || []).map(item => <span key={item}><Check size={12}/> {item}</span>)}</div>
    <form onSubmit={submit} className="safety-form"><select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} aria-label="Safety event type"><option value="consumer_complaint">Consumer complaint</option><option value="adverse_event">Adverse event</option><option value="misleading_advertisement">Misleading advertisement</option><option value="recall">Potential recall</option></select><input value={form.batch} onChange={e => setForm({ ...form, batch: e.target.value })} placeholder="Batch / lot (optional)"/><input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Record an issue or observation"/><button className="secondary" disabled={busy}><Plus size={14}/> Record</button></form>
    {!!summary.events?.length && <div className="event-list">{summary.events.slice(-4).map((e, i) => <div key={i}><span className={`badge ${e.type === 'recall' ? 'sev-red' : 'sev-yellow'}`}>{e.type.replaceAll('_', ' ')}</span><span>{e.description}</span><small>{e.batch || 'batch not recorded'}</small></div>)}</div>}
    <div className="source-links"><a href="https://suraksha.ayush.gov.in/about" target="_blank" rel="noreferrer">Ayush Suraksha <ExternalLink size={11}/></a><a href="https://fssai.gov.in/food-law/food-recall" target="_blank" rel="noreferrer">FSSAI recall guidance <ExternalLink size={11}/></a></div>
  </section>;
}

export function ReviewWorkflowCard({ api, org, kase, assessment }) {
  const initial = assessment?.reviewWorkflow || kase.reviewWorkflow || {};
  const [form, setForm] = useState({ status: initial.status || 'NOT_STARTED', reviewerRole: initial.reviewerRole || '', comments: initial.comments || '' });
  const [saved, setSaved] = useState(false);
  useEffect(() => { const next = assessment?.reviewWorkflow || kase.reviewWorkflow || {}; setForm({ status: next.status || 'NOT_STARTED', reviewerRole: next.reviewerRole || '', comments: next.comments || '' }); }, [kase._id, assessment?.createdAt]);
  async function save(e) { e.preventDefault(); await apiCall(api, `/api/organizations/${org._id}/sahayak/cases/${kase._id}/review`, { method: 'PATCH', body: JSON.stringify(form) }); setSaved(true); setTimeout(() => setSaved(false), 1800); }
  return <section className="card advanced-card review-card"><h3 className="card-h"><FileText size={15}/> Professional review <small>controlled handoff workflow</small></h3><form onSubmit={save} className="review-form"><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option>NOT_STARTED</option><option>IN_REVIEW</option><option>NEEDS_INFORMATION</option><option>VERIFIED_BY_REVIEWER</option></select><input value={form.reviewerRole} onChange={e => setForm({ ...form, reviewerRole: e.target.value })} placeholder="Reviewer type (patent agent, AYUSH, ABS…)"/><textarea value={form.comments} onChange={e => setForm({ ...form, comments: e.target.value })} rows="2" placeholder="Review comments or missing information"/><button className="secondary"><Check size={14}/> {saved ? 'Saved' : 'Save review status'}</button></form></section>;
}

export function ModelFeedbackCard({ api, org, kase }) {
  const [task, setTask] = useState('assessment_summary');
  const [rating, setRating] = useState('NEEDS_CORRECTION');
  const [correctedAnswer, setCorrectedAnswer] = useState('');
  const [correctionNotes, setCorrectionNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  async function submit(e) {
    e.preventDefault(); setBusy(true); setSaved(false); setError('');
    try {
      await apiCall(api, `/api/organizations/${org._id}/sahayak/cases/${kase._id}/model-feedback`, { method: 'POST', body: JSON.stringify({ task, rating, correctedAnswer, correctionNotes }) });
      setSaved(true); setCorrectedAnswer(''); setCorrectionNotes('');
    } catch (err) { setError(err.message || 'Feedback could not be queued'); }
    finally { setBusy(false); }
  }
  return <section className="card advanced-card review-card"><h3 className="card-h"><RefreshCw size={15}/> Improve the model <small>human-approved learning queue</small></h3><p className="muted small">Submit only source-backed corrections. An owner/admin must approve feedback before it can enter Qwen fine-tuning.</p><form onSubmit={submit} className="review-form"><div className="form-grid"><select value={task} onChange={e => setTask(e.target.value)}><option value="assessment_summary">Assessment summary</option><option value="assistant">Assistant answer</option><option value="intake">Fact extraction</option></select><select value={rating} onChange={e => setRating(e.target.value)}><option value="NEEDS_CORRECTION">Needs correction</option><option value="CORRECT">Correct</option><option value="UNSUPPORTED">Unsupported</option></select></div>{rating === 'NEEDS_CORRECTION' && <textarea value={correctedAnswer} onChange={e => setCorrectedAnswer(e.target.value)} rows="3" placeholder="Write the corrected answer" required/>}<textarea value={correctionNotes} onChange={e => setCorrectionNotes(e.target.value)} rows="2" placeholder="Why is this correction source-backed?"/><button className="secondary" disabled={busy}><RefreshCw size={14}/> {saved ? 'Queued for approval' : busy ? 'Submitting…' : 'Submit model feedback'}</button>{error && <p className="warnline">{error}</p>}</form></section>;
}

export function WhatIfCard({ api, org, kase }) {
  const [result, setResult] = useState(null); const [busy, setBusy] = useState(false);
  async function compare(factsPatch) { setBusy(true); try { setResult(await apiCall(api, `/api/organizations/${org._id}/sahayak/cases/${kase._id}/scenarios/compare`, { method: 'POST', body: JSON.stringify({ factsPatch }) })); } finally { setBusy(false); } }
  return <section className="card advanced-card whatif-card"><h3 className="card-h"><RefreshCw size={15}/> What-if comparison <small>see how product facts change the pathway</small></h3><div className="whatif-actions"><button className="chip" disabled={busy} onClick={() => compare({ claims: ['supports daily wellness'] })}>Remove disease claim</button><button className="chip" disabled={busy} onClick={() => compare({ wildCollected: 'cultivated' })}>Use cultivated source</button><button className="chip" disabled={busy} onClick={() => compare({ commercialIntent: 'export_related', targetMarket: 'india_and_export' })}>Plan export</button></div>{result && <div className="comparison"><div><small>Current</small><strong>{result.current.classification}</strong><span>{result.current.regimes.join(' · ') || 'No regimes'}</span></div><ChevronRight size={16}/><div><small>Scenario</small><strong>{result.next.classification}</strong><span>{result.next.regimes.join(' · ') || 'No regimes'}</span></div></div>}</section>;
}
