"""
Per-user Google OAuth - the fallback when a service account can't be used
(company Workspace policy blocking either Cloud project creation or sharing
a sheet with an external/service-account email). The user signs in with
their own Google identity instead, so nothing is shared with an outside
account at all - the app just borrows the signed-in user's own existing
access to their sheets.

Single-tenant, in-memory, matching the rest of this app's current state
model: one connected Google account at a time, lost on backend restart.
That's fine for now (same tradeoff as the rest of the app pre-database);
revisit once persistence is added.
"""
from __future__ import annotations

import os
from typing import Optional

import requests
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
]

_creds: Optional[Credentials] = None
_email: Optional[str] = None


def is_configured() -> bool:
    return bool(os.environ.get("GOOGLE_OAUTH_CLIENT_ID") and os.environ.get("GOOGLE_OAUTH_CLIENT_SECRET"))


def _redirect_uri() -> str:
    return os.environ.get("GOOGLE_OAUTH_REDIRECT_URI", "http://localhost:8000/api/google/callback")


def _client_config() -> dict:
    return {
        "web": {
            "client_id": os.environ["GOOGLE_OAUTH_CLIENT_ID"],
            "client_secret": os.environ["GOOGLE_OAUTH_CLIENT_SECRET"],
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
        }
    }


def _flow() -> Flow:
    return Flow.from_client_config(_client_config(), scopes=SCOPES, redirect_uri=_redirect_uri())


def build_auth_url() -> str:
    url, _state = _flow().authorization_url(
        access_type="offline", include_granted_scopes="true", prompt="consent"
    )
    return url


def handle_callback(code: str) -> None:
    global _creds, _email
    flow = _flow()
    flow.fetch_token(code=code)
    _creds = flow.credentials
    resp = requests.get(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        headers={"Authorization": f"Bearer {_creds.token}"},
        timeout=10,
    )
    _email = resp.json().get("email") if resp.ok else None


def is_connected() -> bool:
    return _creds is not None


def connected_email() -> Optional[str]:
    return _email


def get_credentials() -> Optional[Credentials]:
    global _creds
    if _creds is None:
        return None
    if _creds.expired and _creds.refresh_token:
        _creds.refresh(GoogleRequest())
    return _creds


def disconnect() -> None:
    global _creds, _email
    _creds = None
    _email = None
