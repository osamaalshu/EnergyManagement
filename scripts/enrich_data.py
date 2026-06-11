#!/usr/bin/env python3
"""
enrich_data.py — Offline enrichment step that runs the Enerlytics Python
reference platform (https://github.com/Muathhinai/enerlytics) over the demo
CSVs and writes src/data/generated/enrichedData.json for the React dashboard.

What it produces (all computed by the reference repo's engines):
  1. Data quality classification per chiller (GOOD / SUSPECT / BAD / MISSING / IDLE)
     — modeled on clients/singapore_demo/chiller_data.py (tag + keep, never drop).
  2. Physics KPIs: cooling load (Q = V̇·Cp·ΔT), COP with [0.5, 12] bounds,
     kW/ton — from blocks/block1_chiller/equations.py, GOOD rows only.
  3. Diagnostic rules R-CH-01 (low COP) and R-CH-03 (TOU peak overconsumption)
     with priced OMR impacts — from blocks/block1_chiller/rules.py.
  4. Full APSR CRT bills (Options 1/2/3 × 33kV/11kV/0.415kV) — from
     layer2_tariff/block_a_crt (config-driven JSON rates).
  5. Monthly bill decomposition (structural / tariff-driven / operational
     + physics attribution) — from layer2_tariff/block_a_crt/bill_decomposer.py.
  6. A parity check between the Python CRT engine and the dashboard's
     TypeScript tariffEngine.ts formulas (same constants, must reconcile).

Usage:
  ENERLYTICS_REPO=/path/to/enerlytics python3 scripts/enrich_data.py

The reference repo is NOT vendored into this project. The script looks for it
at $ENERLYTICS_REPO, ../enerlytics, or /tmp/enerlytics-repo (in that order).
Requires Python >= 3.10, stdlib only.
"""

from __future__ import annotations

import csv
import json
import os
import sys
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

# ────────────────────────────────────────────────────────────────────
# Locate and import the Enerlytics reference repo
# ────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "src" / "data"
OUT_FILE = DATA_DIR / "generated" / "enrichedData.json"

_REPO_CANDIDATES = [
    os.environ.get("ENERLYTICS_REPO", ""),
    str(ROOT.parent / "enerlytics"),
    "/tmp/enerlytics-repo",
]
REPO_PATH = next((p for p in _REPO_CANDIDATES if p and (Path(p) / "layer2_tariff").is_dir()), None)
if REPO_PATH is None:
    sys.exit(
        "ERROR: Enerlytics reference repo not found.\n"
        "Clone it and set ENERLYTICS_REPO:\n"
        "  git clone https://github.com/Muathhinai/enerlytics.git ../enerlytics\n"
        "  ENERLYTICS_REPO=../enerlytics python3 scripts/enrich_data.py"
    )
sys.path.insert(0, REPO_PATH)

from blocks.block1_chiller.constants import (  # noqa: E402
    COP_ALERT_THRESHOLD,
    COP_BENCHMARK_PEAK,
    COP_PHYSICAL_MAX,
    COP_PHYSICAL_MIN,
    KW_PER_TON_REFRIGERATION,
)
from blocks.block1_chiller.equations import (  # noqa: E402
    calc_cooling_load_kw,
    calc_cooling_load_tons,
    calc_kw_per_ton,
)
from blocks.block1_chiller.rules import rule_rch01_low_cop, rule_rch03_tou_peak  # noqa: E402
from layer2_tariff.block_a_crt.band_classifier import classify_band  # noqa: E402
from layer2_tariff.block_a_crt.bill_decomposer import decompose_bill  # noqa: E402
from layer2_tariff.block_a_crt.bill_engine import calculate_crt_bill  # noqa: E402
from layer2_tariff.block_a_crt.config_loader import load_tariff_config  # noqa: E402
from shared.tariff import get_tou_rate, is_tou_peak  # noqa: E402

# ────────────────────────────────────────────────────────────────────
# Constants
# ────────────────────────────────────────────────────────────────────
OMAN_TZ = timezone(timedelta(hours=4))  # Oman: UTC+4, no DST
GPM_TO_LS = 0.0630901964  # 1 US GPM = 0.0630901964 L/s (matches shared/units.py)
SITE_ID = "CP1"
SYSTEM = "MIS"
TARIFF_YEAR = 2025  # APSR CRT 2025 rate schedule applied to historical load
VOLTAGES = ["33kV", "11kV", "0.415kV"]
OPTIONS = [1, 2, 3]
DEFAULT_VOLTAGE = "11kV"
VAT_RATE = 0.05
KW_PER_TON_BENCHMARK = round(KW_PER_TON_REFRIGERATION / COP_BENCHMARK_PEAK, 4)  # ≈ 0.781

# Quality statuses (mirrors shared/quality.py + singapore adapter)
GOOD, SUSPECT, BAD, MISSING, IDLE = "GOOD", "SUSPECT", "BAD", "MISSING", "IDLE"
OFF_KW = 5.0
MIN_DELTA_T_C = 1.0

