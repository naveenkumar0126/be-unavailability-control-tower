from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from .. import fillrate as FR
from .. import fillrate_join as FJ
from .. import formulas as F
from ..regions import region_of
from ..store import store
from ..warehouse_map import code_for_name
from ..util import to_native

router = APIRouter(prefix="/api/views", tags=["views"])


class Filters:
    def __init__(
        self,
        region: Optional[list[str]] = Query(None),
        wh: Optional[list[str]] = Query(None),
        brand: Optional[list[str]] = Query(None),
        category: Optional[list[str]] = Query(None),
        min_cpd: Optional[float] = Query(None),
    ):
        self.region = region
        self.wh = wh
        self.brand = brand
        self.category = category
        self.min_cpd = min_cpd


def _dfs(f: Filters):
    if not store.is_loaded:
        raise HTTPException(400, "No data loaded yet. Upload a file first.")
    full = store.df
    filtered = F.apply_filters(
        full, region=f.region, wh=f.wh, brand=f.brand, category=f.category, min_cpd=f.min_cpd
    )
    return full, filtered


@router.get("/kpis")
async def kpis(f: Filters = Depends()):
    full, filtered = _dfs(f)
    return to_native(F.compute_kpis(full, filtered))


@router.get("/rollup/{by}")
async def rollup(by: str, f: Filters = Depends()):
    if by not in ("brand", "wh", "region"):
        raise HTTPException(400, "`by` must be one of: brand, wh, region")
    _, filtered = _dfs(f)
    return to_native(F.rollup(filtered, by))


@router.get("/matrix")
async def matrix(f: Filters = Depends()):
    _, filtered = _dfs(f)
    return to_native(F.matrix(filtered))


@router.get("/pan-india")
async def pan_india(
    mode: str = Query("brand"),
    top_pct: float = Query(100),
    f: Filters = Depends(),
):
    if mode not in ("brand", "sku"):
        raise HTTPException(400, "`mode` must be 'brand' or 'sku'")
    full, filtered = _dfs(f)
    rows = F.pan_india(full, filtered, mode=mode)
    cut = F.pan_india_cut(rows, top_pct)
    total_cpd = float(full["cpd"].sum())
    cut_cpd = sum(r["cpd"] for r in cut)
    cut_un = sum(r["unavail_cpd"] for r in cut)

    # Binary/"normal" availability for the cut: every SKU x WH row counts as
    # one unit regardless of its demand, unlike the CPD-weighted figures
    # above - so a high-CPD OOS row and a low-CPD one move this equally.
    key_col = "brand" if mode == "brand" else "item"
    cut_keys = {r["key"] for r in cut}
    cut_df = filtered[filtered[key_col].isin(cut_keys)]
    binary_n = len(cut_df)
    binary_ok_n = int((~cut_df["is_unavail"]).sum()) if binary_n else 0
    binary_avail_pct = (binary_ok_n / binary_n * 100) if binary_n else 0.0

    summary = {
        "count": len(cut),
        "total_count": len(rows),
        "cut_cpd": cut_cpd,
        "cut_unavail_cpd": cut_un,
        "pct_of_pan": (cut_cpd / total_cpd * 100) if total_cpd else 0.0,
        "unavail_pct_of_pan": (cut_un / total_cpd * 100) if total_cpd else 0.0,
        "unavail_pct_within_cut": (cut_un / cut_cpd * 100) if cut_cpd else 0.0,
        "binary_avail_pct": binary_avail_pct,
        "binary_n": binary_n,
        "binary_ok_n": binary_ok_n,
    }

    fill_available = FJ.fill_rate_available()
    if fill_available:
        lookup = FJ.brand_fill_lookup() if mode == "brand" else FJ.sku_fill_lookup()
        for r in cut:
            key = r["key"] if mode == "brand" else FR.normalize_item_name(r["key"])
            fr = lookup.get(key)
            if fr:
                r.update(fr)

    return to_native({"rows": cut, "summary": summary, "fill_rate_available": fill_available})


@router.get("/priority-queue")
async def priority_queue(top_n: int = Query(15), f: Filters = Depends()):
    _, filtered = _dfs(f)
    return to_native(F.priority_queue(filtered, top_n=top_n))


@router.get("/wh-item")
async def wh_item(
    drill_brand: str = Query("__TOP__"),
    top_n: int = Query(30),
    f: Filters = Depends(),
):
    _, filtered = _dfs(f)
    grid = F.wh_item_grid(filtered, brand=drill_brand, top_n=top_n)

    fill_available = FJ.fill_rate_available()
    if fill_available:
        fill_lookup = FJ.wh_item_fill_lookup()
        for item_row in grid["items"]:
            item_id = FJ.item_id_for_name(item_row["item"])
            if not item_id:
                continue
            for wh_name, cell in item_row["cells"].items():
                wh_code = code_for_name(wh_name)
                if not wh_code:
                    continue
                fr = fill_lookup.get((wh_code, item_id))
                if fr:
                    cell["fill_L1"] = fr["fill_L1"]
                    cell["fill_L2"] = fr["fill_L2"]

    grid["fill_rate_available"] = fill_available
    return to_native(grid)


