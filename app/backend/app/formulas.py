"""
Core ingestion + calculation engine.

Formulas here are ported from two sources that were reverse-engineered and
cross-validated against each other before this file was written:
  - the original HTML dashboard (BE Unavailability Control Tower), specifically
    its SKU-level hydrateAvail() path, and
  - the source Excel ("Copy of DataFinal" sheet, columns H-Y).

One deliberate choice: this engine uses a single DOI-threshold rule for BOTH
normal (SKU-count) and weighted (demand-CPD) availability, matching the HTML
dashboard's validated approach. The Excel used two different rules (inventory>0
for "normal", DOI<threshold for "weighted") - that split was not reproduced
here since the HTML's unified rule was the one with documented accuracy
validation behind it.
"""
from __future__ import annotations

import re
from typing import Optional

import numpy as np
import pandas as pd

from .regions import region_of

DOI_DEFAULT_THRESHOLD = 3.0

COLUMN_CANDIDATES = {
    "wh": ["warehouse_name", "facility_name", "warehouse", "facility"],
    "brand": ["brand_name", "brand"],
    "item": ["item_name", "item", "sku_name", "skusname"],
    "cpd": ["avg_cpd", "warehouse_cpd", "cpd"],
    "inventory": ["wh_current_inventory", "be_current_inventory", "current_inventory", "inventory"],
    "doi": ["current_doi", "backend_doi", "doi"],
    "category": ["category", "cat"],
    "ptype": ["p_type", "ptype", "product_type"],
    "region": ["region"],
    "sales": ["actual_sales", "sales"],
    "open_po": ["open_po_qty", "openpo"],
    "assortment_status": ["assortment_status", "assortmentstatus", "sku_status", "skustatus"],
}

ACTIVE_ASSORTMENT_VALUES = {"active"}

# Feeder/test/decommissioned warehouses that show up in the source data but
# aren't real fulfillment centers to report availability on - excluded at
# ingestion so they never reach any calculation, view, or filter dropdown.
EXCLUDED_WAREHOUSES = {
    "cpc - chennai2 (hp)",
    "cpc - tcigurgaon1 (hp)",
    "farukhnagar - sr feeder warehouse",
    "ludhiana - feeder warehouse",
    "not in use",
    "super store dasna 2 - warehouse",
    "super store hyderabad h2 - warehouse",
    "super store kolkata k3 holisol - warehouse",
    "bengaluru b3 - feeder warehouse",
}

REQUIRED_FIELDS = ["wh", "brand", "cpd"]


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", str(s).lower())


def _pick_column(cols_norm: dict[str, str], candidates: list[str]) -> Optional[str]:
    cand_norm = [_norm(c) for c in candidates]
    for cn in cand_norm:
        if cn in cols_norm:
            return cols_norm[cn]
    for cn in cand_norm:
        if not cn:
            continue
        for col_norm, orig in cols_norm.items():
            if cn in col_norm:
                return orig
    return None


class ColumnNotFoundError(ValueError):
    def __init__(self, field: str, available: list[str]):
        self.field = field
        self.available = available
        super().__init__(
            f"Could not find a column for '{field}'. "
            f"Tried: {COLUMN_CANDIDATES.get(field)}. "
            f"Columns in file: {available}"
        )


