# Provenance & Freshness Contract — Implementation Plan (pre-build)

**Scope:** EnergyManagement MVP (`~/energy-mgmt-redesign`). Intervention #2 from `WHOLE_SYSTEM_AUDIT.md`.
**Objective:** No client-facing metric, series, baseline, status, alert, or recommendation is presented as authoritative unless the system can state **where it came from, what unit, when it was valid, and whether it is measured / calculated / inferred / benchmark / simulated / mocked.**
**Constraint:** smallest implementation that enforces trust at the **adapter → UI boundary**. No broad framework. No code edited in this document.

> Evidence legend: **[F]** fact in repo · **[I]** interpretation · **[P]** proposal. Confidence: High/Med/Low.

---

## ✅ Slice 1 — SHIPPED · dataset provenance + honest demo freshness

**Status:** implemented; lint, typecheck, `verify-provenance` (T1/T9/FH), and gated `npm run build` all pass. Slices 2–3 remain blocked.

**What shipped:** one `DatasetMeta` (`asOf`, `coverageStart`, `generatedAt`, `mode: 'demo'|'historical'|'live'`) derived once in the adapter; an understated global `<DataFreshness>` chip (demo → "Demo data"; historical → "Latest available · <date>"; live → "Live" only when `isLiveDataset()` passes, **derived not stored**); all "Today/LIVE" UI copy removed; a `verify-provenance` guard wired into `build`.

**Files changed:** `src/types/portfolio.ts`, `src/data/realPortfolioData.ts`, `src/data/mockPortfolioData.ts`, `src/components/Provenance.tsx` *(new)*, `src/lib/datasetFreshness.ts` *(new)*, `src/components/DashboardPage.tsx`, `scripts/verify-provenance.mjs` *(new)*, `package.json`.

**Known follow-ups:** internal field names `todaysConsumption`/`todaysProduction` still say "today" (not user-facing; rename in a later cleanup). T1's full unit registry lands with Slice 2.

---

## 1. Current-State Trust-Boundary Map

There is **no API and no backend**. The "backend producers" are two offline pipelines writing committed JSON; the "API presentation layer" is the two TS adapters; the "UI state" is component props/`useMemo`. **[F, High]** (`HANDOVER.md`).

```
RAW            PRODUCER                 CONTRACT (the boundary)        UI
hourly_*.csv → preprocess-csv.mjs   → realData.json → realPortfolioData.ts ─┐
            → enrich_data.py        → enrichedData.json → enrichedPortfolioData.ts ─┤→ pages
                                       (types: src/types/portfolio.ts)              ┘
```

**The trust boundary is the two adapters** (`realPortfolioData.ts`, `enrichedPortfolioData.ts`) and the props they hand to pages. That is the single place to enforce — *not* the raw JSON (regenerating both pipelines is overengineering for the MVP). **[I, High]**

### Phase-1 traceability table (client outputs → source) **[F/I, High]**

