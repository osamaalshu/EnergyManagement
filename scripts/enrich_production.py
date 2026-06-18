"""
enrich_production.py — build the Production Planner dataset for the dashboard
from the layer3_production simulator outputs (Phase 1 per-SKU + Phase 2 line plan).

Pilot preview on the Nizwa Plastic production records (real historical runs),
with energy/changeover ASSUMPTIONS — honestly labelled demo / DEVELOPMENT_PROXY.
Reads the two result JSONs in place; writes src/data/generated/productionData.json.

Run:  python3 scripts/enrich_production.py
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src" / "data" / "generated" / "productionData.json"

_CANDIDATES = [os.environ.get("AL_HILAL_REPO"),
               str(ROOT.parent / "al-hilal-mc01-analysis"),
               str(Path.home() / "al-hilal-mc01-analysis")]
REPO = next((p for p in _CANDIDATES if p and (Path(p) / "layer3_production" / "results").is_dir()), None)
if REPO is None:
    raise SystemExit("al-hilal-mc01-analysis not found — set AL_HILAL_REPO")
RESULTS = Path(REPO) / "layer3_production" / "results"


def main() -> None:
    phase1 = json.loads((RESULTS / "results.json").read_text())
    phase2 = json.loads((RESULTS / "line_plan.json").read_text())
    full_path = RESULTS / "full_plan.json"
    phase2c = json.loads(full_path.read_text()) if full_path.exists() else {}

    # Phase-2 is keyed by line id; the pilot has one line.
    line_id, line = next(iter(phase2["lines"].items()))
    configuration = phase2c.get(line_id)  # Phase 2c: combined lot-sizing × sequencing

    # Clean parameter block so the BROWSER can recompute plans live (interactive sim).
    cfg_dir = Path(REPO) / "layer3_production" / "config"
    lines_cfg = yaml.safe_load((cfg_dir / "lines.yaml").read_text())["lines"]
    a = phase1["assumptions"]
    line_def = next((ln for ln in lines_cfg if ln["id"] == line_id), lines_cfg[0])

    def _q(sku, key):
        m = sku["measured"].get(key)
        return m["value"] if isinstance(m, dict) else m

    # family + nominal diameter for the real SKUs (sequence-dependent setup driver)
    SKU_META = {"DRAIN-SN2": ("Drainage", 160), "PRESS-DIN-CL3": ("Pressure", 110)}

    model = {
        "line": {
            "id": line_def["id"], "name": line_def["name"],
            "machineKw": line_def["machine_kw"], "changeoverH": line_def["changeover_h"],
            "changeoverKw": line_def["changeover_kw"],
            "operatingHoursPerYear": line_def["operating_hours_per_year"],
            "nMachines": line_def.get("n_machines", 1),
            "machineNames": ["Machine 01", "Machine 03"] if line_def.get("n_machines", 1) == 2 else None,
        },
        "economics": {
            "elecOmrPerKwh": a["electricity_omr_per_kwh"],
            "materialOmrPerKg": a["material_price_omr_per_kg"],
            "holdingRateAnnual": a["holding_rate_annual"],
        },
        "skus": [{
            "id": s["sku_id"], "name": s["name"],
            "family": SKU_META.get(s["sku_id"], ("Other", 0))[0],
            "diameterMm": SKU_META.get(s["sku_id"], ("Other", 0))[1],
            "demand": round(_q(s, "annual_demand")),
            "rateEffective": _q(s, "effective_rate"),
            "rateMedian": _q(s, "line_rate"),
            "kgPerUnit": _q(s, "kg_per_unit"),
            "meanRejection": _q(s, "mean_rejection_pct") / 100.0,
        } for s in phase1["skus"]],
    }

    out = {
        "meta": {
            "facility": "Nizwa Plastic Factory",
            "site": "Al Hilal Plastic Industries",
            "lineId": line_id,
            "generatedAt": datetime.now(timezone.utc).date().isoformat(),
            "mode": "demo",
            "proxyStatus": phase1["context"]["proxy_status"],
            "note": "Pilot preview on REAL production records with ASSUMED changeover "
                    "(2 h) / power (75 kW) / prices. Energy is a proxy; savings rest on "
                    "those assumptions until measured. Not a control system.",
        },
        "assumptions": phase1["assumptions"],
        "model": model,                 # clean params for the in-browser interactive planner
        "skus": phase1["skus"],         # per-SKU baseline/optimal with measured/calculated/inferred/assumed labels
        "line": line,                   # Phase-2 baseline vs optimal plan + DES validation
        "configuration": configuration, # Phase-2c combined lot-sizing × sequencing (best config to run all products)
        "savings": {
            "totalOmr": line["saving_total_omr"],
            "decisionOmr": line["saving_decision_omr"],
        },
        "desValidation": line["des_validation"],
    }
    OUT.write_text(json.dumps(out, indent=2))
    print(f"wrote {OUT}")
    print(f"  SKUs: {[s['sku_id'] for s in out['skus']]}")
    print(f"  line {line_id}: baseline {line['baseline']['total_cost_omr']} → optimal {line['optimal']['total_cost_omr']} OMR")
    print(f"  DES makespan P10/50/90: {out['desValidation']['makespan_h_p10_p50_p90']} h")


if __name__ == "__main__":
    main()