@router.get("/wh-item-drill")
async def wh_item_drill(wh: str = Query(...), item: str = Query(...)):
    if not store.is_loaded:
        raise HTTPException(400, "No data loaded yet.")
    df = store.df
    across = df[df["item"] == item]
    if across.empty:
        raise HTTPException(404, "Item not found in the current dataset.")
    here = across[across["wh"] == wh]
    if here.empty:
        raise HTTPException(404, "That item isn't stocked at that warehouse.")
    r = here.iloc[0]

    national_cpd = float(across["cpd"].sum())
    out_rows = across[across["is_unavail"]]

    table = []
    for _, xr in across.sort_values("cpd", ascending=False).iterrows():
        table.append({
            "wh": xr["wh"],
            "region": xr["region"],
            "cpd": float(xr["cpd"]),
            "inventory": float(xr["inventory"]),
            "doi": float(xr["doi"]),
            "open_po": float(xr["open_po"]),
            "status": "OUT" if (xr["is_unavail"] and xr["inventory"] <= 0) else ("LOW" if xr["is_unavail"] else "OK"),
            "fill_L1": None,
            "fill_L2": None,
        })

    result = {
        "item": item,
        "wh": wh,
        "brand": r["brand"],
        "cpd_here": float(r["cpd"]),
        "pct_of_national": (float(r["cpd"]) / national_cpd * 100) if national_cpd else 0.0,
        "inventory": float(r["inventory"]),
        "doi": float(r["doi"]),
        "open_po": float(r["open_po"]),
        "pipeline": float(r["inventory"] + r["open_po"]),
        "national_cpd": national_cpd,
        "national_wh_count": int(across["wh"].nunique()),
        "out_wh_count": int(out_rows["wh"].nunique()),
        "out_cpd": float(out_rows["cpd"].sum()),
        "fill_L1": None,
        "fill_L2": None,
        "fill_rate_available": FJ.fill_rate_available(),
        "rows": table,
    }

    if FJ.fill_rate_available():
        item_id = FJ.item_id_for_name(item)
        if item_id:
            fill_lookup = FJ.wh_item_fill_lookup()
            here_code = code_for_name(wh)
            if here_code:
                fr = fill_lookup.get((here_code, item_id))
                if fr:
                    result["fill_L1"] = fr["fill_L1"]
                    result["fill_L2"] = fr["fill_L2"]
            for row in table:
                row_code = code_for_name(row["wh"])
                if row_code:
                    fr = fill_lookup.get((row_code, item_id))
                    if fr:
                        row["fill_L1"] = fr["fill_L1"]
                        row["fill_L2"] = fr["fill_L2"]

    return to_native(result)


@router.get("/wh-brand-drill")
async def wh_brand_drill(wh: str = Query(...), brand: str = Query(...)):
    if not store.is_loaded:
        raise HTTPException(400, "No data loaded yet.")
    df = store.df
    here = df[(df["wh"] == wh) & (df["brand"] == brand)]
    if here.empty:
        raise HTTPException(404, "That brand isn't stocked at that warehouse.")

    total_cpd = float(here["cpd"].sum())
    unavail_cpd = float(here["unavail_cpd"].sum())
    inventory = float(here["inventory"].sum())
    open_po = float(here["open_po"].sum())
    unavail_pct = (unavail_cpd / total_cpd * 100) if total_cpd else 0.0

    items = []
    for _, xr in here.sort_values("cpd", ascending=False).iterrows():
        items.append({
            "item": xr["item"],
            "cpd": float(xr["cpd"]),
            "inventory": float(xr["inventory"]),
            "doi": float(xr["doi"]),
            "open_po": float(xr["open_po"]),
            "unavail_cpd": float(xr["unavail_cpd"]),
            "status": "OUT" if (xr["is_unavail"] and xr["inventory"] <= 0) else ("LOW" if xr["is_unavail"] else "OK"),
            "fill_L1": None,
            "fill_L2": None,
        })

    result = {
        "wh": wh,
        "brand": brand,
        "region": here["region"].iloc[0] if "region" in here.columns else region_of(wh),
        "sku_count": int(here["item"].nunique()),
        "total_cpd": total_cpd,
        "unavail_cpd": unavail_cpd,
        "unavail_pct": unavail_pct,
        "avail_wtd": 100 - unavail_pct,
        "inventory": inventory,
        "open_po": open_po,
        "doi_blended": (inventory / total_cpd) if total_cpd else 0.0,
        "fill_L1": None,
        "fill_L2": None,
        "fill_rate_available": FJ.fill_rate_available(),
        "items": items,
    }

    if FJ.fill_rate_available():
        brand_lookup = FJ.brand_fill_lookup()
        fr = brand_lookup.get(brand)
        if fr:
            result["fill_L1"] = fr["fill_L1"]
            result["fill_L2"] = fr["fill_L2"]
        wh_code = code_for_name(wh)
        item_lookup = FJ.wh_item_fill_lookup()
        if wh_code:
            for row in items:
                item_id = FJ.item_id_for_name(row["item"])
                if not item_id:
                    continue
                frr = item_lookup.get((wh_code, item_id))
                if frr:
                    row["fill_L1"] = frr["fill_L1"]
                    row["fill_L2"] = frr["fill_L2"]

    return to_native(result)


@router.get("/detail")
async def detail(f: Filters = Depends(), limit: int = Query(5000)):
    _, filtered = _dfs(f)
    d = filtered.sort_values("unavail_cpd", ascending=False).head(limit)
    return to_native(d.to_dict("records"))
