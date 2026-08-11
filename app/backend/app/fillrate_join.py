"""
Joins the independently-loaded Fill Rate dataset onto the main Availability
dataset's views (PAN India, Warehouse x Item) - see warehouse_map.py and
fillrate.normalize_item_name for how the two are matched when there's no
better option.

Preferred join key, when the main dataset has one: item_id. Some main-dataset
exports (e.g. BE_Superset_Daily) carry a real item_id that lines up exactly
with the fill-rate file's own item_id, despite the two sides using very
different product-name text for the same SKU ("Guilt Free" vs "Zero Sugar"
for the identical item) - name matching can never close that kind of gap,
but the shared ID sidesteps it entirely. resolve_item_id() below prefers
that when available and only falls back to fuzzy name matching for exports
that don't carry item_id at all.
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
    """normalize_item_name(item) -> {fill_L1, fill_L2, fill_L15} - the fuzzy
    fallback for main-dataset exports with no item_id of their own."""
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


def sku_fill_lookup_by_id() -> dict[str, dict]:
    """item_id -> {fill_L1, fill_L2, fill_L15} - the direct, reliable join
    when the main dataset carries its own item_id."""
    if not fill_store.is_loaded:
        return {}
    table = FR.fill_rate_table(fill_store.df, fill_store.windows, ["item_id"])
    return {
        r["item_id"]: {"fill_L1": r["fill_L1"], "fill_L2": r["fill_L2"], "fill_L15": r["fill_L15"]}
        for r in table.to_dict("records")
    }


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


def known_fill_item_ids() -> set[str]:
    """Compute once per request and pass into resolve_item_id() when
    resolving many rows in a loop, rather than rebuilding this set on every
    single row."""
    if not fill_store.is_loaded:
        return set()
    return set(fill_store.df["item_id"].unique())


def resolve_item_id(row_item_id: str, item_name: str, known_ids: "set[str] | None" = None) -> str | None:
    """Prefer the main dataset row's own item_id when it's a real, known
    fill-rate item_id; fall back to fuzzy name matching only when it's
    missing (older exports without item_id) or doesn't resolve."""
    if row_item_id:
        ids = known_ids if known_ids is not None else known_fill_item_ids()
        if row_item_id in ids:
            return row_item_id
    return item_id_for_name(item_name)


def fill_for_wh_item(wh_name: str, item_name: str) -> dict | None:
    item_id = item_id_for_name(item_name)
    wh_code = code_for_name(wh_name)
    if not item_id or not wh_code:
        return None
    return wh_item_fill_lookup().get((wh_code, item_id))
