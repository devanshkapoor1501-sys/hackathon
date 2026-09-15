# IP-SAKTI Sahayak — Operations Runbook

A quick reference for the maintainer / on-call when something goes wrong with the SIH 26045 prototype. For the product story, see [`JUDGE-BRIEF.md`](JUDGE-BRIEF.md). For per-source provenance, see [`SOURCE-PROVENANCE.md`](SOURCE-PROVENANCE.md).

## Common failure modes

### 1. LLM is offline / not connected

**Symptom:** sidebar LLM tile shows `OFFLINE` or `WARN`; case workspace shows a yellow **"Deterministic mode active"** banner; assistant answers are templated.

**Diagnose:**
```bash
curl -s http://localhost:3000/health/llm | jq
```
- If `connectivity: "OFFLINE"` and `status: "OFFLINE"` → provider is unreachable.
- If `connectivity: "OFFLINE"` and `status: "NO_MODEL_LOADED"` → a configured local OpenAI-compatible server is up but no requested model is loaded.
- If `connectivity: "OFFLINE"` and `status: "MODEL_MISMATCH"` → the requested trained/Ollama/LM Studio model is not the one currently loaded.

**Fix:**
1. For the default hybrid mode, set `LLM_PROVIDER=hybrid`.
2. For Gemini, set `LLM_PROVIDER=gemini`, `GEMINI_API_KEY=…`, `GEMINI_CHAT_MODEL=gemini-3.6-flash`, and `GEMINI_REASONING_EFFORT=low`.
3. The default local chain is Qwen3-8B (`OLLAMA_MODEL=qwen3:8b`) followed by Qwen3-4B (`OLLAMA_FALLBACK_MODEL=qwen3:4b`). Set `OLLAMA_BASE_URL=http://localhost:11434/v1`; the 8B leg is health-checked and skipped automatically if its exact model id is not loaded. For the trained primary model, set `TRAINED_MODEL_ENABLED=true`, `TRAINED_MODEL_BASE_URL`, `TRAINED_MODEL=<the exact loaded model id>`, and `TRAINED_MODEL_MANIFEST=<path to deployment-manifest.json>`. The manifest must contain `deploymentGate.passed=true`; otherwise the trained provider is intentionally excluded from the chain.
4. For NVIDIA cloud AI, set `NVIDIA_API_KEY=…`. LM Studio remains supported as a legacy local fallback with `LMSTUDIO_BASE_URL=http://localhost:1234/v1` and `LMSTUDIO_MODEL=<the exact model id>`.
5. Restart the backend; the dashboard polls `/health/llm` and reports the active provider and fallback attempts. The application retrieves verified, jurisdiction-scoped evidence before Qwen generates an explanation; model output never replaces citation verification.

**Important:** the system continues to function in deterministic mode. Classification, regime mapping, citation verification and the action plan are all produced by the engines without the LLM; only the narrative explanation falls back to a template.

---

### 2. MongoDB disconnected

**Symptom:** backend fails to start, or every API call returns 500 with `Request failed` and a request ID. Dashboard shows the RecoveryHint with "Something went wrong on our side".

**Diagnose:**
- Look at the backend logs for `MongooseServerSelectionError` or `connection refused`.
- `docker compose ps` (or `mongosh` for Atlas) to verify the DB is reachable.
- If using Atlas, confirm the IP is whitelisted in MongoDB Cloud → Network Access.

**Fix:**
```bash
# local
docker compose up -d mongodb
# or
mongod --replSet rs0
# Atlas
# Update .env MONGODB_URI and confirm IP whitelist
npm run seed:legal   # re-seed if needed
```

---

### 3. Corpus not seeded / empty

**Symptom:** every assessment returns `UNSUPPORTED` for all evidence; Evidence page is empty; System page shows `documents: 0`.

**Diagnose:**
- System page → "Knowledge base" tile shows 0 documents.
- `mongosh ip-sakti --eval "db.legalsources.countDocuments({})"`

