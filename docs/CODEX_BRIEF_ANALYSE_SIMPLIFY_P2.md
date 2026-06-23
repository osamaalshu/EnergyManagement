# Codex Brief — Analyse UX simplify, Pass 2: Delivery · Scrap Focus · Telemetry

**Repo:** `energy-mgmt-redesign` · **Branch:** `feat/fragility-rules`. Apply the **same Decide → Plan → Prove journey** (established on the Planner in Pass 1) to the other three Analyse pages, reusing the shared `DetailsDrawer` (`@/shared/DetailsDrawer`). **Move/reorder existing JSX + collapse deep analytics into the drawer — NO engine/logic/number changes.** Keep every measured/estimated label exactly. Architect owns the zoning; Codex implements + keeps tests green.

General rule per page: the **Decide** zone (the answer + the money + the action) stays visible at top; secondary tables stay in the middle (**Plan**); charts/deep evidence go inside ONE `<DetailsDrawer title="Details & evidence">` at the bottom (**Prove**). Don't delete content unless it's a literal duplicate; this pass is mostly *re-tiering*.

## 1. `src/pages/DeliveryViewPage/DeliveryViewPage.tsx`
- **DECIDE (top, visible):** the 3 KPI tiles (`Orders at risk`, `Worst lateness`, `Finish window P80`) + the **`Recommended changes`** cards (the action). Put Recommended changes directly under the KPI tiles so "what's wrong → what to do" is the first screen.
- **PLAN (middle):** the orders table (`Orders at risk` / `All orders` / search results) + its drill modal — unchanged.
- **PROVE (drawer):** move **`Finish window — current way vs this plan`** (the chart) inside `<DetailsDrawer>` at the bottom.

## 2. `src/pages/ScrapAnalyzerPage/ScrapAnalyzerPage.tsx`
- **DECIDE (top, visible):** the **`This week (measured)`** card block + the money KPI row (`Scrap / year`, `Recoverable`, `Plant-wide lever`) + the **mechanism headline** (`{startupDrivenPct}% of scrap is startup-driven` with its existing association caption) + **`Focus here first — biggest recoverable savings`** (the action list). Order them: measured-week → money KPIs → mechanism headline → Focus-here action.
- **PLAN (middle):** `Worst offenders` table + `This period's 5 worst startup-only runs` + their drill.
- **PROVE (drawer):** move into `<DetailsDrawer>`: **`Products that most generate startup-only runs`** table, the **`Where the scrap comes from (mechanism)`** deeper detail panel (keep the one-line headline up top in Decide; the expanded mechanism explainer goes in the drawer), and **`Energy intensity over time — kWh/kg by product`**.
- If any KPI/number is shown twice verbatim on this page, keep the Decide-zone instance and remove the duplicate.

## 3. `src/pages/PlantTelemetryPage/PlantTelemetryPage.tsx`
This page is monitor/evidence by nature → **Decide + Prove** (no Plan zone needed).
- **DECIDE (top, visible):** the KPI tiles (incl. the `Energy / unit (incl. cooling, est.)` total) + the **`Cooling — estimated (placeholder)`** card (it carries the actionable "meter this" story). Keep their estimated/simulated labels exactly.
- **PROVE (drawer):** move into `<DetailsDrawer>`: **`Power draw over the run`**, **`Energy by machine state`**, **`Validation — ideal vs realistic`**.

## Honesty / guardrails
- Pure re-tiering of existing JSX; no engine/number/logic changes; provenance gate (`scripts/verify-provenance.mjs`) untouched and not weakened. All MEASURED/ESTIMATED/SIMULATED chips and captions move with their content. No new deps.

## Tests Codex must update/write
For each page's existing component test:
1. Assert the **Decide-zone** content still renders at top (the KPI tiles / measured-week / mechanism headline / cooling card as applicable).
2. Assert the **Prove** content (the chart/table moved into the drawer — e.g. "Finish window", "Energy intensity over time", "Power draw over the run", "Validation") is **not visible until** the Details drawer is expanded, then visible after clicking it. (Use the same drawer-toggle assertion pattern as the Planner/DetailsDrawer tests.)
3. All existing tests still pass; `npm run build` clean.

## Acceptance
- Delivery, Scrap Focus, Telemetry each read Decide → (Plan) → Prove with deep analytics collapsed in a `DetailsDrawer`; no numbers changed; honesty labels intact.
- Full suite green; `npm run build` clean; only the 3 page files (+ their tests) touched.
- Do **not** commit or push — leave for review.
