# Codex Brief — make the "Fragility & rules" card action-first (money-led)

**Repo:** `energy-mgmt-redesign` · **Branch:** `feat/fragility-rules` (already checked out — this builds on the parked feature). **Presentational restructure only** — no engine/logic change, reuses values the page already computes. Architect owns the copy/layout; Codex implements + updates the component test.

## Why
Manager-facing risk tools should lead with the **decision and the money**, not the model artifact. Today the card leads with "Fragility & rules" + band counts. Reorder to the **risk → drivers → action → money** pattern so a plant manager sees *what to do and what it's worth* first; demote the score detail and the honesty notes to secondary/small print.

## File
`src/pages/ProductionPlannerPage/ProductionPlannerPage.tsx` — the existing "Fragility &amp; rules" card (the `<div className="card-surface p-5">` block added for `fragility`/`planRules`). Restructure that card only.

## Values to use (ALL already computed on the page — do NOT invent new math)
- `fragility` = `planRules(smart)` → `fragility.bandCounts.{critical,high,moderate,low}`, `fragility.violations[]`.
- `batchSuggestions` (line ~118, `BatchSuggestion[]`) → each has `startupsSaved`, `scrapSavedOmr`, `orderIds[]`, `family`. Derive:
  - `const nCampaigns = batchSuggestions.length;`
  - `const runsToGroup = batchSuggestions.reduce((a,s)=>a+s.orderIds.length,0);`
  - `const startupsSaved = batchSuggestions.reduce((a,s)=>a+s.startupsSaved,0);`
  - `const omrSaved = Math.round(batchSuggestions.reduce((a,s)=>a+s.scrapSavedOmr,0));`
- Reset-heavy / family-change / sub-economic counts come from `fragility.violations` (kinds `reset-heavy`, `family-change`, `sub-economic`) and `fragility.bandCounts`.

## New card layout (top → bottom)
1. **Headline verdict** (largest text, action framing — not "Fragility & rules"):
   - If `fragility.bandCounts.critical + fragility.bandCounts.high > 0` **or** a `reset-heavy` violation exists → **"This plan is reset-heavy."**
   - Else → **"This plan looks steady."**
   - Keep the small `estimatedChip` next to it.
2. **Drivers subline** (muted, one line): `{critical+high} high-risk runs · {familyChanges} family resets · {subEconomic} sub-economic runs` — pull `familyChanges` from the `family-change` violation `count` (0 if absent), `subEconomic` from the `sub-economic` violation `count` (0 if absent).
3. **Primary action + MONEY** (the prominent block — this is the manager's decision):
   - If `nCampaigns > 0`: action line **"Group {runsToGroup} runs into {nCampaigns} campaign(s)"** and a money line, visually emphasised (emerald, larger): **"Estimated avoidable scrap: ~{omrSaved} OMR this month"** with a secondary **"({startupsSaved} fewer startups)"**.
   - If `nCampaigns === 0`: **"Plan already grouped — no campaigns to merge."** (no money line).
4. **Rule details** (demoted, secondary): keep the existing `fragility.violations` list (message + action) but UNDER the action block, in the smaller/muted style already used. If no violations, keep the existing "No fragility rule violations on this plan." line.
5. **Small print** (smallest, muted — demote both existing notes here): the DEFERRED note (planning-data-only; colour/material-lot/soak deferred to sensors) and the ESTIMATE/confidence line, condensed. Add the structural-use point: *"Best used structurally — cut the number of startups, not tiny differences between neighbouring runs."*

Match the page's existing Tailwind tokens (emerald for money/savings as used at lines ~245/387, muted slate for secondary). No new colour system, no new deps. Keep the per-run Fragility badge column in the detail table unchanged.

## Honesty contract
- Money = sum of `scrapSavedOmr` from `batchSuggestions` (already an ESTIMATE from the Startup Ledger basis) — keep the `estimatedChip`/"est." framing; never present it as measured. Don't weaken `scripts/verify-provenance.mjs`. No engine numbers change.

## Tests Codex must update/write
1. Update the existing Planner component test that asserts the old card strings ("Fragility & rules" headline / band-summary text) to the new copy: assert the **verdict headline** ("This plan is reset-heavy" or "This plan looks steady" — whichever the fixture produces), the **money line** ("Estimated avoidable scrap" + an OMR number) when `batchSuggestions` is non-empty, and that the DEFERRED + ESTIMATE small print still render.
2. Keep/adjust the assertion that the per-run Fragility badge column still renders.
3. All existing tests still pass.

## Acceptance
- The card reads risk → drivers → action → money, top to bottom; money (OMR) is visible before the score detail. Violation list + honesty notes demoted. No engine change; values reused.
- Full suite green; `npm run build` clean (provenance gate + tsc + Vite); no new deps; only `ProductionPlannerPage.tsx` (+ its test) touched.
- Do **not** commit or push — leave for review.