**Fix:**
```bash
npm run seed:legal
```
The seed script wipes and re-creates the corpus. Total time ~5–10 s on a local machine.

---

### 4. Rate limit hit (judge demo, multiple refreshes)

**Symptom:** 429 on `/api/auth/*` (15/min) or `/api/sahayak/.../ask*` (30/min).

**Fix:** Wait 60 s. The default limit is generous for a single user; a test loop running too fast will hit it. Increase `max` in `src/app.js` if needed for the demo environment.

---

### 5. LLM is connected but the assessment narrative is templated

**Symptom:** classification is correct, but the narrative reads as a generic template rather than a natural summary.

**Diagnose:** the assessment carries `llmStatus: "CONNECTED"` but `llmUsed: false`. This means LLM synthesis failed at runtime and the system fell back to a deterministic summary — **which is the correct safety behaviour, not a bug**. Check the backend logs for the underlying LLM error (often a token-limit or schema-validation failure).

---

### 6. Vector index drift

**Symptom:** Atlas Vector Search returns 0 results even though corpus has many chunks.

**Fix:**
```bash
# 1. Drop the existing vector index in Atlas
# 2. Re-create it
npm run setup:vector-index
```

If you are not using Atlas Vector Search, leave `EMBEDDING_MODEL=` empty in `.env` — the system falls back to BM25 lexical retrieval and works fully.

---

### 7. Frontend won't load

**Symptom:** blank page or `Cannot read properties of undefined`.

**Diagnose:** open the browser console; the most common cause is `VITE_API_URL` set to the wrong host, or the backend not running. Verify the dev server is on `:5173` and the backend is on `:3000`.

**Fix:**
```bash
# .env or .env.local in the dashboard folder
VITE_API_URL=http://localhost:3000
```

---

## Reset flows

### Full demo reset
```bash
# Wipe cases (keep corpus)
mongosh ip-sakti --eval 'db.caseworkspaces.deleteMany({})'
# Re-seed corpus
npm run seed:legal
# Re-seed the demo organisation (if applicable)
npm run seed
```

### Just re-seed the corpus
```bash
npm run seed:legal
```

### Just refresh one case
```bash
# In the dashboard, open the case → Run assessment again.
# Or: POST /api/organizations/:orgId/sahayak/cases/:id/assess
```

---

## Health probes (copy-paste)

```bash
# LLM
curl -s http://localhost:3000/health/llm | jq '.connectivity, .status, .latencyMs'

# DB
curl -s http://localhost:3000/health/db | jq  # (if exposed)

# Full system panel (counts, retrieval p50/p95, per-regime/level/freshness)
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/sahayak/admin/system | jq

# Evaluation suite (engine-only, no LLM, sub-second)
curl -s -X POST -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/organizations/$ORG/sahayak/evaluation/run | jq '.summary.passRate'
```

---

## Common support queries

> "Why is my assessment showing UNSUPPORTED?"
→ Open the case → Evidence page. Items marked UNSUPPORTED have a verification note explaining why. Most often the source is in a different regime than the active regimes, or the corpus does not yet have a chunk that covers the specific claim. Ingest a new source via the System page if needed.

> "Why did the system say my product is a drug?"
→ Open the case → Product Classification. The rationale lists the facts that triggered the classification. To override, edit the product profile to change the intended use, claims or dosage form.

> "Why isn't the LLM answering?"
→ Check the sidebar LLM tile. If OFFLINE, see failure mode #1. If CONNECTED but answers are templated, see failure mode #5.

> "Can I run this offline?"
→ Yes. Set `LLM_PROVIDER=none` in `.env` and `EMBEDDING_MODEL=` (empty), or leave the default `hybrid` with no keys configured. The system uses deterministic engines + BM25 retrieval. The assistant will use the templated fallback. All other flows (classification, regimes, evidence, action plan, PDF) work fully.

---

## Escalation

For issues that are not covered here:
1. Capture the request ID from the dashboard's RecoveryHint (`Request ID: req_…`).
2. Capture the matching backend log line (it carries the same request ID).
3. Open a ticket with both.
