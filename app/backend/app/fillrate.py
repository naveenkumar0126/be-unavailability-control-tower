"""
Fill rate engine, computed from PO-line-level data (one row per warehouse x
PO x item, with ordered vs GRN'd quantity).

Fill % = sum(grn_quantity) / sum(quantity_ordered) x 100 over a date window -
an order-weighted ratio, not an average of per-PO percentages, so large POs
carry proportionate weight.

Date windows (per the business rule given for this dataset):
  1. Drop the most recent 5 distinct PO dates present in the file - these are
     too fresh for GRN to have caught up, so including them would understate
     fill rate. The latest remaining date becomes the "cutoff".
  2. L1  = the 7 calendar days ending at the cutoff (most recent full week).
  3. L2  = the 7 calendar days before that (the week before L1).
  4. L15 = the 15 calendar days ending at the cutoff - overlaps L1 and L2
     almost entirely (14 of its 15 days), plus one extra day before L2.
"""
from __future__ import annotations

import re
from datetime import timedelta
from typing import Optional

import numpy as np
import pandas as pd

DATE_BUFFER = 5

_TOKEN_RE = re.compile(r"[a-z0-9]+")

# Generic category/packaging words that vary between the two sources
# describing the same SKU (one side says "Frozen Dessert Cone", the other
# "Ice Cream" for the identical product) - dropped so the join key is left
# with just the distinctive brand/flavor/size tokens.
_STOPWORDS = {
    "ice", "cream", "frozen", "dessert", "cone", "tub", "cup", "stick",
    "bar", "sandwich", "pack", "packet", "pouch", "box", "bottle", "jar",
    "carton", "piece", "pieces", "pcs", "pc", "by",
}

# Unit-abbreviation variants that mean the same size (one side writes "1
# ltr", the other "1 L") - collapsed to a single canonical token.
_UNIT_ALIASES = {
    "ltr": "l", "ltrs": "l", "litre": "l", "litres": "l", "liter": "l", "liters": "l",
    "gm": "g", "gms": "g", "gram": "g", "grams": "g",
    "kgs": "kg", "kilogram": "kg", "kilograms": "kg",
}


def normalize_item_name(name: str) -> str:
    """
    Fill-rate item names and main-dataset item names describe the same SKUs
    with different formatting *and* different words (e.g. "BH-Kwality Walls
    Cornetto Double Chocolate - Ice Cream, 105 ml" vs "Kwality Wall's
    Cornetto Double Chocolate Frozen Dessert Cone 105 ml"). Strip the "BH-"
    prefix, apostrophes, and parenthetical pack notes; tokenize; drop generic
    category/packaging words; sort what's left (order can differ too) - the
    remaining brand/flavor/size tokens are what's actually distinctive.
    """
    s = str(name).strip()
    s = re.sub(r"^BH[\s-]+", "", s, flags=re.IGNORECASE)

    # Parens with a digit inside usually carry real info (a "(6 Pieces)"
    # count) - keep the content, drop just the parens. Parens with no digit
    # are pure descriptors ("(Heat & Eat)", "(Frozen)") - drop entirely.
    def _paren(m: re.Match) -> str:
        inner = m.group(1)
        return f" {inner} " if any(c.isdigit() for c in inner) else " "

    s = re.sub(r"\(([^)]*)\)", _paren, s)
    s = s.replace("'", "")

    # One side writes "180g"/"500ml" glued together, the other "180 g"/"500
    # ml" with a space - split the glued form so both tokenize to the same
    # two tokens instead of one side producing a single "180g" token.
    s = re.sub(r"(\d)([a-zA-Z])", r"\1 \2", s)

    tokens = [_UNIT_ALIASES.get(t, t) for t in _TOKEN_RE.findall(s.lower())]
    tokens = [t for t in tokens if t not in _STOPWORDS]
    return " ".join(sorted(tokens))


def load_fill_df(raw: pd.DataFrame) -> pd.DataFrame:
    df = pd.DataFrame()
    df["wh"] = raw["warehouse_code"].astype(str).str.strip()
    df["brand"] = raw["brand"].astype(str).str.strip()
    df["item_id"] = raw["item_id"].astype(str).str.strip()
    df["item"] = raw["product_name"].astype(str).str.strip()
    df["date"] = pd.to_datetime(raw["po_date"], errors="coerce")
    df["ordered"] = pd.to_numeric(raw["quantity_ordered"], errors="coerce").fillna(0)
    df["grn"] = pd.to_numeric(raw["grn_quantity"], errors="coerce").fillna(0)
    if "expected_delivery_date" in raw.columns:
        df["expected_delivery"] = pd.to_datetime(raw["expected_delivery_date"], errors="coerce")
    else:
        df["expected_delivery"] = pd.NaT
    if "po_status" in raw.columns:
        df["po_status"] = raw["po_status"].astype(str).str.strip()
    else:
        df["po_status"] = ""
    return df.dropna(subset=["date"]).reset_index(drop=True)


