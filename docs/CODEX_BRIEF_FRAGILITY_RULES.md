# Codex Brief — Run Fragility score + plan Rules layer (Order Planner)

**Repo:** `energy-mgmt-redesign` · **Branch:** `feat/fragility-rules`. Adds the software embodiment of the memo's **"Startup & Transition Fragility System"**: a per-run **fragility score (0–100) with reasons**, and a plan-level **rules/violations summary** with recommended actions, both on the Order Planner. **No engine behaviour change** — it reads existing `OrderItem` fields. Architect owns the scoring logic (below, implement exactly); Codex implements + writes tests.

## Why
The detail table already shows startup ✓, exception ✓, setup type, and scrap heat as *separate* facts. The planner can't see, at a glance, **which runs are fragile and why, before running them**, nor **what to do about it**. This converts diagnosis → pre-flight checklist. The score uses only ERP-derivable signals; colour-change severity, material-lot change, and machine soak state are **not in the planning data** → explicitly labelled *deferred to sensors / changeover log*. Honesty contract holds: weights are an ESTIMATE (grounded in measured deltas), the model is association not proven cause.

## 1. New pure module — `src/features/production-planning/fragility.ts`
```ts
// Run Fragility — ERP-derivable pre-flight risk for a planned run. ESTIMATE.
// Weights are grounded in MEASURED scrap deltas (first-day ~3×, cold-start 3.87 vs 2.31%,
// small/sub-economic runs ~4×) but the score itself is an association heuristic, not a proven cause.
// Colour-change severity, material-lot change and machine soak state are NOT in planning data
// (they sharpen this once line sensors / the changeover log land) — see DEFERRED note in the UI.
import type { OrderItem, OrderSchedule } from './productionModel';

export type FragilityBand = 'steady' | 'watch' | 'fragile';
export interface RunFragility { score: number; band: FragilityBand; reasons: string[]; }

export function runFragility(it: OrderItem): RunFragility {
  let score = 0; const reasons: string[] = [];
  if (it.setupType === 'family')   { score += 45; reasons.push('Family change — recipe/colour swap; first run of a campaign scraps ~3× (measured)'); }
  else if (it.setupType === 'diameter') { score += 20; reasons.push('Diameter change — die/calibrator swap before this run'); }
  if (it.seq === 1)                { score += 25; reasons.push('Cold start — line warming from idle scraps more (measured 3.87% vs 2.31%)'); }
  if (it.isSubEconomic)            { score += 20; reasons.push('Sub-economic run (below min economic kg) — small runs scrap ~4× (part job-mix)'); }
  if (score > 100) score = 100;
  const band: FragilityBand = score >= 50 ? 'fragile' : score >= 25 ? 'watch' : 'steady';
  if (reasons.length === 0) reasons.push('Steady continuation — no transition or small-run penalty');
  return { score, band, reasons };
}

export interface PlanViolation { kind: 'family-change' | 'sub-economic' | 'fragile-run'; count: number; message: string; action: string; }
export interface PlanRules { fragileRuns: number; watchRuns: number; violations: PlanViolation[]; }

export function planRules(s: OrderSchedule): PlanRules {
  const runs = s.items.map(runFragility);
  const fragileRuns = runs.filter(r => r.band === 'fragile').length;
  const watchRuns   = runs.filter(r => r.band === 'watch').length;
  const subEcon     = s.items.filter(i => i.isSubEconomic).length;
  const violations: PlanViolation[] = [];
  if (s.familyChanges > 0) violations.push({ kind: 'family-change', count: s.familyChanges,
    message: `${s.familyChanges} family change${s.familyChanges === 1 ? '' : 's'} — each is a full recipe/colour reset`,
    action: 'Group same-family runs into one campaign to cut resets' });
  if (subEcon > 0) violations.push({ kind: 'sub-economic', count: subEcon,
    message: `${subEcon} sub-economic run${subEcon === 1 ? '' : 's'} below the min economic batch`,
    action: 'Merge with another order of the same product or extend the run' });
  if (fragileRuns > 0) violations.push({ kind: 'fragile-run', count: fragileRuns,
    message: `${fragileRuns} fragile run${fragileRuns === 1 ? '' : 's'} (score ≥ 50)`,
    action: 'Re-sequence so transitions cluster; protect first-run with standardised startup' });
  return { fragileRuns, watchRuns, violations };
}
```
(Use the repo's existing `round` if needed; no new deps.)

## 2. Wire into the Order Planner — `src/pages/ProductionPlannerPage/ProductionPlannerPage.tsx`
**Detail (schedule) table** (the per-run table near line 516, the one with seq / name / startup / exception / setup / scrap):
- Add a **"Fragility"** column. For each `it`, compute `const fr = runFragility(it)` and render a small badge: the **score** + band colour (`fragile`→rose, `watch`→amber, `steady`→emerald/slate), with the **reasons joined** as the `title` tooltip. Keep it compact (consistent with the existing badge style on that row, e.g. the `exception` chip).
- Do **not** remove or change any existing column or number.

**One summary card** above the detail table (or beside the existing schedule KPIs) — **"Fragility & rules"**:
- Headline counts: `{fragileRuns} fragile · {watchRuns} watch` runs (from `planRules(smart)` — reuse whatever the schedule variable is called on that page).
- List the **violations**: each `message` with its `action` (muted, secondary line). Use the existing card/list styling.
- A muted **DEFERRED note**: *"Score uses planning data only (transition type, cold start, run size). Colour-change severity, material-lot change and machine soak state aren't in the schedule yet — they sharpen this once line sensors / the changeover log land."*
- A muted **provenance line**: *"Fragility is an ESTIMATE — weights grounded in measured scrap deltas; association, not proven cause."*

Match the page's existing Tailwind/token style (FAMILY_BG, the amber/rose/emerald usage already on the page). No new colour system.

## Honesty contract (critical)
- No engine number changes — `fragility.ts` is read-only over `OrderItem`/`OrderSchedule`.
- The fragility card/badge carry the **ESTIMATE** framing; never style as measured/proven. Keep the **DEFERRED** note so absent sensor features are explicit.
- Do **not** weaken `scripts/verify-provenance.mjs`. No new nav item, no rename of existing nav.

## Tests Codex must write
1. `runFragility`: a continuation run (`setupType:'none', seq:2, isSubEconomic:false`) → `score:0, band:'steady'`, the steady reason. A family-change cold-start sub-economic run (`setupType:'family', seq:1, isSubEconomic:true`) → `score:90, band:'fragile'`, 3 reasons. A diameter-only mid-sequence run → `score:20, band:'steady'`. Score caps at 100 (construct a case and assert ≤100).
2. `planRules`: on a fixture schedule (build a minimal `OrderSchedule` with a couple of `items` + `familyChanges`), assert `fragileRuns`/`watchRuns` counts and that violations include `family-change` and `sub-economic` with correct `count` and a non-empty `action`. Empty/clean schedule → no violations, `fragileRuns:0`.
3. Component: the Planner renders the Fragility column badge and the "Fragility & rules" card incl. the DEFERRED note and the ESTIMATE provenance line.
4. All existing tests still pass.

## Acceptance
- Pure `fragility.ts` + Planner wiring only (+ tests). Per-run fragility badge with reasons; plan-level rules card with actions + the DEFERRED/ESTIMATE notes.
- Full suite green; `npm run build` clean (provenance gate + tsc + Vite); no new deps; only `fragility.ts` + `ProductionPlannerPage.tsx` (+ test files) touched.
- Do **not** commit or push — leave for review.
