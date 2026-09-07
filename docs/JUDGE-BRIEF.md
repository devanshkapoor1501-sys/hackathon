# IP-SAKTI Sahayak — Smart India Hackathon 2026 (SIH 26045)

> **One-line pitch.** IP-SAKTI is a jurisdiction-aware decision-support system that turns a plain-language description of an Ayurvedic product into a *citation-verified* India or International IP, regulatory, traditional-knowledge, and biodiversity route map — and a prioritized next-action plan.

---

## The problem (in one paragraph)

An Ayurvedic innovator with a new herbal formulation cannot easily answer "what Indian rules apply to my product?" The information exists — in the Patents Act §3(p), in the Biological Diversity Act, in the ASU drug rules, in FSSAI's Ayurveda Aahara notification, in TKDL — but it is fragmented across statutes, regulators, gazette dates, and classification regimes. A normal user cannot reliably map their product to the right pathway, cannot verify whether a claim is current, and cannot tell when professional review is required.

## Why this is **not** "just a chatbot"

| Generic LLM | IP-SAKTI |
|---|---|
| Invents a confident answer from its weights | Deterministic engines classify the product; LLM only **explains** verified output |
| Cites sections that may not exist | Every citation is checked for source, jurisdiction, status, effective date, passage |
| Treats every doc as trustworthy | Prompt-injection text in retrieved documents is quarantined as **data**; output marked UNSUPPORTED if no authority is found |
| Hides uncertainty | Confidence is **derived** from fact completeness + source coverage; "Human review required" surfaced, never hidden |
| International, fuzzy | Explicit India/International toggle, tagged corpus and separate answer sets |

## Architecture in 30 seconds

```
User  →  Natural-language description
       →  Deterministic fact extraction + targeted clarifying questions
       →  Classification engine (PROPRIETARY_ASU_MEDICINE / AYURVEDA_AAHARA / COSMETIC / …)
       →  Regime mapper (AYUSH · PATENT · TRADEMARK · TK · BIODIVERSITY_ABS · FOOD · COSMETIC · LABELLING)
       →  Hybrid retrieval (BM25 + vector + authority ranking + temporal + jurisdiction filter) over a tagged legal corpus
       →  Citation verifier (source · section · status · effective date · jurisdiction · passage)
       →  Risk + confidence (derived, not invented)
       →  Action plan (priority + reason + evidence per step)
       →  Human-review escalation (unresolved questions, recommended professional)
       →  In-case IP-SAKTI Assistant (case-scoped, evidence-only)
       →  PDF handoff
```

The LLM is **one component**; the legal conclusions are made by deterministic engines against verified Indian sources. The LLM is optional — the system works fully offline with deterministic template output (no fabrication).

## What's actually built (today, in this repo)

