"""
enrich_compressor.py — generate the Compressor pilot-preview dataset for the
dashboard, from the Enerlytics block5_gas_compressor SYNTHETIC station.

Pilot preview on synthetic data (no real OQ-GN data yet). Runs the real block5
physics/rules + reinforcing loop end-to-end and writes
src/data/generated/compressorData.json (KPIs, daily time-series for charts,
findings, model-validation, and a 'latest' snapshot for the live tile).

Run:  python3 scripts/enrich_compressor.py
"""
from __future__ import annotations

import json
import os
import statistics
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_FILE = ROOT / "src" / "data" / "generated" / "compressorData.json"

_CANDIDATES = [os.environ.get("ENERLYTICS_REPO"), str(ROOT.parent / "enerlytics"), "/tmp/enerlytics-repo"]
REPO_PATH = next((p for p in _CANDIDATES if p and (Path(p) / "blocks" / "block5_gas_compressor").is_dir()), None)
if REPO_PATH is None:
    sys.exit("enerlytics repo not found — set ENERLYTICS_REPO or clone to ../enerlytics")
sys.path.insert(0, REPO_PATH)

from blocks.block5_gas_compressor.synthetic import generate_synthetic_readings  # noqa: E402
from blocks.block5_gas_compressor.pilot_loop import run_pilot_loop  # noqa: E402
from blocks.block5_gas_compressor.schema import load_compressor_registry  # noqa: E402
from blocks.block5_gas_compressor.baseline import build_ratio_baseline, get_expected_kw  # noqa: E402
from blocks.block5_gas_compressor.constants import BASELINE_RATIO_BIN_WIDTH  # noqa: E402
from blocks.block5_gas_compressor.equations import (  # noqa: E402
    c_to_k, calc_compression_ratio, calc_mass_flow_kg_s, calc_isentropic_head_j_per_kg,
    calc_isentropic_power_kw, calc_isen_efficiency, calc_poly_efficiency,
    calc_specific_power_kw_per_nm3hr,
)
from shared.claim import Context, ProxyStatus  # noqa: E402
from shared.outcome_ledger import InMemoryOutcomeLedger, summarize_error  # noqa: E402

FIXTURE = Path(REPO_PATH) / "tests" / "fixtures" / "valid_compressor.yaml"
TAG = "CS-01"
_RULE_LABEL = {
    "R-CS-01": "Polytropic efficiency degradation",
    "R-CS-01-DRIFT": "Power drift vs ratio baseline",
    "R-CS-02": "Idle / unloaded-running waste",
    "R-CS-03": "TOU-peak overconsumption",
}
_SEV_RANK = {"OK": 0, "NOT_APPLICABLE": 0, "INSUFFICIENT_DATA": 0, "BASELINE_CALIBRATING": 0,
             "PATH_B_OUT_OF_RANGE": 0, "MEDIUM": 1, "HIGH": 2}


def _as_dt(d):
    return d if isinstance(d, datetime) else datetime.fromisoformat(str(d))


def _per_reading(readings, comp, baseline):
    """Per-reading derived metrics (skip corrupt). Returns list of dicts."""
    out = []
    for r in readings:
        try:
            ratio = calc_compression_ratio(r["suction_pressure"], r["discharge_pressure"])
            eta_poly = calc_poly_efficiency(ratio, r["suction_temp"], r["discharge_temp"], comp.gas_k)
        except (ValueError, KeyError):
            continue
        sp = None
        eta_isen = None
        if "gas_flow" in r:
            try:
                m = calc_mass_flow_kg_s(r["gas_flow"], comp.gas_mw)
                head = calc_isentropic_head_j_per_kg(ratio, c_to_k(r["suction_temp"]), comp.gas_k, comp.gas_z, comp.gas_mw)
                eta_isen = calc_isen_efficiency(calc_isentropic_power_kw(m, head), r["compressor_kw"])
                sp = calc_specific_power_kw_per_nm3hr(r["compressor_kw"], r["gas_flow"])
            except (ValueError, KeyError):
                pass
        expected = get_expected_kw(baseline, ratio, BASELINE_RATIO_BIN_WIDTH)
        out.append({"dt": _as_dt(r["timestamp_utc"]), "etaPoly": eta_poly, "etaIsen": eta_isen,
                    "specificPower": sp, "ratio": ratio, "actualKw": r["compressor_kw"],
                    "expectedKw": expected, "suctionP": r["suction_pressure"], "suctionT": r["suction_temp"],
                    "dischargeP": r["discharge_pressure"], "dischargeT": r["discharge_temp"],
                    "gasFlow": r.get("gas_flow")})
    return out


def _daily_series(per):
    by_day = defaultdict(list)
    for p in per:
        by_day[p["dt"].date()].append(p)
    rows = []
    for day in sorted(by_day):
        pts = by_day[day]
        m = lambda k: ([x[k] for x in pts if x[k] is not None] or [None])
        avg = lambda xs: round(statistics.mean(xs), 4) if xs and xs[0] is not None else None
        rows.append({
            "label": day.strftime("%b %d"),
            "etaPoly": avg([x["etaPoly"] for x in pts if x["etaPoly"] is not None]),
            "specificPower": avg([x["specificPower"] for x in pts if x["specificPower"] is not None]),
            "compressionRatio": avg([x["ratio"] for x in pts]),
            "actualKw": avg([x["actualKw"] for x in pts]),
            "expectedKw": avg([x["expectedKw"] for x in pts if x["expectedKw"] is not None]),
            "suctionP": avg([x["suctionP"] for x in pts]),
            "suctionT": avg([x["suctionT"] for x in pts]),
            "dischargeP": avg([x["dischargeP"] for x in pts]),
            "dischargeT": avg([x["dischargeT"] for x in pts]),
            "gasFlow": avg([x["gasFlow"] for x in pts if x["gasFlow"] is not None]),
        })
    return rows


