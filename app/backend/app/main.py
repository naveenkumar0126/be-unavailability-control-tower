from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import data, views

app = FastAPI(title="BE Unavailability Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(data.router)
app.include_router(views.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
