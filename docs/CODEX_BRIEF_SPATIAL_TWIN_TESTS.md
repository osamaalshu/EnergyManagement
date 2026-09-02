# Codex brief — tests for the spatial twin (`src/features/spatial-twin/`)

**Role:** you write the tests. You do not change the implementation. If a test you believe is
correct fails, stop and report the failing output with your reading of which side is wrong.

**Read first:** `docs/ADR_SPATIAL_TWIN.md` §4, §7, §8. Then `src/features/spatial-twin/model.ts`,
`generate.ts`, `bind.ts`, `layout.ts`, `paint.ts`, `presets.ts`.

**Runner:** Vitest (`npx vitest run`). Pure-logic tests go in
`src/features/spatial-twin/__tests__/*.test.ts` and must run under the `node` environment —
add a `environmentMatchGlobs` entry for `src/features/spatial-twin/**` → `node` in
`vitest.config.ts` (that is the one config file you may touch). The reference dataset is
`src/data/generated/pvBessData.json` (import it, do not fabricate it).

## Scope in

### `generate.test.ts`
1. **Determinism:** `generateGraph(cfg)` called twice yields deep-equal graphs for each preset.
2. **Uniqueness and order:** every id in `order` is unique; `order` is a valid pre-order
   (each node appears after its parent); `nodes[parent].childIds` includes the child.
3. **Counts:** for each preset, `counts` equals the arithmetic of the config
   (strings = arrays × inverters × mppt × stringsPerMppt, modules = strings × modulesPerString,
   racks = containers × racksPerContainer, cells = racks × modulesPerRack × cellsPerModule).
4. **Nameplate arithmetic:** plant `dcKw` equals modules × moduleWp ÷ 1000 within 0.01;
   each array's `dcKw` sums to the plant's; each inverter's `acKw` equals `inverterAcKw`.
5. **No overlapping strings within an array** (rectangle intersection test over every pair
   of string footprints in `A1`, for each preset). No overlapping racks within `C1`.
6. **Footprints stay inside their parent block:** every string and inverter footprint lies
   inside its array's footprint; every rack inside its container; everything inside `extent`.
7. **Validation:** `validateConfig` rejects `tracking: 'single_axis'` with a message that
   names single-axis; rejects `arrays: 0`, `arrays: 1.5`, `modulesPerString: 3`, `gcr: 0.9`,
   an empty `name`; accepts all three presets with `[]`. `generateGraph` throws on an invalid
   config.
8. **Modules and cells are counts, not nodes:** no node has `level` outside the `Level`
   union; there is no node whose id ends in a module or cell suffix; `standsFor.modules` on a
   string equals `modulesPerString`.
9. **platformRef** exists exactly on plant, inverter, bess and rack nodes, and on no other level.
10. **Performance guard:** generating the configurator maximum
    (arrays 16, invertersPerArray 24, mpptPerInverter 12, stringsPerMppt 8, modulesPerString 36,
    other fields from the utility preset, no battery) completes in under 500 ms on the test
    runner (generous ceiling; the point is to catch an accidental O(n²)).

### `bind.test.ts`
11. **Empty state:** every node is `no_data` / `UNAVAILABLE`; every node has its nameplate
    metrics with provenance `DERIVED`; `PV` carries exactly one `ESTIMATED` metric and its
    `basis` contains the reference site's location and year from the JSON.
12. **Attach — measured only where the record sits:** with the reference preset (7 inverters)
    all 7 inverters are `MEASURED`; **no string, MPPT, array or plant node is ever `MEASURED`**
    (assert over the whole graph); every string under a measured inverter is `DERIVED` with
    `statusSourceId` equal to that inverter's id; arrays and the plant are `DERIVED` with a
    basis that starts with "Worst of".
13. **Attach — partial coverage:** with the utility preset (96 inverters) exactly 7 are
    `MEASURED`; inverters 8..96 are `no_data` / `UNAVAILABLE`; their strings are
    `UNAVAILABLE`; array `A1` (12 inverters, 7 measured) is `DERIVED` and its basis says
    "7 of 12"; `A2` is `UNAVAILABLE`.
