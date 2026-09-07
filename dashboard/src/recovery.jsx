import React from 'react';
import { AlertTriangle, ChevronRight, CircleHelp, RefreshCw, Sparkles } from 'lucide-react';

/**
 * RecoveryHint — replaces raw `alert` blocks with actionable next-step guidance.
 * Works for any error with the structured contract from src/app.js:
 *   { code, userMessage, retryable, recoveryHint, requestId }
 * Or with a plain Error (string message).
 */
export function RecoveryHint({ error, onRetry, onLoadDemo, onDismiss, onOpenSystem, compact = false }) {
  if (!error) return null;
  const e = normalizeError(error);

  return <div className={`recovery-hint ${e.tone}`} role="alert" aria-live="polite">
    <div className="recovery-icon"><AlertTriangle size={compact ? 14 : 16}/></div>
    <div className="recovery-body">
      <strong className="recovery-title">{e.title}</strong>
      <p className="recovery-message">{e.userMessage}</p>
      {e.recoveryHint && <p className="recovery-hint-text">{e.recoveryHint}</p>}
      {e.requestId && <p className="recovery-request-id">Request ID: <code>{e.requestId}</code></p>}
    </div>
    <div className="recovery-actions">
      {e.retryable && onRetry && <button className="primary ipsk-btn" onClick={onRetry}><RefreshCw size={13}/> Retry</button>}
      {onLoadDemo && <button className="secondary" onClick={onLoadDemo}><Sparkles size={13}/> Load demo</button>}
      {onOpenSystem && <button className="secondary" onClick={onOpenSystem}><CircleHelp size={13}/> System status</button>}
      {onDismiss && <button className="secondary subtle" onClick={onDismiss}>Dismiss</button>}
    </div>
  </div>;
}

/**
 * InlineLlmBanner — shows a persistent banner at the top of the case workspace
 * when the LLM is offline or in a degraded state, explaining what the user will
 * and won't get.
 */
export function InlineLlmBanner({ phase, info, compact = false }) {
  if (phase === 'checking' || phase === 'online') return null;
  const offline = phase === 'offline';
  const warn = phase === 'warn';
  if (!offline && !warn) return null;
  return <div className={`llm-banner ${offline ? 'off' : 'warn'}`} role="status" aria-live="polite">
    <div className="llm-banner-icon">{offline ? '⏻' : '⚠'}</div>
    <div className="llm-banner-body">
      <strong>{offline ? 'Deterministic mode active' : 'LLM connection issue'}</strong>
      <p>
        {offline
          ? <>No LLM is connected. The classification, regime mapping, action plan and citation verification are still fully produced from the deterministic engines. Explanations and the in-case assistant fall back to template output. <strong>Nothing is fabricated.</strong></>
          : <>The LLM is reachable but the model is not loaded or has a mismatch. {info?.reason || 'Check the System page for the active model.'} Conclusions are still verified against authoritative sources.</>}
      </p>
    </div>
  </div>;
}

function normalizeError(raw) {
  if (!raw) return { title: 'Something went wrong', userMessage: 'Please try again.', retryable: true, tone: 'warn' };
  // Structured AppError-shaped payload from the backend
  if (typeof raw === 'object' && raw.code) {
    const tone = raw.retryable ? 'warn' : 'info';
    return {
      title: titleForCode(raw.code, raw.message),
      userMessage: raw.userMessage || raw.message || 'Please try again.',
      recoveryHint: raw.recoveryHint,
      requestId: raw.requestId,
      retryable: raw.retryable,
      tone
    };
  }
  // Plain Error
  const message = raw.message || String(raw);
  const title = titleForCode('GENERIC', message);
  const retryable = /network|timeout|fetch|unavailable|offline|connection/i.test(message);
  return { title, userMessage: message, retryable, tone: retryable ? 'warn' : 'info' };
}

function titleForCode(code, fallback) {
  const map = {
    VALIDATION_ERROR: 'Check the form',
    RATE_LIMITED: 'Too many requests',
    UNAUTHORIZED: 'Please sign in again',
    FORBIDDEN: 'Access denied',
    NOT_FOUND: 'Not found',
    LLM_OFFLINE: 'AI is offline',
    RETRIEVAL_EMPTY: 'No matching sources',
    INTERNAL_ERROR: 'Something went wrong',
    GENERIC: 'Something went wrong'
  };
  return map[code] || fallback || 'Something went wrong';
}

export function EmptyRecovery({ icon, title, description, primary, secondary, onPrimary, onSecondary }) {
  return <div className="recovery-empty">
    {icon && <div className="recovery-empty-icon">{icon}</div>}
    <h3>{title}</h3>
    {description && <p className="muted">{description}</p>}
    <div className="recovery-empty-actions">
      {primary && onPrimary && <button className="primary ipsk-btn" onClick={onPrimary}>{primary} <ChevronRight size={13}/></button>}
      {secondary && onSecondary && <button className="secondary" onClick={onSecondary}>{secondary}</button>}
    </div>
  </div>;
}
