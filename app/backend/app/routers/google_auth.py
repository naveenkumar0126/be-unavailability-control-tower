import os

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import RedirectResponse

from .. import google_oauth

router = APIRouter(prefix="/api/google", tags=["google"])


def _frontend_url() -> str:
    return os.environ.get("FRONTEND_URL", "http://localhost:5173")


@router.get("/login")
async def login():
    if not google_oauth.is_configured():
        raise HTTPException(
            400,
            "Google OAuth isn't configured (missing GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET).",
        )
    return RedirectResponse(google_oauth.build_auth_url())


@router.get("/callback")
async def callback(code: str = Query(None), error: str = Query(None)):
    if error:
        return RedirectResponse(f"{_frontend_url()}?google_error={error}")
    if not code:
        raise HTTPException(400, "Missing authorization code.")
    try:
        google_oauth.handle_callback(code)
    except Exception as e:  # noqa: BLE001
        return RedirectResponse(f"{_frontend_url()}?google_error={e}")
    return RedirectResponse(f"{_frontend_url()}?google_connected=1")


@router.get("/status")
async def status():
    return {
        "configured": google_oauth.is_configured(),
        "connected": google_oauth.is_connected(),
        "email": google_oauth.connected_email(),
    }


@router.post("/disconnect")
async def disconnect():
    google_oauth.disconnect()
    return {"ok": True}
