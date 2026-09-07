# IP-SAKTI Sahayak — Source Provenance & Authority Taxonomy

This document maps every source in the jurisdiction-tagged legal corpus to its authority level, jurisdiction, official URL where it can be re-verified, and the date the entry was last checked. Sources are ingested by `npm run seed:legal` and the corpus is structured by `sourceKey` in [`scripts/seed-legal-corpus.js`](../scripts/seed-legal-corpus.js).

## Authority taxonomy

| Level | Meaning | Example | Weight in retrieval |
|---|---|---|---|
| 1 | Indian Acts of Parliament, subordinate Rules under those Acts, Constitution | Patents Act 1970, BDA 2002, D&C Rules 1945 | 1.00 |
| 2 | Indian regulations, official guidance, statutory notifications | FSSAI Ayurveda Aahara 2022, BDA Rules 2024 | 0.85 |
| 3 | Official government portals and registries | IP India, NBA, NBB | 0.70 |
| 4 | Restricted-access official databases (e.g. TKDL) | TKDL pointer | 0.55 |
| 5–7 | Lower-authority or test fixtures | (none in current corpus) | 0.4 and below |

The retrieval service multiplies the lexical score by the authority weight and a current-status boost, so an Act of Parliament consistently outranks a portal page for the same query.

## Sources (alphabetical)

| sourceKey | title | Authority | Level | Status | Effective from | URL |
|---|---|---|---|---|---|---|
| `afi_volume_ii` | Ayurvedic Formulary of India (AFI), Part I & II | Ministry of AYUSH | 2 | CURRENT | 1978-01-01 | https://www.ayush.gov.in |
| `bda_2002` | Biological Diversity Act, 2002 | Parliament of India | 1 | CURRENT | 2004-07-01 | https://www.indiacode.nic.in/handle/123456789/2056 |
| `bda_amendment_2023` | Biological Diversity (Amendment) Act, 2023 | Parliament of India | 1 | CURRENT | 2023-08-03 | https://egazette.gov.in |
| `bda_rules_2024` | BDA (Access and Benefit Sharing) Rules, 2024 | MoEFCC | 1 | CURRENT | 2024-10-15 | https://egazette.gov.in |
| `dcsr_asu_schedule_t` | Drugs & Cosmetics Rules, 1945 — Schedule T | MoHFW | 1 | CURRENT | 1970-04-01 | https://www.indiacode.nic.in |
| `draft_example_amendment` | [TEST] Draft ASU licensing guidance | test fixture | 7 | DRAFT | — | — |
| `drugs_cosmetics_act_asu` | Drugs and Cosmetics Act, 1940 — ASU framework | Parliament / MoHFW | 1 | CURRENT | 1947-01-01 | https://www.indiacode.nic.in |
| `fss_act_2006` | Food Safety and Standards Act, 2006 | Parliament of India | 1 | CURRENT | 2011-08-05 | https://www.indiacode.nic.in |
| `fssai_ayurveda_aahara_notification_2022` | FSSAI notification on Ayurveda Aahara, 2022 | FSSAI / MoHFW | 2 | CURRENT | 2022-05-09 | https://www.fssai.gov.in |
| `gi_act_1999` | Geographical Indications of Goods (Registration and Protection) Act, 1999 | Parliament of India | 1 | CURRENT | 2003-09-15 | https://www.indiacode.nic.in |
| `ipindia_registries` | IP India — official registries portal | Office of CGPDTM | 3 | UNKNOWN | — | https://ipindia.gov.in |
| `legal_metrology_packaged` | Legal Metrology (Packaged Commodities) Rules, 2011 | MoCA | 1 | CURRENT | 2011-04-01 | https://consumeraffairs.nic.in |
| `malicious_test_doc` | [TEST] Malicious vendor brochure | test fixture | 7 | UNKNOWN | — | — |
| `nba_abs_certificate_guidelines_2024` | NBA — ABS Certificate operational guidelines, 2024 | National Biodiversity Authority | 3 | CURRENT | 2024-11-20 | https://nbaindia.org |
| `nba_abs_overview` | NBA — ABS framework overview | National Biodiversity Authority | 3 | UNKNOWN | — | https://nbaindia.org |
| `patents_act_1970_current` | The Patents Act, 1970 (post-2005 Amendment) | Parliament of India | 1 | CURRENT | 1972-04-20 | https://www.indiacode.nic.in/handle/123456789/1362 |
| `patents_rules_2003_amended` | Patents Rules, 2003 (as amended incl. 2024) | Office of the CGPDTM | 2 | CURRENT | 2003-05-02 | https://ipindia.gov.in |
| `patents_s3d_pre2005` | Patents Act, 1970 — s.3(d) pre-2005 (historical) | Parliament of India | 1 | HISTORICAL | 2003-05-20 → 2004-12-31 | https://www.indiacode.nic.in/handle/123456789/1362 |
| `ppvfr_2001` | Protection of Plant Varieties and Farmers' Rights Act, 2001 | Parliament of India | 1 | CURRENT | — | https://www.indiacode.nic.in |
| `ppvfr_rules_2003` | PPVFR Rules, 2003 | PPVFR Authority | 2 | CURRENT | 2003-09-12 | https://plantauthority.gov.in |
| `tkdl_pointer` | TKDL — restricted-access pointer | CSIR / MoAYUSH | 4 | UNKNOWN | — | https://www.tkdl.res.in |
| `trademarks_act_1999` | Trade Marks Act, 1999 | Parliament of India | 1 | CURRENT | 2003-11-15 | https://www.indiacode.nic.in |
| `trademarks_rules_2017` | Trade Marks Rules, 2017 | Office of the CGPDTM | 2 | CURRENT | 2017-03-06 | https://ipindia.gov.in |

