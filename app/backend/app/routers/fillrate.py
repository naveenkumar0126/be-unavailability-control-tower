import io
from typing import Optional

import pandas as pd
from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile

from .. import appsscript, fillrate as F
from .. import sheets
from ..util import to_native

router = APIRouter(prefix="/api/fillrate", tags=["fillrate"])

_state: dict = {"df": None, "windows": None, "filename": None, "rows": 0}


def _load_raw(raw: pd.DataFrame, filename: str) -> dict:
    try:
        df = F.load_fill_df(raw)
        windows = F.compute_windows(df)
    except KeyError as e:
        raise HTTPException(422, f"Missing expected column: {e}")
    except ValueError as e:
        raise HTTPException(422, str(e))

    _state["df"] = df
    _state["windows"] = windows
    _state["filename"] = filename
    _state["rows"] = len(df)
    return {"loaded": True, "filename": filename, "rows": len(df), "windows": _window_payload()}


def _item_lookup(df: pd.DataFrame) -> dict:
    last = df.sort_values("date").drop_duplicates("item_id", keep="last")
    return {r["item_id"]: {"item": r["item"], "brand": r["brand"]} for _, r in last.iterrows()}


def _window_payload() -> dict:
    w = _state["windows"]
    return {
        k: {"start": v[0].strftime("%Y-%m-%d"), "end": v[1].strftime("%Y-%m-%d")}
        for k, v in w.items()
        if k in ("L1", "L2", "L15")
    } | {"max_date": w["max_date"].strftime("%Y-%m-%d"), "cutoff": w["cutoff"].strftime("%Y-%m-%d")}


@router.post("/upload")
async def upload(file: UploadFile = File(...)):
    content = await file.read()
    name = file.filename or "upload"
    try:
        if name.lower().endswith(".csv"):
            raw = pd.read_csv(io.BytesIO(content), low_memory=False)
        elif name.lower().endswith((".xlsx", ".xls")):
            raw = pd.read_excel(io.BytesIO(content))
        else:
            raise HTTPException(400, "Unsupported file type - upload a .csv or .xlsx file.")
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"Could not parse file: {e}")
    return _load_raw(raw, name)


@router.post("/list-sheet-tabs")
async def list_sheet_tabs(sheet_url: str = Form(...)):
    try:
        return {"tabs": sheets.list_tabs(sheet_url)}
    except sheets.SheetsNotConfigured as e:
        raise HTTPException(400, str(e))
    except sheets.SheetAccessError as e:
        raise HTTPException(403, str(e))


@router.post("/sync-sheet")
async def sync_sheet(sheet_url: str = Form(...), tab_name: Optional[str] = Form(None)):
    try:
        raw = sheets.fetch_sheet_as_df(sheet_url, tab_name or None)
    except sheets.SheetsNotConfigured as e:
        raise HTTPException(400, str(e))
    except sheets.SheetAccessError as e:
        raise HTTPException(403, str(e))
    if raw.empty:
        raise HTTPException(400, "That sheet/tab came back empty.")
    return _load_raw(raw, f"Google Sheet ({tab_name or 'first tab'})")


@router.post("/appsscript-tabs")
async def appsscript_tabs(webhook_url: str = Form(...), token: str = Form(...)):
    try:
        return {"tabs": appsscript.fetch_tabs(webhook_url, token)}
    except appsscript.AppsScriptError as e:
        raise HTTPException(400, str(e))


@router.post("/appsscript-sync")
async def appsscript_sync(webhook_url: str = Form(...), token: str = Form(...), tab_name: Optional[str] = Form(None)):
    try:
        raw = appsscript.fetch_data(webhook_url, token, tab_name or None)
    except appsscript.AppsScriptError as e:
        raise HTTPException(400, str(e))
    if raw.empty:
        raise HTTPException(400, "That sheet/tab came back empty.")
    return _load_raw(raw, f"Apps Script ({tab_name or 'sheet'})")


@router.get("/status")
async def status():
    if _state["df"] is None:
        return {"loaded": False}
    return {"loaded": True, "filename": _state["filename"], "rows": _state["rows"], "windows": _window_payload()}


def _require_loaded():
    if _state["df"] is None:
        raise HTTPException(400, "No fill rate data loaded yet. Upload a file first.")
    return _state["df"], _state["windows"]


@router.get("/brand")
async def brand_fill_rate(q: Optional[str] = Query(None)):
    df, windows = _require_loaded()
    table = F.fill_rate_table(df, windows, ["brand"])
    if q:
        table = table[table["brand"].str.lower().str.contains(q.lower())]
    table = table.sort_values("ordered_L1", ascending=False)
    return to_native(table.to_dict("records"))


@router.get("/sku")
async def sku_fill_rate(q: Optional[str] = Query(None), brand: Optional[str] = Query(None)):
    df, windows = _require_loaded()
    d = df if not brand else df[df["brand"] == brand]
    table = F.fill_rate_table(d, windows, ["item_id"])
    lookup = _item_lookup(df)
    table["item"] = table["item_id"].map(lambda i: lookup.get(i, {}).get("item", ""))
    table["brand"] = table["item_id"].map(lambda i: lookup.get(i, {}).get("brand", ""))
    if q:
        ql = q.lower()
        table = table[table["item"].str.lower().str.contains(ql) | table["brand"].str.lower().str.contains(ql)]
    table = table.sort_values("ordered_L1", ascending=False)
    return to_native(table.to_dict("records"))


@router.get("/wh-item")
async def wh_item_fill_rate(item_id: Optional[str] = Query(None), wh: Optional[str] = Query(None), brand: Optional[str] = Query(None)):
    df, windows = _require_loaded()
    d = df
    if item_id:
        d = d[d["item_id"] == item_id]
    if wh:
        d = d[d["wh"] == wh]
    if brand:
        d = d[d["brand"] == brand]
    table = F.fill_rate_table(d, windows, ["wh", "item_id"])
    lookup = _item_lookup(df)
    table["item"] = table["item_id"].map(lambda i: lookup.get(i, {}).get("item", ""))
    table["brand"] = table["item_id"].map(lambda i: lookup.get(i, {}).get("brand", ""))
    table = table.sort_values("ordered_L1", ascending=False)
    return to_native(table.to_dict("records"))


@router.get("/warehouses")
async def warehouses():
    df, _ = _require_loaded()
    return to_native(sorted(df["wh"].unique().tolist()))


@router.get("/brands")
async def brands():
    df, _ = _require_loaded()
    return to_native(sorted(df["brand"].unique().tolist()))
