import React, { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Mic, Pause, Play, X, Sparkles } from 'lucide-react';

/**
 * 7-scene presenter mode for the SIH 26045 demo.
 * Scene 0: Landing
 * Scene 1: New Case (load demo)
 * Scene 2: Clarifying questions
 * Scene 3: Classification result
 * Scene 4: IP + Regulatory assessment
 * Scene 5: Evidence (Why?)
 * Scene 6: Action plan + Human review
 * Persisted via localStorage.ipsk.presenterMode.
 */

export const PRESENTER_SCENES = [
  { id: 'landing', title: 'Landing', hash: '', narration: "IP-SAKTI Sahayak — SIH 26045. An India-focused AI decision-support system for Ayurvedic IP and regulatory pathways. Notice the India-only pill in the corner. The product is a polished web application, not a chatbot." },
  { id: 'newcase', title: 'New Case', hash: '#/app/New%20Case', narration: "Click Start Assessment, then New Case. The system accepts a natural-language description — no legal terminology required. Watch the staged analysis pipeline: Analyzing, Extracting, Classifying, Searching, Verifying, Preparing." },
  { id: 'questions', title: 'Clarifying Questions', hash: '#/app/Dashboard', narration: "After the first pass, the system asks only questions that materially affect the classification — one at a time, with option chips. No form fields, no jargon. The user can skip and the system still makes a safe abstention." },
  { id: 'classification', title: 'Product Classification', hash: '#/app/Product%20Classification', narration: "First decision: what is this product? The deterministic engine classifies it as a Proprietary ASU Medicine Candidate. Confidence is MEDIUM, not a magic percentage. Below: the reasoning, what could change it, and the related regulatory areas." },
  { id: 'assessment', title: 'IP & Regulatory Assessment', hash: '#/app/IP%20Assessment', narration: "Now the regulatory map. Patent, Trademark, Traditional Knowledge, Biodiversity / ABS, Food / Aahara, Labelling — each flagged with its relevance and authority. Section 3(p) is surfaced for the traditional-knowledge concern. We never claim a product is patentable." },
  { id: 'evidence', title: 'Evidence & Sources', hash: '#/app/Evidence%20%26%20Sources', narration: "The judge's favourite screen. Every important conclusion traces to an authoritative Indian source — Act, Section, Status, Effective date. Sources marked DRAFT or HISTORICAL are never treated as current law. Support levels: Directly Supported, Strong Inference, Interpretation Required, Unsupported, Conflicting." },
  { id: 'action', title: 'Action Plan & Human Review', hash: '#/app/Dashboard', narration: "Concrete next steps with priority, reason, and a link to evidence. The system also tells the user when professional review is required and which type of professional to consult. That 'I know when to stop' is the safety story." }
];

const PRESENTER_KEY = 'ipsk.presenterMode';

export function isPresenterOn() {
  try { return localStorage.getItem(PRESENTER_KEY) === '1'; } catch { return false; }
}
export function setPresenter(on) {
  try { localStorage.setItem(PRESENTER_KEY, on ? '1' : '0'); } catch { /* private mode */ }
}

export function PresenterOverlay({ sceneIndex, scene, total, onNext, onBack, onJump, onClose, paused, onTogglePause, onLoadDemo }) {
  if (!scene) return null;
  return <div className="presenter-overlay" role="dialog" aria-label="Presenter mode">
    <div className="presenter-bar">
      <div className="presenter-bar-left">
        <Mic size={14}/> <strong>Presenter Mode</strong>
        <span className="presenter-counter">Scene {sceneIndex + 1} / {total}</span>
      </div>
      <div className="presenter-bar-right">
        <button className="presenter-icon" onClick={onTogglePause} aria-label={paused ? 'Resume narration' : 'Pause narration'}>{paused ? <Play size={14}/> : <Pause size={14}/>}</button>
        <button className="presenter-icon" onClick={onClose} aria-label="Exit presenter mode"><X size={14}/></button>
      </div>
    </div>
    <div className="presenter-card">
      <p className="eyebrow">SCENE {sceneIndex + 1} · {scene.title.toUpperCase()}</p>
      <p className="presenter-narration">{scene.narration}</p>
      {scene.id === 'newcase' && <button className="secondary presenter-demo-btn" onClick={onLoadDemo}><Sparkles size={13}/> Load demo case</button>}
      <div className="presenter-controls">
        <button className="secondary" onClick={onBack} disabled={sceneIndex === 0}><ChevronLeft size={14}/> Back</button>
        <div className="presenter-dots">
          {PRESENTER_SCENES.map((s, i) => <button key={s.id} className={`presenter-dot ${i === sceneIndex ? 'active' : ''} ${i < sceneIndex ? 'done' : ''}`} onClick={() => onJump(i)} aria-label={`Jump to scene ${i + 1}`}/>)}
        </div>
        <button className="primary ipsk-btn" onClick={onNext} disabled={sceneIndex === total - 1}>{sceneIndex === total - 1 ? 'End' : <>Next <ChevronRight size={14}/></>}</button>
      </div>
    </div>
  </div>;
}

export function usePresenter() {
  const [active, setActive] = useState(false);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const start = useCallback(() => {
    setPresenter(true);
    setActive(true);
    setSceneIndex(0);
    setPaused(false);
    location.hash = PRESENTER_SCENES[0].hash;
  }, []);

  const stop = useCallback(() => {
    setPresenter(false);
    setActive(false);
  }, []);

  const next = useCallback(() => {
    setSceneIndex(i => {
      const next = Math.min(i + 1, PRESENTER_SCENES.length - 1);
      location.hash = PRESENTER_SCENES[next].hash;
      return next;
    });
  }, []);

  const back = useCallback(() => {
    setSceneIndex(i => {
      const next = Math.max(i - 1, 0);
      location.hash = PRESENTER_SCENES[next].hash;
      return next;
    });
  }, []);

  const jump = useCallback((i) => {
    setSceneIndex(i);
    location.hash = PRESENTER_SCENES[i].hash;
  }, []);

  // Auto-advance narration every ~22s (only when not paused and a demo case exists by scene 3+).
  useEffect(() => {
    if (!active || paused) return;
    const t = setTimeout(() => {
      if (sceneIndex < PRESENTER_SCENES.length - 1) next();
    }, 22000);
    return () => clearTimeout(t);
  }, [active, paused, sceneIndex, next]);

  return { active, sceneIndex, paused, start, stop, next, back, jump, setPaused };
}