International entries are tagged `INTL` and are intentionally kept as separate pointers:

| sourceKey | title | Authority | Level | Status | Effective from | URL |
|---|---|---|---|---|---|---|
| `trips_wto` | TRIPS Agreement | World Trade Organization | 1 | CURRENT | 1995-01-01 | https://www.wto.org/english/docs_e/legal_e/27-trips.pdf |
| `cbd_1992` | Convention on Biological Diversity | CBD Secretariat | 1 | CURRENT | 1993-12-29 | https://www.cbd.int/convention/text/ |
| `nagoya_2010` | Nagoya Protocol | CBD Secretariat | 1 | CURRENT | 2014-10-12 | https://www.cbd.int/abs/text/ |
| `wipo_gratk_2024` | WIPO GRATK Treaty (2024) | WIPO | 1 | CURRENT | 2024-05-24 | https://www.wipo.int/wipolex/en/text/592806 |
| `pct_system` / `madrid_system` / `hague_system` / `budapest_treaty` | WIPO filing-system pointers | WIPO | 1–2 | CURRENT | varies | https://www.wipo.int/ |
| `eu_herbal_products_route` / `us_botanical_products_route` | Export-market access pointers | European Commission / U.S. FDA | 2 | CURRENT | varies | official regulator links in corpus |

Last verified: 2026-08-24.

## Status semantics

- `CURRENT` — the law / regulation is in force today and is what the system should cite.
- `HISTORICAL` — the law / regulation was in force in the past and is retained for "what applied before <date>" queries. The retrieval service does not return historical chunks for queries that don't carry an `asOf` date in the past.
- `DRAFT` — never returned by the retrieval service as current law. DRAFT fixtures are kept only to verify the temporal filter works.
- `SUPERSEDED` — replaced by a later version. Linked to its successor via the `relations` array.
- `PROPOSED` — same handling as `DRAFT`.
- `UNKNOWN` — present in the corpus but the date / status isn't certain. The retrieval service includes it only if the user explicitly asks for "all statuses".

## How to verify

For any source above, the official URL points to the authoritative source. For Indian statutes, the canonical host is `indiacode.nic.in` (maintained by the Ministry of Law and Justice). For subordinate rules, the originating ministry's site is canonical. For TKDL, the source is access-controlled and we deliberately include only a pointer — the system tells the user that authorised prior-art access is required, instead of reproducing restricted content.

## Jurisdiction boundary

Every entry is tagged `IN` or `INTL`. Retrieval and citation verification require an exact match to the selected case jurisdiction; the corpus integrity test checks that both layers are present and no source is untagged. International entries are treaty, filing-system or market-access pointers, not substitutes for target-country law.
