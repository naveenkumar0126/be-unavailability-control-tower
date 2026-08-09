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

    df = df[df["wh"].str.strip() != ""].reset_index(drop=True)
    return df
