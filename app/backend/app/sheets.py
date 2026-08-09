"""
Google Sheets ingestion via a service account (not per-user OAuth) - the
backend authenticates as a machine identity, so pulling a sheet never needs
a browser login. The sheet must be shared with the service account's email
(same as sharing with any collaborator) before it's readable.

Credentials come from one of:
  - GOOGLE_SERVICE_ACCOUNT_JSON: the full JSON key content, as an env var
  - GOOGLE_SERVICE_ACCOUNT_FILE: a path to the JSON key file
Neither is committed to the repo - both are meant to be set as local/host
environment variables (a real secret).
"""
from __future__ import annotations

import json
import os
from functools import lru_cache

import gspread
import pandas as pd
from google.oauth2.service_account import Credentials

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
]


class SheetsNotConfigured(RuntimeError):
    pass


class SheetAccessError(RuntimeError):
    pass


@lru_cache(maxsize=1)
def _credentials_info() -> dict:
    raw = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")
    file_path = os.environ.get("GOOGLE_SERVICE_ACCOUNT_FILE")
    if raw:
        return json.loads(raw)
    if file_path:
        with open(file_path) as f:
            return json.load(f)
    raise SheetsNotConfigured(
        "No Google service account configured. Set GOOGLE_SERVICE_ACCOUNT_JSON "
        "(the key file's JSON content) or GOOGLE_SERVICE_ACCOUNT_FILE (a path to it)."
    )


def service_account_email() -> str:
    return _credentials_info().get("client_email", "")


@lru_cache(maxsize=1)
def _client() -> gspread.Client:
    creds = Credentials.from_service_account_info(_credentials_info(), scopes=SCOPES)
    return gspread.authorize(creds)


def extract_sheet_id(url_or_id: str) -> str:
    s = url_or_id.strip()
    if "/d/" in s:
        return s.split("/d/")[1].split("/")[0]
    return s


def _open(url_or_id: str) -> gspread.Spreadsheet:
    try:
        return _client().open_by_key(extract_sheet_id(url_or_id))
    except gspread.exceptions.APIError as e:
        status = getattr(getattr(e, "response", None), "status_code", None)
        if status in (403, 404):
            raise SheetAccessError(
                f"Could not access this sheet. Make sure it's shared with "
                f"{service_account_email()} (Viewer access is enough)."
            ) from e
        raise SheetAccessError(f"Google Sheets error: {e}") from e


def list_tabs(url_or_id: str) -> list[str]:
    sh = _open(url_or_id)
    return [ws.title for ws in sh.worksheets()]


def fetch_sheet_as_df(url_or_id: str, tab_name: str | None = None) -> pd.DataFrame:
    sh = _open(url_or_id)
    ws = sh.worksheet(tab_name) if tab_name else sh.sheet1
    records = ws.get_all_records()
    return pd.DataFrame(records)