def load_dataframe(raw: pd.DataFrame, doi_threshold: float = DOI_DEFAULT_THRESHOLD) -> pd.DataFrame:
    """Normalize an arbitrary uploaded sheet into the canonical SKU-level schema."""
    cols_norm = {_norm(c): c for c in raw.columns}

    def col_for(field: str, required: bool) -> Optional[str]:
        found = _pick_column(cols_norm, COLUMN_CANDIDATES[field])
        if found is None and required:
            raise ColumnNotFoundError(field, list(raw.columns))
        return found

    # Source files can carry Discontinued/Inactive/Temp Inactive rows
    # alongside Active ones (e.g. the BE_Superset_Daily export's
    # assortment_status column) - those aren't real, currently-stocked
    # assortment and including them drags every availability number down.
    # The dashboard only ever reports on Active assortment, matching what
    # the company's own numbers are scoped to - so drop everything else at
    # ingestion, before any calculation sees it. No-op when the column
    # isn't present in a given upload.
    status_col = col_for("assortment_status", False)
    if status_col:
        is_active = raw[status_col].astype(str).str.strip().str.lower().isin(ACTIVE_ASSORTMENT_VALUES)
        raw = raw[is_active].reset_index(drop=True)

    out = pd.DataFrame(index=raw.index)
    out["wh"] = raw[col_for("wh", True)].astype(str).str.strip()
    out["brand"] = raw[col_for("brand", True)].astype(str).str.strip()

    not_excluded_wh = ~out["wh"].str.lower().isin(EXCLUDED_WAREHOUSES)
    out = out[not_excluded_wh]
    raw = raw[not_excluded_wh].reset_index(drop=True)
    out = out.reset_index(drop=True)

    item_col = col_for("item", False)
    out["item"] = raw[item_col].astype(str).str.strip() if item_col else (out["wh"] + " | " + out["brand"])

    out["cpd"] = pd.to_numeric(raw[col_for("cpd", True)], errors="coerce").fillna(0.0)

    inv_col = col_for("inventory", False)
    out["inventory"] = pd.to_numeric(raw[inv_col], errors="coerce").fillna(0.0) if inv_col else 0.0

    doi_col = col_for("doi", False)
    if doi_col:
        out["doi"] = pd.to_numeric(raw[doi_col], errors="coerce")
    else:
        out["doi"] = np.nan
    derived_doi = out["inventory"] / out["cpd"].replace(0, np.nan)
    out["doi"] = out["doi"].fillna(derived_doi).fillna(0.0)

    cat_col = col_for("category", False)
    out["category"] = raw[cat_col].astype(str).str.strip() if cat_col else "Uncategorized"

    region_col = col_for("region", False)
    fallback_region = out["wh"].apply(region_of)
    if region_col:
        provided = raw[region_col]
        is_blank = provided.isna() | (provided.astype(str).str.strip().isin(["", "nan", "None", "#N/A"]))
        out["region"] = provided.astype(str).str.strip().where(~is_blank, fallback_region)
    else:
        out["region"] = fallback_region

    sales_col = col_for("sales", False)
    out["sales"] = pd.to_numeric(raw[sales_col], errors="coerce").fillna(0.0) if sales_col else 0.0

    po_col = col_for("open_po", False)
    out["open_po"] = pd.to_numeric(raw[po_col], errors="coerce").fillna(0.0) if po_col else 0.0

    out["is_unavail"] = out["doi"] < doi_threshold
    out["unavail_cpd"] = np.where(out["is_unavail"], out["cpd"], 0.0)

    return out.reset_index(drop=True)


def sev_color(v: float) -> str:
    if v <= 5:
        return "#2e7d5b"
    if v <= 15:
        return "#7ba05b"
    if v <= 30:
        return "#c9a227"
    if v <= 50:
        return "#d97e30"
    return "#b03a2e"


def avail_color(v: float) -> str:
    return sev_color(100 - v)


def apply_filters(
    df: pd.DataFrame,
    region: Optional[list[str]] = None,
    wh: Optional[list[str]] = None,
    brand: Optional[list[str]] = None,
    category: Optional[list[str]] = None,
    min_cpd: Optional[float] = None,
) -> pd.DataFrame:
    d = df
    if region:
        d = d[d["region"].isin(region)]
    if wh:
        d = d[d["wh"].isin(wh)]
    if brand:
        d = d[d["brand"].isin(brand)]
    if category:
        d = d[d["category"].isin(category)]
    if min_cpd:
        d = d[d["cpd"] >= min_cpd]
    return d


