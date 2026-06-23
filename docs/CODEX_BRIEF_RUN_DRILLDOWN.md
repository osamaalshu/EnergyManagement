# Codex Brief — worked-example drill-down on the Fragility badge (Order Planner)

**Repo:** `energy-mgmt-redesign` · **Branch:** `feat/fragility-rules` (already checked out). Adds progressive disclosure: clicking a run's Fragility badge expands a **worked example** row showing *why it scored, what to do, and what it's worth*. **Presentational only** — reuses `runFragility(it)` (its `reasons[]` already carry per-driver `impact`, plus `actions[]`) and the detail row's `startup` kg. No engine change. Architect owns layout/copy; Codex implements + extends the component test.

## Why
The badge currently shows `{score} {band}` with a hover tooltip. A manager wants to *click* a Critical run and see the breakdown inline — the "drill on demand" layer under the overview. This makes each flagged run a self-explaining decision.

## File
`src/pages/ProductionPlannerPage/ProductionPlannerPage.tsx` — the per-run detail table (the `detail.rows.filter(...).map(({ it, scrap, reject, startup, kwh, omr, band }) => ...)` block, where `const fr = runFragility(it)` is already computed).

## Behaviour
1. Add toggle state near the other `useState`s: `const [openRun, setOpenRun] = useState<string | null>(null);`
2. Make the existing Fragility badge a **button** (keep its current look/classes). The row key is `it.machine + '-' + it.orderId` — use that as the id. On click: `setOpenRun(prev => prev === id ? null : id)`. Add `aria-expanded={openRun === id}` and a tiny ▸/▾ caret before the score so it reads as expandable. Keep the existing hover `title` tooltip.
3. When `openRun === id`, render an **expanded detail row** immediately after the run's `<tr>` — a second `<tr>` whose single `<td colSpan={<the table's column count>}>` holds the worked example. (Count the `<th>`s in the header and use that colSpan so it spans the full width.) Give it a subtle background (e.g. `bg-slate-50/70 dark:bg-white/5`).

## Worked-example content (inside the expanded row)
Use `fr = runFragility(it)` and `const runOmr = Math.round(startup * econ.materialOmrPerKg);` (startup = this run's startup-scrap kg from the row; `econ.materialOmrPerKg` is in scope).
- **Title:** `Why this run scored {fr.score} ({fr.band})` + the `estimatedChip`.
- **Score breakdown:** list `fr.reasons` that have `impact > 0` as rows of `+{impact} · {label} — {detail}` (the `reasons` array already has `{code,label,impact,detail}`). If the only reason is the `steady` one (impact 0), show `No transition or small-run penalty — steady continuation.`
- **What to do:** list `fr.actions` (`{label}`), each with a small priority tag (`act`/`review`/`info`) using existing token colours (rose/amber/slate).
- **What it's worth (money, emerald):** `This run's startup scrap ≈ {num(startup)} kg ≈ {num(runOmr)} OMR — avoidable by campaigning / extending the run.` Only show this line when `startup > 0`; otherwise show `No startup scrap attributed to this run.`
- One muted line: `Planning-stage estimate — see the Fragility & rules card above for the plan-level action.`

Match existing Tailwind tokens; emerald for the money line (as elsewhere on the page). No new colour system, no new deps. Leave the per-run badge column header and all other columns unchanged.

## Honesty contract
- `runOmr` reuses `startup` kg × `econ.materialOmrPerKg` (already an ESTIMATE) — keep `estimatedChip`/"≈" framing; never present as measured. No engine numbers change. Don't weaken `scripts/verify-provenance.mjs`.

## Tests Codex must extend
1. Component: clicking a run's Fragility badge reveals the worked-example row — assert it shows the `Why this run scored` title, at least one `+{impact}` breakdown line for a flagged run, an action label, and (for a run with startup scrap) the `OMR` money line. Clicking again collapses it (`aria-expanded` toggles / the worked-example text disappears).
2. The default (un-clicked) table still renders the badge column and does NOT show the worked-example text.
3. All existing tests still pass.

## Acceptance
- Clicking a Fragility badge expands an inline worked example (breakdown → actions → per-run OMR), collapses on re-click; keyboard/focus works (it's a real `<button>`). No engine change; values reused.
- Full suite green; `npm run build` clean (provenance gate + tsc + Vite); no new deps; only `ProductionPlannerPage.tsx` (+ its test) touched.
- Do **not** commit or push — leave for review.