- **100+4 tests passing** across 20 test files (engines, retrieval, citation verification, prompt-injection safety, multilingual intake, evaluation harness, auth/RBAC, CORS, dashboard smoke)
- **End-to-end flow** the user can walk: Landing → Start Assessment → New Case → Load demo (neem-turmeric) → clarifying questions (option chips) → Run assessment → walk Classification, IP, Regulatory, Evidence, Action plan, Human review, in-case Assistant → **Injection test** button (proves docs can't poison conclusions) → **Export PDF** report
- **Jurisdiction-tagged corpus** with Indian sources spanning Patents Act §§3(c)–(p), Biological Diversity Act 2002, ASU manufacturing rules, FSSAI Ayurveda Aahara, AFI, ABS guidelines, TKDL policy, plus international TRIPS, CBD/Nagoya, WIPO GRATK, PCT, Madrid, Hague, Budapest and market-access pointers
- **Works with a local LLM** (LM Studio) or cloud (NVIDIA) — same code path; provider abstraction in `src/ai/`
- **Browser never talks to LM Studio directly** — all traffic through the backend, with `/health/llm` auto-probed every 5 s and surfaced in the sidebar
- **A built-in Evaluation harness** (23 cases × 11 dimensions) that runs the deterministic engines end-to-end before the demo to prove the system is healthy

## SIH-specific risks addressed (not just features)

1. **Hallucinated legal citations** → CitationVerifier fails any claim whose source can't be jurisdictionally, temporally, and textually verified
2. **Prompt injection in documents** → Retrieved text is matched against `INJECTION_PATTERNS`, quarantined as data, never obeyed; verified by `tests/abs-tk-injection.test.js`
3. **Mixing draft/historical law with current law** → Each source has `status` + `effectiveFrom/To`; DRAFT/PROPOSED never treated as current
4. **Overconfident AI in a regulated domain** → Hedged language enforced; confidence is *derived*; "Human review required" surfaced with recommended professional
5. **Privacy / cross-tenant data leak** → Strict tenant isolation by `organizationId` on every query (`tests/tenant-isolation.test.js`)
6. **Vendor lock-in / no offline** → Provider abstraction; same app runs against LM Studio locally or cloud LLM; deterministic fallback when LLM is offline
7. **Inappropriate legal certainty** → Disclaimer + hedged language; PDF report carries the "decision support — not legal advice" footer

## How to demonstrate in 5 minutes (the script)

1. **Landing** — *What is this? A jurisdiction-aware decision-support system for Ayurvedic IP and regulatory pathways.*
2. **Start Assessment** — register a workspace in one click
3. **New Case** — paste a sentence in English or Hindi, or click **Load demo case** (neem-turmeric, new extraction process)
4. **Clarifying questions** — answer via option chips; system only asks what materially affects classification
5. **Run assessment** — animated pipeline: Analyzing → Extracting → Classifying → Searching → Verifying → Preparing
6. **Walk the five screens** — Classification, IP Assessment, Regulatory Assessment, Evidence, Action plan, Human review, Timeline
7. **Click Injection test** to show that even a malicious injected document cannot change a conclusion; **Export report** to deliver a PDF handoff

The single question every judge should be able to ask the product is: *"Why did the system say this?"* Every material claim has a one-click answer on the Evidence page.

## Jurisdiction-aware, by design

- India is the default lens and keeps Indian regulators/authorities together.
- International mode surfaces treaty, filing-system and export-market pointers separately.
- An exact jurisdiction filter is applied in retrieval and citation verification, so India and International sources cannot be mixed in one answer set.

## SIH 26045 mapping

| Master prompt § | Where it lives |
|---|---|
| Classification-first | `src/rules/classification.engine.js`, `dashboard/src/sahayak.jsx ClassificationCard` |
| Citation-verified evidence | `src/evidence/citation-verifier.js`, `dashboard/src/sahayak.jsx EvidencePanel` |
| LM Studio support | `src/ai/provider.js`, sidebar LLM tile, `GET /health/llm` |
| No fabrication | `UNSUPPORTED` / `CONFLICTING_AUTHORITIES` enum, deterministic fallback |
| Human review | `HumanReviewCard`, `absScreen`, `tkConsiderations` |
| Injection safety | `detectInjection` in retrieval, `INJECTION_PATTERNS`, 15 injection tests |
| Jurisdiction toggle | Case-level `IN`/`INTL` switch; retrieval and citation verification enforce exact match |
| First-time UX | Guided tour overlay (`dashboard/src/tour.jsx`), inline help on every page, topbar `?` |
| Action plan | `assessment.actions` with priority + reason + evidence |
| Timeline | `TimelineCard` + `src/evidence/timeline.js` |
| PDF handoff | `src/reports/case-report.pdf.js` (branded) |

## Numbers the judges can ask about

- **100 → 104** tests passing (engines + retrieval + safety + UI smoke)
- **23** benchmark cases × **11** dimensions in the Evaluation harness
- **~6 stages** in the assessment pipeline (animate every one for the demo)
- **5 support levels** for evidence (Directly Supported → Strong Inference → Interpretation Required → Unsupported → Conflicting)
- **3+1** confidence outcomes (HIGH / MEDIUM / LOW / REVIEW REQUIRED)
- **9** regulatory regimes mapped per case (AYUSH, PATENT, TRADEMARK, GI, DESIGN, PLANT_VARIETY, BIODIVERSITY_ABS, TRADITIONAL_KNOWLEDGE, LABELLING_CLAIMS, COSMETIC, FOOD)