def deliveries_on(df: pd.DataFrame, target_date: pd.Timestamp) -> pd.DataFrame:
    """PO lines whose expected_delivery_date falls on target_date, grouped
    by warehouse x brand x item (ordered qty, distinct PO count)."""
    d = df[df["expected_delivery"].dt.date == target_date.date()]
    if d.empty:
        return pd.DataFrame(columns=["wh", "brand", "item", "item_id", "ordered", "po_lines"])
    g = d.groupby(["wh", "brand", "item", "item_id"], dropna=False).agg(
        ordered=("ordered", "sum"),
        po_lines=("ordered", "size"),
    ).reset_index()
    return g.sort_values("ordered", ascending=False)


def compute_windows(df: pd.DataFrame, buffer_dates: int = DATE_BUFFER) -> dict:
    dates = sorted(df["date"].dropna().unique())
    if len(dates) <= buffer_dates:
        raise ValueError(
            f"Only {len(dates)} distinct PO dates in the file - need more than "
            f"{buffer_dates} (the most recent {buffer_dates} are dropped as too fresh)."
        )
    trimmed = dates[: len(dates) - buffer_dates]
    cutoff = pd.Timestamp(trimmed[-1])
    earliest = pd.Timestamp(dates[0])

    def clip_start(start: pd.Timestamp) -> pd.Timestamp:
        return start if start >= earliest else earliest

    l1 = (clip_start(cutoff - timedelta(days=6)), cutoff)
    l2 = (clip_start(cutoff - timedelta(days=13)), cutoff - timedelta(days=7))
    l15 = (clip_start(cutoff - timedelta(days=14)), cutoff)
    return {
        "max_date": pd.Timestamp(dates[-1]),
        "cutoff": cutoff,
        "L1": l1,
        "L2": l2,
        "L15": l15,
    }


def _agg(df: pd.DataFrame, group_cols: list[str], start: pd.Timestamp, end: pd.Timestamp) -> pd.DataFrame:
    d = df[(df["date"] >= start) & (df["date"] <= end)]
    if d.empty:
        return pd.DataFrame(columns=group_cols + ["ordered", "grn", "po_lines", "fill_pct"])
    g = d.groupby(group_cols, dropna=False).agg(
        ordered=("ordered", "sum"),
        grn=("grn", "sum"),
        po_lines=("ordered", "size"),
    ).reset_index()
    g["fill_pct"] = np.where(g["ordered"] > 0, g["grn"] / g["ordered"] * 100, 0.0)
    return g


def fill_rate_table(df: pd.DataFrame, windows: dict, group_cols: list[str]) -> pd.DataFrame:
    """One row per group_cols combination, with ordered/grn/fill_pct for all three windows."""
    parts = {}
    for w in ("L1", "L2", "L15"):
        start, end = windows[w]
        parts[w] = _agg(df, group_cols, start, end).set_index(group_cols)

    merged = parts["L1"][[]].combine_first(parts["L2"][[]]).combine_first(parts["L15"][[]])
    for w, part in parts.items():
        part = part.rename(columns={"ordered": f"ordered_{w}", "grn": f"grn_{w}", "po_lines": f"lines_{w}", "fill_pct": f"fill_{w}"})
        merged = merged.join(part, how="outer")
    merged = merged.fillna(0.0).reset_index()
    return merged


def item_meta_lookup(df: pd.DataFrame) -> dict:
    """item_id -> {item, brand}, using each item_id's most recent row."""
    last = df.sort_values("date").drop_duplicates("item_id", keep="last")
    return {r["item_id"]: {"item": r["item"], "brand": r["brand"]} for _, r in last.iterrows()}


def item_id_by_normalized_name(df: pd.DataFrame) -> dict[str, str]:
    """normalize_item_name(item) -> item_id, for joining against the main dataset's item names."""
    meta = item_meta_lookup(df)
    out: dict[str, str] = {}
    for item_id, m in meta.items():
        out[normalize_item_name(m["item"])] = item_id
    return out


def fill_color(v: float) -> str:
    if v >= 90:
        return "#2e7d5b"
    if v >= 75:
        return "#7ba05b"
    if v >= 50:
        return "#c9a227"
    if v >= 25:
        return "#d97e30"
    return "#b03a2e"
