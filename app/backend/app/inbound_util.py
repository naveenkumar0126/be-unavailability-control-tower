"""
Inbound capacity utilization (the "DOD Tracker") - daily, per warehouse:
how much of the day's inbound dock capacity actually got used.

Utilization = GRN ÷ Inbound Cap, matching the source file's own "IB
Utilization" column exactly (verified against real rows).
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .util import parse_numeric, pick_column

COLUMN_CANDIDATES = {
    "date": ["date"],
    "wh": ["warehouse", "warehouse_code", "facility"],
    "zone": ["zone", "region"],
    "cap": ["inboundcap", "inbound_cap", "capacity"],
    "planned": ["plannedqty", "planned_qty", "planned"],
    "grn": ["grnqty", "grn_qty", "grn"],
    "failed": ["failedqty", "failed_qty", "failed"],
}

LOW_UTILIZATION_THRESHOLD = 85.0


def load_inbound_df(raw: pd.DataFrame) -> pd.DataFrame:
    cols = list(raw.columns)

    def col(field, required=True):
        found = pick_column(cols, COLUMN_CANDIDATES[field])
        if found is None and required:
            raise KeyError(f"Could not find a column for '{field}' in the inbound utilization file.")
        return found

    df = pd.DataFrame()
    df["date"] = pd.to_datetime(raw[col("date")], errors="coerce", format="mixed", dayfirst=True)
    df["wh"] = raw[col("wh")].fillna("").astype(str).str.strip()
    zone_col = col("zone", required=False)
    df["zone"] = raw[zone_col].fillna("").astype(str).str.strip() if zone_col else ""
    df["cap"] = parse_numeric(raw[col("cap")])
    df["planned"] = parse_numeric(raw[col("planned")])
    df["grn"] = parse_numeric(raw[col("grn")])
    failed_col = col("failed", required=False)
    df["failed"] = parse_numeric(raw[failed_col]) if failed_col else 0.0

    return df.dropna(subset=["date"]).reset_index(drop=True)


def last_n_days(df: pd.DataFrame, n: int = 7) -> pd.DataFrame:
    dates = sorted(df["date"].dropna().unique())[-n:]
    d = df[df["date"].isin(dates)].copy()
    d["utilization_pct"] = np.where(d["cap"] > 0, d["grn"] / d["cap"] * 100, 0.0)
    d["is_low"] = d["utilization_pct"] < LOW_UTILIZATION_THRESHOLD
    return d.sort_values(["wh", "date"], ascending=[True, False])


def wh_summary(df: pd.DataFrame, n: int = 7) -> pd.DataFrame:
    """One row per warehouse: average utilization over the last n days, and
    how many of those days were below the low-utilization threshold."""
    d = last_n_days(df, n)
    g = d.groupby("wh").agg(
        zone=("zone", "first"),
        days=("date", "nunique"),
        avg_cap=("cap", "mean"),
        avg_planned=("planned", "mean"),
        avg_grn=("grn", "mean"),
        avg_utilization=("utilization_pct", "mean"),
        low_days=("is_low", "sum"),
    ).reset_index()
    return g.sort_values("avg_utilization")
