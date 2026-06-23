# Codex Brief — Analyse UX simplify, Pass 1: shared Details drawer + Planner journey

**Repo:** `energy-mgmt-redesign` · **Branch:** `feat/fragility-rules` (continue on it). Goal: turn the Planner from a 15-card analyst worksheet into a **manager journey: Decide → Plan → Prove**, and build the shared collapsible primitive the other 3 Analyse pages will reuse in Pass 2. **Reorder/move existing JSX + delete redundant duplicates — do NOT change any engine logic, numbers, or the fragility feature.** Architect owns the structure; Codex implements + keeps tests green.

## 1. New shared primitive — `src/shared/DetailsDrawer.tsx`
A collapsible "Details & evidence" section for progressive disclosure (default **collapsed**).
```tsx
import { useState, type FC, type ReactNode } from 'react';
export const DetailsDrawer: FC<{ title?: string; children: ReactNode; defaultOpen?: boolean }> = ({ title = 'Details & evidence', children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card-surface overflow-hidden p-0">
      <button type="button" aria-expanded={open} onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-5 py-3 text-left">
        <span className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</span>
        <span className="text-slate-400" aria-hidden="true">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="space-y-6 border-t border-slate-200/60 p-5 dark:border-white/10">{children}</div>}
    </div>
  );
};
export default DetailsDrawer;
```

## 2. Restructure `src/pages/ProductionPlannerPage/ProductionPlannerPage.tsx` into 3 zones
Keep the header + ScenarioBanner at top. Then reorder the EXISTING blocks into this order (move JSX; don't rewrite the inner content except the small deletions noted):

**ZONE 1 — DECIDE (hero, first thing after header):**
- Move the **"Fragility & rules" action card** (the `This plan is reset-heavy.` card) to here — it leads the page.
- Move the **strategy toggle** (`Save resin / Protect dates / Expedite` buttons + the params row) directly beneath it, so changing strategy visibly moves the card's numbers.
- **DELETE these two now-redundant blocks** (their facts already live in the action card's drivers): (a) the `This plan creates {ledger.startups} startups …` headline sentence; (b) the entire `This plan (estimated)` PlanKpi row (the 4 PlanKpi tiles). The `PlanKpi` component may become unused — if so, remove it too.

**ZONE 2 — PLAN (the sequence):**
- The **Schedule — grouped by family** strip.
- The **Run-by-run detail** table — **simplify its columns** to the decision set: `# · Product · Qty · Run h · Fragility · Scrap kg · Finish d · When`. **Move the three energy columns (`Energy kWh`, `kWh/kg`, `Energy OMR`) out of this table** (they remain available in the drill-down row and the Prove drawer). Keep the per-run Fragility badge + its click-to-expand worked example exactly as-is. Update `RUN_DETAIL_COLUMN_COUNT` to the new column total.
- The **Order book** editor.
- The **Batching Advisor** card (this is the "apply campaigns" action surface).

**ZONE 3 — PROVE (wrap in one `<DetailsDrawer>`, collapsed):**
Move all of these *inside* a single `<DetailsDrawer title="Details & evidence">` at the bottom: **Startup Ledger**, **Expected scrap — from this plan's run-time & changeovers**, **Time-of-use lever**, **Biggest levers — what cuts your finish date most**, **When will it finish? (Monte-Carlo)**, **Energy intensity — kWh per kg by product**. They keep their existing markup; they're just now behind the drawer.

## Honesty / guardrails
- No engine/number/logic change; this is pure JSX reorganization + deleting duplicate displays. The fragility module, scheduleOrders, ledger, Monte-Carlo, provenance gate — untouched. Keep all `estimatedChip`/"est." labels on whatever moves.
- Don't weaken `scripts/verify-provenance.mjs`. No new deps.

## Tests Codex must update/write
1. New: `DetailsDrawer` renders its title, hides children by default, reveals on click (`aria-expanded` toggles), respects `defaultOpen`.
2. Planner component test: the action card verdict + money line now render **near the top** (still present); the deleted `This plan creates … startups` sentence and the `This plan (estimated)` PlanKpi row are **gone**; the Prove content (e.g. "Startup Ledger", "When will it finish") is **not visible until** the Details drawer is expanded, then visible after clicking it. The simplified run table no longer has the `kWh/kg` column header but still has `Fragility`, `Scrap kg`, `Finish d`. Keep the existing fragility drill-down test passing (adjust queries if column count changed).
3. All other tests still pass; `npm run build` clean.

## Acceptance
- Planner reads Decide → Plan → Prove; deep analytics collapsed in `DetailsDrawer`; redundant startup/ledger duplicates removed; run table trimmed to decision columns; fragility feature intact.
- Full suite green; `npm run build` clean; only `ProductionPlannerPage.tsx`, new `src/shared/DetailsDrawer.tsx` (+ tests) touched.
- Do **not** commit or push — leave for review.
