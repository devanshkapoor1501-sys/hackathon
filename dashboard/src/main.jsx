import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity, AlertTriangle, ArrowRight, BadgeCheck, BookOpen, Check, CheckCircle2, ChevronRight, Database,
  ClipboardCheck, CircleHelp, FileSearch, FlaskConical, Gauge, Globe2, History, Leaf, Loader2, LockKeyhole,
  LayoutDashboard, LogOut, Menu, Mic, Plus, RefreshCw, Search, Settings, ShieldAlert, ShieldCheck, Sparkles, SquarePlus,
  TerminalSquare, Users, X, Scale
} from 'lucide-react';
import './styles.css';
import { GuidedTour, HelpCenter, hasCompletedTour, resetTour } from './tour.jsx';
import { PresenterOverlay, PRESENTER_SCENES, usePresenter } from './presenter.jsx';
import { Spinner } from './sahayak.jsx';
import {
  DashboardHome, NewCasePage, ClassificationPage, IpAssessmentPage,
  RegulatoryAssessmentPage, EvidencePage, ActivityPage, RoleWorkspacePage
} from './modules.jsx';
import { SahayakPage, CaseWorkspaceView, LegalSourcesPage, DevPanelPage, EvaluationPage } from './sahayak.jsx';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const BRAND = { name: 'IP-SAKTI Sahayak', tagline: 'AI-powered IP and regulatory decision support for Ayurveda', ps: 'SIH 26045' };

const NAV_MAIN = [
  ['Dashboard', Gauge], ['New Case', SquarePlus], ['My Cases', FileSearch],
  ['Product Classification', BadgeCheck], ['IP Assessment', Scale], ['Regulatory Assessment', BookOpen],
  ['Evidence & Sources', ShieldCheck], ['Activity / Timeline', History]
];
const NAV_PLATFORM = [
  ['Legal Sources', BookOpen], ['Evaluation', ClipboardCheck], ['System', TerminalSquare], ['Settings', Settings]
];

const ROLE_META = {
  applicant: { label: 'Applicant / Innovator', compact: 'Applicant', eyebrow: 'INNOVATOR WORKSPACE' },
  professional: { label: 'IP Professional', compact: 'Professional', eyebrow: 'PROFESSIONAL REVIEW DESK' },
  government: { label: 'Government Reviewer', compact: 'Government', eyebrow: 'REGULATORY OVERSIGHT DESK' },
  platform_admin: { label: 'Platform Administrator', compact: 'Platform Admin', eyebrow: 'PLATFORM OPERATIONS' }
};

const NAV_BY_ROLE = {
  applicant: [['ASSESSMENTS', NAV_MAIN], ['PLATFORM TOOLS', NAV_PLATFORM]],
  professional: [
    ['PROFESSIONAL DESK', [['Dashboard', Gauge], ['Review Queue', ClipboardCheck], ['New Case', SquarePlus], ['My Cases', FileSearch], ['Product Classification', BadgeCheck], ['IP Assessment', Scale], ['Regulatory Assessment', BookOpen], ['Evidence & Sources', ShieldCheck], ['Activity / Timeline', History]]],
    ['KNOWLEDGE & ACCOUNT', [['Legal Sources', BookOpen], ['Settings', Settings]]]
  ],
  government: [
    ['OVERSIGHT DESK', [['Dashboard', Gauge], ['Oversight', ClipboardCheck], ['Case Registry', FileSearch], ['Evidence & Sources', ShieldCheck], ['Activity / Timeline', History]]],
    ['PUBLIC KNOWLEDGE', [['Legal Sources', BookOpen], ['Settings', Settings]]]
  ],
  platform_admin: [
    ['OPERATIONS', [['Dashboard', Gauge], ['Platform Operations', TerminalSquare], ['Legal Sources', BookOpen], ['Evaluation', ClipboardCheck], ['Activity / Timeline', History]]],
    ['ACCOUNT', [['Settings', Settings]]]
  ]
};

function roleMeta(accountRole) { return ROLE_META[accountRole] || ROLE_META.applicant; }
function roleNavigation(accountRole) { return NAV_BY_ROLE[accountRole] || NAV_BY_ROLE.applicant; }

