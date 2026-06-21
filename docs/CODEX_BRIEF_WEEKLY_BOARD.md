# Codex Brief — "The Week" board on the Analyse Hub

**Repo:** `energy-mgmt-redesign` (current `main`). **Branch:** `feat/weekly-board`. Builds on merged Analyse v2 (Startup Ledger, measured KPIs, Batching Advisor, mechanism Pareto). Architect (Claude) owns the design + logic spec; Codex implements + writes tests. Follow the design exactly — this is a designed signature element, not a generic KPI card.

**Why:** The plant manager needs a ~30-second weekly board as the entry to Analyse: *how many startups are we choosing this week, what do they cost, and the one move to cut them?* It makes the validated startup-scrap mechanism the operating language of the workspace.

## Where
Add a single **"The Week" board** at the **top of `src/pages/AnalyseHubPage/AnalyseHubPage.tsx`**, above the existing decision cards. The Hub already imports `productionData`, `scheduleOrders`, `monteCarloOrders`, and builds the pilot `orders`/`products`/`line`/`econ` — reuse them. Add imports: `startupKpis` from `@/features/production-planning/startupKpis` and `suggestBatches` from `@/features/production-planning/batchingAdvisor`.

## Data wiring
- **Measured KPIs** (from `startupKpis`): use the latest weekly entry `startupKpis.weekly.at(-1)` (fallback to `startupKpis.summary`). Show: `startups`, `coldStarts`, `scrapPerStartupKg` (kg), `subEconomicPct` (as %). Label the board "measured · week {weekly.at(-1).week}".
- **The one move** (scenario): `const suggestions = suggestBatches(orders, products, line, econ, HOURS_PER_DAY);` take `suggestions[0]`. Show its `orderIds.length`, `family`/product name, `startupsSaved`, `scrapSavedKg`, `scrapSavedOmr`, `otifBefore`→`otifAfter`. If `suggestions` is empty → empty state copy (below).

## Layout & design (follow precisely)
One elevated board surface (`card-surface` + a thin teal top accent rule; slightly more prominent than the decision cards). Three stacked zones:

**Zone 1 — the ignition tally (signature, measured).**
- Label: "This week's startups".
- Render the week's startups as **N discrete ignition marks** where N = the startups count: warm-starts are amber ticks, the first `coldStarts` of them are **cold** (frost-blue tick + a small ❄). Marks are small vertical bars/ticks in a horizontal row that wraps. Show the numeric count beside the tally.
- The mark count MUST equal the KPI (data, not decoration). Cap the rendered marks at a sane max (e.g. 40) with a "+more" if exceeded, but the number always shows the true count.
- Accessibility: wrap the marks in an element with `aria-label="{startups} startups, {coldStarts} cold-starts"` and mark the individual glyphs `aria-hidden`. No looping animation; at most a single reduced-motion-respecting fade-in (skip entirely under `prefers-reduced-motion`).

**Zone 2 — four measured KPI tiles** (emerald MEASURED chip on the zone): Startups · Cold-starts · Scrap / startup (kg) · Sub-economic runs (%). Numbers in the mono/tabular face. Quiet styling — the tally is the hero, the tiles are calm.

**Zone 3 — "The one move" (scenario).** A divider labeled "The one move" with a **scenario** chip (slate/amber, visually distinct from the measured emerald above — this is the evidence-tier separation that must be unmistakable). One sentence + a CTA button:
- Copy: `Batch {n} {family} orders → cut {startupsSaved} startups · ~{scrapSavedKg} kg ({scrapSavedOmr} OMR) startup scrap · OTIF {otifBefore%}→{otifAfter%}`.
- Button: **"Open in Planner →"** wired to the existing navigation the decision cards use (route to the Planner).
- Empty state (no suggestion): "No same-product orders small enough to batch this week."

Brand: respect the navy/teal Enerlytics system; full dark-mode support; visible keyboard focus on the CTA; responsive down to mobile (tiles stack, tally wraps).

## Honesty contract
- Zone 1 + Zone 2 are **measured** (emerald). Zone 3 is **scenario** (slate/amber) — never style the scenario action like the measured KPIs. The two tiers must be instantly distinguishable. Do not weaken `scripts/verify-provenance.mjs`.

## Copy rules
Manager-facing, plain, sentence case. Active voice on the button ("Open in Planner"). No jargon ("Sub-economic runs", not "below-MOQ").

## Tests Codex must write (`src/pages/AnalyseHubPage/__tests__/` — extend or add)
1. The board renders the four measured KPI values from `startupKpis.weekly.at(-1)` (or summary), with a MEASURED chip and the week label.
2. The ignition tally's accessible label reports the correct startups + cold-starts counts (matches the KPI).
3. "The one move" renders the top `suggestBatches` suggestion (family, startups cut, OMR) with a scenario chip — or the empty-state copy when there is no suggestion.
4. The board's measured zone does not carry the word "scenario", and the one-move zone does not carry "measured" (evidence-tier separation).
5. Existing Hub tests still pass.

## Acceptance criteria
- "The Week" board sits atop the Hub; measured tally + 4 KPIs (real data) clearly separated from the scenario one-move; CTA routes to Planner.
- All tests green; `npm run build` clean (provenance gate + tsc + Vite); no new deps; only AnalyseHubPage (+ its test) changed.
- Do **not** commit or push — leave for review.