def aggregate(df: pd.DataFrame, group_cols: list[str]) -> pd.DataFrame:
    if df.empty:
        return pd.DataFrame(columns=group_cols + [
            "cpd", "unavail_cpd", "n", "ok_n", "inventory", "open_po", "sales",
            "unavail_pct", "avail_wtd", "norm_avail", "norm_unavail",
        ])
    g = df.groupby(group_cols, dropna=False)
    out = g.agg(
        cpd=("cpd", "sum"),
        unavail_cpd=("unavail_cpd", "sum"),
        n=("cpd", "size"),
        ok_n=("is_unavail", lambda s: int((~s).sum())),
        inventory=("inventory", "sum"),
        open_po=("open_po", "sum"),
        sales=("sales", "sum"),
    ).reset_index()
    out["unavail_pct"] = np.where(out["cpd"] > 0, out["unavail_cpd"] / out["cpd"] * 100, 0.0)
    out["avail_wtd"] = 100 - out["unavail_pct"]
    out["norm_avail"] = np.where(out["n"] > 0, out["ok_n"] / out["n"] * 100, 0.0)
    out["norm_unavail"] = 100 - out["norm_avail"]
    return out


def compute_kpis(full_df: pd.DataFrame, filtered_df: pd.DataFrame) -> dict:
    d = filtered_df
    total_cpd = float(d["cpd"].sum())
    total_unavail_cpd = float(d["unavail_cpd"].sum())
    unavail_pct = (total_unavail_cpd / total_cpd * 100) if total_cpd else 0.0
    n = len(d)
    ok_n = int((~d["is_unavail"]).sum()) if n else 0
    norm_avail = (ok_n / n * 100) if n else 0.0
    is_filtered = len(d) != len(full_df)
    pan_total = float(full_df["cpd"].sum())
    return {
        "unavail_weighted": unavail_pct,
        "avail_weighted": 100 - unavail_pct,
        "unavail_normal": 100 - norm_avail,
        "avail_normal": norm_avail,
        "unavail_cpd": total_unavail_cpd,
        "total_cpd": total_cpd,
        "pct_of_pan": (total_unavail_cpd / pan_total * 100) if (is_filtered and pan_total) else None,
        "active_skus": n,
        "warehouses": int(d["wh"].nunique()),
        "brands": int(d["brand"].nunique()),
        "is_filtered": is_filtered,
    }


def rollup(df: pd.DataFrame, by: str) -> list[dict]:
    g = aggregate(df, [by])
    total_unavail = float(g["unavail_cpd"].sum())
    total_cpd = float(g["cpd"].sum())
    g["loss_share_pct"] = np.where(total_unavail > 0, g["unavail_cpd"] / total_unavail * 100, 0.0)
    g["demand_share_pct"] = np.where(total_cpd > 0, g["cpd"] / total_cpd * 100, 0.0)
    if by == "wh":
        g["region"] = g["wh"].apply(region_of)
    g = g.sort_values("unavail_cpd", ascending=False)
    return g.to_dict("records")


def matrix(df: pd.DataFrame) -> dict:
    g = aggregate(df, ["wh", "brand"])
    warehouses = sorted(df["wh"].unique().tolist())
    brands = sorted(df["brand"].unique().tolist())
    cell_map = {(r["wh"], r["brand"]): r for r in g.to_dict("records")}
    rows = []
    for w in warehouses:
        row_cells = {}
        for b in brands:
            c = cell_map.get((w, b))
            if c:
                row_cells[b] = {
                    "cpd": c["cpd"], "unavail_cpd": c["unavail_cpd"],
                    "unavail_pct": c["unavail_pct"], "avail_wtd": c["avail_wtd"],
                    "norm_avail": c["norm_avail"],
                }
        wh_rows = df[df["wh"] == w]
        rows.append({
            "wh": w, "region": region_of(w),
            "total_cpd": float(wh_rows["cpd"].sum()),
            "total_unavail_cpd": float(wh_rows["unavail_cpd"].sum()),
            "cells": row_cells,
        })
    return {"warehouses": warehouses, "brands": brands, "rows": rows}


