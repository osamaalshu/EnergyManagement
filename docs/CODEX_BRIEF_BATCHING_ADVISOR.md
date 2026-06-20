# Codex Brief — Batching Advisor (the action engine)

**Repo:** `energy-mgmt-redesign` (current `main`, post phase-1 refactor: `@/` alias, `src/features|pages|shared|lib`). **Branch:** `feat/batching-advisor`. Builds on the merged Analyse v2 (P0 Startup Ledger + P1 measured KPIs). Architect (Claude) wrote this; Codex implements + writes/extends tests + runs them.

**Why:** We validated that the dominant controllable loss is **startup/purge scrap**, and the lever is **fewer, larger, better-sequenced runs**. P0 *measures* startups on a plan; this turns that into an **action**: the Batching Advisor proposes consolidating small, same-class orders into campaigns and quantifies the saving vs the due-date cost. Principle: **discipline with override** — recommend exceptions with explicit trade-offs; never "the algorithm says no."

## Engine you build on (do not change its behaviour)
`src/features/production-planning/productionModel.ts` already exports:
- `scheduleOrders(orders, products, days, machines, line, econ, hoursPerDay, famH, diaH, startupScrapKgPerChangeover, mode)` → `OrderSchedule`
- `computeStartupLedger(sched, products, materialOmrPerKg, minEconomicRunKg)` → `StartupLedger`
- `Order { id, productId, qty, dueDay, priority? }`; `OrderItem { …, runKg, isSubEconomic, setupType }`; `SkuParam` (has `family`, `diameterMm`, `kgPerUnit`, `rateEffective`, `meanRejection`); `MIN_ECONOMIC_RUN_KG`.
The Planner schedules with `famH=3, diaH=0.5, startupScrapKgPerChangeover=10, mode='grouped'`. **Reuse these** so the Advisor's numbers reconcile with the Startup Ledger (single source of truth).

## Scope

**IN:**
1. **Pure engine module** `src/features/production-planning/batchingAdvisor.ts` — `suggestBatches(...)` (fully unit-tested).
2. **Batching Advisor card** on the Order Planner (`src/pages/ProductionPlannerPage/ProductionPlannerPage.tsx`) — ranked suggestions with the save/risk trade-off and an **Apply (preview)** action.

**OUT:** any change to `scheduleOrders`/`computeStartupLedger`/the ledger card/Scrap Focus/Delivery View/telemetry/tariff engine; energy (kWh) saving (leave a typed placeholder only); auto-applying without preview.

## Algorithm (deterministic — re-simulate, like Delivery View's recommendations)

```ts
export interface BatchSuggestion {
  id: string;
  family: string;
  productId: string;            // same-product merge (the primary candidate)
  orderIds: string[];           // the >=2 orders this batch merges
  mergedQty: number;
  startupsSaved: number;        // ledgerBase.startups - ledgerCand.startups
  scrapSavedKg: number;         // ledgerBase.startupScrapKg - ledgerCand.startupScrapKg
  scrapSavedOmr: number;        // scrapSavedKg * materialOmrPerKg
  addedLateDays: number;        // max over affected orders of max(0, candLate - baseLate)
  otifBefore: number;           // 0..1
  otifAfter: number;
  feasible: boolean;            // addedLateDays <= maxAddedLateDays
  // energySavedKwh?: number    // PLACEHOLDER — omit/undefined until metered
}

export function suggestBatches(
  orders: Order[],
  products: Record<string, SkuParam>,
  line: LineParam, econ: Econ, hoursPerDay: number,
  opts?: { dueWindowDays?: number; maxAddedLateDays?: number; minEconomicRunKg?: number; topN?: number },
): BatchSuggestion[]
```

