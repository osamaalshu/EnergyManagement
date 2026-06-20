# Codex Brief — P1: measured weekly KPIs + floor-walk (wire `startupKpis.json`)

**Repo:** `energy-mgmt-redesign` · **Branch:** `feat/p1-startup-kpis` (off P0). **Builds on P0** (`computeStartupLedger`, the "This plan (estimated)" strip). Architect (Claude) wrote this; Codex implements + writes/extends tests + runs them.

**Why:** P0 surfaced startup metrics for a *proposed plan* (estimated). P1 adds the **measured** historical reality from real run episodes, so the manager sees both "what I'm planning" and "what's been happening." The data already exists at `src/data/startupKpis.json` (generated from the cleaned ERP via `al-hilal-mc01-analysis/scripts/export_startup_kpis.py`; provenance = **measured (ERP run episodes)**, window 2025–2026).

## Data contract — `src/data/startupKpis.json` (already present)
```ts
interface StartupKpis {
  meta: { generated: string; window: [string, string]; minEconomicRunKg: number;
          coldStartGapDays: number; materialOmrPerKg: number; provenance: string; source: string };
  summary: { totalRuns: number; startups: number; coldStarts: number; subEconomicRuns: number;
             subEconomicPct: number; scrapPerStartupKg: number; totalScrapKg: number; totalScrapOmr: number };
  weekly: { week: string; startups: number; coldStarts: number; subEconomicRuns: number;
            subEconomicPct: number; scrapPerStartupKg: number; totalScrapKg: number }[];
  worstStartupRuns: { product: string; startDate: string; runKg: number; scrapKg: number; coldStart: boolean }[];
}
```
Add this interface to a small typed loader (e.g. `src/lib/startupKpis.ts`) that imports the JSON and exports it typed. Do **not** recompute anything — this is the measured source of truth.

## Scope

**IN (P1):**
1. **Typed loader** for `startupKpis.json` (`src/lib/startupKpis.ts`).
2. **"This week (measured)" panel** on the **Scrap Focus** page (`src/components/ScrapAnalyzerPage.tsx`): the 4 north-star KPIs from `summary` (or the latest `weekly` entry) — **startups, cold-starts (REAL, not proxy), % sub-economic runs, scrap per startup** — plus a small weekly **sparkline/trend** from `weekly`. Labelled **MEASURED** (distinct provenance styling from P0's amber "estimated").
3. **Floor-walk card** on the same page: **"This period's 5 worst startup-only runs"** from `worstStartupRuns` (product, date, run kg, scrap kg, cold-start badge).
4. A one-line provenance footer citing `meta.provenance`, `meta.window`, and `meta.source`.

**OUT (do not build):** the mechanism-first Pareto rebuild (later P1.b); Batching Advisor; any Planner engine change; any change to the P0 "This plan (estimated)" strip; telemetry; tariff engine.

## Honesty contract (critical)
- This panel is **measured** — style it clearly differently from P0's amber "estimated" chips (e.g. an emerald/green "measured" chip). The two must be visually unmistakable on the same workspace.
- **Cold-starts here are REAL** (idle-gap ≥ `coldStartGapDays`), so label them "cold-starts" *without* the word "proxy" (unlike the Planner's family-change proxy). Make the distinction explicit in a tooltip.
- Do not weaken `scripts/verify-provenance.mjs`; the new measured panel must pass it.

## Tests Codex must write/extend
1. Loader returns a well-formed `StartupKpis` (summary numeric, `weekly.length > 0`, `worstStartupRuns.length <= 5`).
2. `subEconomicPct` in `summary` is within [0,1]; `scrapPerStartupKg >= 0`.
3. Component (Scrap Focus): the "This week (measured)" panel renders the 4 KPIs and a **MEASURED** chip; the floor-walk lists the runs from `worstStartupRuns`; a cold-start run shows the cold-start badge.
4. Provenance: the measured panel uses measured styling and is not labelled "estimated"; build-time provenance gate passes.

## Acceptance criteria
- Typed loader exists; no recomputation of KPI values in the UI (pure display of the JSON).
- Scrap Focus shows a measured weekly KPI panel + weekly trend + floor-walk; all from `startupKpis.json`.
- Measured vs the P0 estimated strip are visually distinct; cold-start labelled real (no "proxy").
- All tests green; `npm run build` clean (provenance gate + tsc + Vite); no new deps; no engine/tariff changes.
- Do **not** commit or push — leave for review.
