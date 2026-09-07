# IP-SAKTI Sahayak — SIH 26045

**AI-powered IP and regulatory decision support for Ayurveda.**

Jurisdiction-aware prototype built for Smart India Hackathon Problem Statement **SIH 26045**: users describe an Ayurvedic product or innovation, choose India or International, and receive a classification-first, source-cited route map with confidence and human-review escalation. Indian and international answer sets are filtered and displayed separately.

> Decision support only — not legal advice, not a government approval authority.
> India is the default lens. International mode provides separately cited treaty, filing-system and export-market pointers; it does not import Indian authorities into an international answer.

---

## Quick start

Prerequisites: Node.js 22 or newer and MongoDB. Docker Desktop is the easiest way to run the required local MongoDB replica set. Gemini, NVIDIA and LM Studio are supported through the backend provider abstraction.

```bash
npm install
npm --prefix dashboard install

# 1. Configure the backend
# Windows PowerShell:
Copy-Item .env.example .env
# macOS/Linux:
# cp .env.example .env
# The copied defaults use hybrid mode with no AI credentials, so the app
# starts in deterministic mode until you configure a provider.

# 2. Start the required local MongoDB (skip this if using MongoDB Atlas)
docker compose up -d

# 3. Seed the Indian legal corpus once
npm run seed:legal

# 4. Run the backend in one terminal
npm run dev                   # http://localhost:3000

# 5. Run the dashboard in a second terminal
npm run dashboard:dev         # http://localhost:5173
```

For MongoDB Atlas, omit `docker compose up -d`, set `MONGODB_URI` in `.env`, and make sure your client IP is allowed in MongoDB Cloud → Network Access. MongoDB is required for stored cases and the legal corpus; AI providers are optional.

### Optional AI providers

The browser never receives an AI key. With the default `LLM_PROVIDER=hybrid`, the app tries NVIDIA cloud AI, then LM Studio, and finally deterministic mode. For the configured Gemini setup, `LLM_PROVIDER=gemini` uses `gemini-3.6-flash` directly. Classification, regime mapping, citation verification, action plans and PDF reports remain available if any AI provider is unavailable.

To use Gemini as the active model, set the following in `.env` and restart the backend:

```
LLM_PROVIDER=gemini
GEMINI_API_KEY=your-google-ai-studio-key
GEMINI_CHAT_MODEL=gemini-3.6-flash
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
GEMINI_REASONING_EFFORT=low
```

