# Analyse Workspace — Product Requirements & Equation Reference

**Product:** Enerlytics · Nizwa Plastic (Al Hilal) extrusion pilot
**Scope:** The four features under **Analyse** in the dashboard sidebar.
**Status:** MVP, in-browser models. Exact optimiser/engine runs server-side.
**Pilot machine:** **MC01 only.** Other extruders run different dies at different rates and power and are not yet calibrated; modelling them with MC01's numbers would be a guess, so the decision features are scoped to a single machine.

Each feature answers **exactly one decision**. This document states that decision, the inputs the manager controls, the exact equations, the outputs, and the provenance (what is *measured* vs *estimated*) so nothing is mistaken for live data.

Notation:
- `q` = order/product quantity (pipes), `r` = effective production rate (pipes/h)
- `kg/u` = unit weight (kg/pipe), `ρ` = reject rate (mass fraction), `c_m` = material price (OMR/kg)
- `H` = hours/day (shift length), `D` = planning window (days)
- Setup hours: `S_fam` (family change), `S_dia` (diameter change)

---

## 0. Goal & Methodology

### Goal
Build the smallest set of features that let a plant manager make **materially better decisions** — not a monitoring dashboard. The bar for any element on screen is: *if the client sat here, would this change a real choice for the better?* If not, it is cut. We optimise for **signal-to-noise**: terminate noise (synthetic numbers presented as real, vanity metrics, low-sample outliers, cosmetic "insights", dead code), keep only strong, defensible signal. Each feature answers **exactly one decision** and labels every number as *measured*, *estimated*, or *simulated* so nothing is mistaken for live data.

### Methodology
1. **Decision-first design.** Start from the one decision a feature must change; derive inputs, equations and outputs from it. Reject anything that doesn't move that decision.
2. **Ground in real data, refuse to fabricate.** Use the actual MC01/line records where they exist (per-product reject, demand, switch frequency). Where data doesn't support a quantity (e.g. per-product run rates for the full catalogue), we say so and do **not** invent it — fabricated precision is noise.
3. **Provenance discipline.** Measured vs estimated vs simulated is explicit in the UI and here. A single tariff authority (`tariffEngine.ts`); a build-time provenance check gates merges.
4. **Critical audit, challenge every assumption.** Each equation and default is interrogated against the data as if delivery depended on it (e.g. the scrap distribution is *diffuse*, not Pareto; the P25 "recoverable" was an arbitrary vanity number and was replaced with gap-to-plant-average over a material, well-measured focus set; `RATE_CV` is an assumption, not "measured", and is labelled and made adjustable; the TOU lever only pays in summer).
5. **Two-agent workflow.** **Claude (architect)** owns system design, business logic, the decision/equation spec, and review sign-off. **Codex (executor)** implements specs, writes the tests, runs them, and fixes failures — Claude never writes test files. Flow: architect brief → `/codex:rescue` → `/reviewer` → `CHANGES.log` → commit. (Where this slipped into solo implementation, it was corrected back to this flow.)
6. **Honest scoping.** Decision features are scoped to a single calibrated machine (MC01); scrap analysis is line-level (Machines 01 & 03) because the records can't be split. Scope is stated, not blurred.

---

## 1. Order Planner

**Decision:** *For next week's order book, will every order ship on time — and how do I balance corporate due dates against steady runs and energy cost, on MC01?*

### Inputs the manager controls
| Input | Meaning |
|---|---|
| Order book | rows of (product, qty `q`, due day, ★ priority) |
| Planning window `D` | days available |
| Hours/day `H` | shift length |
| Balance strategy | `grouped` (fewest changeovers) · `balanced` · `due` (meet due dates) |
| Shift start hour | clock hour the daily shift begins (TOU lever) |
| ★ Priority | force a must-ship order to the front of the line |

### Calibrated model parameters (not typed by the manager)
- Per-product `r`, `ρ`, `kg/u` — **measured** from production history.
- `S_fam` = 3 h, `S_dia` = 0.5 h, scrap/changeover = 10 kg — **estimates** until the changeover log connects.

### Equations
**Run time** for an order: `rt = q / r`.

**Sequence-dependent setup** between consecutive jobs `prev → cur`:
```
setup = S_fam        if family(prev) ≠ family(cur)
      = S_dia        if same family, different diameter
      = 0            if identical family+diameter
```

**Sequencing** (single machine; priority applied first):
- `due` (EDD): sort all orders by due day.
- `grouped`: families ordered by **descending total load**; within a family by diameter, then due day.
- `balanced`: families ordered by **earliest due day**; within a family by due day, then diameter.
- **Priority:** ★ orders are pulled to the front (earliest-due first), then the rest follow the strategy.

**Timeline:** walking the sequence, `t ← t + setup + rt` for each job; `finishDay = t_end / H`.

**On-time:** `onTime = finishDay ≤ dueDay`.