/* ---------------- API client ---------------- */
class Api {
  constructor(accessToken, setAccessToken) { this.accessToken = accessToken; this.setAccessToken = setAccessToken; }
  async request(path, options = {}, retry = true) {
    const headers = new Headers(options.headers || {}); if (options.body != null && !(options.body instanceof FormData)) headers.set('content-type', 'application/json'); if (this.accessToken) headers.set('authorization', `Bearer ${this.accessToken}`);
    let response = await fetch(`${API}${path}`, { ...options, headers, credentials: 'include' });
    if (response.status === 401 && retry) {
      const refresh = await fetch(`${API}/api/auth/refresh`, {
        method: 'POST', credentials: 'include',
        headers: { 'content-type': 'application/json' }, body: '{}'
      });
      if (refresh.ok) {
        const data = await refresh.json(); this.setAccessToken(data.accessToken); this.accessToken = data.accessToken;
        return this.request(path, options, false);
      }
    }
    const data = response.status === 204 ? null : await response.json(); if (!response.ok) {
      // Surface the full structured error so RecoveryHint can show userMessage / requestId / retryable.
      const errInfo = data?.error || {};
      const error = new Error(errInfo.userMessage || errInfo.message || 'Request failed');
      error.code = errInfo.code;
      error.userMessage = errInfo.userMessage;
      error.retryable = errInfo.retryable;
      error.recoveryHint = errInfo.recoveryHint;
      error.requestId = errInfo.requestId;
      error.status = response.status;
      throw error;
    }
    return data;
  }
}

