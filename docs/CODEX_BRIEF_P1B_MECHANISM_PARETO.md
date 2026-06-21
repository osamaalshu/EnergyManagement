# Codex Brief — P1.b: mechanism-first Pareto on Scrap Focus

**Repo:** `energy-mgmt-redesign` (current `main`; `@/` alias, `src/features|pages|shared|lib`). **Branch:** `feat/p1b-mechanism-pareto`. Builds on merged Analyse v2 (P0 Startup Ledger, P1 measured KPIs, Batching Advisor). Architect (Claude) wrote this; Codex implements + writes/extends tests + runs them.

**Why:** Scrap Focus is still organised "which products are dirty?" But the validated mechanism says scrap is **startup-driven**: on real run-episode data, **68% of total scrap is startup (first-day) scrap and only 32% is steady-state continuation.** The screen should *lead* with mechanism, then products — so the manager sees "we have a startup-frequency problem," not "we have a product problem."

## Data (already in `src/data/startupKpis.json`)
The export now emits two new blocks (provenance: **measured, ERP run episodes, 2025–26**):
```ts
mechanismScrap: {
  coldStartKg: number; coldStartOmr: number;      // first-day scrap of cold-start runs   (real: 8,256 kg / 3,715 OMR)
  warmStartupKg: number; warmStartupOmr: number;  // first-day scrap of warm-start runs    (real: 33,071 kg / 14,882 OMR)
  continuationKg: number; continuationOmr: number;// scrap on non-first days (steady state)(real: 19,593 kg / 8,817 OMR)
};
productStartups: {                                 // top products by startup scrap (descending)
  product: string; startups: number; coldStarts: number; subEconomicRuns: number; startupScrapKg: number;
}[];
```
**First task:** extend the `StartupKpis` interface in `src/features/production-planning/startupKpis.ts` to include `mechanismScrap` and `productStartups` (pure type addition; no recomputation). `coldStartKg + warmStartupKg + continuationKg === summary.totalScrapKg` (it does in the data).

## Scope
**IN — only `src/pages/ScrapAnalyzerPage/ScrapAnalyzerPage.tsx` + the loader interface extension:**
1. A new **"Where the scrap comes from (mechanism)"** section placed **above** the existing per-product Pareto. It shows the 3-way split (warm-startup, cold-start, continuation) as a small Pareto/stacked bar, with the **headline "{X}% of scrap is startup-driven"** where `X = round(100*(coldStartKg+warmStartupKg)/totalScrapKg)`. Tag **MEASURED** (emerald, reuse the P1 chip).
2. A **"Products that most generate startup-only runs"** mini-table from `productStartups` (product, startups, cold-starts, sub-economic, startup scrap kg) — the mechanism-framed companion to the existing product Pareto.
3. **Reframe "recoverable":** add one line near the loss summary — *"Startup-driven scrap ≈ {startupKg} kg ({startupOmr} OMR) is the batching-addressable pool (estimate — assumes startups cut by campaigning; not all removable)."* Keep the existing scrapCatalog per-product `recoverable` unchanged; just contextualise it.

**OUT (do not change):** the existing scrapCatalog-based per-product Pareto / investigator table / SNR guard / changeover card logic; the P1 "This week (measured)" panel and floor-walk (keep as-is); Planner, Delivery View, Batching Advisor, telemetry, tariff engine, `verify-provenance.mjs`.

## Honesty contract
- The mechanism split and product-startup table are **measured** (run episodes) → emerald MEASURED chip, visually distinct from estimated/amber.
- "Batching-addressable pool" is an **estimate** of what's *potentially* avoidable — label it estimate and state the assumption; do **not** imply all startup scrap is removable.
- The existing scrapCatalog Pareto stays measured-as-is. Two data sources coexist (run-episode mechanism vs per-product catalogue) — both are line-level scrap; don't merge their numbers, present them as complementary lenses.

## Tests Codex must write/extend (`src/pages/ScrapAnalyzerPage/__tests__/ScrapAnalyzerPage.test.tsx`, + loader test)
1. Loader: `mechanismScrap` present; `coldStartKg + warmStartupKg + continuationKg` equals `summary.totalScrapKg` (within rounding); `productStartups.length > 0`.
2. Component: the mechanism section renders the three categories and the **"{X}% of scrap is startup-driven"** headline with the correct computed X; carries a MEASURED chip and not "estimated" in that block.
3. Component: the product-startup table renders the top `productStartups` entries.
4. The "batching-addressable pool" line is labelled an estimate.
5. Existing Scrap Focus tests still pass unchanged (per-product Pareto, P1 measured panel, floor-walk).

## Acceptance criteria
- `StartupKpis` interface extended; no recomputation of the new fields in the UI (pure display).
- Scrap Focus leads with the mechanism split + the startup-driven % headline, then the product-startup table, then the existing per-product Pareto — measured vs estimated visually distinct.
- All tests green; `npm run build` clean (provenance gate + tsc + Vite); no new deps; no changes outside ScrapAnalyzerPage + the loader.
- Do **not** commit or push — leave for review.