**Throughput / capacity:**
```
productionH   = Σ rt
changeoverH   = Σ setup
makespanH     = t_end (single lane)
capacityH     = D × H
utilisation   = makespanH / capacityH ,   fits = makespanH ≤ capacityH
steadyState%  = productionH / (productionH + changeoverH)
```

**Scrap:**
```
baseScrapKg    = Σ q · (kg/u) · ρ
startupScrapKg = (familyChanges + diameterChanges) · scrapPerChangeover
scrapKg        = baseScrapKg + startupScrapKg ,   scrapOMR = scrapKg · c_m
```

### Monte-Carlo confidence (rate variability)
Run-time multiplier is lognormal with mean 1 and CV = `RATE_CV` (0.35):
```
σ = √(ln(1 + CV²)) ,  μ = −σ²/2 ,  mult = exp(μ + σ·Z) ,  Z ~ N(0,1)  (Box–Muller)
```
Over ~1500 reps, each job's finish is `t ← t + setup + rt·mult`. Outputs:
- `onTimeProb[order]` = fraction of reps where that order finished ≤ due day.
- `pAllOnTime` = fraction of reps where **every** order shipped on time → the headline verdict %.
- `samplesDays` = makespan distribution → "typical" (P50) and "bad run" (P90) finish.

### Time-of-Use energy lever
The machine runs an `H`-hour daily shift starting at `shiftStart`. Machine-elapsed hour `e` maps to clock hour:
```
hourOfDay(e) = (shiftStart + (e mod H)) mod 24
```
Each run is priced hour-by-hour on the **real CRT tariff** (`effectiveRateOmrPerKwh`, 0.415 kV, summer):
```
energyOMR(run) = Σ_hours machineKw · rate(hourOfDay(e))
```
**Lever:** scan `shiftStart ∈ {0..23}`, total the plan's energy at each, and surface the cheapest with one-click apply.
```
saveIfBest = OMR(currentStart) − min_s OMR(s)
spread     = max_s OMR(s) − min_s OMR(s)
```
At `H = 24` the whole clock is used, so there is no off-peak window to shift into (the UI says so).

### Biggest levers (sensitivity)
Re-run the schedule under each change and report **days off the finish (makespan)**:
`+4 h/day`, `halve changeover times`, `halve rate variability (CV/2)`.

### Outputs
Verdict (on-time count, `pAllOnTime`%, P50/P90 finish, steady-state %, changeover & scrap saved vs ungrouped, at-risk names) · order table (finish, on-time, confidence) · scrap card · TOU lever card · levers bar · finish distribution (strategy vs EDD baseline) · Gantt · per-run table (scrap + energy by tariff band).

### Provenance
**Measured:** `r`, `ρ`, `kg/u`, tariff schedule. **Estimated:** `S_fam`, `S_dia`, scrap/changeover, `RATE_CV`. **Modelled:** the lognormal variability and shift-window energy mapping.

### Known gaps
Raw-material/inventory availability not modelled; scheduler is a heuristic (a CP-SAT pass would *guarantee* due-date feasibility where physically possible).

---

## 2. Delivery View

**Decision:** *Will we hit our OTIF commitment over the next 7/14/30 days — and what single change recovers the most at-risk orders today?*

### Equations
Built on the same `scheduleOrders` + `monteCarloOrders` engine (grouped schedule, full catalogue).

```
OTIF        = onTimeOrders / totalOrders            (within the selected day range)
atRisk      = orders where  not onTime  OR  onTimeProb < 0.95
atRiskKg    = Σ q · (kg/u)  over at-risk orders
atRiskOMR   = atRiskKg · c_m
worstLate   = max(lateDays)
finishWindow= [P50, P80] of the Monte-Carlo makespan samples
```

**Root-cause tag** (heuristic, per order):
```
"<machine> capacity"  if on bottleneck lane and (late or onTimeProb < 0.95)
"High scrap · <name>" if ρ ≥ 1.25 × median(ρ)
"Changeover cluster"  if setupType = family
"Sequence / due date" otherwise
```
Bottleneck lane = the machine with the highest load.

**Recommendations** (each re-simulated, ranked by ΔOTIF):
```
candidates = { EDD reorder , +2 h/day overtime , add a machine }
ΔOTIF      = OTIF(candidate) − OTIF(base)
fixed      = orders on-time under candidate but late under base
```
Keep candidates with `ΔOTIF > 0`, top 3. Clicking one previews the orders it would fix.

### Outputs
Top strip (OTIF vs 95% target, orders at risk + tonnes + OMR, worst lateness, P50–P80 window) · at-risk table with root-cause + confidence + search · ranked recommendations with re-sim ΔOTIF and click-to-preview · current-vs-plan P50→P80 finish bands · per-order drill-down.

### Provenance
OTIF, confidence and windows from the simulation (rate variability bootstrapped). Recommendations are heuristics, read-only in this MVP. **Currently runs on the demo catalogue** — real orders plug in when the order book connects.

