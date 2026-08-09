import io
from typing import Optional

import pandas as pd
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from .. import appsscript, sheets
from ..formulas import DOI_DEFAULT_THRESHOLD, ColumnNotFoundError
from ..store import get_raw_cache, set_raw_cache, store

router = APIRouter(prefix="/api/data", tags=["data"])

# Holds bytes of an uploaded multi-sheet workbook while we wait for the user
# to pick which sheet to load.
_pending_xlsx: dict = {"bytes": None, "filename": None}


def _status_payload() -> dict:
    if not store.is_loaded:
        return {"loaded": False}
    return {
        "loaded": True,
        "filename": store.filename,
        "uploaded_at": store.uploaded_at,
        "rows": int(len(store.df)),
        "doi_threshold": store.doi_threshold,
        "facets": store.facets(),
    }


@router.post("/upload")
async def upload(
    file: UploadFile = File(...),
    sheet_name: Optional[str] = Form(None),
    doi_threshold: float = Form(DOI_DEFAULT_THRESHOLD),
):
    content = await file.read()
    name = file.filename or "upload"
    lower = name.lower()

    try:
        if lower.endswith(".csv"):
            raw = pd.read_csv(io.BytesIO(content))
        elif lower.endswith((".xlsx", ".xls")):
            xl = pd.ExcelFile(io.BytesIO(content))
            if sheet_name:
                raw = xl.parse(sheet_name)
            elif len(xl.sheet_names) == 1:
                raw = xl.parse(xl.sheet_names[0])
            else:
                _pending_xlsx["bytes"] = content
                _pending_xlsx["filename"] = name
                return {"needs_sheet_selection": True, "sheets": xl.sheet_names, "filename": name}
        else:
            raise HTTPException(400, "Unsupported file type - upload a .csv or .xlsx file.")
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001 - surface parse errors to the client
        raise HTTPException(400, f"Could not parse file: {e}")

    set_raw_cache(raw)
    try:
        store.load(raw, name, doi_threshold=doi_threshold)
    except ColumnNotFoundError as e:
        raise HTTPException(422, str(e))
    return _status_payload()


@router.post("/select-sheet")
async def select_sheet(sheet_name: str = Form(...), doi_threshold: float = Form(DOI_DEFAULT_THRESHOLD)):
    if not _pending_xlsx["bytes"]:
        raise HTTPException(400, "No pending upload is awaiting a sheet selection.")
    xl = pd.ExcelFile(io.BytesIO(_pending_xlsx["bytes"]))
    if sheet_name not in xl.sheet_names:
        raise HTTPException(400, f"Sheet '{sheet_name}' not found in this workbook.")
    raw = xl.parse(sheet_name)
    set_raw_cache(raw)
    try:
        store.load(raw, _pending_xlsx["filename"], doi_threshold=doi_threshold)
    except ColumnNotFoundError as e:
        raise HTTPException(422, str(e))
    return _status_payload()


@router.get("/status")
async def status():
    return _status_payload()


@router.post("/doi-threshold")
async def set_doi_threshold(threshold: float = Form(...)):
    raw = get_raw_cache()
    if raw is None:
        raise HTTPException(400, "No data loaded yet.")
    try:
        store.set_doi_threshold(threshold, raw)
    except ColumnNotFoundError as e:
        raise HTTPException(422, str(e))
    return _status_payload()


@router.get("/sheets-info")
async def sheets_info():
    try:
        return {"configured": True, "service_account_email": sheets.service_account_email()}
    except sheets.SheetsNotConfigured as e:
        return {"configured": False, "detail": str(e)}


@router.post("/list-sheet-tabs")
async def list_sheet_tabs(sheet_url: str = Form(...)):
    try:
        return {"tabs": sheets.list_tabs(sheet_url)}
    except sheets.SheetsNotConfigured as e:
        raise HTTPException(400, str(e))
    except sheets.SheetAccessError as e:
        raise HTTPException(403, str(e))


@router.post("/sync-sheet")
async def sync_sheet(
    sheet_url: str = Form(...),
    tab_name: Optional[str] = Form(None),
    doi_threshold: float = Form(DOI_DEFAULT_THRESHOLD),
):
    try:
        raw = sheets.fetch_sheet_as_df(sheet_url, tab_name or None)
    except sheets.SheetsNotConfigured as e:
        raise HTTPException(400, str(e))
    except sheets.SheetAccessError as e:
        raise HTTPException(403, str(e))

    if raw.empty:
        raise HTTPException(400, "That sheet/tab came back empty.")

    set_raw_cache(raw)
    try:
        store.load(raw, f"Google Sheet ({tab_name or 'first tab'})", doi_threshold=doi_threshold)
    except ColumnNotFoundError as e:
        raise HTTPException(422, str(e))
    return _status_payload()


@router.post("/appsscript-tabs")
async def appsscript_tabs(webhook_url: str = Form(...), token: str = Form(...)):
    try:
        return {"tabs": appsscript.fetch_tabs(webhook_url, token)}
    except appsscript.AppsScriptError as e:
        raise HTTPException(400, str(e))


@router.post("/appsscript-sync")
async def appsscript_sync(
    webhook_url: str = Form(...),
    token: str = Form(...),
    tab_name: Optional[str] = Form(None),
    doi_threshold: float = Form(DOI_DEFAULT_THRESHOLD),
):
    try:
        raw = appsscript.fetch_data(webhook_url, token, tab_name or None)
    except appsscript.AppsScriptError as e:
        raise HTTPException(400, str(e))
    if raw.empty:
        raise HTTPException(400, "That sheet/tab came back empty.")
    set_raw_cache(raw)
    try:
        store.load(raw, f"Apps Script ({tab_name or 'sheet'})", doi_threshold=doi_threshold)
    except ColumnNotFoundError as e:
        raise HTTPException(422, str(e))
    return _status_payload()