14. **Attach — attention threshold:** monkey-patch a copy of the JSON so one inverter's
    `mediumFlags / rows` exceeds `INVERTER_FLAG_SHARE_ATTENTION`; that inverter is
    `attention`, its strings inherit `attention`, its array and the plant are `attention`.
    Unpatched data: every measured inverter is `ok` (state this expectation from the real
    numbers: all seven are around 1 % flagged).
15. **Scenario is SIMULATED and never merges:** `applyScenario` on a string makes the string
    `SIMULATED` / `attention`; the input snapshot is unchanged (deep-equal before/after);
    its parent MPPT, when the inverter above is measured, stays `DERIVED` (carried from the
    measurement — see ADR §7); the inverter stays `MEASURED`.
16. **Scenario propagates when nothing measured blocks it:** on the empty state, an
    `inverter_offline` scenario makes the inverter, its MPPTs and strings, its array and the
    plant all `SIMULATED` / `attention`. `aggregateProvenance` returns `SIMULATED` whenever any
    input is `SIMULATED`, `ESTIMATED` if any is estimated and none simulated, `DERIVED` for
    measured-only inputs, and `UNAVAILABLE` only when every input is unavailable.
17. **Scenario level guard:** `applyScenario` with `string_open_circuit` targeted at an
    inverter throws; `rack_hot` targeted at a rack on the rooftop preset works.
18. **Idempotence:** calling `propagate` twice with the same `own` set yields the same snapshot.
19. **`nodeCertainty`:** `UNAVAILABLE` status with only `DERIVED` metrics → `DERIVED`; a
    `MEASURED` status → `MEASURED`.

### `layout.test.ts`
20. Collapsed root yields one node with `hiddenDescendants` = total descendants; expanding
    the root yields root + its children; every edge's `from`/`to` exist in `nodes`; no two
    nodes at the same depth overlap vertically; parent `y` sits between its first and last
    visible child; `expandTo` adds every ancestor of the target and the target.

### `paint.test.ts`
21. `paintFor` returns a solid colour for `MEASURED`, a `url(#…)` for `DERIVED`, `ESTIMATED`,
    `SIMULATED`, and the empty fill for `UNAVAILABLE` and for `no_data` under the status
    overlay; the certainty overlay uses the navy colour key regardless of status; only
    `SIMULATED` gets a dash array.

### `TwinPage.smoke.test.tsx` (jsdom)
22. Renders `TwinPage` with the default preset; the heading "Digital twin" and the legend's
    five labels are present; clicking "Array 1 (A1)" shows the detail panel with id `A1`;
    selecting "Ground-mount plant" updates the Strings stat to 2,304.

## Scope out
- Do not change any file under `src/features/spatial-twin/` or `src/pages/TwinPage/`.
- No snapshot tests of SVG markup.
- No browser-performance claims; the plant-level LOD gap is documented in the ADR.

## What "done" looks like
`npx vitest run` green with the new files; `npm run build` green; a one-paragraph report per
test file saying which assertion you expect to be the most likely to catch a real regression.

## GROUND TRUTH (verified, not assumed)
- artifact:  src/features/spatial-twin/{model,generate,bind,layout,paint,presets}.ts @ working tree on branch feat/spatial-twin (base 9d87649) — uncommitted, listed by `git status --short` as untracked; the propose worktree carries the uncommitted delta.
- purpose:   test
- consumes:  (imports of this feature across src, from grep) 3 from '@/features/spatial-twin/bind';4 from '@/features/spatial-twin/generate';2 from '@/features/spatial-twin/layout';5 from '@/features/spatial-twin/model';4 from '@/features/spatial-twin/paint';2 from '@/features/spatial-twin/presets';
- callers:   src/pages/TwinPage/PhysicalMap.tsx src/pages/TwinPage/ElectricalTree.tsx src/pages/TwinPage/DetailPanel.tsx src/pages/TwinPage/Configurator.tsx src/pages/TwinPage/TwinPage.tsx src/pages/TwinPage/fills.tsx 
- falsifier: the sanity run in docs/ADR_SPATIAL_TWIN.md §8 (vite-node, 2026-09-02) reported 0 measured strings and 42 derived strings after attach on the reference preset, and 0 overlaps among A1 strings; a test asserting the opposite must fail. If test 12 passes while a string is MEASURED, the test is wrong, not the code.
