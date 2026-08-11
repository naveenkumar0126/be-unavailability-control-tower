from __future__ import annotations

import io
import os
from typing import Optional

import pandas as pd
from fastapi import APIRouter, File, HTTPException, Query, Request, UploadFile

from .. import tags as T
from ..pushutil import read_push_dataframe
from ..tags_store import tags_store
from ..util import to_native

router = APIRouter(tags=["tags"])


@router.post("/api/tags/upload")
async def tags_upload(file: UploadFile = File(...)):
    content = await file.read()
    name = file.filename or "upload"
    if not name.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(400, "Upload the TAG & Reason workbook as .xlsx/.xls (one sheet per week).")
    try:
        xl = pd.ExcelFile(io.BytesIO(content))
        combined, skipped = T.load_tags_workbook(xl)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"Could not parse file: {e}")

    for week, wdf in combined.groupby("week"):
        tags_store.upsert_week(week, wdf.reset_index(drop=True))

    return {
        "loaded": True,
        "filename": name,
        "weeks_loaded": int(combined["week"].nunique()),
        "rows": len(combined),
        "skipped_sheets": skipped,
    }


@router.post("/api/tags/push")
async def tags_push(request: Request):
    """
    Apps Script push target for the TAG & Reason sheet - the same outbound-
    push pattern used for the main dataset and fill rate (see
    appsscript-push-template.gs), except this sheet has one tab per day
    rather than one tab total, so the script calls this once per tab and
    each call carries that tab's own name so we can parse its date the same
    way a direct .xlsx upload does. A day already loaded gets replaced, not
    duplicated, so re-running the sync (e.g. a daily trigger) is safe.
    """
    expected = os.environ.get("APPSSCRIPT_PUSH_TOKEN")
    if not expected:
        raise HTTPException(400, "Push endpoint not configured (APPSSCRIPT_PUSH_TOKEN not set on the backend).")
    token = request.headers.get("authorization", "").removeprefix("Bearer ").strip()
    if token != expected:
        raise HTTPException(401, "Invalid push token.")

    try:
        raw, meta = await read_push_dataframe(request)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"Could not parse push payload: {e}")
    if raw.empty:
        raise HTTPException(400, "No rows in push payload.")

    sheet_name = meta.get("sheet_name") or meta.get("source") or "sheet"
    week = T.parse_week_from_sheet_name(sheet_name)
    if week is None:
        raise HTTPException(
            422,
            f"Could not find a date in sheet name '{sheet_name}' - expected something like '6th_july' or '3rd aug'.",
        )

    try:
        wdf = T.load_tags_sheet(raw, week, sheet_name)
    except KeyError as e:
        raise HTTPException(422, str(e))

    tags_store.upsert_week(pd.Timestamp(week), wdf)
    return {"loaded": True, "sheet_name": sheet_name, "week": week.isoformat(), "rows": len(wdf)}


@router.get("/api/tags/status")
async def tags_status():
    if not tags_store.is_loaded:
        return {"loaded": False, "weeks": []}
    df = tags_store.df
    weeks = []
    for w in tags_store.week_list:
        wdf = df[df["week"] == pd.Timestamp(w)]
        weeks.append({
            "week": pd.Timestamp(w).strftime("%Y-%m-%d"),
            "label": wdf["week_label"].iloc[0] if len(wdf) else str(w),
            "rows": int(len(wdf)),
        })
    return {"loaded": True, "weeks": weeks, "total_rows": len(df)}


@router.get("/api/tags/overview")
async def tags_overview():
    if not tags_store.is_loaded:
        raise HTTPException(400, "No tag data loaded yet.")
    return to_native(T.overview(tags_store.df))


@router.get("/api/tags/trend")
async def tags_trend():
    if not tags_store.is_loaded:
        raise HTTPException(400, "No tag data loaded yet.")
    return to_native({
        "trend": T.weekly_tag_trend(tags_store.df),
        "coverage": T.coverage_by_week(tags_store.df),
    })


@router.get("/api/tags/by-brand")
async def tags_by_brand(week: Optional[str] = Query(None)):
    if not tags_store.is_loaded:
        raise HTTPException(400, "No tag data loaded yet.")
    w = pd.Timestamp(week) if week else None
    return to_native(T.tag_by_dimension(tags_store.df, "brand", w))


@router.get("/api/tags/by-warehouse")
async def tags_by_warehouse(week: Optional[str] = Query(None)):
    if not tags_store.is_loaded:
        raise HTTPException(400, "No tag data loaded yet.")
    w = pd.Timestamp(week) if week else None
    return to_native(T.tag_by_dimension(tags_store.df, "wh", w))


@router.get("/api/tags/chronic")
async def tags_chronic(min_weeks: int = Query(3)):
    if not tags_store.is_loaded:
        raise HTTPException(400, "No tag data loaded yet.")
    return to_native(T.chronic_issues(tags_store.df, min_weeks))


@router.get("/api/tags/detail")
async def tags_detail(
    week: Optional[str] = Query(None),
    tag: Optional[list[str]] = Query(None),
    wh: Optional[list[str]] = Query(None),
    brand: Optional[list[str]] = Query(None),
    limit: int = Query(2000),
):
    if not tags_store.is_loaded:
        raise HTTPException(400, "No tag data loaded yet.")
    d = tags_store.df
    if week:
        d = d[d["week"] == pd.Timestamp(week)]
    if tag:
        d = d[d["tag"].isin(tag)]
    if wh:
        d = d[d["wh"].isin(wh)]
    if brand:
        d = d[d["brand"].isin(brand)]
    d = d.sort_values("unavail_cpd", ascending=False).head(limit)
    cols = [
        "week_label", "wh", "region", "brand", "tag", "remark", "category_remark",
        "cpd", "avail_wtd", "doi", "active_skus", "unavail_cpd", "skus_note",
    ]
    return to_native(d[cols].to_dict("records"))


@router.get("/api/tags/facets")
async def tags_facets():
    if not tags_store.is_loaded:
        return {"warehouses": [], "brands": [], "tags": []}
    df = tags_store.df
    return {
        "warehouses": sorted(df["wh"].unique().tolist()),
        "brands": sorted(df["brand"].unique().tolist()),
        "tags": sorted(df["tag"].unique().tolist()),
    }
