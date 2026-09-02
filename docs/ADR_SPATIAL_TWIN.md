# ADR — Spatial asset twin (PV + BESS), and why it is not "Block 8"

**Status:** built on `feat/spatial-twin`, awaiting founder review · **Date:** 2026-09-02
**Inputs:** Block 8 implementation brief (PM, 2026-09-02); Fable mandate; the repo; three reference repositories.
**Scope of this ADR:** the dashboard (`osamaalshu/EnergyManagement`). The platform repo is touched only by the identity link described in §4.

## 1. Decision in one paragraph

Build a **configuration-driven asset graph** (what exists, what it belongs to, what it feeds, where it sits) with a **state snapshot bound to it under explicit provenance rules**, and render that graph with **two 2-D SVG views** — a site plan and an electrical tree — plus a detail panel that states the basis of every number. It is a horizontal layer used by the PV and BESS pages, not a new analytical block. No 3-D. No new dependency. No new ingestion path. The one thing this layer adds that nothing else in Enerlytics has is the **certainty overlay**: every painted surface carries a pattern that says whether the value was measured there, carried from a measurement elsewhere, estimated from a reference plant, simulated for the demo, or unknown.

## 2. What was actually asked (§1 of the reasoning layer)

The literal ask was "a digital twin for investors and clients: they give us the number of arrays and how they are configured, we give them the twin." The decision it feeds: *does Enerlytics look like a company that can hold a plant's structure and its data honestly at the same time?* The answer is useless if the twin is a picture. It is useful only if a visitor can type their plant, click into it, and see the platform refuse to claim more than it knows. That is what was built.

## 3. Current state (A)

| Concern | Dashboard (`energy-mgmt`) | Platform (`enerlytics`) |
|---|---|---|
| Stack | Vite · React 19 · TypeScript · Tailwind 3 · Recharts · Vitest. No router (page state in `App.tsx`), no store library, no realtime. | Python; blocks 6 (PV) and 7 (BESS) own physics, baseline, forecast, dispatch. |
| Asset hierarchy | Portfolio → Site → Subsystem → Equipment (`lib/portfolioNav.ts`). PV site has three leaves: array, inverter fleet, battery. | `shared/identity.py`: site → subsystem → equipment, UUID5. PV plant = subsystem, inverter = equipment. **No string, module, rack or cell level exists.** Hierarchy depth is an open founder decision (memory: pv_bess_domain_spec). |
| PV/BESS data | `data/generated/pvBessData.json` exported by `tools/export_pv_bess_dashboard.py`: annual/monthly plant KPIs, forecast, dispatch scenario, fault classes, **7 inverter records** (PVDAQ 1199), lab cells. Nothing below inverter. | Block 6 consumes string currents from NIST data in replay, but nothing at string level is exported. |
| Provenance | `DatasetMeta.mode` (demo / historical / live) + `DataFreshness` chip + build gate `verify-provenance.mjs` (no "live/today" literals). Per-dataset, not per-value. | Ordinal `Confidence` + `derive_confidence()`; claims register. |
| Existing spatial precedent | `shared/ChillerPlantSchematic.tsx` — a hand-coded SVG topology with status fills. | — |

Conclusion: the dashboard already has the idiom (SVG schematic, provenance chips, scenario banner, data-domain JSON + typed wrapper). The gap is per-node provenance and a graph. Nothing 3-D exists and nothing needs it.

## 4. Architecture decision (C, D)

```
features/spatial-twin/
  model.ts     AssetNode · AssetGraph · NodeState · StateSnapshot · Provenance · rules
  generate.ts  TwinConfig → AssetGraph  (deterministic ids, metres, electrical parents)
  bind.ts      records → own states · propagate down (weaken) · propagate up (worst/weakest)
  layout.ts    electrical tree geometry (pure)
  paint.ts     status colour × provenance pattern
  presets.ts   three starting plants
pages/TwinPage/
  TwinPage · Configurator · PhysicalMap · ElectricalTree · DetailPanel · fills
```

**Generic:** the graph, the state, the provenance rules, the propagation, both renderers, the detail panel. They know `level` strings and footprints, nothing about photovoltaics.
**PV/BESS-specific:** the generator (row/pitch geometry, containers/racks), the binder (which record fields become which metrics), presets, scenario effects. A chiller plant would add a generator and a binder and reuse everything else.

