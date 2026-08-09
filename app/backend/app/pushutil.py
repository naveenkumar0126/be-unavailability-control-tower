"""
Shared body-parsing for the Apps Script push endpoints (data.py, fillrate.py).

Two things large sheets need that a naive JSON POST doesn't give you:
  1. A compact payload shape - {headers: [...], data: [[...], ...]} instead
     of an array of {col: val} objects, which repeats every column name on
     every single row. For a 100k-row sheet that repetition alone roughly
     doubles the payload.
  2. Gzip - UrlFetchApp (the Apps Script HTTP client) caps POST bodies at
     ~50MB, which a large sheet can exceed even in the compact shape. Gzip
     buys another 5-10x on top of that for this kind of repetitive tabular
     JSON, and Apps Script can compress before sending via Utilities.gzip().

Still accepts the older {rows: [{col: val}, ...]} shape too, so nothing
that was already working breaks.
"""
from __future__ import annotations

import gzip
import json

import pandas as pd
from fastapi import Request


async def read_push_dataframe(request: Request) -> tuple[pd.DataFrame, dict]:
    raw = await request.body()
    if request.headers.get("content-encoding", "").lower() == "gzip":
        raw = gzip.decompress(raw)
    body = json.loads(raw)

    if isinstance(body, dict) and "headers" in body and "data" in body:
        df = pd.DataFrame(body["data"], columns=body["headers"])
        meta = body
    else:
        rows = body.get("rows") if isinstance(body, dict) else body
        df = pd.DataFrame(rows)
        meta = body if isinstance(body, dict) else {}

    return df, meta
