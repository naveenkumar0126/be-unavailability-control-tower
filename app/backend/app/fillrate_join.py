"""
Joins the independently-loaded Fill Rate dataset onto the main Availability
dataset's views (PAN India, Warehouse x Item) - see warehouse_map.py and
fillrate.normalize_item_name for how the two are matched, since neither
warehouse identifiers nor item names line up directly between the sources.
"""
from __future__ import annotations

from . import fillrate as FR
from .fillrate_store import fill_store
from .warehouse_map import code_for_name


def fill_rate_available() -> bool:
    return fill_store.is_loaded


def brand_fill_lookup() -> dict[str, dict]:
    """brand -> {fill_L1, fill_L2, fill_L15}"""
    if not fill_store.is_loaded:
        return {}
    table = FR.fill_rate_table(fill_store.df, fill_store.windows, ["brand"])
    return {
        r["brand"]: {"fill_L1": r["fill_L1"], "fill_L2": r["fill_L2"], "fill_L15": r["fill_L15"]}
        for r in table.to_dict("records")
    }


def sku_fill_lookup() -> dict[str, dict]:
    """normalize_item_name(item) -> {fill_L1, fill_L2, fill_L15}"""
    if not fill_store.is_loaded:
        return {}
    df = fill_store.df
    table = FR.fill_rate_table(df, fill_store.windows, ["item_id"])
    by_id = {r["item_id"]: r for r in table.to_dict("records")}
    name_to_id = FR.item_id_by_normalized_name(df)
    out = {}
    for norm_name, item_id in name_to_id.items():
        row = by_id.get(item_id)
        if row:
            out[norm_name] = {"fill_L1": row["fill_L1"], "fill_L2": row["fill_L2"], "fill_L15": row["fill_L15"]}
    return out


def wh_item_fill_lookup() -> dict[tuple[str, str], dict]:
    """(warehouse_code, item_id) -> {fill_L1, fill_L2, fill_L15}"""
    if not fill_store.is_loaded:
        return {}
    table = FR.fill_rate_table(fill_store.df, fill_store.windows, ["wh", "item_id"])
    return {
        (r["wh"], r["item_id"]): {"fill_L1": r["fill_L1"], "fill_L2": r["fill_L2"], "fill_L15": r["fill_L15"]}
        for r in table.to_dict("records")
    }


def item_id_for_name(item_name: str) -> str | None:
    if not fill_store.is_loaded:
        return None
    name_to_id = FR.item_id_by_normalized_name(fill_store.df)
    return name_to_id.get(FR.normalize_item_name(item_name))


def fill_for_wh_item(wh_name: str, item_name: str) -> dict | None:
    item_id = item_id_for_name(item_name)
    wh_code = code_for_name(wh_name)
    if not item_id or not wh_code:
        return None
    return wh_item_fill_lookup().get((wh_code, item_id))