---

## 3. Scrap Focus

**Decision:** *How much am I losing to scrap, which products drive it, and what's actually worth fixing — on real MC01 data?*

### Data
Real per-product catalogue aggregated from **MC01 shift records** (`production_clean.parquet`):
`94 products`, period `2025-01-01 → 2026-05-09` (493 days), overall reject **2.87 %**. Demand and scrap are annualised by `factor = 365 / spanDays`. Each row carries `samples` = number of shift-records behind it (the SNR guard).

### Equations
```
scrapKg(product)   = demand · (kg/u) · ρ           (annualised; mass-basis reject)
scrapOMR           = scrapKg · c_m
totalKg            = Σ scrapKg ,  totalOMR = Σ scrapOMR
```

**Pareto / concentration:** sort products by `scrapKg` desc;
```
cumPct(i) = (Σ_{j≤i} scrapKg_j) / totalKg
to80      = smallest i with cumPct ≥ 80%      → "Top N = 80% of the loss"
```

**Best-rate benchmark & recoverable** (computed on *well-measured* products only, `samples ≥ 5`, so a 2-record outlier cannot set the target):
```
benchmark   = P25 of ρ over well-measured products
saving(p)   = max(0, ρ_p − benchmark) · demand_p · (kg/u)_p · c_m
recoverable = Σ saving(p)   over well-measured products only
```

**Signal-to-noise guard:** products with `samples < 5` are flagged (⚠, greyed in the Pareto, dimmed in the table) and **excluded** from the benchmark and from recoverable/recommendations. (70 of 94 products fall below this threshold — the loss is concentrated in the well-sampled few.)

**Changeover scrap (decomposition estimate, not additive):**
```
changeoversPerYear = MEASURED product-switches/yr on MC01  (204/yr: 84 family + 121 diameter)
changeoverKg       = changeoversPerYear · scrapPerChangeover   (kg/changeover is the only estimate)
changeoverShare    = changeoverKg / totalKg
```
The records log **total** scrap and don't tag startup vs in-run, so this is a modelled decomposition of the loss above — *not* extra scrap. It is the slice the Order Planner's family-grouping directly removes. The result (~4–5 %) confirms scrap here is **reject-driven, not changeover-driven** (consistent with the EDA: run-length ⟂ scrap).

### Outputs
Provenance banner (period, products, overall reject, low-sample count) · loss summary (scrap/yr kg + OMR, concentration, recoverable) · Pareto (top 10, confidence-shaded) · top-5 focus recommendations by recoverable OMR · changeover-scrap card with adjustable kg/changeover · investigator table (records, reject %, demand/yr, scrap, cum %, well-measured filter, search) · per-product drill-down.

### Provenance
**Measured:** per-product `ρ`, `kg/u`, demand, switch counts. **Estimated:** kg/changeover, material price. Per-shift / per-batch / per-cause attribution unlocks when the MES connects.

---

## 4. Plant Telemetry

**Decision:** *What will the line's sensors stream, and how much energy is paid for but makes no product?* (Digital-twin validation — Track B.)

### Model (SimPy plant-state engine, server-side)
State machine `idle → setup → run → down`; stochastic breakdowns via MTBF/MTTR. Power is **emitted from state** (each state has a kW level), not noise on a flat line. Telemetry trace `(hour, machine, state, kw, units)` is aggregated to plant kW over time.

### Equations / KPIs
```
availability   = run_time / (run_time + down_time)
utilisation_run= run_time / makespan
energy_kwh     = Σ_states (state_hours · state_kw)
kwh_per_unit   = energy_kwh / units_made
energyByState  = {run, setup, idle, down}  →  the non-run share is the waste to attack
```
**Validation:** ideal (no faults) vs realistic (MTBF/MTTR) for availability, makespan, downtime, energy/unit. Calibrating MTBF/MTTR to the client's downtime log makes the realistic column match history — closing the loop.

### Provenance
**Simulated** (clearly tagged). Wire the sensors and this becomes the live trace; modelled parameters calibrate to reality and the "simulated" tag drops.

---

## Cross-feature notes
- **One engine:** Planner, Delivery View and the Scrap changeover estimate all sit on `scheduleOrders` / `monteCarloOrders` in `src/lib/productionModel.ts`. Telemetry sits on the separate SimPy engine (Track B). The two close into one loop when sensors connect.
- **Tariff authority:** all OMR energy pricing flows through `src/lib/tariffEngine.ts` (single runtime rate authority; enforced by the provenance check).
- **Honesty contract:** every screen labels measured vs estimated vs simulated. No screen presents modelled output as live data.
- **Consistency caveat:** the Planner treats `ρ` as in-run reject and *adds* startup scrap; Scrap Focus treats `ρ` as measured *total* (incl. startup) and *decomposes* an estimated changeover share. They agree directionally; full reconciliation needs the changeover log.