**Why not Block 8:** blocks produce claims from physics. This produces no claim; it arranges claims from blocks 6/7 in space and says how sure each one is. Calling it a block would invite it to grow analytics of its own and duplicate the physics. It is `shared/`-tier in spirit — a consumer of blocks, never a producer.

**Identity link:** nodes at levels the platform registers (plant, inverter, battery system, rack) carry a `platformRef` naming the subsystem/equipment type. Levels below (MPPT, string, container) are **display topology** until the founder decides hierarchy depth. When that lands, `platformRef` gains the UUID5 and nothing in the renderers changes.

## 5. Visualisation strategy (E)

Two views, one selection, one legend:

* **Plan** — SVG in metres, plant frame (x east, y south), two zoom levels only: whole plant, or one array / container. Strings are the smallest painted object. Modules are ticks inside a string drawn by an SVG `pattern`, not elements. Scale bar and north arrow, because a plan without them is a picture.
* **Connections** — layered tree, grid on the left, sun on the right. Collapsed boxes carry a count. Selection expands the path to the node.
* **Detail** — identity, parent chain, "stands for N modules, none measured on its own", status with basis and a link to the measured node it was carried from, every metric with its provenance chip and one-sentence basis, scenario buttons for that level, and a link into the existing PV/BESS analytics with the right section focused.

**3-D rejected for now.** Every question in the mandate's §3 ("where is it, what feeds it, is it measured, where are anomalies clustered") is answered faster top-down. 3-D earns its place for rooftops with multiple levels, shading context and technician navigation — none of which exists in the data today. The seam is `footprint` (x, y, w, h in metres); adding `z` and a tilt does not change the graph. If 3-D is built later it is a third renderer over the same graph, and the `Starlink Viz` instancing pattern is the right reference for it.

## 6. Telemetry binding (F)

A `StateSnapshot` is a map `nodeId → NodeState`. Today it is produced synchronously from the exported JSON. A realtime feed would produce the same shape at the server from block outputs, batched and diffed, and the renderers would not change. The dashboard has no realtime mechanism and this ADR does not add one; the brief's "use the existing realtime path" has no referent yet.

What binds today:

| Source | Level | Provenance |
|---|---|---|
| Configuration | every node | DERIVED nameplates (sum of parts, basis stated) |
| PVDAQ 1199 inverter records | first N inverters, in traversal order | MEASURED status + efficiency metrics |
| DKASC 1B specific yield × nameplate | plant | ESTIMATED yearly energy, basis names the site, year and mounting |
| Injected scenario | one target node | SIMULATED |

## 7. Provenance rules (G)

```
MEASURED   only at the node the record names
DERIVED    carried down from a measured ancestor (names the source), or summed up from children
ESTIMATED  a reference plant's number scaled to this one
SIMULATED  a demo scenario; dominates any aggregate it touches; never merges with a record
UNAVAILABLE nothing reports here
```

Propagation (`bind.propagate`):
1. Own sources (measured, simulated) are never overwritten.
2. Down: a node with no source takes its nearest sourced ancestor's status, provenance weakened one step (MEASURED → DERIVED, SIMULATED → SIMULATED), and records `statusSourceId`.
3. Up: a node still unset takes the worst status and weakest provenance of its known children, or stays unknown.

One consequence worth stating: a simulated fault on a string **below a measured inverter does not change the inverter**. The measurement is what the sensor said. It does show on every un-measured node between the fault and that inverter (the MPPT, here): a node that only inherited its status from above is re-summarised when something beneath it is simulated. The demo shows the string and its MPPT cross-hatched red and the inverter solid green, and the panel explains all three. *(Amended after the 5-axis review: the first cut let the inherited status hide the scenario at the MPPT, which contradicted the "SIMULATED dominates" rule in model.ts.)*

## 8. Scale (H)

Measured on this machine (`vite-node`, one run each — indicative, not a benchmark):