def pan_india(full_df: pd.DataFrame, filtered_df: pd.DataFrame, mode: str = "brand") -> list[dict]:
    TOT = float(full_df["cpd"].sum())
    key_col = "brand" if mode == "brand" else "item"
    rows = []
    for key, sub in filtered_df.groupby(key_col, dropna=False):
        cpd = float(sub["cpd"].sum())
        un = float(sub["unavail_cpd"].sum())
        n = len(sub)
        ok_n = int((~sub["is_unavail"]).sum())
        rows.append({
            "key": key,
            "brand": sub["brand"].iloc[0],
            "category": sub["category"].iloc[0] if "category" in sub.columns else None,
            "cpd": cpd,
            "weight_pct": (cpd / TOT * 100) if TOT else 0.0,
            "unavail_cpd": un,
            "unavail_pan": (un / TOT * 100) if TOT else 0.0,
            "unavail_within": (un / cpd * 100) if cpd else 0.0,
            "avail_wtd": 100 - ((un / cpd * 100) if cpd else 0.0),
            "norm_avail": (ok_n / n * 100) if n else 0.0,
            "wh_count": int(sub["wh"].nunique()),
            "sku_count": int(sub["item"].nunique()) if mode == "brand" else 1,
            "inventory": float(sub["inventory"].sum()),
            "open_po": float(sub["open_po"].sum()),
        })
    rows.sort(key=lambda r: -r["cpd"])
    run = 0.0
    for r in rows:
        run += r["weight_pct"]
        r["cumulative_pct"] = run
    return rows


def pan_india_cut(rows: list[dict], top_pct: float) -> list[dict]:
    if top_pct >= 100:
        return rows
    n = 0
    for i, r in enumerate(rows):
        n = i + 1
        if r["cumulative_pct"] >= top_pct:
            break
    return rows[:n]


def priority_queue(df: pd.DataFrame, top_n: int = 15) -> list[dict]:
    g = aggregate(df, ["wh", "brand"])
    if g.empty:
        return []
    total_unavail = float(g["unavail_cpd"].sum())
    g["loss_share_pct"] = np.where(total_unavail > 0, g["unavail_cpd"] / total_unavail * 100, 0.0)
    g["region"] = g["wh"].apply(region_of)
    g = g.sort_values("unavail_cpd", ascending=False).head(top_n)
    return g.to_dict("records")


def wh_item_grid(df: pd.DataFrame, brand: Optional[str] = None, top_n: int = 30) -> dict:
    d = df if not brand or brand == "__TOP__" else df[df["brand"] == brand]
    item_cpd = d.groupby("item")["cpd"].sum().sort_values(ascending=False)
    items = item_cpd.head(top_n).index.tolist()
    wh_cpd = d.groupby("wh")["cpd"].sum()
    wh_cpd = wh_cpd[wh_cpd > 0].sort_values(ascending=False)
    whs = wh_cpd.index.tolist()
    total_all = float(df["cpd"].sum())

    sub = d[d["item"].isin(items)]
    item_brand = sub.groupby("item")["brand"].first().to_dict()
    cell_map = {(r["item"], r["wh"]): r for r in sub.to_dict("records")}

    rows = []
    for it in items:
        present = [cell_map[(it, w)] for w in whs if (it, w) in cell_map]
        icpd = sum(p["cpd"] for p in present)
        iav = (sum(p["cpd"] * (1 - p["unavail_cpd"] / p["cpd"] if p["cpd"] else 0) for p in present) / icpd * 100) if icpd else 0.0
        cells = {}
        for w in whs:
            p = cell_map.get((it, w))
            if not p:
                continue
            cells[w] = {
                "cpd": p["cpd"], "inventory": p["inventory"], "doi": p["doi"],
                "status": "OUT" if (p["is_unavail"] and p["inventory"] <= 0) else ("LOW" if p["is_unavail"] else "OK"),
            }
        rows.append({
            "item": it, "brand": item_brand.get(it, ""),
            "pan_cpd": icpd, "weight_pct": (icpd / total_all * 100) if total_all else 0.0,
            "avail_wtd": iav, "cells": cells,
        })
    return {"items": rows, "warehouses": whs}
