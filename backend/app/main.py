from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.config import settings
from app.database import Base, engine, get_db
from app.etim_repository import get_class_detail, list_classes
from app.schemas import EquipmentTypicalCreate, EquipmentTypicalListItem, EquipmentTypicalRead, EtimClassDetail, EtimClassSummary
from app.typicals import create_typical, delete_typical, get_typical, list_typicals


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    summary="API voor ETIM-gedreven Equipment Typicals",
    lifespan=lifespan,
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


@app.get("/api/v1/etim/classes", response_model=list[EtimClassSummary])
def etim_classes(search: str | None = None, limit: int = 25) -> list[EtimClassSummary]:
    safe_limit = min(max(limit, 1), 100)
    return list_classes(search=search, limit=safe_limit)


@app.get("/api/v1/etim/classes/{class_id}", response_model=EtimClassDetail)
def etim_class_detail(class_id: str) -> EtimClassDetail:
    result = get_class_detail(class_id)
    if result is None:
        raise HTTPException(status_code=404, detail="ETIM class not found")
    return result


@app.get("/api/v1/typicals", response_model=list[EquipmentTypicalListItem])
def typicals(db: Session = Depends(get_db)) -> list[EquipmentTypicalListItem]:
    return list_typicals(db)


@app.post("/api/v1/typicals", response_model=EquipmentTypicalRead, status_code=201)
def typicals_create(payload: EquipmentTypicalCreate, db: Session = Depends(get_db)) -> EquipmentTypicalRead:
    try:
        return create_typical(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/v1/typicals/{typical_id}", response_model=EquipmentTypicalRead)
def typical_detail(typical_id: str, db: Session = Depends(get_db)) -> EquipmentTypicalRead:
    result = get_typical(db, typical_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Typical not found")
    return result


@app.delete("/api/v1/typicals/{typical_id}", status_code=204)
def typical_delete(typical_id: str, db: Session = Depends(get_db)) -> None:
    deleted = delete_typical(db, typical_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Typical not found")
