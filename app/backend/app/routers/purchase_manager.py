import io
import os
from typing import Optional

import pandas as pd
from fastapi import APIRouter, File, Form, HTTPException, Query, Request, UploadFile

from .. import fillrate as FR
from .. import festive as FE
from .. import inbound_util as IU
from ..fillrate_store import fill_store
from ..festive_store import festive_store
from ..inbound_store import inbound_store
from ..pushutil import read_push_dataframe
from ..seed import seed_errors
from ..store import store
from ..util import to_native
from ..warehouse_map import code_for_name

router = APIRouter(tags=["purchase-manager"])


def _read_upload(content: bytes, filename: str) -> pd.DataFrame:
    lower = filename.lower()
    if lower.endswith(".csv"):
        return pd.read_csv(io.BytesIO(content), low_memory=False)
    if lower.endswith((".xlsx", ".xls")):
        return pd.read_excel(io.BytesIO(content))
    raise HTTPException(400, "Unsupported file type - upload a .csv or .xlsx file.")


# ---------------- Inbound utilization ----------------

@router.post("/api/inbound/upload")
async def inbound_upload(file: UploadFile = File(...)):
    content = await file.read()
    name = file.filename or "upload"
    try:
        raw = _read_upload(content, name)
        df = IU.load_inbound_df(raw)
    except HTTPException:
        raise
    except KeyError as e:
        raise HTTPException(422, str(e))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"Could not parse file: {e}")
    if df.empty:
        raise HTTPException(400, "No usable rows found in that file.")
    inbound_store.load(df, name)
    return {"loaded": True, "filename": name, "rows": len(df)}


@router.post("/api/inbound/push")
async def inbound_push(request: Request):
    """Apps Script pushes the DOD Tracker sheet to us directly - see
    data.py's /push for why (outbound calls a script makes on its own
    authority aren't blocked by Workspace admin policy the way inbound
    requests to the script's own URL can be)."""
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

    try:
        df = IU.load_inbound_df(raw)
    except KeyError as e:
        raise HTTPException(422, str(e))
    if df.empty:
        raise HTTPException(400, "No usable rows found in that push.")

    source = meta.get("source", "Apps Script push")
    inbound_store.load(df, source)
    return {"loaded": True, "filename": source, "rows": len(df)}


@router.get("/api/inbound/status")
async def inbound_status():
    if not inbound_store.is_loaded:
        errs = [e for e in seed_errors if e.startswith("inbound:")]
        return {"loaded": False, "seed_errors": errs}
    return {"loaded": True, "filename": inbound_store.filename, "rows": len(inbound_store.df)}


@router.get("/api/inbound/utilization")
async def inbound_utilization(wh: Optional[list[str]] = Query(None), days: int = Query(7)):
    if not inbound_store.is_loaded:
        raise HTTPException(400, "No inbound utilization data loaded yet.")
    d = IU.last_n_days(inbound_store.df, days)
    if wh:
        codes = {code_for_name(w) for w in wh}
        codes.discard(None)
        d = d[d["wh"].isin(codes)]
    d = d.copy()
    d["date"] = d["date"].dt.strftime("%Y-%m-%d")
    return to_native(d.to_dict("records"))


@router.get("/api/inbound/summary")
async def inbound_summary(wh: Optional[list[str]] = Query(None), days: int = Query(7)):
    if not inbound_store.is_loaded:
        raise HTTPException(400, "No inbound utilization data loaded yet.")
    g = IU.wh_summary(inbound_store.df, days)
    if wh:
        codes = {code_for_name(w) for w in wh}
        codes.discard(None)
        g = g[g["wh"].isin(codes)]
    return to_native(g.to_dict("records"))


# ---------------- Festive requirements ----------------

@router.post("/api/festive/upload")
async def festive_upload(file: UploadFile = File(...), ptype: str = Form(...)):
    content = await file.read()
    name = file.filename or "upload"
    try:
        raw = _read_upload(content, name)
        df = FE.load_festive_df(raw, ptype)
    except HTTPException:
        raise
    except KeyError as e:
        raise HTTPException(422, str(e))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"Could not parse file: {e}")
    if df.empty:
        raise HTTPException(400, "No usable rows found in that file.")
    festive_store.load(ptype, df)
    return {"loaded": True, "ptype": ptype, "filename": name, "rows": len(df)}


@router.get("/api/festive/status")
async def festive_status():
    if not festive_store.is_loaded:
        errs = [e for e in seed_errors if not e.startswith("inbound:")]
        return {"loaded": False, "ptypes": [], "seed_errors": errs}
    return {
        "loaded": True,
        "ptypes": [{"ptype": p, "rows": len(d)} for p, d in festive_store.sets.items()],
    }


@router.get("/api/festive/requirements")
async def festive_requirements(
    wh: Optional[list[str]] = Query(None),
    ptype: Optional[str] = Query(None),
    min_requirement: float = Query(1),
):
    if not festive_store.is_loaded:
        raise HTTPException(400, "No festive data loaded yet.")
    df = festive_store.all()
    if wh:
        df = df[df["wh"].isin(wh)]
    if ptype:
        df = df[df["ptype"] == ptype]
    df = df[df["requirement"] >= min_requirement]
    df = df.sort_values("requirement", ascending=False)
    return to_native(df.to_dict("records"))


# ---------------- Festive dashboard (standalone workspace) ----------------

