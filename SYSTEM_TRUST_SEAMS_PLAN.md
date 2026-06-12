# System Trust Seams — Implementation Plan (pre-build)

**Branch:** `fix/system-trust-seams` (from `main` @ `4296a7b`, post-PR#2).
**Scope (locked to two seams):** (A) propagate the provenance that already exists in generated metadata into the UI; (B) establish **one authoritative runtime tariff source of truth**.
**Constraint:** smallest correct change. No code edited in this document. **Do not implement until this plan is approved.**

> Legend: **[F]** repo fact · **[I]** interpretation · **[Q]** founder/domain question · **[R]** recommendation. Confidence H/M/L.

---

## A. Existing Provenance Propagation

### A.1 The chain today (where provenance dies)
```
enrich_data.py → enrichedData.json.meta  →  enrichedPortfolioData.ts `enrichedMeta` (EXPORTED)
                                                     │
                                                     └──► consumed by: NOTHING  ✗  (dies here)
DatasetMeta (realPortfolioData) ──► <DataFreshness> chip (Dashboard only)  ✓
```
**[F, High]** `enrichedMeta` is exported (`src/data/enrichedPortfolioData.ts:29`) but no component imports it. `DatasetMeta` (Slice 1) is a *parallel, recomputed* freshness object that does **not** read `enrichedMeta`. So two metadata objects exist; the richer one (with engine, tariff year, notes) is unused. **The seam is half-built.**

### A.2 Field inventory (`enrichedData.meta`) + decision
| Field | Current value | Meaning | Decision |
|---|---|---|---|
| `dataRange.from` / `.to` | 2011-06-01 / 2014-04-09 | dataset period | **Provenance details** (chip tooltip). **Unify:** `DatasetMeta.asOf/coverageStart` should derive from this, not recompute from `tariffHourlyData`. |
| `generatedAt` | 2026-06-11T09:48Z | when JSON was built | **Internal / provenance details.** **Fix the Slice-1 bug:** `DatasetMeta.generatedAt` currently = page-load `new Date()`; source it from here instead. |
| `tariffConfigYear` | 2025 | tariff schedule vintage | **Display directly** on every tariff output ("2025 CRT rates"). Core of the vintage disclosure (seam B). |
| `engine` | "enerlytics … (Python)" | producing engine | **Provenance details** (auditability), not headline. |
| `system` / `siteId` | MIS / CP1 | config context | **Internal / provenance details.** |
| `notes[0]` "UTC+4 no DST" | — | time-base assumption | **Internal.** |
| `notes[1]` "flow GPM → L/s 0.0630902" | — | flow-unit assumption | **Provenance details — BUT BLOCKED from validating pump SE.** This note documents enrich's GPM assumption; it must NOT be used to mark the preprocess `×10` pump value `calculated`/`valid` (issue #3 unresolved). Pump provenance stays `unresolved`. |
| `notes[2]` "APSR CRT 2025 rates on historical load (demo)" | — | the tariff vintage disclosure | **Display directly** wherever a bill is shown. |
| `notes[3]` "VAT 5% on top" | — | bill composition | **Provenance details.** |

**Rule honored:** the generated `meta` remains the single source. The UI **reads** it; it must **not** re-author any of these strings. `DatasetMeta` is refactored to be a thin *typed view over `enrichedMeta` + the timeseries*, not a second source. **[R]**

### A.3 Minimal propagation design
- Type the meta in `src/types/portfolio.ts` (`EnrichedMeta`) — it's currently an inline cast.
- `enrichedPortfolioData.ts` already exports `enrichedMeta`; add a small typed selector `getDatasetProvenance()` that returns `{ period, generatedAt, tariffYear, engine, notes }`.
- `DatasetMeta` (real adapter) derives `asOf/coverageStart/generatedAt` from `enrichedMeta.dataRange/generatedAt` (kills the runtime-`now()` bug; one period source).
- `<DataFreshness>` tooltip + a new minimal `<TariffBasis>` line (Tariff page + dashboard cost card) render `tariffYear` + the "2025 rates on historical (demo)" note **read from meta**.
- **No** per-metric `MetricMeta` rollout (excluded, §D).

---

## B. Single Authoritative Runtime Tariff Source

### B.1 Output → engine map (today) **[F, High]**
| Tariff output | UI location | Produced by | Runtime or precomputed |
|---|---|---|---|
| Monthly bill table | TariffPage `:101` | **TS** `calculateMonthlyDetailedBills` | runtime |
| Effective-rate chart | TariffPage `:112-115` | **TS** `aggregateTo*` | runtime |
| Tariff KPIs (Total kWh/Energy/Capacity/Supply+VAT/Total) | TariffPage | **TS** (from `monthlyBills`) | runtime |
| Dashboard last-24h OMR + full-bill | DashboardPage `:54,117,128` | **TS** `effectiveRateOmrPerKwh` + bills | runtime |
| Option comparison (1/2/3) | TariffPage `:122` | **Python** `getOptionTotals` | precomputed (committed JSON) |
| Bill decomposition | TariffPage `:179` | **Python** `decompose_bill` | precomputed |
| Parity status | TariffPage `:322` | **Python** check | precomputed |

**Key fact:** **at runtime, only the TS engine executes.** The Python outputs are *static reads*. So the risk is **not** "two engines run at once" — it is: **the TS engine carries its own hardcoded rate tables** (`tariffEngine.ts`: `BST_MIS_2025_RO_PER_MWH`, `DIST_BZ_PER_KWH`, `CAPACITY_OMR_PER_MW_YEAR`, `SUPPLY_CHARGE_OMR_PER_YEAR=50`, `VAT_RATE`) that can **drift** from the Python config that produced the committed decomposition/option-comparison. A TS-only rate edit ships unguarded (parity runs only in the Python enrich step). **[F, High]**

### B.2 Three options, evaluated against the real constraints
| Criterion | (1) Python authoritative, UI reads precomputed | (2) TS authoritative, Python = offline validation | (3) Shared rate definition drives both |
|---|---|---|---|
| Frontend-only deploy | ⚠ needs precompute of **all** voltage×resolution×date-range combos (UI is interactive: voltage 33/11/0.415, daily–yearly, arbitrary date filter) → combinatorial | ✅ TS already computes live | ✅ TS computes live |
| Build reproducibility | ✅ | ✅ | ✅ |
| Tariff updates | edit Python only | edit TS only | **edit one schedule; both follow** |
| Explainability/audit | bills opaque (precomputed) | rates in TS code | **rates in one versioned file** |
| Duplicated assumptions | removes TS engine, but decomposition still Python → 2 rate sources remain unless shared | **decomposition/option-comp would need TS re-implementation** (re-duplication) | **eliminates duplicated rates** (root cause) |
| Testability | hard (no live calc to test) | ✅ | ✅ + version guard |
| MVP complexity | **high** (precompute matrix) | medium (re-implement decomposition in TS) | **low** (extract existing constants to JSON) |
| Future API/backend | precompute pattern ports | TS port awkward server-side | definition ports cleanly |

**Why not 1:** the UI's interactivity (voltage, resolution, arbitrary date range) makes full precompute combinatorial — it would freeze the product's interactive tariff exploration. **[I, High]**
**Why not pure 2:** the decomposition needs the physics-expected reference + `bill_decomposer` (genuinely Python); re-implementing it in TS re-creates duplication the other direction. **[I, High]**

### B.3 Recommendation — **Option 3, minimal** (least-effort root-cause fix; *not* a framework)
- **TS remains the single RUNTIME authority** for all live tariff numbers (no engine rewrite).
- **One rate definition:** at enrich time, Python **dumps the loaded tariff config** (`load_tariff_config(2025, MIS)`) into a committed `src/data/generated/tariffSchedule.json` (+ a `scheduleVersion`/hash in `enrichedData.meta`). The TS engine **reads its rates from that JSON** instead of hardcoding them. The enerlytics platform stays untouched (we only snapshot its config output). **[R, High]**
- **Python decomposition + option-comparison remain precomputed analytical artifacts**, each **stamped with the same `scheduleVersion`**. They are *derived analyses*, not a second tariff authority.
- **Parity becomes validation, not ownership:** it asserts the TS runtime engine and the Python precompute implement the **same** schedule identically.
- **Staleness guard:** a check fails the build if the `scheduleVersion` the TS engine loads ≠ the version stamped on the committed precomputed artifacts — so **a tariff change cannot update one output while leaving another stale.**

This satisfies all required invariants: one runtime authority (TS) · schedule/version in provenance · historical-load vs tariff-vintage distinguished (via the disclosure from seam A) · all tariff views consume the same rates · parity = validation · cross-output staleness blocked.

**[Q-B1]** Confirm we may **snapshot the platform's tariff config to a committed JSON** in this repo (vs continuing to hardcode in TS). This is the single decision gating B.

---

## C. Guardrails (proposed tests, extend `verify-provenance`)
| ID | Fails when | How |
|---|---|---|
| P1 | adapter drops generated provenance | assert `getDatasetProvenance()` returns non-empty `period/generatedAt/tariffYear` matching `enrichedData.meta` |
| P2 | a tariff output lacks schedule/version | assert every committed tariff artifact (bills snapshot, decomposition, option totals) carries `scheduleVersion` |
| P3 | two UI tariff calcs use different authorities | static check: only `tariffEngine.ts` computes tariffs at runtime; grep that no component re-implements rates; both read the same `tariffSchedule.json` |
| P4 | historical load shown as a current invoice | FH-style check: a bill rendered without the "2025 rates on historical (demo)" basis near it → fail |
| P5 | runtime TS and precomputed mixed | assert `scheduleVersion(tariffSchedule.json) === enrichedData.meta.scheduleVersion` (the staleness guard) |
| P6 | unvalidated flow-derived value gets `calculated`/`valid` | assert pump SE provenance stays `unresolved` while issue #3 open (no `valid`/`calculated` tag on pump outputs) |

All ride the existing `verify-provenance.mjs` (one Node script, gates `build`) — **no new test runner.** **[R]**

---

## D. Explicitly Excluded From This Branch
- ❌ Resolving/changing the chilled-water-flow `×10` (issue #3 stays open).
- ❌ Broad `MetricMeta` rollout to all features.
- ❌ Anomaly-system redesign · score redesign · missing-sensor policy.
- ❌ Generic provenance/metadata frameworks.
- ❌ Any unrelated UI change.

---

## Conclusion (required 7)

1. **Recommended tariff authority:** **TS engine = single runtime authority**, reading rates from **one committed `tariffSchedule.json` snapshotted from the Python config**; Python = offline validation + precomputed decomposition (version-stamped). (Option 3, minimal.)
2. **Exact provenance fields to propagate:** `dataRange` (→ display period, drive `DatasetMeta`), `generatedAt` (→ fix DatasetMeta source), `tariffConfigYear` + `notes[2]` "2025 rates on historical (demo)" (→ display on bills), `engine`/`system`/`siteId`/`notes[0,3]` (→ provenance details), `notes[1]` flow-unit (→ details, **blocked from validating pump**). Source remains `enrichedData.meta`.
3. **Files expected to change:** `src/types/portfolio.ts` (+`EnrichedMeta`, `scheduleVersion`); `src/data/enrichedPortfolioData.ts` (`getDatasetProvenance`); `src/data/realPortfolioData.ts` (`DatasetMeta` derives from `enrichedMeta`); `src/lib/tariffEngine.ts` (read rates from JSON); `src/components/Provenance.tsx` (+`<TariffBasis>`); `src/components/TariffPage.tsx` + `DashboardPage.tsx` (render basis); `scripts/enrich_data.py` (dump `tariffSchedule.json` + `scheduleVersion`); `scripts/verify-provenance.mjs` (P1–P6); new `src/data/generated/tariffSchedule.json`. **No enerlytics-platform change.**
4. **Migration sequence:** (S1) propagate provenance read-only — type `EnrichedMeta`, `getDatasetProvenance`, unify `DatasetMeta`, render `<TariffBasis>`, add P1/P4. (S2) one rate source — enrich dumps `tariffSchedule.json`+version, TS reads it, stamp artifacts, add P2/P3/P5/P6, re-run parity. Each step independently shippable.
5. **Tests required:** P1–P6 above + re-confirm existing T1/T9/FH + Python parity unchanged.
6. **Risks & rollback:** TS reading rates from JSON could shift a rounding edge → **mitigated by parity** (must stay ≤0.5%) and a golden snapshot of current bills before the change; rollback = revert the TS rate-source commit (rates fall back to constants). Provenance step is purely additive (low risk).
7. **Decisions requiring founder/domain validation:** **[Q-B1]** snapshot platform tariff config → committed JSON (gates B); **[Q-A1]** exact on-screen wording for the "2025 CRT rates on historical 2011–2014 load (demo)" basis; confirm `scheduleVersion` = tariff-year + config hash.

*Plan complete. No code changed. Awaiting approval of the Option-3-minimal recommendation and the two domain questions before Step S1.*