Steps:
1. **Baseline:** `base = scheduleOrders(orders, products, 30, 1, line, econ, hoursPerDay, 3, 0.5, 10, 'grouped')`; `ledgerBase = computeStartupLedger(base, products, econ.materialOmrPerKg)`; baseline OTIF = `base.onTime / base.total`; per-order baseline `lateDays`.
2. **Candidate generation (primary = same-product merges):** group orders by `productId`; a candidate = a group of **≥2** orders where **at least one is sub-economic** (`qty*kgPerUnit < minEconomicRunKg`, default `MIN_ECONOMIC_RUN_KG`) **and** all due days fall within `dueWindowDays` (default **7**) of the group's earliest due day.
3. **Apply a candidate:** replace the group's orders with **one merged order** `{ id: 'batch:'+productId, productId, qty: Σqty, dueDay: min(dueDay), priority: any(priority) }`; keep all other orders unchanged.
4. **Re-simulate:** `cand = scheduleOrders(modifiedOrders, …, 'grouped')`; `ledgerCand = computeStartupLedger(cand, …)`. Compute `startupsSaved`, `scrapSavedKg`, `scrapSavedOmr`, `otifAfter`, and `addedLateDays` (compare the merged order + any others against baseline `lateDays`; the merged order's due = the earliest, so it must not finish later than that).
5. **Filter & rank:** keep suggestions with `startupsSaved > 0`; set `feasible = addedLateDays <= maxAddedLateDays` (default **1**); rank by `scrapSavedOmr` desc; return top `topN` (default **3**). Return **all** ranked (feasible and not) so the UI can show infeasible ones as "override" with their cost.

Determinism: stable ordering (sort by scrapSavedOmr, tie-break by `id`); no `Date.now`/random.

## UI — Batching Advisor card (Order Planner)
- A card titled **"Batching Advisor"** with an **estimated** chip (reuse the existing amber chip pattern).
- For each suggestion: a one-line recommendation, e.g. *"Batch 3 {family} orders of {productName} → save {startupsSaved} startups, ≈{scrapSavedKg} kg ({scrapSavedOmr} OMR) startup scrap · +{addedLateDays}d max lateness · OTIF {otifBefore%→otifAfter%}."*
- **Feasible** suggestions styled normal; **infeasible** ones shown muted with an **"override — costs {addedLateDays}d lateness"** note (discipline-with-override).
- **Apply (preview):** clicking sets the Planner's order book to the merged set (preview state), re-renders the verdict/ledger so the manager sees the new plan; a **Revert** returns to the original. (Apply mutates the local planner order state only; no persistence.)
- Empty state: "No sub-economic same-product orders due within {dueWindowDays} days to batch."

## Honesty contract
- Scrap/OMR are **estimated** (same basis as the Startup Ledger) — label with the estimated chip. Energy is **not** claimed (the `energySavedKwh` placeholder stays undefined/omitted with a "when metered" note).
- Numbers must reconcile with the Startup Ledger (both derive from `computeStartupLedger`). Do not weaken `scripts/verify-provenance.mjs`.

## Tests Codex must write (`src/features/production-planning/__tests__/batchingAdvisor.test.ts` + extend the Planner component test)
1. Two sub-economic same-product orders within the window → one suggestion with `startupsSaved >= 1` and `scrapSavedKg > 0`.
2. `scrapSavedOmr === scrapSavedKg * econ.materialOmrPerKg` (rounding consistent).
3. Orders of the same product but due **outside** the window → **no** suggestion.
4. All orders already large (≥ `MIN_ECONOMIC_RUN_KG`) → **no** suggestion (nothing sub-economic to batch).
5. Merged order's `dueDay` = min of the group; if merging makes an order late beyond `maxAddedLateDays`, `feasible === false` (still returned).
6. Determinism: identical inputs → identical suggestion order.
7. Reconciliation: for a suggestion, `startupsSaved === ledgerBase.startups − computeStartupLedger(candidateSchedule,…).startups`.
8. Component: the Batching Advisor card renders a suggestion line with the estimated chip; Apply changes the rendered Startup Ledger startups count; an infeasible suggestion shows the "override" note.

## Acceptance criteria
- `suggestBatches` pure/deterministic/exported; numbers derive from `computeStartupLedger`; all assertions pass.
- Planner shows the Batching Advisor card with ranked save-vs-risk suggestions, estimated provenance, Apply-preview + Revert, discipline-with-override for infeasible ones.
- All tests green; `npm run build` clean (provenance gate + tsc + Vite); no new deps; no changes to engine behaviour, Scrap Focus, Delivery View, tariff, telemetry.
- Do **not** commit or push — leave for review.