BAND_TO_SHORT = {
    "off_peak": "OP",
    "night_peak": "NP",
    "weekday_day_peak": "WDP",
    "weekend_day_peak": "WEDP",
}

MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def month_label(key: str) -> str:
    y, m = key.split("-")
    return f"{MONTH_NAMES[int(m) - 1]} {y}"


def parse_ts(raw: str) -> datetime:
    """Parse a CSV timestamp ('YYYY-MM-DD HH:MM:SS' or ISO-T) as naive Oman local time."""
    return datetime.fromisoformat(raw.replace("T", " ").strip())


def to_utc(ts_local_naive: datetime) -> datetime:
    """CSV timestamps are Oman plant local time (UTC+4) → convert to UTC-aware."""
    return ts_local_naive.replace(tzinfo=OMAN_TZ).astimezone(timezone.utc)


def r(v: float, d: int = 2) -> float:
    return round(v, d)


# ────────────────────────────────────────────────────────────────────
# 1. Load CSVs
# ────────────────────────────────────────────────────────────────────
def load_rows() -> list[dict]:
    files = sorted(DATA_DIR.glob("hourly_data_*.csv"))
    if not files:
        sys.exit(f"ERROR: no hourly_data_*.csv files in {DATA_DIR}")
    rows: list[dict] = []
    for f in files:
        with open(f, newline="", encoding="utf-8") as fh:
            for rec in csv.DictReader(fh):
                row: dict = {"timestamp": rec["timestamp"]}
                for k, v in rec.items():
                    if k == "timestamp":
                        continue
                    try:
                        row[k] = float(v)
                    except (TypeError, ValueError):
                        row[k] = 0.0
                rows.append(row)
        print(f"  loaded {f.name}")
    rows.sort(key=lambda x: x["timestamp"])
    # de-dup on timestamp (keep first)
    seen: set[str] = set()
    deduped = []
    for row in rows:
        if row["timestamp"] in seen:
            continue
        seen.add(row["timestamp"])
        deduped.append(row)
    for row in deduped:
        row["_ts"] = parse_ts(row["timestamp"])
        row["_ts_utc"] = to_utc(row["_ts"])
        row["_month"] = row["timestamp"][:7]
    return deduped


_META_KEYS = {"timestamp", "_ts", "_ts_utc", "_month"}


