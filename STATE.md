# STATE — energy-mgmt (dashboard) · branch `feat/spatial-twin`

Where we are. The standing spec is `docs/ADR_SPATIAL_TWIN.md` (this feature) and
`docs/ANALYSE_PRD.md` (Analyse). Read both at the start of a session.

## Last run — 2026-09-03 · Spatial twin built, awaiting tests + founder review

Founder asked for "a digital twin for investors and clients: they give the number of arrays and
how they are configured, we give them the twin", with a PM brief (Block 8) and a mandate to
challenge it. Investigated the repo, the platform repo, and the three reference repos
(Starlink Viz MIT, PV Sim GE MIT/Gradio, PV Layout Designer proprietary). Decision and reasons in
`docs/ADR_SPATIAL_TWIN.md`. Headlines: **not Block 8, not 3-D, not from Hugging Face** — a
config-driven asset graph + provenance-bound state + two SVG views + detail panel, zero new
dependencies, ~900 lines TS.

Built: `src/features/spatial-twin/{model,generate,bind,layout,paint,presets}.ts`,
`src/pages/TwinPage/*`, route `'twin'` in App/Sidebar/TopBar, "Open the digital twin →" button on
the Solar + storage page, CSS tokens `--twin-*` in `index.css`.

**Gate said:** `tsc -b` clean · eslint clean · `npm run build` (provenance gate + tsc + vite) green
· vitest 68/68 (pre-existing; new tests pending) · vite-node sanity run: determinism, unique ids,
0 overlaps, attach → 0 MEASURED strings / all DERIVED with source, scenario SIMULATED and base
untouched, max config 41,873 nodes in 26 ms generate + 30 ms bind. Screenshots (light, dark,
array focus, connections, attached + scenario) reviewed; map aspect ratio and DERIVED wording
fixed after the review.

**Tests landed:** Codex proposal 20260903-000324 applied (53 tests, 6 files, tests only); suite
121/121. My mutation checks: MEASURED carried downward → 2 fail; rows−1 → 3 fail.
**Verifier (separate model, read-only): PASS** on vitest 121/121, build exit 0, eslint 0, an
independent vite-node provenance sweep (2,958 nodes, 20 MEASURED, 0 below inverter), and its own
mutation kill (2 tests) with a hash-identical restore.
**Unverified:** browser rendering at the configurator maximum (36,864 strings) — plant-level LOD
not yet wired (ADR §8).

## In progress
- `feat/spatial-twin` → committed locally (review findings applied), NOT pushed. PR to
  `osamaalshu/EnergyManagement` main on founder's word.

## Done
- (this session) everything under "Last run", committed locally on `feat/spatial-twin`.

## Escalated — founder decisions
1. **Ship the twin as a page on the Solar + storage site (current) or promote it to the
   Overview page?** The ask said "main page demo"; it is reachable in two clicks from the
   sidebar today. One number: it adds 0 KB of dependencies, so placement is a product call only.
2. **Hierarchy depth** (still open from pv_bess_domain_spec): string/MPPT nodes have no platform
   UUID until this is decided. `platformRef` is the seam.
3. A simulated fault under a measured inverter stops at that inverter (ADR §7, amended after
   review so it does show on the MPPT between). A visitor may still expect the plant total to
   move. Keep, or add a "what if the record agreed" mode?

## Lessons
- The Playwright MCP screenshot tool times out at 5 s on this page; the sibling worktree's
  `node_modules/playwright` driven from a node script works. Script in the session scratchpad.
- `codex-propose.sh` refuses a brief without a `## GROUND TRUTH` section with `- key: value`
  lines. Write it first, from grep, not from memory.
- zsh treats `==X==` and `--include=*.tsx` as globs/expansions in a plain `Bash` call; quote them.
- Recharts "width(-1)" console warnings on the Solar + storage page are pre-existing, not the twin.

## Next immediate step
Muath reviews `feat/spatial-twin` (run `npm run dev`, Portfolio → Solar + storage → "Open the
digital twin →"). On his word: push + PR. Then the three escalated questions above.
