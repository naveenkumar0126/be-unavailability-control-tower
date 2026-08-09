"""
Fallback data source #3: a Google Apps Script Web App deployed by the user
against their own sheet, called as a plain HTTP JSON API.

This exists because company Workspace policy can block both other routes:
  - a service account needs the sheet shared with an external email
  - per-user OAuth needs the app allowlisted by a Workspace admin
      (Admin Console > Security > API Controls > App Access Control)

Apps Script sidesteps both: it's a first-party Google tool that runs as the
signed-in user inside their own account, so it was never subject to either
restriction. The deployed script exposes the sheet as JSON at a URL guarded
by a shared-secret token (see the script template this module's companion
instructions hand to the user) - our backend just does a plain GET, no
Google auth library involved on this end at all.
"""
from __future__ import annotations

import pandas as pd
import requests


class AppsScriptError(RuntimeError):
    pass


def _call(webhook_url: str, token: str, params: dict) -> object:
    try:
        r = requests.get(webhook_url, params={"token": token, **params}, timeout=60)
    except requests.RequestException as e:
        raise AppsScriptError(f"Could not reach the Apps Script webhook: {e}") from e
    if not r.ok:
        raise AppsScriptError(f"Webhook returned HTTP {r.status_code}: {r.text[:300]}")
    try:
        data = r.json()
    except ValueError as e:
        raise AppsScriptError(
            f"Webhook didn't return JSON (got: {r.text[:200]!r}). "
            f"Make sure the deployed URL ends in /exec, not /dev."
        ) from e
    if isinstance(data, dict) and data.get("error"):
        raise AppsScriptError(str(data["error"]))
    return data


def fetch_tabs(webhook_url: str, token: str) -> list[str]:
    data = _call(webhook_url, token, {"action": "tabs"})
    if not isinstance(data, list):
        raise AppsScriptError("Expected a list of tab names from the webhook.")
    return data


def fetch_data(webhook_url: str, token: str, tab: str | None = None) -> pd.DataFrame:
    params = {"action": "data"}
    if tab:
        params["sheet"] = tab
    data = _call(webhook_url, token, params)
    if not isinstance(data, list):
        raise AppsScriptError("Expected a list of row objects from the webhook.")
    return pd.DataFrame(data)
