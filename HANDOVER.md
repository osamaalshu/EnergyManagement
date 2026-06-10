# Enerlytics Demo — Integration Handover

**Date:** 10 June 2026  
**Branch / state:** Uncommitted local changes (see [Git status](#git-status))  
**Reference repo:** [github.com/Muathhinai/enerlytics](https://github.com/Muathhinai/enerlytics)

---

## Executive summary

The Enerlytics energy-dashboard demo was upgraded to align with the Python reference platform’s physics validation, diagnostic rules, and APSR CRT tariff engine. The React app remains a **static Vite SPA** deployed on Netlify — no backend was added.

The integration strategy is **offline Python enrichment**:

1. Raw CSVs → Node preprocessor → `realData.json` (time series, KPIs, comparisons)
2. Raw CSVs → Python enricher → `enrichedData.json` (quality, physics, CRT bills, decomposition)
3. Both JSON files are **committed** and consumed by TypeScript adapters at build time

All six plan stages are complete. `npm run lint`, `npm run typecheck`, and `npm run build` pass. Python ↔ TypeScript tariff parity is verified (max diff **0.008%** across 105 monthly bills).

---

## Architecture

```
src/data/hourly_data_*.csv
        │
        ├─► scripts/preprocess-csv.mjs ──► src/data/generated/realData.json
        │                                      └─► src/data/realPortfolioData.ts
        │
        └─► scripts/enrich_data.py ──────► src/data/generated/enrichedData.json
               (requires enerlytics repo)         └─► src/data/enrichedPortfolioData.ts
                                                          │
                                                          ▼
                                              React pages (Netlify static build → dist/)
```

**Netlify invariants unchanged:** build command `npm run build`, publish dir `dist/`, SPA redirect in `netlify.toml`, Node 20.

---

## What was done (by stage)

### Stage 1 — Python enrichment pipeline

**New:** `scripts/enrich_data.py`

Runs the reference repo’s engines over the same `hourly_data_*.csv` files and writes `src/data/generated/enrichedData.json`.

| Output section | Source (Python repo) | Purpose |
|---|---|---|
| `dataQuality` | Quality classification (GOOD/SUSPECT/BAD/MISSING/IDLE) | Sensor validation; flagged rows kept, not dropped |
| `physics` | `block1_chiller` equations + rules | COP, kW/ton, R-CH-01 (low COP), R-CH-03 (TOU peak), priced OMR impacts |
| `tariff` | `layer2_tariff/block_a_crt` | Monthly CRT bills for Options 1/2/3 × 33kV / 11kV / 0.415kV |
| `decomposition` | `bill_decomposer` | Structural / tariff-driven / operational / physics-attributed OMR per month |
| `parity` | Cross-check vs TS `tariffEngine.ts` | Fails enrich step if monthly totals diverge > 0.5% |

**New npm script:** `npm run enrich` → `python3 scripts/enrich_data.py`

**Repo location:** Set `ENERLYTICS_REPO=/path/to/enerlytics` or clone to `../enerlytics` or `/tmp/enerlytics-repo`. The reference repo is **not vendored** into this project.

**Enriched data snapshot (current committed JSON):**

- Data range: 2011-06-01 → 2014-04-09 (25,053 hourly rows × 3 chillers = 75,159 quality-classified rows)
- Quality: GOOD 21,821 · SUSPECT 1,789 · BAD 822 · IDLE 50,727
- Plant avg COP (GOOD rows): **6.29**
- Decomposition: 35 months at 11kV, Option 1
- Parity: **PASS** — 105 bills checked, max diff 0.008%

**Rules not applicable** (missing signals in CSV):

- R-CH-02 — condenser fouling (needs outdoor wet-bulb)
- R-PU-01/02 — pump efficiency (needs head kPa)
- R-CT-01/02 — tower approach/effectiveness (needs wet-bulb)

---

### Stage 2 — Tariff accuracy

**`scripts/preprocess-csv.mjs`**

- Removed flat `OMR_PER_KWH = 0.012` for anomaly/inefficiency and today’s KPI costs
- Added deterministic CRT effective-rate helpers (`seasonBlock`, `touBandFromTs`, `effectiveRateOmrPerKwh`) using Oman local time (UTC+4, no DST)

**`src/lib/tariffEngine.ts`**

- Replaced `Date`-based TOU band logic with string parsing (`parseOmanTimestamp`, `touBandFromParts`) so band assignment is **deterministic** regardless of browser timezone
- `effectiveRateOmrPerKwh` and aggregation functions accept string timestamps and voltage level

**`src/components/TariffPage.tsx`**

- Connection voltage radio group: **33kV / 11kV / 0.415kV** (keyboard-focusable, `role="radiogroup"`)
- **Tariff Option Comparison** card — Options 1/2/3 totals from Python engine; cheapest option highlighted
- Parity status shown in UI (“TS/Python parity: verified”)

**`src/components/DashboardPage.tsx`**

- Last-24h chart joins kWh and OMR from the **same timestamped** `tariffHourlyData` rows (no index-based join)
- Energy-only OMR line vs full-bill daily estimate (amortized capacity/supply/VAT) clearly separated

---

### Stage 3 — Physics validation in the UI

**New:** `src/data/enrichedPortfolioData.ts` — typed adapter for `enrichedData.json`

**New types in** `src/types/portfolio.ts`: `DataQualityReport`, `ChillerPhysics`, `PhysicsRuleResult`, `CrtMonthlyBill`, `DecompositionMonth`, etc.

**`src/components/AnomalyPanel.tsx`**

- Accepts optional `subtitle` and `findings` (physics rule rows with severity badges)
- KPI labels switch to “Rule-Triggered Hours” / “Diagnosed Cost Impact” when physics findings are present
- Baseline line label becomes “Gulf benchmark (COP 4.5)” in physics mode

**`src/components/BuildingPage.tsx`**

- **Data Quality** card: status share bar, per-chiller GOOD/flagged counts, top quality episodes
- **Plant Physics Diagnostics** panel (replaces rolling-threshold building anomaly)

**`src/components/EquipmentPage.tsx`**

- Rule badges (R-CH-01, etc.) on chiller header when triggered
- Physics KPI cards: avg COP, benchmark, alert threshold
- Monthly COP chart (GOOD rows only) with benchmark (4.5) and alert (2.5) reference lines
- Per-chiller physics diagnostics panel

---

### Stage 4 — Bill decomposition view

**`src/components/TariffPage.tsx`** — new section:

- Stacked `ComposedChart`: structural, operational, tariff-driven, physics-diagnosed OMR
- Monthly breakdown table with Excel export
- Wired to `decompositionMonths` from enriched data (11kV, Option 1)

---

### Stage 5 — Cleanup

**Deleted (orphaned, zero remaining imports):**

| Path | Reason |
|---|---|
| `src/components/widgets/*` (7 files) | Unused grid widgets on mock data |
| `src/components/SavingsPage.tsx` | Orphaned savings view |
| `src/data/mockDashboardData.ts` | Replaced by real data |
| `src/data/mockSavingsData.ts` | Orphaned |
| `src/data/mockTariffData.ts` | Replaced by CRT engine |
| `ui-audit-*.png` (repo root) | Stale audit screenshots |

**`src/data/realPortfolioData.ts`**

- `buildingConsumptionBreakdown` now reads real shares from `realData.json`:
  - Chiller 1: 33% · Chiller 2: 37% · Chiller 3: 28% · Pumps: 3%
  - (was hardcoded “100% Cooling”)

**`README.md`**

- Added **Data Pipeline** section documenting preprocess + enrich workflow

---

### Stage 6 — Verification

| Check | Result |
|---|---|
| `npm run lint` | ✅ Pass |
| `npm run typecheck` | ✅ Pass |
| `npm run build` | ✅ Pass (`dist/` in ~2.6s) |
| Python ↔ TS parity | ✅ 105 bills, max diff 0.008% |
| Browser smoke test | ✅ Dashboard, Building, Equipment, Tariff — light + dark mode |
| Keyboard nav | ✅ Voltage radios Tab-focusable with visible focus |

**Lint fixes applied during verify:**

- `BuildingPage.tsx` — removed unused `TimeResolution` import
- `DashboardPage.tsx` — moved `last24` computation to module scope (static data; satisfies React Compiler `preserve-manual-memoization`)

---

## Key files reference

### New files

```
scripts/enrich_data.py
src/data/enrichedPortfolioData.ts
src/data/generated/enrichedData.json
HANDOVER.md                          ← this document
```

### Modified files

```
README.md
package.json                         (+ preprocess, enrich scripts)
scripts/preprocess-csv.mjs
src/components/AnomalyPanel.tsx
src/components/BuildingPage.tsx
src/components/DashboardPage.tsx
src/components/EquipmentPage.tsx
src/components/TariffPage.tsx
src/data/generated/realData.json     (regenerated with CRT rates)
src/data/realPortfolioData.ts
src/lib/tariffEngine.ts
src/types/portfolio.ts
```

### Deleted files

```
src/components/SavingsPage.tsx
src/components/widgets/*.tsx         (7 widgets)
src/data/mockDashboardData.ts
src/data/mockSavingsData.ts
src/data/mockTariffData.ts
ui-audit-fullpage.png
ui-audit-mobile.png
```

### Unchanged adapters (still re-export real data)

`src/data/mockPortfolioData.ts` — thin re-export layer over `realPortfolioData.ts` (name kept for backward compat with existing imports).

---

## How to run locally

```bash
npm install
npm run dev          # http://localhost:5173
```

### Regenerate data (development only)

```bash
# Step 1 — always available (Node)
npm run preprocess   # → src/data/generated/realData.json

# Step 2 — requires Python reference repo
git clone https://github.com/Muathhinai/enerlytics.git ../enerlytics
export ENERLYTICS_REPO=../enerlytics
npm run enrich       # → src/data/generated/enrichedData.json
```

Both JSON outputs should be committed after regeneration so Netlify builds never need Python.

### Guardrail checks (run before merge)

```bash
npm run lint
npm run typecheck
npm run build
```

---

## UI behaviour changes (before → after)

| Area | Before | After |
|---|---|---|
| Cost calculations | Flat 0.012 OMR/kWh in several places | CRT effective rates (TOU + DUoS + TUoS by band) |
| TOU bands | Browser `Date` parsing (timezone-dependent) | Fixed UTC+4 string parsing |
| Building anomalies | Rolling % threshold vs baseline | Physics rules R-CH-01/03 with priced OMR |
| Equipment COP | All rows including bad sensors | GOOD rows only; monthly COP chart with benchmarks |
| Tariff page | Option 1 only, 11kV hardcoded | Voltage selector + Options 1/2/3 comparison |
| Portfolio donut | “100% Cooling” | Real chiller 1/2/3 + pump kWh shares |
| Savings page / widgets | Present but unused | Removed |

**Dark mode:** All new cards, charts, and controls use existing `card-surface` / CSS var patterns — verified readable in dark mode.

---

## Data contracts

### `enrichedData.json` top-level keys

```json
{
  "meta": { ... },
  "dataQuality": { "totalRows", "byStatus", "perChiller" },
  "physics": { "constants", "perChiller", "plant", "notApplicableRules", "monthlyPhysicsOmr" },
  "tariff": { "voltages", "options", "bills", "optionTotals" },
  "decomposition": { "voltage", "option", "months" },
  "parity": { "checkedBills", "maxDiffPct", "tolerancePct", "pass" }
}
```

### TypeScript entry points

- `src/data/realPortfolioData.ts` — time series, KPIs, comparisons, `tariffHourlyData`
- `src/data/enrichedPortfolioData.ts` — quality, physics, CRT bills, decomposition, parity

Key helpers:

```ts
getPhysicsAnomaly(chillerNum?)  // → { data: AnomalyData, findings: PhysicsRuleResult[] }
getCrtBills(voltage, option)    // → CrtMonthlyBill[]
getOptionTotals(voltage)        // → Record<string, TariffOptionTotal>
```

---

## Git status

Changes are **not yet committed**. At time of handover:

```
Modified:  README, package.json, preprocess-csv.mjs, 5 components,
           realPortfolioData.ts, tariffEngine.ts, portfolio.ts, realData.json
New:       scripts/enrich_data.py, enrichedPortfolioData.ts, enrichedData.json, HANDOVER.md
Deleted:   SavingsPage, 7 widgets, 3 mock data files, audit PNGs
```

Suggested commit grouping (optional):

1. `feat: add Python enrichment pipeline and enrichedData.json`
2. `feat: unify CRT tariff engine and TOU timezone handling`
3. `feat: physics diagnostics UI (quality card, rules, COP charts)`
4. `feat: tariff option comparison and bill decomposition`
5. `chore: remove orphaned widgets and mock data`

---

## Known limitations & assumptions

1. **Historical data, 2025 tariff** — APSR CRT 2025 MIS rates are applied to 2011–2014 load for demo purposes (noted in `enrichedData.json` meta).
2. **CSV timestamps = Oman local** — UTC+4, no DST. All band logic assumes this.
3. **Flow units** — Chilled-water flow converted GPM → L/s (factor 0.0630902) per reference repo convention.
4. **Missing environmental signals** — No OAT/RH/wet-bulb in CSV; tower and fouling rules skipped.
5. **No pump head signal** — Pump efficiency rules R-PU-01/02 skipped.
6. **Decomposition UI** — Fixed to 11kV Option 1 in enriched output; Tariff page interactive recalc uses TS engine for the selected voltage.
7. **Bundle size** — Main JS chunk ~3 MB (pre-existing; not addressed in this work).

---

## Suggested next steps

- [ ] Commit and push changes; verify Netlify deploy on refresh for `/tariff` route
- [ ] Add `npm run check` script (`lint && typecheck && build`) to `package.json` if desired
- [ ] Re-run `npm run enrich` after any enerlytics repo update; confirm parity still passes
- [ ] If new CSV columns arrive (OAT, pump head), re-run enrich to enable R-CH-02, R-PU, R-CT rules
- [ ] Consider code-splitting large JSON imports to reduce initial bundle size
- [ ] Wire portfolio-level anomaly panel to physics (currently building/equipment only)

---

## Contacts & references

- **Demo repo:** `energy-dashboard` (this project)
- **Reference engine:** https://github.com/Muathhinai/enerlytics
- **Plan doc (do not edit):** `.cursor/plans/demo_fix_with_python_engine_329ae490.plan.md`
- **Workspace rules:** `.cursor/rules/` (guardrails, Netlify, UI/UX, grid layout, PR checklist)
