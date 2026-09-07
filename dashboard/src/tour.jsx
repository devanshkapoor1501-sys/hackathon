import React, { useEffect, useState } from 'react';
import { ChevronRight, ChevronLeft, X, Check, CircleHelp, Sparkles } from 'lucide-react';

const TOUR_KEY = 'ipsk.tourCompleted';
const TOUR_STEPS = [
  {
    title: 'Welcome to IP-SAKTI Sahayak',
    body: 'An India-focused decision-support system for Ayurvedic IP and regulatory pathways. We will walk through the core flow in under a minute.',
    target: null
  },
  { title: 'Create a case', body: 'Every product assessment is a case. You can return to it later, edit it, and the system keeps an audit trail.', target: 'New Case' },
  { title: 'Describe your product', body: 'You do not need legal terminology. Tell us what you have developed in plain English or Hindi — the system extracts structured facts.', target: null },
  { title: 'Classification', body: 'IP-SAKTI determines what type of product yours is (proprietary ASU medicine, Ayurveda Aahara, cosmetic, etc.) BEFORE answering regulatory questions.', target: 'Product Classification' },
  { title: 'Evidence', body: 'Every material conclusion is linked to an authoritative Indian source. If we cannot verify a claim, we mark it UNSUPPORTED rather than invent it.', target: 'Evidence & Sources' },
  { title: 'Action plan', body: 'Concrete next steps — each with a reason and a priority. Mark steps as in-progress or completed as you work through them.', target: null },
  { title: 'You are ready', body: 'Start by creating your first case — or load the SIH demo to see the full flow with the Neem-Turmeric tablet scenario.', target: null }
];

export function hasCompletedTour() {
  try { return localStorage.getItem(TOUR_KEY) === '1'; } catch { return false; }
}
export function markTourCompleted() {
  try { localStorage.setItem(TOUR_KEY, '1'); } catch { /* private mode */ }
}
export function resetTour() {
  try { localStorage.removeItem(TOUR_KEY); } catch { /* private mode */ }
}

export function GuidedTour({ page, onNavigate, onFinish }) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(true);
  const current = TOUR_STEPS[step];
  const total = TOUR_STEPS.length;

  useEffect(() => {
    if (current?.target && current.target !== page) onNavigate?.(current.target);
  }, [step]);

  function next() { if (step < total - 1) setStep(step + 1); else finish(true); }
  function back() { if (step > 0) setStep(step - 1); }
  function finish(complete) { setVisible(false); markTourCompleted(); onFinish?.(complete); }

  if (!visible) return null;
  return <div className="tour-overlay" role="dialog" aria-modal="true" aria-label="Product tour">
    <div className="tour-backdrop" onClick={() => finish(false)} />
    <div className="tour-card">
      <button className="tour-close" onClick={() => finish(false)} aria-label="Close tour"><X size={16}/></button>
      <div className="tour-progress">
        {TOUR_STEPS.map((_, i) => <span key={i} className={i === step ? 'active' : i < step ? 'done' : ''}/>)}
      </div>
      <p className="eyebrow">STEP {step + 1} OF {total}</p>
      <h2>{current.title}</h2>
      <p>{current.body}</p>
      {current.target && <p className="tour-hint">We have navigated you to the <strong>{current.target}</strong> screen.</p>}
      <div className="tour-actions">
        <button className="secondary" onClick={() => finish(false)}>Skip tour</button>
        <div className="tour-nav">
          <button className="secondary" onClick={back} disabled={step === 0}><ChevronLeft size={14}/> Back</button>
          <button className="primary ipsk-btn" onClick={next}>
            {step === total - 1 ? <><Check size={14}/> Get started</> : <>Next <ChevronRight size={14}/></>}
          </button>
        </div>
      </div>
    </div>
  </div>;
}

const HELP_ENTRIES = [
  { q: 'What is IP-SAKTI?', a: 'An India-focused AI decision-support prototype for Ayurvedic IP and regulatory pathways (SIH 26045). It classifies products, maps applicable Indian regimes, retrieves authoritative evidence, and produces a next-action plan.' },
  { q: 'What is a case?', a: 'A case stores the description of one product plus every assessment IP-SAKTI has produced for it. You can return to a case, edit it, and rerun the assessment — the system keeps the history.' },
  { q: 'How is classification determined?', a: 'A deterministic engine evaluates your product facts (intended use, claims, dosage form, ingredients, classical text status) and decides a category. The LLM does not decide classification — it only explains the result.' },
  { q: 'What is confidence?', a: 'Confidence reflects how many critical facts are resolved and how strong the source coverage is. It is NOT legal certainty. Review the unresolved questions and human-review flags before relying on any conclusion.' },
  { q: 'Why does human review appear?', a: 'When evidence is insufficient, the source is contested, or the legal interpretation requires a professional, IP-SAKTI surfaces it instead of inventing an answer. The recommended professional type is shown.' },
  { q: 'How are sources selected?', a: 'Hybrid retrieval (BM25 + vector + authority ranking + temporal filtering) over an India-only legal corpus. Each citation is verified for source, jurisdiction, status and effective dates before being shown.' },
  { q: 'Does this replace a lawyer?', a: 'No. IP-SAKTI is decision support. It does not file applications, give legal advice, or replace qualified professionals. It tells you what to investigate and what questions to take to them.' },
  { q: 'Do I need LM Studio?', a: 'No. The default hybrid mode tries configured cloud AI first, then optional LM Studio, and finally deterministic mode. Classification, evidence, action plans and reports continue to work without an AI provider.' }
];

export function HelpCenter({ onClose, onReplayTour }) {
  const [open, setOpen] = useState(null);
  return <div className="help-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
    <div className="help-modal" role="dialog" aria-modal="true" aria-label="Help center">
      <button className="modal-close" onClick={onClose} aria-label="Close"><X/></button>
      <p className="eyebrow">HELP CENTER</p>
      <h2><CircleHelp size={20} style={{ verticalAlign: 'middle', marginRight: 8 }}/>How IP-SAKTI works</h2>
      <p className="muted">Quick answers to the most common questions. Detailed guidance is available on every screen.</p>
      <div className="help-list">
        {HELP_ENTRIES.map((entry, i) => <details key={i} className="help-item" open={open === i} onToggle={e => e.target.open && setOpen(i)}>
          <summary>{entry.q}</summary>
          <p>{entry.a}</p>
        </details>)}
      </div>
      <div className="help-actions">
        <button className="secondary" onClick={onReplayTour}><Sparkles size={14}/> Restart product tour</button>
        <button className="primary ipsk-btn" onClick={onClose}>Close</button>
      </div>
    </div>
  </div>;
}