Google documents this OpenAI-compatible endpoint and the `gemini-3.6-flash` model ID in its [Gemini API documentation](https://ai.google.dev/gemini-api/docs/openai).

To enable the cloud leg, set the following in `.env` and restart the backend:

```
LLM_PROVIDER=hybrid
NVIDIA_API_KEY=nvapi-your-key
```

To use LM Studio as the optional local fallback:

1. Load a chat model (e.g., `google/gemma-4-e2b`) → Developer tab → **Start Server** (port 1234).
2. In `.env`:
   ```
   LLM_PROVIDER=lmstudio
   LMSTUDIO_BASE_URL=http://localhost:1234/v1
   LMSTUDIO_MODEL=google/gemma-4-e2b
   EMBEDDING_MODEL=            # empty → lexical retrieval only (fully functional)
   ```
3. Verify: `curl http://localhost:3000/health/llm` and inspect `activeProvider` and `providerAttempts`.

The explicit modes are also preserved: `LLM_PROVIDER=cloud` uses only NVIDIA, `LLM_PROVIDER=lmstudio` uses only LM Studio, and `LLM_PROVIDER=none` disables AI completely. The browser never talks directly to either AI endpoint; requests always go through this backend.

### Cloud database note

The app works with a local MongoDB (`docker compose up -d`) or Atlas. Atlas Vector Search is optional — without it, retrieval uses the built-in BM25 lexical path automatically.

---

## The product flow

```
Landing page → Start Assessment → Create case (natural language ± structured fields)
→ AI fact extraction → targeted clarifying questions (option chips, "Question 2 of 4")
→ Product classification (deterministic engine) → Applicable Indian regimes
→ Hybrid retrieval over authoritative sources → citation verification
→ Risks + derived confidence → Action plan (each step explains WHY)
→ Human review escalation → Export PDF report
```

Screens: Dashboard · New Case · My Cases · Case Workspace · Product Classification · IP Assessment · Regulatory Assessment · Evidence & Sources · Activity/Timeline · Settings · Legal Sources · Evaluation · System.

The **IP-SAKTI Assistant** (in-case chat) answers follow-up questions strictly from the current case's verified information; offline it replies deterministically without fabricating anything.

---

## Testing

```bash
npm test                              # backend/engine tests (no servers needed)

cd dashboard && npx vitest run src/smoke.test.jsx   # UI render smoke tests
npm run dashboard:build                # production dashboard build
```

Manual demo (~5 min): open the site → choose a role demo account on sign-in (credentials: [`docs/DEMO-ACCOUNTS.md`](docs/DEMO-ACCOUNTS.md)) → role-specific dashboard → open the seeded case queue → inspect Classification → IP → Regulatory → Evidence → Action plan → Human review. Applicant accounts can also create a new case and use **Load demo case** (neem-turmeric scenario).

Useful checks:
- `GET /health/llm` — provider/model/connectivity
- **System** page — corpus counts, retrieval p50/p95 latency, per-regime/level/freshness breakdown, ingestion panel
- **Evaluation** page — persistent benchmark suite (31 cases / 11 dimensions) with latency tracking

A 1-page **judge brief** for SIH evaluators is at [`docs/JUDGE-BRIEF.md`](docs/JUDGE-BRIEF.md).

## Demo features for SIH judges

| Feature | Where | What it shows |
|---|---|---|
| **Presenter mode** | Top-bar `Mic` button | 7-scene narration overlay, auto-advances every ~22s, jump-to-scene, pause/resume. Designed for a 5-minute judge walkthrough. |
| **First-time tour** | Auto-shown on first sign-in | 7-step product tour; skippable, persisted, replayable from Settings. |
| **Help center** | Top-bar `?` button | 8 Q&A entries + "Restart product tour". |
| **Editable facts** | Case workspace → Product profile → Edit details | Edit 8 critical fields; "may need recalculation" warning when assessment is stale. |
| **Knowledge graph** | Case workspace (assessed case) | Visualises Product → Ingredients → Classification → Regimes → Evidence. |
| **Streaming assistant** | Case workspace → IP-SAKTI Assistant | SSE-streamed answers, fallback to JSON if SSE unavailable. |
| **Branded PDF report** | Case workspace → Export report | Green brand header on every page, cover scorecard (classification + risk + regimes), footer with page numbers, SIH 26045 watermark. |
| **Corpus health** | System page | Per-regime + per-authority-level + freshness histograms + retrieval p50/p95. |
| **DEMO banner** | Demo cases | Yellow banner clarifies all demo data is simulated. |
| **Restraint animations** | Every page | Restrained page-transitions, classification "reveal", staggered evidence items; honours `prefers-reduced-motion`. |
| **Recovery hints** | Every error | `RecoveryHint` component shows `userMessage` + `retryable` + `recoveryHint` + `requestId`. Retry / Load demo / System status actions. |
| **LLM offline banner** | Case workspace | Persistent banner when LLM is offline or model-mismatched. "Deterministic mode active — nothing fabricated." |
| **Skip link + focus ring** | Every page | `<a href="#main-content" className="skip-link">`, visible `:focus-visible` outline, `aria-live` regions. |
| **"Why this matters" pill** | Clarifying questions | Each question has a tooltip + visible "Why this matters" pill showing the reason. |
| **Top-evidence pin** | Evidence page | Strongest verified claim pinned first with a `Top evidence` badge. |
| **Lazy KnowledgeGraph** | Case workspace | SVG graph loaded as a separate 1.6 KB gzipped chunk. |
| **Request IDs** | Every API response | `x-request-id` header on every response, echoed in logs and error bodies. |
| **Per-route rate limits** | Auth (15/min) + Sahayak (30/min) | Brute-force protection on the right surfaces. |

## Judge demo (5-minute script)

1. **Landing** → "Start Assessment" (1 min)
2. **Presenter mode** → click `Mic` button (auto-narrates 7 scenes) (4 min)
3. **Walk the rest manually** if questions arise

## Documentation

| File | What's in it |
|---|---|
| `docs/JUDGE-BRIEF.md` | 1-page SIH 26045 pitch for evaluators. |
| `docs/OPERATIONS.md` | Runbook for the maintainer / on-call (LLM offline, Mongo down, corpus empty, rate limit, etc.). |
| `docs/SOURCE-PROVENANCE.md` | Every corpus source mapped to its authority, URL, level and status. |

---

## Architecture

| Layer | Location |
|---|---|
| Backend API | `src/routes`, Fastify 5 |
| Case & assessment services | `src/services/case.service.js`, `intake.service.js` |
| Deterministic engines | `src/rules` (classification, regimes, ABS, TK/s.3(p), questions) |
| Retrieval | `src/retrieval/legal-retrieval.service.js` (BM25 ⊕ vector ⊕ authority ⊕ temporal) |
| Evidence verification | `src/evidence/citation-verifier.js`, `timeline.js` |
| LLM abstraction | `src/ai` (hybrid cloud-first | cloud | lmstudio | none; structured output w/ safe fallback) |
| Indian legal corpus | `scripts/seed-legal-corpus.js` (+ admin ingestion via System page) |
| Evaluation harness | `src/evaluation` |
| Frontend | `dashboard/src` (React + Vite: `main.jsx` shell, `sahayak.jsx` workspace, `modules.jsx` pages) |

Key guarantees: the LLM never decides legal conclusions; every material claim is citation-verified or marked UNSUPPORTED; DRAFT/HISTORICAL sources are never treated as current law; prompt-injection text in documents is quarantined as data; confidence is derived, never invented.

---

## Legacy module (retained underneath, not part of the SIH product)

This repository originally contained a multi-tenant AI customer-support MVP ("Aiden"). Auth, organizations and the ingestion queue are shared infrastructure and still work, but none of its pages, branding or flows appear in the IP-SAKTI product. 
