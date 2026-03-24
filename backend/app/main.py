from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    summary="API voor ETIM-gedreven Equipment Typicals",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "environment": settings.app_env}


@app.get("/api/v1/meta")
def meta() -> dict[str, str]:
    return {
        "name": settings.app_name,
        "version": "0.1.0",
        "scope": "equipment-typicals-foundation",
    }

