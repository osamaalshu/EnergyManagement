# Codex Brief — P0: Startup Ledger + startup-first Planner + root-cause taxonomy

**Repo:** `energy-mgmt-redesign` · **Workflow:** architect (Claude) wrote this brief; Codex implements + writes/extends tests + runs them. Claude does not write test files.
**Why:** ERP analysis validated that the dominant controllable loss on MC01 is **startup/purge scrap** (first day of a run scraps ~3× continuation; small runs ~4×; both are the same "startup-only run"). The Analyse workspace must reorganise around startups. This is the **P0** slice — engine + Planner + taxonomy — all computable from the existing engine on a proposed schedule, **no new data or sensors required.**

Spec of record: `docs/ANALYSE_PRD.md` (v1) and `~/al-hilal-mc01-analysis/ANALYSE_V2_ROADMAP.md` (v2 direction). Honesty contract is unchanged: every number is labelled **measured / estimated / simulated**; modelled numbers must never visually resemble measured ones.

---

## Scope

**IN (P0):**
1. Engine: a typed **Startup Ledger** computed from an `OrderSchedule` (pure function, fully unit-tested).
2. Order Planner: **verdict card reframed startup-first**; a **Startup Ledger card**; a **sub-economic flag** per run in the per-run table.
3. Delivery View: **new root-cause taxonomy** (5 mechanism-linked tags) replacing the current generic tags.
4. A compact **"This plan" KPI strip** (4 north-star metrics) on the Planner.

**OUT (later slices, do not build now):** Batching Advisor (P1); historical *weekly* KPIs from real run-level data (needs a new data export — see "Known dependency"); Scrap Focus mechanism-first Pareto (P1); telemetry changes (P2); TOU-lever demotion (P2).

**Known dependency / honest scope:** the dashboard's real data (`src/data/scrapCatalog.ts`) is per-product aggregates, **not** run-level/time-series, so true *historical* weekly startups/cold-starts cannot be computed in-app yet. Therefore the P0 KPI strip is **plan-level ("this proposed plan"), forward-looking, labelled estimated** — not a historical weekly review. The historical version is deferred until a run-level export lands. Do not fake it.

---

## 1. Engine — `src/lib/productionModel.ts`

Add a new constant, a sub-economic flag, and a pure ledger function. Reuse existing fields (`familyChanges`, `diameterChanges`, `startupScrapKg`, `items[].setupType`, `items[].qty`, the product `kgPerUnit`). Keep everything deterministic.

```ts
// New tunable (estimate — label as such in UI). Below this a run is "sub-economic":
// its fixed startup scrap dominates. Default chosen to sit near the small-run quartile boundary.
export const MIN_ECONOMIC_RUN_KG = 3000; // ESTIMATE — adjustable

export interface StartupLedger {
  startups: number;            // runs that begin after a setup, + the first run
  familyChangeStarts: number;  // subset preceded by a FAMILY change (cold/dirty-start PROXY)
  subEconomicRuns: number;     // runs with runKg < MIN_ECONOMIC_RUN_KG
  totalRuns: number;
  subEconomicPct: number;      // subEconomicRuns / totalRuns
  startupScrapKg: number;      // = schedule.startupScrapKg (re-exposed here, ESTIMATE)
  startupScrapOmr: number;     // startupScrapKg * materialOmrPerKg
  scrapPerStartupKg: number;   // startupScrapKg / max(startups,1)
}

// Pure, deterministic. Must not mutate inputs.
export function computeStartupLedger(
  sched: OrderSchedule,
  products: Record<string, SkuParam>,
  materialOmrPerKg: number,
  minEconomicRunKg = MIN_ECONOMIC_RUN_KG,
): StartupLedger { /* … */ }
```

Semantics Codex must implement exactly:
- **`startups`** = count of `items` where `setupType !== 'none'` **plus 1** for the first run (index 0 is always a startup). Equivalently `familyChanges + diameterChanges + 1` when there is ≥1 item; `0` when `items` is empty.
- **`familyChangeStarts`** = count of items with `setupType === 'family'`. Treat as a **cold-start proxy** in the UI label (a recipe/colour change ≈ a dirty restart). Do **not** call it "cold-start" without the word "proxy/estimated."
- **`runKg`** for an item = `item.qty * products[item.productId].kgPerUnit`.
- **`subEconomicRuns`** = count of items with `runKg < minEconomicRunKg`.
- **`startupScrapKg`** = pass through `sched.startupScrapKg` (already `(familyChanges + diameterChanges) * scrapPerChangeover`). Keep it the single source of truth — do not recompute differently.
- All numeric outputs rounded consistently with the existing `round()` helper.
- Add an `isSubEconomic: boolean` (and `runKg: number`) to each `OrderItem` produced by `scheduleOrders` so the per-run table can flag it without recomputation. Compute it inside `scheduleOrders` using `MIN_ECONOMIC_RUN_KG`.

## 2. Root-cause taxonomy — Delivery View

Replace the current root-cause tagging (`"<machine> capacity" / "High scrap" / "Changeover cluster" / "Sequence / due date"`) with these **5 mechanism-linked tags**. Locate the existing tag function (in `src/lib/productionModel.ts` or `src/components/DeliveryViewPage.tsx`) and replace its body; keep its call sites/signature stable.

