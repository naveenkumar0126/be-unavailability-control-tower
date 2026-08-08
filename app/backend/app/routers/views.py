from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from .. import formulas as F
from ..store import store
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
    summary = {
        "count": len(cut),
        "total_count": len(rows),
        "cut_cpd": cut_cpd,
        "cut_unavail_cpd": cut_un,
        "pct_of_pan": (cut_cpd / total_cpd * 100) if total_cpd else 0.0,
        "unavail_pct_of_pan": (cut_un / total_cpd * 100) if total_cpd else 0.0,
        "unavail_pct_within_cut": (cut_un / cut_cpd * 100) if cut_cpd else 0.0,
    }
    return to_native({"rows": cut, "summary": summary})


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
    return to_native(F.wh_item_grid(filtered, brand=drill_brand, top_n=top_n))


@router.get("/detail")
async def detail(f: Filters = Depends(), limit: int = Query(5000)):
    _, filtered = _dfs(f)
    d = filtered.sort_values("unavail_cpd", ascending=False).head(limit)
    return to_native(d.to_dict("records"))