| Configuration | Nodes | Strings | Modules (counted) | Generate | Bind |
|---|---|---|---|---|---|
| Rooftop preset | 63 | 36 | 648 | <1 ms | <1 ms |
| Ground-mount preset | 2,830 | 2,304 | 64,512 | 1.4 ms | — |
| Configurator maximum | 41,873 | 36,864 | 1,327,104 | 26 ms | 30 ms |

Browser rendering at the maximum is **unverified**: 36,864 SVG rects at plant level would be slow. The mitigation already in the design is level-of-detail (strings only draw inside a focused array), which is not yet wired for the plant view. Before a customer site above ~5,000 strings, switch the plant-level string layer to a single `<path>` per array or to Canvas. The graph and the state do not change.

## 9. Simulation boundary (I)

| Meaning | Where it lives | In this layer? |
|---|---|---|
| Physics (expected output) | block 6 (`forecast.py`, `baseline.py`) | No — consumed via the export, labelled ESTIMATED when scaled |
| Operational what-if ("INV-03 offline") | topology arithmetic | Yes, as a SIMULATED scenario on one node |
| Historical replay | needs a per-node history export | No — not yet; the snapshot shape supports it (`asOf`) |
| State estimation | a model, block-tier | No |
| Scenario analysis (+500 kWp) | the configurator already does structure; economics is block 7 dispatch | Structure yes, money no |

## 10. Reference repositories (J)

| Reference | Licence | Verdict | Why |
|---|---|---|---|
| Starlink Viz / Mission Control | MIT (verified) | **REFERENCE ONLY** | Next.js + React-Three-Fiber + Zustand + WebSocket + DuckDB. Excellent instanced-mesh and batched colour-update pattern for a future 3-D renderer. Wrong stack for this repo today and 3-D is not needed. |
| PV Sim GE (Hugging Face) | MIT per card (verified via API) | **REJECT** | Gradio app; its pvlib concepts already exist in block 6 with a baseline the app lacks. Importing it would duplicate domain logic. |
| PV Layout Designer | Proprietary | **REJECT** | Concept only; the row/pitch/GCR idea is standard engineering and was written from scratch. |
| pvlib | BSD-3 | already in block 6 | not part of this layer |

"Grab it from Hugging Face" was the founder's opening hypothesis. Tested and not adopted: there is no reusable twin on Hugging Face, and the two spaces named solve different problems on different stacks. The layer is ~900 lines of TypeScript with zero new dependencies.

## 11. Configuration (§16)

Version 1 is the form: counts, module watts, inverter kW, mounting, tilt, facing, GCR; containers, racks, modules, cells, rack kWh/kW, whether the BMS reports cells. `TwinConfig` is JSON; a CSV/JSON import is a parser onto the same type. A surveyed layout (DXF/GIS/drone) replaces `footprint` values only. Both are roadmap.

## 12. Risks (L)

* **Plan-level rendering above ~5,000 strings** — unverified; mitigation in §8.
* **Reference records are from Maryland, yields from Alice Springs** — every basis sentence says so; the estimate is labelled ESTIMATED and the copy says "your sun will differ". A visitor who skims will still see a number. This is the honest ceiling of a demo with no Omani PV data.
* **Levels below equipment have no platform identity** — deliberate; `platformRef` is the seam. Do not add UUIDs to strings before the hierarchy decision.
* **A scenario under a measured node stops at that node** — by design; may surprise a visitor. The banner and the panel explain.
* **Tests** — written by Codex from the brief in `docs/CODEX_BRIEF_SPATIAL_TWIN_TESTS.md` (53, suite 121/121); two mutation checks kill 2 and 3 tests; an independent verifier passed all five claims. One assertion (brief item 15, MPPT provenance) was edited by hand to follow the §7 amendment.

## 13. Sequence (M)

1. **Done:** graph · binding · propagation · plan · connections · detail · configurator · presets · scenarios · route · tests · verifier · 5-axis review (5 findings, all applied).
2. **Next:** founder review of the branch.
3. Plant-level LOD (single path per array) and a measured browser benchmark at 5k / 25k strings.
4. Founder decision on hierarchy depth → `platformRef` gets UUID5s; block 0 registration exports a `TwinConfig`.
5. Per-node history export from the replay tool → historical replay with a time cursor.
6. Only then, and only for a site that needs it: a 3-D renderer over the same graph.
