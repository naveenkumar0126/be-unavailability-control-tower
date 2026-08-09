import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Loads app/backend/.env if present (local dev only - on Render, env vars are
# set directly in its dashboard, no .env file involved). Safe to call even
# when the file doesn't exist.
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from .routers import data, fillrate, google_auth, purchase_manager, views  # noqa: E402
from .seed import load_seed_data  # noqa: E402

app = FastAPI(title="BE Unavailability Dashboard API")
load_seed_data()

DEFAULT_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://be-unavailability-frontend.onrender.com",
]
extra_origins = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=DEFAULT_ORIGINS + extra_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(data.router)
app.include_router(views.router)
app.include_router(fillrate.router)
app.include_router(google_auth.router)
app.include_router(purchase_manager.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