def main():
    readings = generate_synthetic_readings()
    reg = load_compressor_registry(str(FIXTURE))
    comp = next(c for c in reg.get_compressors() if c.compressor_tag == TAG)

    ledger = InMemoryOutcomeLedger()
    ctx = Context("oq-gn-synthetic", "ratio-baseline", ProxyStatus.DEVELOPMENT_PROXY)
    findings = run_pilot_loop(str(FIXTURE), TAG, readings, baseline_window_days=14,
                              claim_context=ctx, outcome_ledger=ledger)

    # rebuild the same baseline split for per-reading series
    srt = sorted(readings, key=lambda r: r["timestamp_utc"])
    from datetime import timedelta
    cutoff = _as_dt(srt[0]["timestamp_utc"]) + timedelta(days=14, hours=1)
    base_window = [r for r in srt if _as_dt(r["timestamp_utc"]) < cutoff]
    diag_window = [r for r in srt if _as_dt(r["timestamp_utc"]) >= cutoff]
    baseline = build_ratio_baseline(base_window)
    per = _per_reading(diag_window, comp, baseline)
    series = _daily_series(per)
    last = per[-1] if per else None

    agg: dict[str, dict] = {}
    for results in findings.all_results:
        for res in results:
            a = agg.setdefault(res.rule_id, {"evaluated": 0, "triggered": 0, "omr": 0.0, "severity": "OK", "message": ""})
            a["evaluated"] += 1
            if res.triggered:
                a["triggered"] += 1
                a["omr"] += res.omr_impact
                if _SEV_RANK.get(res.severity, 0) >= _SEV_RANK.get(a["severity"], 0):
                    a["severity"], a["message"] = res.severity, res.message
    rule_rows = [{"ruleId": rid, "label": _RULE_LABEL.get(rid, rid), "severity": a["severity"],
                  "triggeredHours": a["triggered"], "evaluatedHours": a["evaluated"],
                  "omrImpact": round(a["omr"], 2),
                  "description": a["message"] or f"{rid} — no trigger in window."}
                 for rid, a in sorted(agg.items())]

    es = (summarize_error(ledger.entries(), findings.observations) or [None])[0]
    kpis = {
        "etaPoly": round(statistics.mean([p["etaPoly"] for p in per if p["etaPoly"] is not None]), 3),
        "etaIsen": round(statistics.mean([p["etaIsen"] for p in per if p["etaIsen"] is not None]), 3),
        "specificPowerKwPerNm3hr": round(statistics.mean([p["specificPower"] for p in per if p["specificPower"] is not None]), 5),
        "compressionRatio": round(statistics.mean([p["ratio"] for p in per]), 2),
        "designPolyEff": comp.design_poly_eff, "ratedKw": comp.rated_kw,
    }
    ts = [_as_dt(r["timestamp_utc"]) for r in readings]
    out = {
        "meta": {
            "facility": reg.facility_name, "compressorTag": TAG, "site": "OQ Gas Networks (Nizwa)",
            "asOf": max(ts).date().isoformat(), "coverageStart": min(ts).date().isoformat(),
            "generatedAt": datetime.now(timezone.utc).date().isoformat(),
            "mode": "demo", "proxyStatus": "DEVELOPMENT_PROXY",
            "note": "Pilot preview on SYNTHETIC data — block5 physics validated pre-pilot; "
                    "OQ-GN tariff class & timezone unconfirmed (KFU-5/6); not real OQ-GN data.",
        },
        "kpis": kpis,
        "series": series,
        "latest": None if last is None else {
            "timestamp": last["dt"].isoformat(), "etaPoly": round(last["etaPoly"], 3),
            "actualKw": round(last["actualKw"], 0),
            "expectedKw": None if last["expectedKw"] is None else round(last["expectedKw"], 0),
            "compressionRatio": round(last["ratio"], 2),
        },
        "findings": rule_rows,
        "totalOmrImpactPerWindow": round(findings.total_omr_impact, 2),
        "counts": {"diagnosticReadings": findings.diagnostic_readings, "badReadings": findings.bad_readings,
                   "pathUsed": findings.path_used_counts, "blockedClaims": len(findings.blocked_claims)},
        "reinforcing": None if es is None else {
            "modelVersion": es.model_version, "contextKey": es.context_key,
            "nRecorded": es.n_recorded, "nReconciled": es.n_reconciled,
            "coveragePct": round(es.coverage_pct, 1),
            "mape": None if es.mape is None else round(es.mape, 1)},
    }
    OUT_FILE.write_text(json.dumps(out, indent=2))
    print(f"wrote {OUT_FILE}  ·  series={len(series)} days")
    print("kpis:", kpis); print("latest:", out["latest"])


if __name__ == "__main__":
    main()
