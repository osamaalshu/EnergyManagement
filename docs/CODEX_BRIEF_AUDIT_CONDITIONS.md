# Codex Brief — action the build-loop audit conditions

**Repo:** `energy-mgmt-redesign` · **Branch:** `feat/audit-conditions`. Three small, honesty-driven fixes from the manager-gate verdict. **No behaviour change to the engine** (same numeric values, just single-sourced). Architect spec; Codex implements + tests.

## 1. Centralise the changeover defaults (single source of truth)
`src/features/production-planning/productionModel.ts` already exports `SETUP_FAMILY_H = 3.0` and `SETUP_DIAMETER_H = 0.5`, but the **scrap-per-changeover `10`** is a magic number repeated across pages.
- **Add:** `export const STARTUP_SCRAP_KG_PER_CHANGEOVER = 10;` (estimate; the changeover log will make it measured).
- **Delivery View** (`src/pages/DeliveryViewPage/DeliveryViewPage.tsx`, the `scheduleOrders(orders, products, 30, m, line, econ, h, 3, 0.5, 10, mode)` call): replace the literals `3, 0.5, 10` with `SETUP_FAMILY_H, SETUP_DIAMETER_H, STARTUP_SCRAP_KG_PER_CHANGEOVER` (import them). This removes the silent inconsistency with the Planner.
- **Order Planner** (`ProductionPlannerPage.tsx`): seed the editable defaults from the constants — `useState(SETUP_FAMILY_H)`, `useState(SETUP_DIAMETER_H)`, `useState(STARTUP_SCRAP_KG_PER_CHANGEOVER)` instead of the literals `3 / 0.5 / 10`. (Keep them editable; just stop hardcoding the default in two places.)

## 2. Telemetry honesty caption — kWh/kg is machine-direct only
`src/pages/PlantTelemetryPage/PlantTelemetryPage.tsx`, near the `'Energy / unit'` KPI: add a short caption: **"machine-direct power only — cooling/chiller not yet included (see energy roadmap)."** So the simulated kWh/unit is never read as a true total.

## 3. Scrap Focus honesty caption — association + job-mix
`src/pages/ScrapAnalyzerPage/ScrapAnalyzerPage.tsx`, under the **"{startupDrivenPct}% of scrap is startup-driven"** headline: add a small caption: **"association (run-episode classification), not proven cause; part of the small-run penalty is product/job mix, not startup alone."** (One line, muted.)

## Honesty contract
These are honesty/consistency fixes — they must not change any number, only single-source the defaults and add the two captions. Do not weaken `scripts/verify-provenance.mjs`.

## Tests Codex must write/extend
1. `STARTUP_SCRAP_KG_PER_CHANGEOVER === 10`; `SETUP_FAMILY_H === 3`; `SETUP_DIAMETER_H === 0.5`.
2. Delivery View's schedule call produces **identical** results to before (regression: the constants equal the old literals — a schedule on a fixture is unchanged).
3. Source guard: `DeliveryViewPage.tsx` no longer contains the literal sequence `3, 0.5, 10` in the `scheduleOrders` call (uses the named constants).
4. Component: Telemetry renders the "machine-direct… cooling not yet included" caption; Scrap Focus renders the "association… product/job mix" caption.
5. All existing tests still pass.

## Acceptance
- One source of truth for changeover defaults; Delivery == Planner defaults. Two honesty captions live. No number changed.
- Full suite green; `npm run build` clean (provenance gate + tsc + Vite); no new deps; only the 5 named files touched.
- Do **not** commit or push — leave for review.