def aggregate_2h(rows: list[dict]) -> list[dict]:
    """Average hourly readings into 2-hour blocks for the physics/COP layer.

    Single-hour sensor noise (a one-off inverted ΔT, a transient implausible COP)
    gets averaged out, so more *true* data survives QA instead of ~⅔ of hours
    being dropped as single-hour glitches. Bills, the tariff engine, and the
    decomposition's energy all keep the raw hourly rows — only the COP/efficiency
    basis uses these 2-hour blocks. Block timestamp = the even-hour start.
    """
    if not rows:
        return []
    numeric_keys = [k for k in rows[0] if k not in _META_KEYS]
    buckets: dict[tuple, list[dict]] = defaultdict(list)
    for row in rows:
        ts = row["_ts"]
        buckets[(ts.year, ts.month, ts.day, ts.hour // 2)].append(row)
    out: list[dict] = []
    for key in sorted(buckets):
        grp = buckets[key]
        base = grp[0]
        agg: dict = {k: base[k] for k in _META_KEYS}
        for k in numeric_keys:
            vals = [g.get(k, 0.0) for g in grp]
            agg[k] = sum(vals) / len(vals)
        out.append(agg)
    return out


# ────────────────────────────────────────────────────────────────────
# 2. Data quality classification (tag + keep, per chiller)
# ────────────────────────────────────────────────────────────────────
def classify_chiller_rows(rows: list[dict], n: int) -> list[dict]:
    """Classify every hour for chiller n. Mirrors singapore_demo chiller_data.classify()."""
    p = f"CP_Chiller{n}_"
    tagged = []
    for row in rows:
        kw = row.get(p + "kW", 0.0)
        st = row.get(p + "ChilledWaterSupplyTemp", 0.0)
        rt = row.get(p + "ChilledWaterReturnTemp", 0.0)
        flow_gpm = row.get(p + "ChilledWaterFlowrate", 0.0)
        flow_ls = flow_gpm * GPM_TO_LS if flow_gpm > 0 else None
        cop = None

        if kw <= OFF_KW or flow_gpm <= 0:
            status, reason = IDLE, "chiller off or no chilled-water flow"
        elif st <= 0 and rt <= 0:
            status, reason = MISSING, "missing supply/return temperature"
        elif rt <= st:
            status, reason = BAD, "inverted ΔT (return ≤ supply) — sensor fault or no cooling"
        elif (rt - st) < MIN_DELTA_T_C:
            cop = calc_cooling_load_kw(flow_ls, rt, st) / kw
            status, reason = SUSPECT, "very low ΔT — low load or sensor drift"
        else:
            cop = calc_cooling_load_kw(flow_ls, rt, st) / kw
            if cop < COP_PHYSICAL_MIN or cop > COP_PHYSICAL_MAX:
                status, reason = BAD, f"COP outside [{COP_PHYSICAL_MIN}, {COP_PHYSICAL_MAX}] — implausible"
                cop = None
            else:
                status, reason = GOOD, "valid running reading"

        tagged.append({
            "row": row,
            "status": status,
            "reason": reason,
            "cop": cop,
            "kw": kw,
            "flow_ls": flow_ls,
            "st": st,
            "rt": rt,
        })
    return tagged


def quality_summary(tagged: list[dict]) -> dict:
    by_status: dict[str, int] = defaultdict(int)
    for t in tagged:
        by_status[t["status"]] += 1
    flagged = [t for t in tagged if t["status"] in (BAD, SUSPECT, MISSING)]
    episodes: dict[str, dict] = {}
    for t in flagged:
        e = episodes.setdefault(t["reason"], {"count": 0, "first": None, "last": None, "_days": set(), "status": t["status"]})
        e["count"] += 1
        ts = t["row"]["timestamp"]
        e["first"] = ts if e["first"] is None else min(e["first"], ts)
        e["last"] = ts if e["last"] is None else max(e["last"], ts)
        e["_days"].add(ts[:10])
    ep_list = [
        {"reason": k, "status": v["status"], "count": v["count"], "first": v["first"], "last": v["last"], "distinctDays": len(v["_days"])}
        for k, v in sorted(episodes.items(), key=lambda kv: -kv[1]["count"])
    ]
    total = len(tagged)
    return {
        "totalRows": total,
        "byStatus": dict(by_status),
        "goodForDiagnosis": by_status.get(GOOD, 0),
        # Used for COP/efficiency = GOOD + SUSPECT (low-ΔT but computable).
        "usableForDiagnosis": by_status.get(GOOD, 0) + by_status.get(SUSPECT, 0),
        # Impossible/inverted readings — retained and surfaced to INVESTIGATE
        # (sensor fault or equipment running abnormally), never silently dropped.
        "impossibleReadings": by_status.get(BAD, 0),
        "flaggedNotDiscarded": len(flagged),
        "episodes": ep_list,
    }


# ────────────────────────────────────────────────────────────────────
# 3. Physics KPIs + diagnostic rules (GOOD rows only)
# ────────────────────────────────────────────────────────────────────
RULE_DESCRIPTIONS = {
    "R-CH-01": f"Low COP alert — COP < {COP_ALERT_THRESHOLD} indicates severe degradation",
    "R-CH-03": f"TOU peak overconsumption — kW > 115% of COP={COP_BENCHMARK_PEAK} benchmark during Oman TOU peak",
}


def run_physics_for_chiller(tagged: list[dict]) -> dict:
    # COP/physics basis: GOOD + SUSPECT (low-ΔT). SUSPECT readings still have a
    # valid (if lower-confidence) COP, so we use them rather than discard. BAD
    # (inverted ΔT / impossible COP), IDLE and MISSING can't yield a COP and stay
    # out of the metric — but they are retained and surfaced as integrity flags
    # (see quality_summary) because an "impossible" reading is itself a signal:
    # a faulty meter, or a chiller genuinely running wrong.
    good = [t for t in tagged if t["status"] in (GOOD, SUSPECT) and t["cop"] is not None]

    monthly: dict[str, dict] = defaultdict(lambda: {"kw": 0.0, "tons": 0.0, "cool_kw": 0.0, "hours": 0})
    rule_totals = {
        rid: {"triggered": 0, "omr": 0.0, "monthly_omr": defaultdict(float), "severity": sev}
        for rid, sev in (("R-CH-01", "HIGH"), ("R-CH-03", "HIGH"))
    }
    sum_cop, sum_kwpt = 0.0, 0.0

    for t in good:
        row = t["row"]
        ts: datetime = row["_ts"]
        cool_kw = calc_cooling_load_kw(t["flow_ls"], t["rt"], t["st"])
        tons = calc_cooling_load_tons(t["flow_ls"], t["rt"], t["st"])
        kwpt = calc_kw_per_ton(t["kw"], tons)
        sum_cop += t["cop"]
        sum_kwpt += kwpt

        m = monthly[row["_month"]]
        m["kw"] += t["kw"]
        m["tons"] += tons
        m["cool_kw"] += cool_kw
        m["hours"] += 1

        rule_row = {
            "cop": t["cop"],
            "ch_kw": t["kw"],
            "cooling_load_tons": tons,
            "tou_rate_bz": get_tou_rate(ts),
            "is_peak": is_tou_peak(ts),
        }
        for rid, fn in (("R-CH-01", rule_rch01_low_cop), ("R-CH-03", rule_rch03_tou_peak)):
            res = fn(rule_row)
            if res.triggered:
                rule_totals[rid]["triggered"] += 1
                rule_totals[rid]["omr"] += res.omr_impact
                rule_totals[rid]["monthly_omr"][row["_month"]] += res.omr_impact

    n_good = len(good)
    months_sorted = sorted(monthly.keys())
    monthly_kwpt = [
        {
            "month": mk,
            "label": month_label(mk),
            "actual": r(monthly[mk]["kw"] / monthly[mk]["tons"], 4) if monthly[mk]["tons"] > 0 else 0,
            "benchmark": KW_PER_TON_BENCHMARK,
        }
        for mk in months_sorted
    ]
    monthly_cop = [
        {
            "month": mk,
            "label": month_label(mk),
            "value": r(monthly[mk]["cool_kw"] / monthly[mk]["kw"], 3) if monthly[mk]["kw"] > 0 else 0,
        }
        for mk in months_sorted
    ]
    rules_out = [
        {
            "ruleId": rid,
            "severity": v["severity"],
            "triggeredHours": v["triggered"],
            "evaluatedHours": n_good,
            "omrImpact": r(v["omr"], 2),
            "description": RULE_DESCRIPTIONS[rid],
        }
        for rid, v in rule_totals.items()
    ]
    return {
        "goodRows": n_good,
        "avgCop": r(sum_cop / n_good, 3) if n_good else 0,
        "avgKwPerTon": r(sum_kwpt / n_good, 4) if n_good else 0,
        "monthlyKwPerTon": monthly_kwpt,
        "monthlyCop": monthly_cop,
        "rules": rules_out,
        "_monthly_rule_omr": {
            rid: dict(v["monthly_omr"]) for rid, v in rule_totals.items()
        },
        "_monthly_raw": {mk: monthly[mk] for mk in months_sorted},
    }


# ────────────────────────────────────────────────────────────────────
# 4. CRT bills (Options 1/2/3 × voltages) via the reference bill engine
# ────────────────────────────────────────────────────────────────────
def plant_kw(row: dict) -> float:
    return row.get("Total_Chiller_kW", 0.0) + row.get("CP_TotalChilledWaterPump_kW", 0.0)


def month_intervals(rows_by_month: dict[str, list[dict]], mk: str) -> list[dict]:
    return [
        {"timestamp_utc": row["_ts_utc"], "kwh": plant_kw(row), "interval_minutes": 60.0}
        for row in rows_by_month[mk]
    ]


def month_peaks_kw(rows: list[dict]) -> tuple[float, float]:
    """(coincident_kw, noncoincident_kw): mean of top-3 kW in day-peak bands, and max kW.
    Mirrors the TS engine's 'top3_peakbands' coincident-peak proxy."""
    all_kw = [plant_kw(row) for row in rows]
    dnc = max(all_kw) if all_kw else 0.0
    peak_kw = [
        plant_kw(row)
        for row in rows
        if classify_band(row["_ts_utc"], SYSTEM)[0] in ("weekday_day_peak", "weekend_day_peak") and plant_kw(row) > 0
    ]
    if peak_kw:
        top = sorted(peak_kw, reverse=True)[:3]
    else:
        top = sorted([v for v in all_kw if v > 0], reverse=True)[:3]
    dc = sum(top) / len(top) if top else 0.0
    return dc, dnc


def compute_bills(rows_by_month: dict[str, list[dict]], config) -> dict:
    bills: dict[str, dict[str, list[dict]]] = {}
    months_sorted = sorted(rows_by_month.keys())
    for voltage in VOLTAGES:
        bills[voltage] = {}
        for option in OPTIONS:
            out = []
            for mk in months_sorted:
                rows = rows_by_month[mk]
                intervals = month_intervals(rows_by_month, mk)
                dc_kw, dnc_kw = month_peaks_kw(rows)
                bill = calculate_crt_bill(
                    site_id=SITE_ID,
                    intervals=intervals,
                    voltage=voltage,
                    system=SYSTEM,
                    tariff_option=option,
                    tariff_year=TARIFF_YEAR,
                    billing_month=int(mk[5:7]),
                    estimated_coincident_mw=dc_kw / 1000.0,
                    estimated_noncoincident_mw=dnc_kw / 1000.0,
                    config=config,
                )
                vat = bill.total_omr * VAT_RATE
                by_band = {
                    BAND_TO_SHORT.get(b, b): {"kwh": r(v["kwh"]), "omr": r(v["omr"], 3)}
                    for b, v in bill.bst_by_band.items()
                }
                out.append({
                    "month": mk,
                    "label": month_label(mk),
                    "hours": len(intervals),
                    "totalKwh": r(bill.total_kwh),
                    "bstOmr": r(bill.bst_omr, 3),
                    "duosOmr": r(bill.duos_omr, 3),
                    "tuosOmr": r(bill.tuos_monthly_omr, 3),
                    "standingOmr": r(bill.standing_omr, 3),
                    "subtotalOmr": r(bill.total_omr, 3),
                    "vatOmr": r(vat, 3),
                    "totalOmr": r(bill.total_omr + vat, 3),
                    "peakKw": r(dnc_kw),
                    "coincidentKw": r(dc_kw),
                    "byBand": by_band,
                })
            bills[voltage][str(option)] = out
    return bills


# ────────────────────────────────────────────────────────────────────
# 5. Bill decomposition (default voltage, Option 1)
# ────────────────────────────────────────────────────────────────────
# Manufacturer / nameplate design COP from client equipment data. Populate per
# deployment (e.g. from the chiller spec sheet). None → fall back to the plant's
# own demonstrated-best COP. The 4.5 COP_BENCHMARK_PEAK is only a last-resort floor.
DESIGN_COP: float | None = None


def resolve_target_cop(plant_cop_by_month: dict[str, float]) -> tuple[float, str]:
    """Efficiency target for the decomposition reference, in priority order:
    1. manufacturer/design COP (client equipment data), else
    2. the plant's demonstrated-best COP (90th-percentile monthly COP), else
    3. the COP_BENCHMARK_PEAK floor."""
    if DESIGN_COP and DESIGN_COP > 0:
        return DESIGN_COP, "design_nameplate"
    cops = sorted(v for v in plant_cop_by_month.values() if v > 0)
    if cops:
        idx = min(len(cops) - 1, int(0.9 * (len(cops) - 1)))
        return cops[idx], "demonstrated_best_p90"
    return COP_BENCHMARK_PEAK, "benchmark_floor"


def compute_decomposition(
    rows_by_month: dict[str, list[dict]],
    config,
    monthly_physics_omr: dict[str, float],
    plant_cop_by_month: dict[str, float],
    target_cop: float,
) -> dict:
    """Decompose each month's bill against an EFFICIENT reference: the same load
    with the chillers scaled to `target_cop` (manufacturer/design COP, else the
    plant's demonstrated best). Operational = the correctable cost of running
    below that target. Also reports the signed TOU-vs-flat tariff effect."""
    months_sorted = sorted(rows_by_month.keys())

    def chiller_kw(row: dict) -> float:
        return row.get("Total_Chiller_kW", 0.0)

    def pump_kw(row: dict) -> float:
        return row.get("CP_TotalChilledWaterPump_kW", 0.0)

    def eff_peaks(load_by_row: list[tuple[dict, float]]) -> tuple[float, float]:
        vals = [v for _, v in load_by_row]
        dnc = max(vals) if vals else 0.0
        peak_band = [
            v for row, v in load_by_row
            if classify_band(row["_ts_utc"], SYSTEM)[0] in ("weekday_day_peak", "weekend_day_peak") and v > 0
        ]
        top = sorted(peak_band, reverse=True)[:3] if peak_band else sorted([v for v in vals if v > 0], reverse=True)[:3]
        dc = sum(top) / len(top) if top else 0.0
        return dc, dnc

    out = []
    for mk in months_sorted:
        rows = rows_by_month[mk]
        intervals = month_intervals(rows_by_month, mk)
        dc_kw, dnc_kw = month_peaks_kw(rows)

        # Efficiency factor: chillers serving the SAME cooling at the target COP
        # would draw (actual_cop / target_cop) of the energy. At/above target → 1
        # (no correctable waste). Pumps are not COP-rated, so they pass through.
        actual_cop = plant_cop_by_month.get(mk, 0.0)
        factor = min(1.0, actual_cop / target_cop) if (target_cop > 0 and actual_cop > 0) else 1.0

        eff_load = [(row, pump_kw(row) + chiller_kw(row) * factor) for row in rows]
        ref_intervals = [
            {"timestamp_utc": row["_ts_utc"], "kwh": v, "interval_minutes": 60.0}
            for row, v in eff_load
        ]
        ref_dc_kw, ref_dnc_kw = eff_peaks(eff_load)
        profile = f"efficient_cop_{target_cop:.2f}"

        actual_bill = calculate_crt_bill(
            site_id=SITE_ID, intervals=intervals, voltage=DEFAULT_VOLTAGE, system=SYSTEM,
            tariff_option=1, tariff_year=TARIFF_YEAR, billing_month=int(mk[5:7]),
            estimated_coincident_mw=dc_kw / 1000.0, estimated_noncoincident_mw=dnc_kw / 1000.0,
            config=config,
        )
        # Option 3 (flat) on the SAME load → signed TOU-vs-flat effect (− = TOU saves).
        flat_bill = calculate_crt_bill(
            site_id=SITE_ID, intervals=intervals, voltage=DEFAULT_VOLTAGE, system=SYSTEM,
            tariff_option=3, tariff_year=TARIFF_YEAR, billing_month=int(mk[5:7]),
            estimated_coincident_mw=dc_kw / 1000.0, estimated_noncoincident_mw=dnc_kw / 1000.0,
            config=config,
        )
        tariff_effect_omr = actual_bill.bst_omr - flat_bill.bst_omr

        dec = decompose_bill(
            actual_bill=actual_bill, actual_intervals=intervals, reference_intervals=ref_intervals,
            config=config, voltage=DEFAULT_VOLTAGE, system=SYSTEM, reference_profile=profile,
            benchmark_coincident_mw=ref_dc_kw / 1000.0, benchmark_noncoincident_mw=ref_dnc_kw / 1000.0,
        )

        physics_omr = monthly_physics_omr.get(mk, 0.0)
        # VAT-inclusive so the decomposition reconciles with the monthly bill table.
        vat = 1.0 + VAT_RATE
        total = dec.total_omr * vat
        reference_total = dec.reference_total_omr * vat
        structural = min(dec.structural_omr * vat, total)
        operational = max(0.0, total - structural)
        out.append({
            "month": mk,
            "label": month_label(mk),
            "totalOmr": r(total, 3),
            "structuralOmr": r(structural, 3),
            "structuralPct": r(structural / total * 100 if total > 0 else 0.0, 1),
            # Signed TOU-vs-flat effect (+ premium / − saving). A separate lens,
            # NOT part of the structural/operational partition.
            "tariffDrivenOmr": r(tariff_effect_omr * vat, 3),
            "tariffDrivenPct": r(tariff_effect_omr * vat / total * 100 if total > 0 else 0.0, 1),
            "operationalOmr": r(operational, 3),
            "operationalPct": r(operational / total * 100 if total > 0 else 0.0, 1),
            "targetCop": r(target_cop, 3),
            "actualCop": r(actual_cop, 3),
            # Physics-diagnosed subset of operational waste (R-CH-01 + R-CH-03)
            "physicsOmr": r(min(physics_omr, operational / vat) * vat, 3),
            "physicsRawOmr": r(physics_omr * vat, 3),
            "referenceTotalOmr": r(reference_total, 3),
            "referenceProfile": profile,
            "betterThanReference": False,
            "savingsVsReferenceOmr": 0.0,
            "operationalComponents": {
                k: r(v * vat, 3) for k, v in dec.operational_components.items()
            },
        })
    return {"voltage": DEFAULT_VOLTAGE, "option": 1, "targetCop": r(target_cop, 3), "months": out}


# ────────────────────────────────────────────────────────────────────
# 6. Parity check vs the dashboard's TypeScript tariffEngine.ts formulas
# ────────────────────────────────────────────────────────────────────
# These constants intentionally duplicate src/lib/tariffEngine.ts — the point
# is to verify the TS engine the UI uses reconciles with the Python engine.
TS_BST = {
    "Jan-Mar": {"OP": 12, "NP": 12, "WDP": 12, "WEDP": 12},
    "Apr": {"OP": 16, "NP": 16, "WDP": 16, "WEDP": 16},
    "May-Jul": {"OP": 19, "NP": 46, "WDP": 36, "WEDP": 28},
    "Aug-Sep": {"OP": 17, "NP": 27, "WDP": 20, "WEDP": 20},
    "Oct": {"OP": 16, "NP": 16, "WDP": 16, "WEDP": 16},
    "Nov-Dec": {"OP": 12, "NP": 12, "WDP": 12, "WEDP": 12},
}
TS_DIST = {"33kV": 4.0, "11kV": 5.0, "0.415kV": 10.6}
TS_CAPACITY = {"CGR": 6775, "CPR": 7691, "NCPR": 1839}
TS_SUPPLY_PER_YEAR = 50


def ts_month_block(m: int) -> str:
    if m <= 3:
        return "Jan-Mar"
    if m == 4:
        return "Apr"
    if m <= 7:
        return "May-Jul"
    if m <= 9:
        return "Aug-Sep"
    if m == 10:
        return "Oct"
    return "Nov-Dec"


def ts_tou_band(ts_local: datetime) -> str:
    hm = ts_local.hour * 60 + ts_local.minute
    is_weekend = ts_local.weekday() in (4, 5)  # Fri, Sat
    if hm >= 22 * 60 or hm <= 2 * 60 + 59:
        return "NP"
    if 13 * 60 <= hm <= 15 * 60 + 59:
        return "WEDP" if is_weekend else "WDP"
    return "OP"


def ts_engine_subtotal(rows: list[dict], voltage: str) -> float:
    """Re-implementation of calculateMonthlyDetailedBills() subtotal (pre-VAT) for one month."""
    energy = 0.0
    kw_all, kw_peak = [], []
    for row in rows:
        ts = row["_ts"]
        kwh = plant_kw(row)
        band = ts_tou_band(ts)
        bst = TS_BST[ts_month_block(ts.month)][band]
        energy += (kwh / 1000.0) * (bst + TS_DIST[voltage])
        kw_all.append(kwh)
        if band in ("WDP", "WEDP") and kwh > 0:
            kw_peak.append(kwh)
    dnc = max(kw_all) if kw_all else 0.0
    pool = sorted(kw_peak or [v for v in kw_all if v > 0], reverse=True)[:3]
    dc = sum(pool) / len(pool) if pool else 0.0
    capacity = (
        dc * TS_CAPACITY["CPR"] / 12000.0
        + dnc * TS_CAPACITY["NCPR"] / 12000.0
        + dc * TS_CAPACITY["CGR"] / 12000.0
    )
    return energy + capacity + TS_SUPPLY_PER_YEAR / 12.0


def parity_check(rows_by_month: dict[str, list[dict]], bills: dict) -> dict:
    max_diff_pct = 0.0
    worst = None
    checked = 0
    for voltage in VOLTAGES:
        for bill in bills[voltage]["1"]:
            mk = bill["month"]
            ts_subtotal = ts_engine_subtotal(rows_by_month[mk], voltage)
            py_subtotal = bill["subtotalOmr"]
            if py_subtotal <= 0:
                continue
            diff_pct = abs(ts_subtotal - py_subtotal) / py_subtotal * 100.0
            checked += 1
            if diff_pct > max_diff_pct:
                max_diff_pct = diff_pct
                worst = {"month": mk, "voltage": voltage, "ts": r(ts_subtotal, 3), "py": r(py_subtotal, 3)}
    tolerance_pct = 0.5
    passed = max_diff_pct <= tolerance_pct
    return {
        "checkedBills": checked,
        "maxDiffPct": r(max_diff_pct, 4),
        "tolerancePct": tolerance_pct,
        "pass": passed,
        "worst": worst,
    }


# ────────────────────────────────────────────────────────────────────
# Main
# ────────────────────────────────────────────────────────────────────
def main() -> None:
    print(f"Enerlytics reference repo: {REPO_PATH}")
    rows = load_rows()
    print(f"Total rows: {len(rows)}  ({rows[0]['timestamp']} → {rows[-1]['timestamp']})")

    config = load_tariff_config(TARIFF_YEAR, SYSTEM)

    # ── Data quality + physics per chiller ──────────────────────────
    data_quality_per_chiller: dict[str, dict] = {}
    physics_per_chiller: dict[str, dict] = {}
    plant_monthly = defaultdict(lambda: {"kw": 0.0, "tons": 0.0, "cool_kw": 0.0})
    total_by_status: dict[str, int] = defaultdict(int)
    monthly_physics_omr: dict[str, float] = defaultdict(float)
    plant_rules: dict[str, dict] = {
        rid: {"triggered": 0, "omr": 0.0} for rid in ("R-CH-01", "R-CH-03")
    }
    plant_cop_sum, plant_cop_n = 0.0, 0

    # COP/efficiency basis: 2-hour blocks (smooths single-hour sensor noise so
    # more true data passes QA). Bills/decomposition energy still use `rows`.
    rows_2h = aggregate_2h(rows)
    print(f"Physics basis: {len(rows_2h)} 2-hour blocks (from {len(rows)} hourly rows)")

    for n in (1, 2, 3):
        tagged = classify_chiller_rows(rows_2h, n)
        dq = quality_summary(tagged)
        data_quality_per_chiller[str(n)] = dq
        for k, v in dq["byStatus"].items():
            total_by_status[k] += v

        phys = run_physics_for_chiller(tagged)
        for mk, raw in phys.pop("_monthly_raw").items():
            plant_monthly[mk]["kw"] += raw["kw"]
            plant_monthly[mk]["tons"] += raw["tons"]
            plant_monthly[mk]["cool_kw"] += raw["cool_kw"]
        for rid, by_month in phys.pop("_monthly_rule_omr").items():
            for mk, omr in by_month.items():
                monthly_physics_omr[mk] += omr
        for rule in phys["rules"]:
            plant_rules[rule["ruleId"]]["triggered"] += rule["triggeredHours"]
            plant_rules[rule["ruleId"]]["omr"] += rule["omrImpact"]
        if phys["goodRows"] > 0:
            plant_cop_sum += phys["avgCop"] * phys["goodRows"]
            plant_cop_n += phys["goodRows"]
        physics_per_chiller[str(n)] = phys
        print(f"  Chiller {n}: GOOD={dq['goodForDiagnosis']}/{dq['totalRows']}  avgCOP={phys['avgCop']}")

    plant_months = sorted(plant_monthly.keys())
    plant_monthly_kwpt = [
        {
            "month": mk,
            "label": month_label(mk),
            "actual": r(plant_monthly[mk]["kw"] / plant_monthly[mk]["tons"], 4) if plant_monthly[mk]["tons"] > 0 else 0,
            "benchmark": KW_PER_TON_BENCHMARK,
        }
        for mk in plant_months
    ]
    plant_monthly_cop = [
        {
            "month": mk,
            "label": month_label(mk),
            "value": r(plant_monthly[mk]["cool_kw"] / plant_monthly[mk]["kw"], 3) if plant_monthly[mk]["kw"] > 0 else 0,
        }
        for mk in plant_months
    ]
    plant_rules_out = [
        {
            "ruleId": rid,
            "severity": "HIGH",
            "triggeredHours": v["triggered"],
            "evaluatedHours": plant_cop_n,
            "omrImpact": r(v["omr"], 2),
            "description": RULE_DESCRIPTIONS[rid],
        }
        for rid, v in plant_rules.items()
    ]

    # ── CRT bills + decomposition ───────────────────────────────────
    rows_by_month: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        rows_by_month[row["_month"]].append(row)

    print("Computing CRT bills (3 options × 3 voltages)…")
    bills = compute_bills(rows_by_month, config)

    option_totals = {
        voltage: {
            opt: {
                "totalOmr": r(sum(b["totalOmr"] for b in bills[voltage][opt]), 2),
                "energyOmr": r(sum(b["bstOmr"] + b["duosOmr"] for b in bills[voltage][opt]), 2),
                "months": len(bills[voltage][opt]),
            }
            for opt in map(str, OPTIONS)
        }
        for voltage in VOLTAGES
    }

    print("Computing bill decomposition…")
    plant_cop_by_month = {
        mk: plant_monthly[mk]["cool_kw"] / plant_monthly[mk]["kw"]
        for mk in plant_months if plant_monthly[mk]["kw"] > 0
    }
    target_cop, target_basis = resolve_target_cop(plant_cop_by_month)
    print(f"  efficiency target COP: {target_cop:.3f} ({target_basis})")
    decomposition = compute_decomposition(
        rows_by_month, config, dict(monthly_physics_omr), plant_cop_by_month, target_cop
    )

    print("Running TS↔Python tariff parity check…")
    parity = parity_check(rows_by_month, bills)
    print(f"  parity: checked={parity['checkedBills']} maxDiff={parity['maxDiffPct']}% pass={parity['pass']}")
    if not parity["pass"]:
        sys.exit(f"ERROR: parity check failed — TS and Python engines diverge: {parity['worst']}")

    output = {
        "meta": {
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "engine": "enerlytics reference platform (Python)",
            "tariffConfigYear": TARIFF_YEAR,
            "system": SYSTEM,
            "siteId": SITE_ID,
            "dataRange": {"from": rows[0]["timestamp"], "to": rows[-1]["timestamp"], "totalRows": len(rows)},
            "notes": [
                "CSV timestamps treated as Oman local time (UTC+4, no DST).",
                "Chilled-water flow converted GPM → L/s (factor 0.0630902).",
                "APSR CRT 2025 MIS rates applied to historical load (demo).",
                "VAT (5%) added on top of CRT total for display consistency.",
            ],
        },
        "dataQuality": {
            "totalRows": len(rows) * 3,
            "byStatus": dict(total_by_status),
            "perChiller": data_quality_per_chiller,
        },
        "physics": {
            "constants": {
                "copAlertThreshold": COP_ALERT_THRESHOLD,
                "copBenchmarkPeak": COP_BENCHMARK_PEAK,
                "kwPerTonBenchmark": KW_PER_TON_BENCHMARK,
                "copPhysicalBounds": [COP_PHYSICAL_MIN, COP_PHYSICAL_MAX],
                "kwPerTonRefrigeration": KW_PER_TON_REFRIGERATION,
            },
            "perChiller": physics_per_chiller,
            "plant": {
                "avgCop": r(plant_cop_sum / plant_cop_n, 3) if plant_cop_n else 0,
                "goodRows": plant_cop_n,
                "monthlyKwPerTon": plant_monthly_kwpt,
                "monthlyCop": plant_monthly_cop,
                "rules": plant_rules_out,
            },
            "notApplicableRules": [
                {"ruleId": "R-CH-02", "reason": "Condenser fouling needs outdoor wet-bulb (no OAT/RH signal in dataset)"},
                {"ruleId": "R-PU-01/02", "reason": "Pump efficiency rules need head (kPa) signal — not in dataset"},
                {"ruleId": "R-CT-01/02", "reason": "Tower approach/effectiveness need wet-bulb — not in dataset"},
            ],
            "monthlyPhysicsOmr": [
                {"month": mk, "label": month_label(mk), "omr": r(v, 3)}
                for mk, v in sorted(monthly_physics_omr.items())
            ],
        },
        "tariff": {
            "voltages": VOLTAGES,
            "options": OPTIONS,
            "defaultVoltage": DEFAULT_VOLTAGE,
            "bills": bills,
            "optionTotals": option_totals,
        },
        "decomposition": decomposition,
        "parity": parity,
    }

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_FILE, "w", encoding="utf-8") as fh:
        json.dump(output, fh, indent=1)
    print(f"\nWrote {OUT_FILE} ({OUT_FILE.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    main()