function useHashRoute() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const onChange = () => setHash(location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return decodeURIComponent(hash.replace(/^#\/?/, ''));
}

/* ---------------- PUBLIC: Landing ---------------- */
export function Landing({ onAuth }) {
  return <main className="landing">
    <nav className="landing-nav">
      <Brand/>
      <div className="landing-links">
        <a href="#/how-it-works">How it works</a>
        <button className="secondary" onClick={() => onAuth()}>Sign in</button>
        <button className="primary ipsk-btn" onClick={() => onAuth()}>Start Assessment</button>
      </div>
    </nav>

    <section className="hero">
      <p className="ps-badge">SMART INDIA HACKATHON · PROBLEM STATEMENT {BRAND.ps}</p>
      <h1>IP-SAKTI Sahayak</h1>
      <p className="hero-tagline">AI-powered decision support for Ayurvedic IP and regulatory pathways.</p>
      <p className="hero-desc">Describe your Ayurvedic product or innovation, choose India or International, and get a source-cited route map with evidence, risks, and next actions kept clearly separate.</p>
      <div className="hero-ctas">
        <button className="primary ipsk-btn big" onClick={() => onAuth()}>Start Assessment <ArrowRight size={16}/></button>
        <a className="secondary big" href="#/how-it-works">Explore How It Works</a>
      </div>
      <div className="hero-note"><ShieldCheck size={14}/> Decision support only — not legal advice, not a government approval authority.</div>
    </section>

    <section className="landing-section">
      <p className="eyebrow center">HOW IT WORKS</p>
      <h2 className="center-h">From description to evidence-backed action plan</h2>
      <div className="flow-grid">
        {[['01', 'Describe', 'Your product in plain language — no legal terminology needed.'], ['02', 'Classify', 'The system determines what the product actually is.'], ['03', 'Verify', 'Conclusions are checked against authoritative sources for the selected jurisdiction.'], ['04', 'Act', 'A concrete next-action plan with human-review flags.']].map(([n, t, d]) =>
          <article key={n} className="flow-card"><span>{n}</span><h3>{t}</h3><p>{d}</p></article>)}
      </div>
    </section>

    <section className="landing-section alt">
      <p className="eyebrow center">WHAT IP-SAKTI ANALYZES</p>
      <div className="chips center">
        {['AYUSH / ASU medicines', 'Indian IP (Patents, Trademarks, GI)', 'TRIPS · PCT · Madrid · Hague', 'Traditional Knowledge · s.3(p)', 'CBD / Nagoya ABS', 'Food / Ayurveda Aahara (FSSAI)', 'Export-market classification'].map(x => <span key={x} className="chip static">{x}</span>)}
      </div>
    </section>

    <section className="landing-section">
      <p className="eyebrow center">WHY IT IS DIFFERENT</p>
      <h2 className="center-h">Not just an AI chatbot.</h2>
      <div className="why-grid">
        {[['Evidence-backed', 'Every conclusion cites its source, section and current/historical status.'],
          ['Jurisdiction-aware', 'India and International answer sets stay visibly separate.'],
          ['Classification-first', 'Product category is resolved before any regulatory question is answered.'],
          ['Source-aware', 'Authority levels, effective dates and superseded versions are tracked.'],
          ['Human-review ready', 'Uncertainty is escalated with context, not hidden behind confidence scores.'],
          ['AI optional', 'Cloud AI, LM Studio or deterministic mode — nothing is fabricated when offline.']].map(([t, d]) =>
          <article key={t} className="why-card"><ShieldCheck size={18}/><h3>{t}</h3><p>{d}</p></article>)}
      </div>
    </section>

    <footer className="landing-foot">
      <Brand small/> 
      <span>Prototype for evaluation purposes · Official-source pointers · Not affiliated with any government body</span>
    </footer>
  </main>;
}

/* ---------------- PUBLIC: How it works ---------------- */
export function HowItWorks({ onBack }) {
  const steps = [
    ['User Input', 'You describe an Ayurvedic product or innovation in plain language.'],
    ['AI Fact Extraction', 'Structured facts are extracted — intended use, claims, ingredients, process.'],
    ['Clarifying Questions', 'Only questions that materially change the classification are asked.'],
    ['Product Classification', 'Deterministic rules classify the product (ASU drug, food, cosmetic…).'],
    ['Regulatory Mapping', 'Applicable regimes are derived from the classification and selected jurisdiction.'],
    ['Source Retrieval', 'Hybrid search over a jurisdiction-tagged authority-aware legal corpus.'],
    ['Evidence Verification', 'Each citation is checked: source, jurisdiction, status, dates, passage.'],
    ['Risk Assessment', 'Confidence is derived from evidence strength — never invented.'],
    ['Action Plan', 'Concrete next actions, each linked to its reason.'],
    ['Human Review', 'Ambiguity is escalated to qualified professionals with context.']
  ];
  return <main className="landing">
    <nav className="landing-nav"><Brand/><button className="secondary" onClick={onBack}>← Back</button></nav>
    <section className="landing-section">
      <p className="eyebrow center">THE PIPELINE</p>
      <h1 className="center-h">How IP-SAKTI reaches a conclusion</h1>
      <div className="pipeline">
        {steps.map(([t, d], i) =>
          <article key={t} className="pipeline-step">
            <span className="pipe-num">{i + 1}</span>
            <div><h3>{t}</h3><p>{d}</p></div>
            {i < steps.length - 1 && <ChevronRight size={16} className="pipe-arrow"/>}
          </article>)}
      </div>
      <div className="why-strip">
        <ShieldCheck size={16}/> The LLM explains verified conclusions — deterministic engines and authoritative sources decide them.
      </div>
    </section>
  </main>;
}

/* ---------------- Brand ---------------- */
function Brand({ small }) {
  return <div className={`brand-lockup ${small ? 'small' : ''}`}>
    <div className="logo ipsk-logo"><LeafMark/><b>IP-SAKTI</b><i>Sahayak</i></div>
    <small>SIH 26045 · Ayurvedic IP &amp; Regulatory Decision Support</small>
  </div>;
}
const LeafMark = () => <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 3c-3.4 3-6 5.8-6 9a6 6 0 0 0 12 0c0-3.2-2.6-6-6-9z" fill="#e8f5ee"/><circle cx="12" cy="13" r="2" fill="#d97706"/></svg>;

/* ---------------- Auth ---------------- */
function Auth({ onSession }) {
  const [mode, setMode] = useState('login'), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [demoAccounts, setDemoAccounts] = useState([]), [selectedDemo, setSelectedDemo] = useState(null);
  useEffect(() => {
    if (mode !== 'login') return;
    fetch(`${API}/api/auth/demo-accounts`).then(response => response.ok ? response.json() : []).then(setDemoAccounts).catch(() => setDemoAccounts([]));
  }, [mode]);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    const form = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (mode === 'register') await fetch(`${API}/api/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) }).then(async r => {
        if (!r.ok) {
          const data = await r.json();
          const details = data?.error || {};
          throw new Error([details.userMessage || details.message || 'Registration failed', details.recoveryHint].filter(Boolean).join(' '));
        }
      });
      const response = await fetch(`${API}/api/auth/login`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: form.email, password: form.password }) });
      const data = await response.json(); if (!response.ok) throw new Error([data?.error?.userMessage || data?.error?.message || 'Sign in failed', data?.error?.recoveryHint].filter(Boolean).join(' '));
      onSession(data);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <main className="auth-shell">
    <section className="auth-brand">
      <Brand/>
      <div className="auth-copy">
        <p className="eyebrow">JURISDICTION-AWARE DECISION SUPPORT · SIH 26045</p>
        <h1>Classify your Ayurvedic product. <em>See the right pathways.</em></h1>
        <p>Built for startups, MSMEs, practitioners and innovators who need a clear, source-cited view of Indian and international IP or regulatory routes.</p>
        <div className="stat-strip">
          <div className="stat"><Scale size={16}/><div><strong>7 regimes</strong><span>mapped end-to-end</span></div></div>
          <div className="stat"><ShieldCheck size={16}/><div><strong>Evidence-backed</strong><span>cited, not hallucinated</span></div></div>
          <div className="stat"><Leaf size={16}/><div><strong>AI optional</strong><span>cloud, local or deterministic</span></div></div>
        </div>
        <div className="regime-strip">
          <span className="regime"><Leaf size={13}/> AYUSH</span>
          <span className="regime"><BadgeCheck size={13}/> Patents</span>
          <span className="regime"><BookOpen size={13}/> Trad. Knowledge</span>
          <span className="regime"><FlaskConical size={13}/> Biodiversity / ABS</span>
        </div>
      </div>
    </section>
    <section className="auth-form"><div className="form-card">
      <p className="kicker">{mode === 'login' ? 'WELCOME BACK' : 'CREATE YOUR WORKSPACE'}</p>
      <h2>{mode === 'login' ? 'Sign in to continue.' : 'Start assessing in minutes.'}</h2>
      <form key={selectedDemo?.email || mode} onSubmit={submit}>
        {mode === 'register' && <label>Full name<input name="name" required minLength="2" placeholder="Asha Sharma"/></label>}
        <label>Work email<input name="email" type="email" required placeholder="asha@ayurstartup.in" defaultValue={selectedDemo?.email || ''}/></label>
        <label>Password<input name="password" type="password" minLength="10" required placeholder="At least 10 characters" defaultValue={selectedDemo?.password || ''}/></label>
        {error && <div className="alert">{error}</div>}
        <button className="primary ipsk-btn full" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
      </form>
      {mode === 'login' && demoAccounts.length > 0 && <div className="demo-access" aria-label="Demo accounts">
        <div className="demo-access-head"><div><p className="eyebrow">EVALUATION ACCESS</p><strong>Try a role-based demo</strong></div><span>Dev only</span></div>
        <div className="demo-account-list">{demoAccounts.map(account => <button type="button" key={account.key} className={`demo-account ${selectedDemo?.key === account.key ? 'active' : ''}`} onClick={() => { setSelectedDemo(account); setError(''); }}>
          <span className="demo-account-mark">{account.roleLabel.slice(0, 1)}</span><span><strong>{account.roleLabel}</strong><small>{account.description}</small></span><ChevronRight size={14}/>
        </button>)}</div>
        <p className="demo-access-note"><ShieldCheck size={13}/> Demo credentials are prefilled for this development workspace.</p>
      </div>}
      <p className="switch">{mode === 'login' ? 'New here?' : 'Already have an account?'} <button onClick={() => { setMode(m => m === 'login' ? 'register' : 'login'); setError(''); setSelectedDemo(null); }}>{mode === 'login' ? 'Create an account' : 'Sign in'}</button></p>
    </div></section>
  </main>;
}

/* ---------------- Workspace setup ---------------- */
function Setup({ api, onReady }) {
  const [name, setName] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function create(e) { e.preventDefault(); setBusy(true); setError(''); try { onReady(await api.request('/api/organizations', { method: 'POST', body: JSON.stringify({ name: name.trim() }) })); } catch (e) { setError(e.message); } finally { setBusy(false); } }
  async function signOut(){try{await api.request('/api/auth/logout',{method:'POST'})}finally{location.reload()}}
  return <main className="session-shell setup-shell">
    <section className="session-brand setup-brand" aria-hidden="true">
      <Brand/>
      <div className="session-brand-copy">
        <p className="eyebrow light">YOUR ASSESSMENT WORKSPACE</p>
        <h1>Give your work<br/><em>a clear home.</em></h1>
        <p>Keep cases, assessments and evidence together—securely separated for your organization or practice.</p>
      </div>
      <div className="session-orbit"><span/><i/><b/></div>
    </section>
    <section className="session-panel setup-panel">
      <div className="setup-card setup-card-themed">
        <div className="setup-step-index">01</div>
        <p className="kicker">SET UP YOUR SPACE</p>
        <h2>Name your organization or practice</h2>
        <p className="setup-lede">This name will appear across your dashboard and reports.</p>
        <form onSubmit={create}>
          <label>Organization name<input value={name} onChange={e => setName(e.target.value)} minLength="2" required placeholder="AyurStartup Innovations LLP" autoComplete="organization"/></label>
          {error && <div className="alert" role="alert">{error}</div>}
          <button className="primary ipsk-btn full" disabled={busy}>{busy ? 'Creating…' : <>Continue <ArrowRight size={15}/></>}</button>
          <button type="button" className="setup-signout" onClick={signOut} disabled={busy}><LogOut/> Use another account</button>
        </form>
        <p className="setup-assurance"><ShieldCheck size={14}/> You can update this later in Workspace settings.</p>
      </div>
    </section>
  </main>;
}

function LoadingWorkspace({ mode = 'restoring' }) {
  const starting = mode === 'starting';
  return <main className="session-shell" aria-busy="true" aria-live="polite">
    <section className="session-brand" aria-hidden="true">
      <Brand/>
      <div className="session-brand-copy">
        <p className="eyebrow light">{starting ? 'WORKSPACE INITIALISING' : 'SESSION CHECK IN PROGRESS'}</p>
        <h1>{starting ? <>Your assessment workspace<br/><em>is almost ready.</em></> : <>A calm place to make<br/><em>the right next decision.</em></>}</h1>
        <p>{starting ? 'Loading your organization, cases and evidence-backed tools.' : 'IP-SAKTI keeps every classification, source and action plan close at hand.'}</p>
      </div>
      <div className="session-orbit"><span/><i/><b/></div>
    </section>
    <section className="session-panel">
      <div className="session-card" role="status">
        <div className="session-mark"><LeafMark/><span className="session-mark-ring"/></div>
        <p className="kicker">{starting ? 'STARTING YOUR SESSION' : 'RESTORING YOUR SESSION'}</p>
        <h2>{starting ? 'Opening your workspace.' : 'Checking your workspace.'}</h2>
        <p className="session-lede">{starting ? 'One moment while we prepare your secure assessment environment.' : 'We’re checking your session and preparing the latest workspace state.'}</p>
        <div className="session-steps">
          <div className="session-step active"><span className="session-step-icon"><LockKeyhole size={16}/></span><span><strong>Secure sign-in</strong><small>Verifying your session</small></span><SpinnerInline/></div>
          <div className="session-step"><span className="session-step-icon"><Database size={16}/></span><span><strong>Workspace data</strong><small>Loading your organization</small></span><span className="session-step-dot"/></div>
          <div className="session-step"><span className="session-step-icon"><LayoutDashboard size={16}/></span><span><strong>Dashboard</strong><small>Preparing your tools</small></span><span className="session-step-dot"/></div>
        </div>
        <div className="session-progress"><span/></div>
        <p className="session-note"><ShieldCheck size={14}/> Your cases stay scoped to your organization.</p>
      </div>
    </section>
  </main>;
}
const SpinnerInline = () => <Loader2 size={22} className="spin"/>;

/* ---------------- Settings ---------------- */
function SettingsPage({ api, org, user, membership, onOrgUpdated }) {
  const [name, setName] = useState(org.name || ''), [saving, setSaving] = useState(false), [saved, setSaved] = useState(false), [error, setError] = useState('');
  const canManageOrganization = ['owner', 'admin'].includes(membership?.role);
  async function save(e) { e.preventDefault(); setSaving(true); setError(''); try { onOrgUpdated(await api.request(`/api/organizations/${org._id}`, { method: 'PATCH', body: JSON.stringify({ name: name.trim() }) })); setSaved(true); } catch (e) { setError(e.message); } finally { setSaving(false); } }
  async function signOut(){try{await api.request('/api/auth/logout',{method:'POST'})}finally{location.reload()}}
  function replayTour() { resetTour(); location.hash = '#/app/Dashboard'; location.reload(); }
  return <>
    <Header eyebrow="SETTINGS" title="Workspace settings"/>
    <div className="settings-grid">
      <section className="card settings-card">
        <h2>Organization</h2>
        {canManageOrganization ? <form onSubmit={save}>
          <label>Organization name<input value={name} onChange={e => { setName(e.target.value); setSaved(false); }} minLength="2" required/></label>
          <label>Workspace ID<input value={org._id} readOnly/></label>
          {error && <div className="alert" role="alert">{error}</div>}
          <button className="primary ipsk-btn" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          {saved && <span className="inline-success"><CheckCircle2 size={14}/> Saved</span>}
        </form> : <><p className="muted">This workspace is managed by an organization owner or administrator.</p><label>Workspace ID<input value={org._id} readOnly/></label></>}
      </section>
      <section className="card settings-card">
        <h2>Account</h2>
        <p className="muted">Signed in as <strong>{user.email}</strong></p>
        <button className="secondary" onClick={signOut}><LogOut size={14}/> Sign out</button>
      </section>
      <section className="card settings-card">
        <h2>Tour &amp; Help</h2>
        <p className="muted small">Replay the first-time product tour to revisit the core flow, or use the <strong>?</strong> button in the top bar for the help center.</p>
        <button className="secondary" onClick={replayTour}><Sparkles size={14}/> Restart product tour</button>
      </section>
      <section className="card settings-card">
        <h2>About</h2>
        <p className="small"><strong>IP-SAKTI Sahayak</strong> — SIH 26045 prototype.<br/>India + International scope. Decision support, not legal advice.</p>
      </section>
    </div>
  </>;
}

/* ---------------- Live LLM status (real backend probe every 5s) ---------------- */
function llmDisplay(data) {
  if (!data) return { cls: 'off', label: 'Offline', detail: 'backend unreachable — template mode' };
  const latency = data.latencyMs != null ? ` · ${data.latencyMs}ms` : '';
  switch (data.status) {
    case 'READY':
      return { cls: 'on', label: 'Connected', detail: `${data.model}${latency}` };
    case 'NO_MODEL_LOADED':
      return { cls: 'warn', label: 'No model loaded', detail: data.reason || 'configured AI providers have no usable model' };
    case 'MODEL_NOT_CONFIGURED':
      return { cls: 'warn', label: 'Model not configured', detail: data.reason || 'configure Gemini, NVIDIA or a local model to enable AI explanations' };
    case 'CONFIG_MISSING':
    case 'NO_PROVIDER_CONFIGURED':
      return { cls: 'off', label: 'AI optional', detail: 'deterministic mode — no provider configured' };
    case 'MODEL_MISMATCH':
      return { cls: 'warn', label: 'Model mismatch', detail: data.reason || `"${data.model}" is not loaded` };
    default:
      return { cls: 'off', label: 'Offline', detail: 'template mode — nothing fabricated' };
  }
}

function useLlmStatus(intervalMs = 5000) {
  const [info, setInfo] = useState(null);          // last /health/llm payload (null = unreachable)
  const [phase, setPhase] = useState('checking');  // checking | online | warn | offline
  const [busy, setBusy] = useState(false);         // true while a probe is in flight
  const [updatedAt, setUpdatedAt] = useState(0);
  const inFlight = React.useRef(false);

  const probe = React.useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true);
    try {
      const response = await fetch(`${API}/health/llm`, { cache: 'no-store' });
      const data = await response.json();
      // Only trust a payload whose connectivity field is present — never fake it
      setInfo(data && 'connectivity' in data ? data : null);
      setPhase(data?.connectivity === 'CONNECTED' ? 'online' : data?.status === 'NO_MODEL_LOADED' || data?.status === 'MODEL_MISMATCH' ? 'warn' : 'offline');
      setUpdatedAt(Date.now());
    } catch {
      setInfo(null); setPhase('offline'); setUpdatedAt(Date.now());
    } finally {
      inFlight.current = false; setBusy(false);
    }
  }, []);

  React.useEffect(() => {
    probe();
    const t = setInterval(probe, intervalMs);
    return () => clearInterval(t);
  }, [intervalMs, probe]);

  return { info, phase, busy, updatedAt, refresh: probe };
}

function Ago({ at }) {
  const [, forceTick] = useState(0);
  useEffect(() => { const t = setInterval(() => forceTick(x => x + 1), 1000); return () => clearInterval(t); }, []);
  if (!at) return null;
  const s = Math.max(0, Math.round((Date.now() - at) / 1000));
  return <span className="ago"> · {s < 3 ? 'just now' : `${s}s ago`}</span>;
}

/* ---------------- App shell ---------------- */
function Header({ eyebrow, title, subtitle, action }) {
  return <header className="page-head"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{action}</header>;
}
export { Header };

function Shell({ api, user, org, membership, setPage, page, onOpenHelp, onStartPresenter, onStopPresenter, presenterActive, children }) {
  const [mobile, setMobile] = useState(false);
  const llm = useLlmStatus(5000);
  const accountRole = user?.accountRole || 'applicant';
  const meta = roleMeta(accountRole);
  const groups = roleNavigation(accountRole);
  const view = llmDisplay(llm.phase === 'checking' ? null : llm.info);
  return <div className="app-shell ipsk-shell">
    <aside className={mobile ? 'mobile-open' : ''}>
      <div className="sidebar-brand"><Brand/><div className="account-context"><span className="role-dot"/><span>{meta.label}</span></div></div>
      <button className="aside-close" onClick={() => setMobile(false)} aria-label="Close navigation"><X/></button>
      {groups.map(([label, items]) => <React.Fragment key={label}>
        <p className="nav-group">{label}</p>
        <nav aria-label={`${label} navigation`}>{items.map(([label, Icon]) =>
          <button key={label} className={page === label ? 'active' : ''} onClick={() => { setPage(label); setMobile(false); }} aria-current={page === label ? 'page' : undefined}><Icon size={16}/>{label}</button>)}</nav>
      </React.Fragment>)}
      <div className="aside-bottom">
        <button type="button" className={`llm-status ${view.cls} ${llm.busy ? 'probing' : ''}`}
          onClick={llm.refresh} title="Click to re-check configured AI providers">
          <i/>
          <div>
            <strong>LLM: {view.label}</strong>
            <small>
              {view.detail}
              <Ago at={llm.updatedAt}/>
            </small>
          </div>
        </button>
        <button className="signout" onClick={async () => { try { await api.request('/api/auth/logout', { method: 'POST' }); } finally { location.reload(); } }}><LogOut size={14}/> Sign out</button>
      </div>
    </aside>
    {mobile && <button className="mobile-scrim" onClick={() => setMobile(false)} aria-label="Close navigation"/>}
    <div className="main">
      <header className="topbar">
        <button className="menu" onClick={() => setMobile(true)} aria-label="Open navigation"><Menu/></button>
        <div className="top-org"><Globe2 size={14}/> {org.name} <span className="role-badge">{meta.compact}</span><span className="pill success">{membership?.role || 'owner'}</span></div>
        <div className="top-actions">
          {onStartPresenter && !presenterActive && <button className="presenter-toggle" onClick={onStartPresenter} title="Start presenter mode (5-min judge narration)"><Mic size={14}/> Presenter</button>}
          {presenterActive && <button className="presenter-toggle active" onClick={onStopPresenter} title="Exit presenter mode"><Mic size={14}/> Presenter</button>}
          <button className="icon-button help-button" onClick={() => onOpenHelp?.()} aria-label="Help center" title="Help center"><CircleHelp size={18}/></button>
          <span className="ps-chip">{BRAND.ps}</span>
        </div>
      </header>
      <div className="content">{children}</div>
    </div>
  </div>;
}

/* ---------------- Router / App ---------------- */
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('IP-SAKTI UI error:', error, info); }
  render() {
    if (this.state.error) {
      return <main style={{ padding: 40, fontFamily: 'system-ui' }}>
        <h2 style={{ color: '#b02a2a' }}>Something went wrong</h2>
        <p style={{ color: '#45524a' }}>{String(this.state.error?.message || this.state.error)}</p>
        <pre style={{ background: '#f4f4f4', padding: 12, fontSize: 12, overflow: 'auto' }}>{this.state.error?.stack || ''}</pre>
        <button onClick={() => { localStorage.removeItem('ipsk.selectedCase'); location.hash = ''; location.reload(); }} style={{ padding: '10px 18px', cursor: 'pointer' }}>Reset & reload</button>
      </main>;
    }
    return this.props.children;
  }
}

function App() {
  const route = useHashRoute();
  // Private routes: everything under #/app/* AND direct case links (#/case/<id>)
  const isCaseRoute = /^case\/.+/.test(route);
  const isPublic = !(route.startsWith('app') || isCaseRoute);
  const [accessToken, setAccessToken] = useState(''), [user, setUser] = useState(null), [org, setOrg] = useState(null), [membership, setMembership] = useState(null), [booting, setBooting] = useState(true), [bootMode, setBootMode] = useState('restoring'), [bootError, setBootError] = useState('');
  const api = useMemo(() => new Api(accessToken, setAccessToken), [accessToken]);
  const page = route.split('/')[1] || 'Dashboard';

  // Case deep-link: #/case/<id>
  let viewCaseId = null;
  if (isCaseRoute) viewCaseId = route.split('/')[1];
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const openCase = id => { setSelectedCaseId(id); location.hash = `#/case/${id}`; };
  const closeCase = () => { setSelectedCaseId(null); location.hash = '#/app/Dashboard'; };
  useEffect(() => { if (isCaseRoute && route.split('/')[1] !== selectedCaseId) setSelectedCaseId(route.split('/')[1]); }, [route]);

  async function loadSession(token = accessToken) {
    const local = new Api(token, setAccessToken);
    const me = await local.request('/api/auth/me'); setUser(me.user);
    const memberships = await local.request('/api/organizations');
    let savedOrg = '';
    try { savedOrg = localStorage.getItem('ipsk.organizationId') || ''; } catch { /* private mode */ }
    const selectedMembership = memberships.find(m => String(typeof m.organizationId === 'object' ? m.organizationId._id : m.organizationId) === savedOrg) || memberships[0];
    if (selectedMembership) {
      const selected = selectedMembership.organizationId;
      setMembership(selectedMembership);
      setOrg(typeof selected === 'object' ? selected : { _id: selected, name: 'Workspace' });
    }
  }
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`${API}/api/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: '{}'
        });
        if (!response.ok) return;
        const session = await response.json(); if (cancelled) return;
        setAccessToken(session.accessToken); setUser(session.user);
        await loadSession(session.accessToken);
      } catch (error) { if (!cancelled) setBootError(error.message || 'Unable to reach the server'); }
      finally { if (!cancelled) setBooting(false); }
    })();
    return () => { cancelled = true; };
  }, []);
  const pageTitle = isCaseRoute ? 'Case Workspace' : page;
  useEffect(() => { document.title = `${pageTitle !== 'Dashboard' ? pageTitle[0].toUpperCase() + pageTitle.slice(1) + ' · ' : ''}IP-SAKTI Sahayak · SIH 26045`; }, [pageTitle]);
  // Signed-in users land on the app, never on the public marketing pages
  useEffect(() => {
    if (!booting && user && org && !location.hash.startsWith('#/app') && !location.hash.startsWith('#/case')) location.hash = '#/app/Dashboard';
  }, [booting, user, org]);

  // First-time guided tour: shown once, skippable, replayable from Help.
  const [tour, setTour] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  useEffect(() => {
    if (booting || !user || !org) return;
    if (!hasCompletedTour() && !isCaseRoute) {
      const t = setTimeout(() => setTour(true), 600);
      return () => clearTimeout(t);
    }
  }, [booting, user, org]);
  function replayTour() { setHelpOpen(false); setTour(true); }
  const setPage = p => { location.hash = `#/app/${p}`; setSelectedCaseId(null); };
  const allowedPages = new Set(roleNavigation(user?.accountRole).flatMap(([, items]) => items.map(([label]) => label)));
  useEffect(() => {
    if (!booting && user && org && route.startsWith('app/') && !allowedPages.has(page)) setPage('Dashboard');
  }, [booting, user, org, route, page, allowedPages.size]);

  // Presenter mode: 7-scene narration overlay for the SIH judge demo.
  const presenter = usePresenter();
  async function presenterLoadDemo() {
    try { const demo = await api.request(`/api/organizations/${org._id}/sahayak/demo`, { method: 'POST' }); setSelectedCaseId(demo._id); location.hash = `#/case/${demo._id}`; } catch { /* show error inside the overlay */ }
  }

  async function startSession(session) { setBootMode('starting'); setBooting(true); try { setAccessToken(session.accessToken); setUser(session.user); await loadSession(session.accessToken); location.hash = '#/app/Dashboard'; } catch (e) { setBootError(e.message); } finally { setBooting(false); } }

  if (booting && isPublic) return <LoadingWorkspace mode={bootMode}/>;
  if (isPublic && route.startsWith('how')) return <HowItWorks onBack={() => { location.hash = ''; }} />;
  if (isPublic) return <Landing onAuth={() => { location.hash = '#/app/Dashboard'; location.reload(); }} />;

  if (booting) return <LoadingWorkspace mode={bootMode}/>;
  if (bootError && !user) return <main className="setup"><div className="setup-card"><AlertTriangle/><p className="eyebrow">CONNECTION ISSUE</p><h1>We couldn't load IP-SAKTI Sahayak.</h1><p className="muted">{bootError}</p><button className="primary ipsk-btn" onClick={() => location.reload()}><RefreshCw/> Try again</button></div></main>;
  if (!user) return <Auth onSession={startSession}/>;
  if (!org) return <Setup api={api} onReady={created => { localStorage.setItem('ipsk.organizationId', String(created._id)); setMembership({ role: 'owner' }); setOrg(created); }} />;

  let content;
  if (viewCaseId || selectedCaseId) content = <CaseWorkspaceView api={api} org={org} caseId={viewCaseId || selectedCaseId} onBack={closeCase}/>;
  else switch (page) {
    case 'Review Queue': content = <RoleWorkspacePage api={api} org={org} user={user} onOpenCase={openCase} view="review"/>; break;
    case 'Oversight': content = <RoleWorkspacePage api={api} org={org} user={user} onOpenCase={openCase} view="oversight"/>; break;
    case 'Case Registry': content = <SahayakPage api={api} org={org} onOpenCase={openCase}/>; break;
    case 'Platform Operations': content = <RoleWorkspacePage api={api} org={org} user={user} onOpenCase={openCase} view="operations"/>; break;
    case 'New Case': content = <NewCasePage api={api} org={org} onOpenCase={openCase}/>; break;
    case 'My Cases': content = <SahayakPage api={api} org={org} onOpenCase={openCase}/>; break;
    case 'Product Classification': content = <ClassificationPage api={api} org={org} onNewCase={() => setPage('New Case')} onOpenCase={openCase}/>; break;
    case 'IP Assessment': content = <IpAssessmentPage api={api} org={org}/>; break;
    case 'Regulatory Assessment': content = <RegulatoryAssessmentPage api={api} org={org}/>; break;
    case 'Evidence & Sources': content = <EvidencePage api={api} org={org}/>; break;
    case 'Activity / Timeline': content = <ActivityPage api={api} org={org}/>; break;
    case 'Legal Sources': content = <LegalSourcesPage api={api}/>; break;
    case 'Evaluation': content = <EvaluationPage api={api} org={org}/>; break;
    case 'System': content = <DevPanelPage api={api}/>; break;
    case 'Settings': content = <SettingsPage api={api} org={org} user={user} membership={membership} onOrgUpdated={setOrg}/>; break;
    default: content = user.accountRole && user.accountRole !== 'applicant'
      ? <RoleWorkspacePage api={api} org={org} user={user} onOpenCase={openCase}/>
      : <DashboardHome api={api} org={org} user={user} membership={membership} onOpenCase={openCase} onNewCase={() => setPage('New Case')}/>;
  }

  return <>
    <a href="#main-content" className="skip-link">Skip to main content</a>
    <Shell api={api} user={user} org={org} membership={membership} page={viewCaseId || selectedCaseId ? 'My Cases' : page} setPage={setPage} onOpenHelp={() => setHelpOpen(true)} onStartPresenter={() => presenter.start()} onStopPresenter={() => presenter.stop()} presenterActive={presenter.active}>
      <main id="main-content" tabIndex={-1}>
        {content}
      </main>
      {tour && <GuidedTour page={page} onNavigate={setPage} onFinish={() => setTour(false)}/>}
      {helpOpen && <HelpCenter onClose={() => setHelpOpen(false)} onReplayTour={replayTour}/>}
      {presenter.active && <PresenterOverlay
        sceneIndex={presenter.sceneIndex}
        scene={PRESENTER_SCENES[presenter.sceneIndex]}
        total={PRESENTER_SCENES.length}
        onNext={presenter.next}
        onBack={presenter.back}
        onJump={presenter.jump}
        onClose={presenter.stop}
        paused={presenter.paused}
        onTogglePause={() => presenter.setPaused(p => !p)}
        onLoadDemo={presenterLoadDemo}
      />}
    </Shell>
  </>;
}

createRoot(document.getElementById('root')).render(<ErrorBoundary><App/></ErrorBoundary>);
