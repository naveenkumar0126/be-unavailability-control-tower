import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import data, fillrate, google_auth, views

app = FastAPI(title="BE Unavailability Dashboard API")

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


@app.get("/api/health")
async def health():
    return {"status": "ok"}