Priority order (first match wins), per at-risk order/item:
1. **`Cold-start penalty`** — item is a startup AND `setupType === 'family'`.
2. **`Startup overload`** — item is a startup (`setupType !== 'none'` or first run) and late/at-risk.
3. **`Sub-economic run`** — `isSubEconomic` true.
4. **`Due-date compression`** — on-time under a looser sequence but late here (i.e. lateness driven by due-date packing, not capacity).
5. **`Pure capacity shortfall`** — otherwise (makespan exceeds capacity regardless of sequence).

Export the tag set as a typed union so the UI and tests share it:
```ts
export type RootCause = 'Startup overload' | 'Cold-start penalty' | 'Sub-economic run' | 'Pure capacity shortfall' | 'Due-date compression';
```

## 3. Order Planner UI — `src/components/ProductionPlannerPage.tsx`

- **Verdict card → startup-first.** Lead line becomes: **"This plan creates `N` startups (`F` family-change / cold-start proxy), `K` sub-economic runs, ≈ `X` kg startup scrap (`Y` OMR)."** Demote OTIF / pAllOnTime / P50–P90 to a secondary row beneath (keep them — do not remove). All ledger numbers carry an **"estimated"** chip.
- **Startup Ledger card** (new, prominent, above the TOU lever): the `StartupLedger` fields with the estimated label and a one-line "what is a startup?" tooltip. Place the existing **TOU lever card below it** (demote, don't cut).
- **Per-run table:** add two columns — **`startup?`** (✓ if `setupType !== 'none'` or first run) and **`sub-economic?`** (✓ if `isSubEconomic`), with the sub-economic rows visually flagged (e.g. an amber dot + "exception").
- **Balance-strategy control:** relabel options to manager language while keeping the same underlying `mode` values — `grouped→"Save resin (fewest startups)"`, `balanced→"Protect due dates"`, `due→"Expedite (EDD)"`. Default selection = `grouped`.

## 4. "This plan" KPI strip — Planner (or `AnalyseHubPage` if cleaner)

A 4-tile strip, **clearly titled "This plan (estimated)"**:
1. **Startups** (`ledger.startups`)
2. **Cold-starts (proxy)** (`ledger.familyChangeStarts`)
3. **% sub-economic runs** (`ledger.subEconomicPct`)
4. **Scrap per startup** (`ledger.scrapPerStartupKg` kg, + OMR)

Each tile shows the "estimated" provenance chip. Add a single footnote: *"Plan-level estimates; historical weekly figures arrive with the run-level export."*

---

## Tests Codex must write/extend (`src/lib/__tests__/productionModel.test.ts` + a component test)

Assert at minimum:
1. **Empty order book** → `computeStartupLedger` returns all-zero ledger, no throw; `subEconomicPct = 0`.
2. **Single order** → `startups === 1`, `totalRuns === 1`; `subEconomicRuns === 1` iff `runKg < MIN_ECONOMIC_RUN_KG`.
3. **`startups === familyChanges + diameterChanges + 1`** for any non-empty schedule (property check across a couple of fixtures).
4. **`grouped` vs `due` mode:** `grouped` yields **≤** startups of `due` on a fixture with multiple families (fewer changeovers ⇒ fewer/equal startups).
5. **`startupScrapKg` equals `sched.startupScrapKg`** exactly (single source of truth — no divergence).
6. **`isSubEconomic`** is true exactly for items with `qty*kgPerUnit < MIN_ECONOMIC_RUN_KG`; threshold is honoured at the boundary (`< ` not `<=`).
7. **`scrapPerStartupKg === startupScrapKg / startups`** (and `0` when `startups === 0`).
8. **Root-cause priority:** a family-change startup that is late tags **`Cold-start penalty`**, not `Startup overload` (priority order respected); a small non-startup late order tags `Sub-economic run` before `Pure capacity shortfall`.
9. **Determinism:** same inputs → identical ledger across runs (no `Date.now`/random in the ledger path).
10. **Component (Planner):** verdict card renders the startup counts and the "estimated" chip; per-run table shows the `sub-economic?` flag for a sub-economic fixture.

Run `npm test` (or the repo's configured runner) and the existing **provenance/build-time check** — both must pass. Do not weaken the provenance gate.

---

## Acceptance criteria
- `computeStartupLedger` exists, is pure/deterministic, exported, fully covered by the assertions above; all tests green.
- Planner verdict card leads with startups/sub-economic/startup-scrap; OTIF retained but secondary; TOU lever retained but below the Startup Ledger card; strategy relabeled (values unchanged).
- Per-run table shows `startup?` and `sub-economic?`; sub-economic rows visibly flagged.
- Delivery View uses the 5-tag `RootCause` union end-to-end (function + UI + tests).
- The "This plan (estimated)" KPI strip renders the 4 tiles with provenance chips and the footnote.
- Every new number is labelled estimated; no modelled value is styled like measured data; provenance gate passes.
- No change to `tariffEngine.ts` behaviour; no new dependencies; TypeScript builds clean.

## Out of scope (reject if attempted)
Batching Advisor; historical weekly KPIs; Scrap Focus Pareto changes; telemetry; removing OTIF or the TOU lever; editing the tariff engine.
