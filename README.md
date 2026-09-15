# IP-SAKTI Sahayak — SIH 26045

**AI-powered IP and regulatory decision support for Ayurveda.**

Jurisdiction-aware prototype built for Smart India Hackathon Problem Statement **SIH 26045**: users describe an Ayurvedic product or innovation, choose India or International, and receive a classification-first, source-cited route map with confidence and human-review escalation. Indian and international answer sets are filtered and displayed separately.

> Decision support only — not legal advice, not a government approval authority.
> India is the default lens. International mode provides separately cited treaty, filing-system and export-market pointers; it does not import Indian authorities into an international answer.

---

## Run locally

### Prerequisites

- Node.js 22 or newer and npm.
- Docker Desktop with Docker Compose, or a MongoDB replica-set connection. The local Compose file is the easiest option.
- Git.
- AI credentials are optional. The application works in deterministic/offline mode when no provider is configured.

### 1. Clone and install dependencies

```powershell
git clone https://github.com/Tarundeep1357/IP-Sakati-Sahayak.git
cd IP-Sakati-Sahayak
npm ci
npm --prefix dashboard ci
```

If you already have this repository, update it instead:

```powershell
git pull
npm ci
npm --prefix dashboard ci
```

### 2. Configure the backend

Create a local environment file:

```powershell
Copy-Item .env.example .env
```

For a local deterministic run, use these values in `.env`:

```dotenv
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/ip_sakti_sahayak?directConnection=true
LLM_PROVIDER=none
```

Keep secrets only in `.env`; never commit that file. For a production deployment, replace the placeholder JWT, cookie, and encryption secrets with fresh values.

`LLM_PROVIDER=none` intentionally keeps this local setup fully offline. In that mode the dashboard may show **LLM: Offline** and the assessment uses deterministic, non-fabricated output.

### 3. Start MongoDB

In the repository root:

```powershell
docker compose up -d
```

The Compose setup starts MongoDB and initializes its replica set. If MongoDB is already running locally, skip this command and point `MONGODB_URI` at the existing instance. MongoDB Atlas can also be used by replacing `MONGODB_URI` with the Atlas connection string.

Seed the jurisdiction-tagged legal corpus once after MongoDB is available:

```powershell
npm run seed:legal
```

### 4. Start the application

Use two terminals from the repository root.

Terminal 1 — backend API:

```powershell
npm run dev
```

Terminal 2 — React/Vite dashboard:

```powershell
npm run dashboard:dev
```

