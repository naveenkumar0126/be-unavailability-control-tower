"""
Festive stock-readiness, per product type ("ptype" - e.g. Khoya, Rasmalai,
Sabudana Tikki for Sawan). Same shape the original dashboard's festive
tracker used: need = Projection + BAU/Safety, achievement read as-given
from the sheet when present (it's maintained by the planning team,
possibly on a different refresh cycle than inventory), only derived when
absent.

Some ptype files are SKU-level (have item_name), others are brand-level
only (no item_name column at all) - both grains are handled, falling back
to brand as the row key when there's no item_name.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .regions import region_of
from .util import parse_numeric, parse_percent, pick_column

COLUMN_CANDIDATES = {
    "wh": ["facility_name", "warehouse_name", "warehouse"],
    "brand": ["brand_name", "brand"],
    "item": ["item_name", "item"],
    "inventory": ["sumofbecurrentinventory", "be_current_inventory", "current_inventory"],
    "fe_inventory": ["sumoffecurrentinventory", "fe_current_inventory"],
    "cpd": ["sumofcpd", "cpd"],
    "open_po": ["sumofopenpoqty", "open_po_qty"],
    "projection": ["sumofprojection", "projection"],
    "bau_safety": ["sumofbausafety", "bau+safety", "bau_safety"],
    "requirement": ["totalrequirement", "total_requirement"],
    "ach_be": ["achievemntbe", "achievementbe"],
    "ach_po": ["achievemntbeopenpo", "achievementbeopenpo", "achievemntbe+openpo"],
    "remark": ["remarks", "remark"],
}

NON_WAREHOUSE_LABELS = {"grand total", "total", "subtotal", "sub total"}


def load_festive_df(raw: pd.DataFrame, ptype: str) -> pd.DataFrame:
    cols = list(raw.columns)

    def col(field, required=True):
        found = pick_column(cols, COLUMN_CANDIDATES[field])
        if found is None and required:
            raise KeyError(f"Could not find a column for '{field}' in the {ptype} festive file.")
        return found

    df = pd.DataFrame()
    df["wh"] = raw[col("wh")].fillna("").astype(str).str.strip()
    df["brand"] = raw[col("brand")].fillna("").astype(str).str.strip()

    item_col = col("item", required=False)
    df["item"] = raw[item_col].fillna("").astype(str).str.strip() if item_col is not None else df["brand"]
    df["item"] = df["item"].replace({"nan": ""})
    df.loc[df["item"] == "", "item"] = df["brand"]

    df["inventory"] = parse_numeric(raw[col("inventory")])
    fe_col = col("fe_inventory", required=False)
    df["fe_inventory"] = parse_numeric(raw[fe_col]) if fe_col else 0.0
    df["cpd"] = parse_numeric(raw[col("cpd")])
    df["open_po"] = parse_numeric(raw[col("open_po")])
    df["projection"] = parse_numeric(raw[col("projection")])
    df["bau_safety"] = parse_numeric(raw[col("bau_safety")])
    df["need"] = df["projection"] + df["bau_safety"]

    req_col = col("requirement", required=False)
    if req_col:
        df["requirement"] = parse_numeric(raw[req_col])
    else:
        df["requirement"] = (df["need"] - df["inventory"] - df["open_po"]).clip(lower=0)

    ach_be_col = col("ach_be", required=False)
    if ach_be_col:
        df["ach_be"] = parse_percent(raw[ach_be_col]).fillna(0.0)
    else:
        df["ach_be"] = (df["inventory"] / df["need"].replace(0, pd.NA) * 100).clip(upper=100).fillna(0.0)

    ach_po_col = col("ach_po", required=False)
    if ach_po_col:
        df["ach_po"] = parse_percent(raw[ach_po_col]).fillna(0.0)
    else:
        df["ach_po"] = ((df["inventory"] + df["open_po"]) / df["need"].replace(0, pd.NA) * 100).clip(upper=100).fillna(0.0)

    remark_col = col("remark", required=False)
    df["remark"] = raw[remark_col].fillna("").astype(str).replace({"nan": ""}) if remark_col else ""

    df["ptype"] = ptype
    df["region"] = df["wh"].apply(region_of)

    # Pivot-table exports sometimes bake a "Grand Total" row into the sheet
    # itself, in the same column as real warehouse names - that's not a
    # warehouse and would double-count into every aggregate if left in.
    not_blank = df["wh"].str.strip() != ""
    not_subtotal = ~df["wh"].str.strip().str.lower().isin(NON_WAREHOUSE_LABELS)
    df = df[not_blank & not_subtotal].reset_index(drop=True)
    return df


AT_RISK_ACH_PO_THRESHOLD = 50.0


def overview(df: pd.DataFrame) -> dict:
    """Headline stock-readiness numbers across every loaded ptype."""
    if df.empty:
        return {
            "ptypes": [], "ptype_count": 0, "row_count": 0, "warehouse_count": 0, "brand_count": 0,
            "total_requirement": 0.0, "total_need": 0.0, "ach_be_pct": 0.0, "ach_po_pct": 0.0,
            "at_risk_count": 0, "at_risk_requirement": 0.0,
        }
    weight = df["need"].clip(lower=0)
    w_sum = float(weight.sum())
    ach_be = float((weight * df["ach_be"]).sum() / w_sum) if w_sum else 0.0
    ach_po = float((weight * df["ach_po"]).sum() / w_sum) if w_sum else 0.0
    at_risk = df[(df["requirement"] > 0) & (df["ach_po"] < AT_RISK_ACH_PO_THRESHOLD)]

    return {
        "ptypes": sorted(df["ptype"].unique().tolist()),
        "ptype_count": int(df["ptype"].nunique()),
        "row_count": int(len(df)),
        "warehouse_count": int(df["wh"].nunique()),
        "brand_count": int(df["brand"].nunique()),
        "total_requirement": float(df["requirement"].sum()),
        "total_need": w_sum,
        "ach_be_pct": ach_be,
        "ach_po_pct": ach_po,
        "at_risk_count": int(len(at_risk)),
        "at_risk_requirement": float(at_risk["requirement"].sum()),
    }


def _weighted_group(d: pd.DataFrame, group_col: str) -> pd.DataFrame:
    """Group by group_col, need-weighting the achievement percentages so a
    warehouse with a huge outstanding need isn't diluted by a dozen
    near-zero-need rows averaging equally alongside it."""
    d = d.copy()
    d["_w"] = d["need"].clip(lower=0)
    d["_wbe"] = d["_w"] * d["ach_be"]
    d["_wpo"] = d["_w"] * d["ach_po"]
    d["_at_risk"] = (d["requirement"] > 0) & (d["ach_po"] < AT_RISK_ACH_PO_THRESHOLD)
    g = d.groupby(group_col, dropna=False).agg(
        requirement=("requirement", "sum"),
        need=("_w", "sum"),
        row_count=("requirement", "size"),
        brand_count=("brand", "nunique"),
        wh_count=("wh", "nunique"),
        at_risk_count=("_at_risk", "sum"),
        _wbe_sum=("_wbe", "sum"),
        _wpo_sum=("_wpo", "sum"),
    ).reset_index()
    g["ach_be_pct"] = np.where(g["need"] > 0, g["_wbe_sum"] / g["need"], 0.0)
    g["ach_po_pct"] = np.where(g["need"] > 0, g["_wpo_sum"] / g["need"], 0.0)
    g = g.drop(columns=["_wbe_sum", "_wpo_sum"])
    return g.sort_values("requirement", ascending=False)


def by_ptype(df: pd.DataFrame) -> list[dict]:
    if df.empty:
        return []
    return _weighted_group(df, "ptype").to_dict("records")


def by_dimension(df: pd.DataFrame, dim: str, ptype: "str | None" = None) -> list[dict]:
    d = df if not ptype else df[df["ptype"] == ptype]
    if d.empty:
        return []
    return _weighted_group(d, dim).to_dict("records")