| Client Output | UI Component | Backend Producer | Current Source field | Unit (where) | Timestamp / asOf | Quality / Provenance state | Main Trust Gap |
|---|---|---|---|---|---|---|---|
| "Today's Consumption" kWh/OMR | `DashboardPage.tsx:253` | preprocess `todayRows`/`latestDate` | `hourlyProductionConsumption`, `tariffHourlyData` | kWh/OMR (JSX literal) | **labeled "Today"; actually 2014-04-09** | none | **Freshness lie** |
| "Today's Cooling Output" | `DashboardPage.tsx:235` | preprocess `todayCoolingTons` | `todaysProduction` | tons / kWh (JSX) | same | none | Freshness + "production" mislabel |
| Last-24h kWh/OMR chart | `DashboardPage.tsx:278` | preprocess | `hourlyProductionConsumption` | kWh/OMR | latest day, labeled "Today" | none | Freshness |
| COP series | `BuildingPage` COP chart | preprocess `copByResolution` | `TimeSeriesPoint{label,value}` | COP (dimensionless, JSX) | `label` string | provenance = **calculated** (uses all-hours tons) | Unlabeled calc; mixes quality |
| COP baseline | `BuildingPage:318` | `physicsConstants.copBenchmarkPeak` | enrich constants | COP | static | **benchmark 4.5** (now sourced ✓ this session) | Was hardcoded; now OK |
| Pump specific energy + baseline | `BuildingPage` pump chart | preprocess `getPumpSpecificEnergySeries` (×10) | `PumpSpecificEnergyPoint` | kWh/m³ (JSX) | `label` | **simulated/uncertain** (×10 unverified); baseline now P25 ✓ | ×10 provenance |
| CRT bill totals | `TariffPage` | enrich `calculate_crt_bill` | `CrtMonthlyBill` | OMR | month | **calculated @ 2025 rates** (parity ✓) | Vintage A9 undisclosed |
| Bill decomposition | `TariffPage` | enrich `compute_decomposition` | `DecompositionMonth` | OMR | month | calculated/inferred (fixed ✓) | OK (disclose target basis) |
| Diagnostic estimate (physics) | `TariffPage` | enrich rules | `physicsOmr` | OMR | year | **inferred / modeled (labeled ✓)** | OK |
| Portfolio Score /100 | `PortfolioPage:218` | preprocess `score` | `PortfolioMeta.score` | dimensionless index | none | **inferred heuristic** (magic 0.3/120) | Unlabeled inference, false precision |
| Savings potential % | `PortfolioPage:222` | preprocess | `savingsPotentialPercent` | % | none | inferred (self-referential) | Unlabeled inference |
| Energy breakdown % | `PortfolioPage` donut | preprocess | `ConsumptionBreakdownEntry` | % | none | calculated | Minor |
| Data Quality / integrity | `BuildingPage` | enrich `quality_summary` | `ChillerQualityReport` | counts | range | **measured-data quality (good ✓)** | OK |
| Rolling anomaly cost | (Portfolio/anomaly) | preprocess `computeAnomalyData` | `AnomalyData.inefficiencyCost` | OMR | label | **inferred w/ `avgCoolingTons=200` default** | Fabricated magnitude |
| Equipment status (running/off/warning) | `EquipmentPage` cards | preprocess | `Equipment.status` | enum | none | inferred from kW/temp threshold | Inferred-as-fact |
| Daily consumption heatmap | `TariffPage` | adapter from `tariffHourlyData` | derived | kWh | year (chosen) | measured | asOf only |

---

## 2. Existing Reusable Contracts (extend, don't replace) **[F, High]**

