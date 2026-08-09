"""
Google Sheets ingestion. Two auth modes, tried in this order:

1. Per-user OAuth (see google_oauth.py) - preferred whenever a user has
   signed in, since it needs no sheet-sharing step at all: the app just
   uses the signed-in user's own existing access.
2. A service account - a machine identity that must be explicitly added
   as a Viewer on each sheet. Works well for personal/unrestricted Google
   accounts, but company Workspace policy commonly blocks sharing with an
   external service-account email entirely, in which case mode 1 is the
   only option.

Service-account credentials come from one of:
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

from . import google_oauth

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
def _service_account_client() -> gspread.Client:
    creds = Credentials.from_service_account_info(_credentials_info(), scopes=SCOPES)
    return gspread.authorize(creds)


def active_auth_mode() -> str:
    if google_oauth.is_connected():
        return "oauth"
    try:
        _credentials_info()
        return "service_account"
    except SheetsNotConfigured:
        return "none"


def _active_client() -> gspread.Client:
    oauth_creds = google_oauth.get_credentials()
    if oauth_creds:
        return gspread.authorize(oauth_creds)
    return _service_account_client()


def extract_sheet_id(url_or_id: str) -> str:
    s = url_or_id.strip()
    if "/d/" in s:
        return s.split("/d/")[1].split("/")[0]
    return s


def _open(url_or_id: str) -> gspread.Spreadsheet:
    if active_auth_mode() == "none":
        raise SheetsNotConfigured(
            "No Google access configured - connect a Google account or set up a service account first."
        )
    try:
        return _active_client().open_by_key(extract_sheet_id(url_or_id))
    except gspread.exceptions.APIError as e:
        status = getattr(getattr(e, "response", None), "status_code", None)
        if status in (403, 404):
            hint = (
                "Make sure you've connected the right Google account."
                if google_oauth.is_connected()
                else f"Make sure it's shared with {service_account_email()} (Viewer access is enough)."
            )
            raise SheetAccessError(f"Could not access this sheet. {hint}") from e
        raise SheetAccessError(f"Google Sheets error: {e}") from e


def list_tabs(url_or_id: str) -> list[str]:
    sh = _open(url_or_id)
    return [ws.title for ws in sh.worksheets()]


def fetch_sheet_as_df(url_or_id: str, tab_name: str | None = None) -> pd.DataFrame:
    sh = _open(url_or_id)
    ws = sh.worksheet(tab_name) if tab_name else sh.sheet1
    records = ws.get_all_records()
    return pd.DataFrame(records)