@router.get("/api/festive/overview")
async def festive_overview():
    if not festive_store.is_loaded:
        raise HTTPException(400, "No festive data loaded yet.")
    return to_native(FE.overview(festive_store.all()))


@router.get("/api/festive/by-ptype")
async def festive_by_ptype():
    if not festive_store.is_loaded:
        raise HTTPException(400, "No festive data loaded yet.")
    return to_native(FE.by_ptype(festive_store.all()))


@router.get("/api/festive/by-brand")
async def festive_by_brand(ptype: Optional[str] = Query(None)):
    if not festive_store.is_loaded:
        raise HTTPException(400, "No festive data loaded yet.")
    return to_native(FE.by_dimension(festive_store.all(), "brand", ptype))


@router.get("/api/festive/by-region")
async def festive_by_region(ptype: Optional[str] = Query(None)):
    if not festive_store.is_loaded:
        raise HTTPException(400, "No festive data loaded yet.")
    return to_native(FE.by_dimension(festive_store.all(), "region", ptype))


@router.get("/api/festive/by-warehouse")
async def festive_by_warehouse(ptype: Optional[str] = Query(None)):
    if not festive_store.is_loaded:
        raise HTTPException(400, "No festive data loaded yet.")
    return to_native(FE.by_dimension(festive_store.all(), "wh", ptype))


# ---------------- Focus items: high CPD, low DOI ----------------

@router.get("/api/pm/focus-items")
async def focus_items(wh: Optional[list[str]] = Query(None), doi_max: float = Query(3), top_n: int = Query(30)):
    if not store.is_loaded:
        raise HTTPException(400, "No data loaded yet.")
    d = store.df
    if wh:
        d = d[d["wh"].isin(wh)]
    d = d[d["doi"] < doi_max]
    d = d.sort_values("cpd", ascending=False).head(top_n)
    cols = ["wh", "brand", "item", "region", "category", "cpd", "inventory", "doi", "open_po", "is_unavail"]
    return to_native(d[cols].to_dict("records"))


# ---------------- Today's expected deliveries ----------------

@router.get("/api/pm/deliveries-today")
async def deliveries_today(wh: Optional[list[str]] = Query(None), date: Optional[str] = Query(None)):
    if not fill_store.is_loaded:
        raise HTTPException(400, "No fill rate data loaded yet.")
    target = pd.Timestamp(date) if date else pd.Timestamp.now().normalize()
    d = FR.deliveries_on(fill_store.df, target)
    if wh:
        codes = {code_for_name(w) for w in wh}
        codes.discard(None)
        d = d[d["wh"].isin(codes)]
    result = to_native(d.to_dict("records"))
    return {"date": target.strftime("%Y-%m-%d"), "rows": result}


# ---------------- At-a-glance overview (4 summary numbers, one call) ----------------

@router.get("/api/pm/overview")
async def pm_overview(wh: Optional[list[str]] = Query(None)):
    codes = None
    if wh:
        codes = {code_for_name(w) for w in wh}
        codes.discard(None)

    TOP_N = 5

    focus = None
    if store.is_loaded:
        d = store.df
        if wh:
            d = d[d["wh"].isin(wh)]
        low = d[d["doi"] < 3]
        top = low.sort_values("cpd", ascending=False).head(TOP_N)
        focus = {
            "count": int(len(low)),
            "at_risk_cpd": float(low["cpd"].sum()),
            "top": top[["wh", "brand", "item", "cpd", "doi", "inventory"]].to_dict("records"),
        }

    inbound = None
    if inbound_store.is_loaded:
        g = IU.wh_summary(inbound_store.df, 7)
        if codes:
            g = g[g["wh"].isin(codes)]
        top = g.head(TOP_N)  # wh_summary is already sorted worst-utilization-first
        inbound = {
            "avg_utilization": float(g["avg_utilization"].mean()) if len(g) else 0.0,
            "low_wh_count": int((g["avg_utilization"] < IU.LOW_UTILIZATION_THRESHOLD).sum()),
            "wh_count": int(len(g)),
            "top": top[["wh", "zone", "avg_utilization", "avg_planned", "avg_grn"]].to_dict("records"),
        }

    festive = None
    if festive_store.is_loaded:
        df = festive_store.all()
        if wh:
            df = df[df["wh"].isin(wh)]
        df = df[df["requirement"] > 0]
        top = df.sort_values("requirement", ascending=False).head(TOP_N)
        festive = {
            "total_requirement": float(df["requirement"].sum()),
            "ptype_count": int(df["ptype"].nunique()),
            "row_count": int(len(df)),
            "top": top[["wh", "brand", "item", "ptype", "requirement"]].to_dict("records"),
        }

    deliveries = None
    if fill_store.is_loaded:
        target = pd.Timestamp.now().normalize()
        d = FR.deliveries_on(fill_store.df, target)
        if codes:
            d = d[d["wh"].isin(codes)]
        top = d.head(TOP_N)  # deliveries_on is already sorted largest-order-first
        deliveries = {
            "total_units": float(d["ordered"].sum()),
            "po_lines": int(d["po_lines"].sum()) if len(d) else 0,
            "row_count": int(len(d)),
            "top": top[["wh", "brand", "item", "ordered", "po_lines"]].to_dict("records"),
        }

    return to_native({"focus_items": focus, "inbound": inbound, "festive": festive, "deliveries": deliveries})