- **String-literal unions already used as enums:** `TimeResolution`, `PerformanceBand`, `severity: 'critical'|'warning'|'info'`, `EquipmentType`, `EquipmentStatus`. **→ the new `ProvenanceType`/`QualityStatus` enums must follow this exact pattern** (`src/types/portfolio.ts`).
- **`ByResolution<T>`** generic — a precedent for one small generic wrapper; reuse the discipline, not a new framework.
- **Units already documented as comments** (`// kW/ton`, `// m²`, `// kWh/m³`) — these become the *source of truth* for a units map; nothing new to invent, just promote them from comments to data.
- **`ChillerQualityReport` / `QualityEpisode`** — existing *measured-data* quality. **Keep separate** from analytical provenance (Phase-4 risk: don't conflate raw quality with analytical confidence).
- **`parity_check()`** (`enrich_data.py`) + `npm run lint/typecheck/build` — the existing guardrail pattern to **extend** for tests (don't invent a new test runner).

**Conclusion:** the repo has the *idioms* (enums, typed adapters, a parity guard). It lacks the *fields*. Extend. **[I, High]**

---

## 3. Identified Provenance & Freshness Gaps

- **G1 (P0):** No dataset-level `asOf` / coverage anywhere → "Today/LIVE/last-24h" on 2014 data. One missing field causes the single worst trust failure. **[F, High]**
- **G2 (P0):** No `provenanceType` on any output → measured, calculated, inferred, and simulated values look identical (Score, savings%, ×10 pump, anomaly cost, equipment status all render like measured facts).
- **G3 (P1):** Units live in comments/JSX, not data → no enforcement; the ×10 unit ambiguity is invisible.
- **G4 (P1):** No `qualityStatus` for analytical outputs (stale/estimated/suspect) distinct from raw-sensor quality.
- **G5 (P1):** Inferred recommendations/states (anomaly, savings, equipment "warning") carry no supporting observation/assumption.

---

## 4. Proposed Minimal Schema

Two tiers only. **Not** a per-value wrapper (Phase-4 risk #1).

### Tier A — one dataset descriptor (kills G1 globally, ~cheapest, highest leverage)
```ts
export interface DatasetMeta {
  asOf: string;            // ISO date of the latest real reading (max timestamp)
  coverageStart: string;   // ISO date of earliest reading
  generatedAt: string;     // when the JSON was produced
  isLive: boolean;         // false for batch/historical (always false today)
}
```
Generated **once** in the adapter from the existing data (`max(tariffHourlyData.timestamp)`) — no pipeline regen needed. **[P, High]**

### Tier B — a descriptor for *named, headline* outputs only (KPIs, baselines, statuses, alerts) — NOT every series point
```ts
export interface MetricMeta {
  unit: string | null;            // null only if explicitly dimensionless (e.g. COP, %)
  provenanceType: ProvenanceType;
  source: string;                 // human-readable origin ("APSR CRT 2025 engine", "Gulf benchmark", "plant CSV")
  qualityStatus: QualityStatus;
  method?: string;                // short formula/rule id for calculated/inferred ("100-(kW/ton-0.3)*120", "R-CH-01")
  confidence?: 'high' | 'medium' | 'low';  // for inferred/estimated only
  basisAsOf?: string;             // when this metric's underlying data was valid (defaults to DatasetMeta.asOf)
}
```

### Field-by-field justification
| Field | Prevents | Mandatory? | Required by | Generated where | Layer |
|---|---|---|---|---|---|
| `asOf` (Tier A) | "today" on stale data (G1) | **Yes (dataset)** | all "current/today" UI | adapter (max timestamp) | API-presentation |
| `unit` | dimensional value with no unit (G3) | Yes unless dimensionless | every numeric headline metric | static metric registry (from existing comments) | domain/presentation |
| `provenanceType` | measured≡inferred confusion (G2) | **Yes** | every headline metric/baseline/status/alert | static registry / enrich output | domain |
| `source` | "where did this come from?" | **Yes** | every headline metric | static registry | domain |
| `qualityStatus` | stale/estimated shown as valid (G4) | Yes | metrics that can degrade | adapter (derive from asOf) + enrich | domain/presentation |
| `method` | untraceable calculations | Optional (calc/inferred only) | Score, decomposition, rules | static / enrich | domain |
| `confidence` | false precision on inferences | Optional (inferred/estimated only) | Score, savings%, anomaly, diagnostic est. | static / enrich | domain |
| `basisAsOf` | per-metric staleness | Optional (defaults to asOf) | metrics not refreshed with the dataset | adapter | presentation |

**Explicitly excluded for MVP** (Phase-4): no per-series-point provenance (series already carry `label`; unit is declared once per chart); no `id`/lineage graph; no versioned schema registry; no runtime metadata on every primitive.

### Controlled values (enums — discriminated unions, matching repo style)
```ts
export type ProvenanceType =
  | 'measured'        // direct from a meter/sensor reading
  | 'calculated'      // deterministic transform of measured (COP, bills)
  | 'inferred'        // modeled/estimated with assumptions (score, diagnostic est.)
  | 'benchmark'       // external reference value (Gulf COP 4.5)
  | 'simulated'       // synthetic/illustrative (none should reach prod unlabeled)
  | 'mocked'          // placeholder (must never render unlabeled)
  | 'manual';         // human-entered (e.g. future nameplate COP)

export type QualityStatus =
  | 'valid'
  | 'stale'           // older than the output's freshness budget
  | 'incomplete'      // partial coverage (e.g. 2014 partial month)
  | 'estimated'       // inferred fill / modeled
  | 'suspect'         // upstream quality flags present
  | 'unavailable';    // no defensible value -> render a blocked state, not 0
```

---

## 5. Enforcement Rules

| # | Rule | Enforced where | On failure |
|---|---|---|---|
| R1 | A numeric headline output must have a `unit` unless `unit===null` (explicit dimensionless). | metric registry type + test | **build test fails** |
| R2 | "Current/live/today" labels only when `DatasetMeta.isLive===true` OR within freshness budget. Today it's batch → **never "today"**. | `<Freshness>`/`<Provenance>` UI primitive | label replaced with `asOf`; test fails if literal "Today/LIVE" string present near a metric |
| R3 | `mocked`/`simulated` must render with a visible badge; never indistinguishable from `measured`. | UI primitive + test | test fails if such a metric renders without the badge |
| R4 | Stale data (`qualityStatus==='stale'`) is labeled or blocked by criticality (bills/alerts = block; charts = label). | adapter sets status; UI primitive | warning banner (charts) / blocked card (bills) |
| R5 | Inferred recommendation/alert must carry `method` + the observation it rests on. | enrich output / registry | test fails if `provenanceType==='inferred'` and `method` missing |
| R6 | The frontend must not invent `source`, `asOf`, `qualityStatus`, or `provenanceType`. | code review + grep test (no hardcoded "measured"/dates in components) | test fails |
| R7 | Missing provenance fails **visibly** (a "—/unverified" chip), never silently as trustworthy. | UI primitive default | renders unverified chip; test asserts no headline metric lacks meta |
| R8 | Conversions/aggregations preserve `source`/`provenanceType` lineage (e.g. ×10, OMR×VAT). | metric registry note + test | test fails if a known conversion (×10) has no documented `method`/`source` |

**Degradation policy (criticality-tiered):** `bills & alerts` → **block** on stale/unverified. `efficiency charts & KPIs` → **label** (chip) and keep rendering. `exploratory (heatmap)` → **label** only.

---

## 6. Failure & Degradation Behaviour

- **Block** (render a neutral "Unverified — pending source" card): missing `provenanceType` or `source` on a bill/alert; `qualityStatus==='unavailable'`.
- **Warn** (chip + tooltip, keep chart): `stale`, `estimated`, `inferred`, `simulated`.
- **Badge** (explicit): `mocked`/`simulated` always.
- **Never:** silently show `0`/`NaN`/`Infinity` or a bare number with no chip for a registered headline metric.

---

## 7. First Vertical Slice (Slice 1 — highest value, smallest change)

**Target: the freshness lie (G1) — the #1 trust risk, one field, fixes every "Today/LIVE" at once.**

Chain: `raw (max timestamp) → adapter DatasetMeta → <Freshness/Provenance> primitive → DashboardPage labels → test`.

- Add `DatasetMeta` type (`portfolio.ts`).
- Compute `datasetMeta` in `realPortfolioData.ts` from `max(tariffHourlyData.timestamp)` (no pipeline regen).
- Add a tiny `<Provenance>`/`<Freshness>` UI primitive (chip + tooltip).
- `DashboardPage`: replace "Today's …" → "Latest period · {asOf}"; remove "LIVE"; show the chip.
- **Test:** fails if the literal "Today"/"LIVE" appears adjacent to a metric while `isLive===false`, and if `datasetMeta.asOf` is missing/invalid.

**Completion criteria:** Dashboard shows the real data date; no "today/live" wording; test green.

---

## 8. Migration Sequence

**Slice 2 — baselines & decomposition outputs.** Attach `MetricMeta` to: COP baseline (`benchmark`, source "Gulf COP 4.5"), pump baseline (`inferred`, "P25 own data", `confidence:'low'` until ×10 resolved), decomposition target COP + tariff bills (`calculated`, source "APSR CRT 2025", disclose vintage A9). Files: `enrichedPortfolioData.ts`, `BuildingPage.tsx`, `TariffPage.tsx`. Compatibility: additive (optional fields). Test: bills must carry vintage; baselines must carry `provenanceType`.

**Slice 3 — alerts, recommendations, inferred states.** Score (`inferred`, method, `confidence:'low'`), savings% (`inferred`, self-referential), rolling anomaly cost (`inferred`, expose `avgCoolingTons` assumption or retire), equipment status (`inferred` from threshold). Files: `PortfolioPage.tsx`, `EquipmentPage.tsx`, registry. Test: every `inferred` output has `method` + `confidence`.

Each slice: additive, behind the same primitive, independently shippable.

---

## 9. Test Plan (extend the existing guardrail, don't invent one)

Add `npm run verify:provenance` (a Node script, sibling to the parity check) wired into `npm run build`/CI. It loads the committed JSON + a static **metric registry** and asserts:

| Test | Fails when |
|---|---|
| T1 unit-present | a registered dimensional metric has `unit==null` |
| T2 source-present | a registered metric has empty `source`/`provenanceType` |
| T3 freshness-honesty | UI contains "Today/LIVE/now" near a metric while `isLive===false` (grep over `src/components`) |
| T4 calc-not-measured | a `calculated`/`inferred` metric is labeled measured |
| T5 mock-visibility | a `mocked`/`simulated` metric lacks the badge |
| T6 timestamp-valid | `asOf`/`basisAsOf` not a valid ISO date |
| T7 conversion-lineage | a known conversion (×10, VAT) lacks documented `method`/`source` |
| T8 api-ui-agreement | adapter `provenanceType`/`asOf` ≠ what the primitive renders |
| T9 no-NaN | any client-facing series/number is `NaN`/`±Infinity`/`null` where a number is required |

T9 + T1 can run **today** with zero schema (pure JSON scan) — ship them first as the cheapest guard.

---

## 10. Risks of Overengineering — explicit checks

| Risk | Mitigation in this design |
|---|---|
| Wrapping every primitive in an object | **Rejected.** Two tiers only: one dataset descriptor + a registry for ~15 headline outputs. Series points untouched. |
| Universal metadata framework before MVP needs it | **Rejected.** No schema registry/versioning/lineage graph. |
| Duplicating timestamps already in series | **Avoided.** Series keep `label`; freshness is dataset-level `asOf`, not per-point. |
| Provenance fields nobody consumes | **Avoided.** Every field is read by the `<Provenance>` primitive or a test; if neither, it's cut. |
| Identical metadata on different outputs | **Avoided.** `MetricMeta` fields are optional by output type (bills need vintage; charts need unit; inferences need confidence). |
| Mixing raw-data quality with analytical confidence | **Avoided.** `ChillerQualityReport` (sensor quality) stays separate from `MetricMeta.qualityStatus`/`confidence` (analytical). |
| Abstraction with no second use | One UI primitive + one registry, both used ≥10×. |
| Repo-wide migration in one step | **Rejected.** 3 additive slices, each shippable. |

---

## 11. Files Expected To Change (per slice)

- **Slice 1:** `src/types/portfolio.ts` (+`DatasetMeta`), `src/data/realPortfolioData.ts` (compute `datasetMeta`), new `src/components/Provenance.tsx`, `src/components/DashboardPage.tsx`, new `scripts/verify-provenance.mjs`, `package.json` (script).
- **Slice 2:** `src/types/portfolio.ts` (+`MetricMeta`,enums), new `src/data/metricRegistry.ts`, `src/data/enrichedPortfolioData.ts`, `BuildingPage.tsx`, `TariffPage.tsx`.
- **Slice 3:** `PortfolioPage.tsx`, `EquipmentPage.tsx`, `metricRegistry.ts`.

No raw-CSV, no `enrich_data.py`, no `preprocess-csv.mjs` change required for Slices 1–2 (provenance is declared at the boundary). Slice 3 may optionally move `avgCoolingTons` out of preprocess.

---

## 12. Questions Requiring Founder / Domain Validation

1. **Freshness policy:** for a historical demo, is "Latest period · Apr 2014" acceptable, or should the demo be re-cut on a recent date? (Blocks Slice 1 copy.)
2. **Tariff vintage (A9):** confirm bills are "computed at 2025 CRT rates on historical load" — exact disclosure wording.
3. **×10 pump factor — TRACED, status `unresolved`.** Source: `CP_TotalChilledWaterPump_kW ÷ Σ CP_Chiller{1,2,3}_ChilledWaterFlowrate × 10` (`preprocess-csv.mjs:876`; commit `b236aae` "10x correction factor", no basis). Raw flow median 786 / max 3295; pump 5.3 kW median. **The enrich pipeline treats the same column as GPM** (`flow_ls = raw × 0.063`) — contradicting the preprocess `×10`. If flow is GPM the correct factor is **×4.403 → ~0.032 kWh/m³** (physically normal); `×10 → ~0.0735` over-scales ~2.3× (appears tuned to the old 0.08 baseline). L/s (~0.002) and m³/h (~0.007) are implausibly low. **Do not classify as `calculated`/`simulated` yet — label `provenanceType: 'unresolved'` until the flow-meter unit is confirmed** (founder/meter spec). Resolution likely: column = GPM, replace `×10` with `×4.403`.
4. **Score:** keep as `inferred` index with disclosed method, or retire? (Slice 3.)
5. **Criticality tiers:** confirm bills/alerts **block** on stale, charts **label**. (R4 policy.)

---

## 13. Recommendation

**Extend the existing contract — implement the minimal two-tier design, do not build a framework.**

- **Now (cheapest, highest leverage):** ship **T9 + T1** (pure-JSON NaN/unit scan) and **Slice 1** (`DatasetMeta` + `<Provenance>` + kill "Today/LIVE"). This alone neutralises the dominant trust-erosion loop (R1) and installs the first structural balancing loop at the trust boundary.
- **Then:** Slices 2–3 as additive passes.
- **Reject:** any per-value wrapper, universal metadata engine, or raw-pipeline migration — the MVP does not need them, and they would re-introduce the complexity-debt loop (R3) we are trying to break.

This is the smallest change that makes the rule *"nothing authoritative without source, unit, vintage, and provenance"* **structurally enforced** rather than manually policed — converting the audit (a manual balancing loop, B3) into an automated one.

*Plan complete. No production code modified. Awaiting go-ahead (and the §12 answers) before Slice 1.*