Open [http://localhost:5173](http://localhost:5173). The API runs at [http://localhost:3000](http://localhost:3000).

Useful health checks:

```powershell
Invoke-WebRequest http://localhost:3000/ready
Invoke-RestMethod http://localhost:3000/health/llm
```

### Optional AI providers

AI is opt-in and the browser never receives provider credentials. The hybrid chain is:

`NVIDIA → Gemini → LM Studio → deterministic mode`

Enable the backup chain with:

```dotenv
LLM_PROVIDER=hybrid
NVIDIA_API_KEY=your-nvidia-key
GEMINI_API_KEY=your-google-ai-studio-key
```

The provider order is `NVIDIA → Gemini → LM Studio → deterministic mode`. Gemini is attempted only when `GEMINI_API_KEY` is present; the application does not make a Gemini request when the key is empty. If NVIDIA is unavailable and Gemini is configured, Gemini is the backup provider.

To use Gemini directly instead of the hybrid chain:

```dotenv
LLM_PROVIDER=gemini
GEMINI_API_KEY=your-google-ai-studio-key
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
GEMINI_CHAT_MODEL=gemini-3.6-flash
GEMINI_REASONING_EFFORT=low
```

Get the key from [Google AI Studio](https://aistudio.google.com/app/apikey). Store it only in `.env`, restart the backend after changing it, and never paste it into source files or commit it.

For LM Studio, start its local OpenAI-compatible server and set:

```dotenv
LLM_PROVIDER=lmstudio
LMSTUDIO_BASE_URL=http://localhost:1234/v1
LMSTUDIO_MODEL=your-local-chat-model
```

After changing `.env`, restart the backend and inspect `/health/llm` for `providerAttempts`, `activeProvider`, and the current offline/fallback status:

```powershell
$llm = Invoke-RestMethod http://localhost:3000/health/llm
$llm | Select-Object provider,status,connectivity,activeProvider,reason
$llm.providerAttempts | Select-Object provider,status,connected,reason
```

Expected behavior:

- `provider=hybrid` with a valid Gemini key: Gemini appears as a configured provider and can be selected after an NVIDIA failure.
- `CONFIG_MISSING` for Gemini: `GEMINI_API_KEY` is absent or empty; add it to `.env` and restart the backend.
- `NO_PROVIDER_CONFIGURED` or `OFFLINE`: no configured provider is reachable, so deterministic mode remains active safely.
- `LLM_PROVIDER=none`: fully offline mode is intentional and all AI providers are disabled.

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

## Assessment and reporting features

- **Decision snapshot:** plain-language classification, confidence meaning, evidence completeness, missing facts, and the conditions that could change the result.
- **Start here:** prioritized next steps with action-oriented wording and human-review boundaries.
- **Plain-language summary:** optional English or Hindi summary generated on demand, with safe deterministic fallback and copy-to-clipboard support.
- **Decision brief PDF:** branded cover, executive decision, facts, implications, next steps, risks, unresolved information, international plan, evidence appendix, page numbers, and non-legal-advice disclaimer.
- **International target-market planner:** EU, United States, UAE, and custom-country checklist routes. These are verification checklists, not market-entry approval conclusions.
- **Provider fallback status:** the UI and `/health/llm` show whether the active result came from the configured provider, a fallback provider, or deterministic mode.

International routes link to official starting points, including [European Commission herbal medicinal products](https://health.ec.europa.eu/medicinal-products/herbal-medicinal-products_en), [FDA botanical products](https://www.fda.gov/about-fda/center-drug-evaluation-and-research-cder/what-botanical-drug), and [UAE MoHAP natural-source product registration](https://mohap.gov.ae/documents/20117/0/Registration%2Bof%2BA%2BPharmaceutical%2BProduct%2BDerived%2Bfrom%2BNatural%2BSources%2B_%2BMinistry%2Bof%2BHealth%2Band%2BPrevention%2B-%2BUAE.pdf/99e94fbe-6f1d-90e2-e6d1-9eef24d48f87).

## Testing and production build

Run the full test suite serially on Windows if your machine has limited memory:

```powershell
npm test -- --run --maxWorkers=1
npm run dashboard:build
```

The test suite includes backend, deterministic assessment, AI fallback, summary, international planner, PDF, and dashboard smoke coverage. The production dashboard bundle is generated under `dashboard/dist`.

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
| LLM abstraction | `src/ai` (NVIDIA → Gemini → LM Studio → deterministic fallback; structured output with safe fallback) |
| Indian legal corpus | `scripts/seed-legal-corpus.js` (+ admin ingestion via System page) |
| Evaluation harness | `src/evaluation` |
| Frontend | `dashboard/src` (React + Vite: `main.jsx` shell, `sahayak.jsx` workspace, `modules.jsx` pages) |

Key guarantees: the LLM never decides legal conclusions; every material claim is citation-verified or marked UNSUPPORTED; DRAFT/HISTORICAL sources are never treated as current law; prompt-injection text in documents is quarantined as data; confidence is derived, never invented.

---

## Legacy module (retained underneath, not part of the SIH product)

This repository originally contained a multi-tenant AI customer-support MVP ("Aiden"). Auth, organizations and the ingestion queue are shared infrastructure and still work, but none of its pages, branding or flows appear in the IP-SAKTI product. 
