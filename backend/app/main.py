from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from app.config import settings
from app.database import Base, engine, get_db
from app.etim_repository import get_class_detail, list_classes
from app.presets import create_preset, delete_preset, list_presets, update_preset
from app.schemas import EquipmentTypicalCreate, EquipmentTypicalListItem, EquipmentTypicalRead, EquipmentTypicalUpdate, EtimClassDetail, EtimClassSummary, ParameterDefinitionPresetCreate, ParameterDefinitionPresetRead, ParameterDefinitionPresetUpdate, TypicalValidationResult
from app.typicals import create_draft_from_released, create_typical, delete_typical, get_typical, list_typical_versions, list_typicals, release_typical, update_typical, validate_typical_payload


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    with engine.begin() as connection:
        inspector = inspect(connection)
        preset_columns = {column["name"] for column in inspector.get_columns("parameter_definition_presets")}
        if "interface_groups_json" not in preset_columns:
            connection.execute(
                text("ALTER TABLE parameter_definition_presets ADD COLUMN interface_groups_json TEXT")
            )
        if "interface_mapping_rules_json" not in preset_columns:
            connection.execute(
                text("ALTER TABLE parameter_definition_presets ADD COLUMN interface_mapping_rules_json TEXT")
            )
        interface_columns = {column["name"] for column in inspector.get_columns("typical_interfaces")}
        if "group_code" not in interface_columns:
            connection.execute(text("ALTER TABLE typical_interfaces ADD COLUMN group_code VARCHAR(100)"))
        parameter_definition_columns = {
            column["name"] for column in inspector.get_columns("typical_parameter_definitions")
        }
        if "bundle_id" not in parameter_definition_columns:
            connection.execute(
                text("ALTER TABLE typical_parameter_definitions ADD COLUMN bundle_id VARCHAR(36)")
            )
        group_columns = {column["name"] for column in inspector.get_columns("typical_interface_groups")}
        if "bundle_id" not in group_columns:
            connection.execute(text("ALTER TABLE typical_interface_groups ADD COLUMN bundle_id VARCHAR(36)"))
        mapping_columns = {
            column["name"] for column in inspector.get_columns("typical_interface_mapping_rules")
        }
        if "bundle_id" not in mapping_columns:
            connection.execute(
                text("ALTER TABLE typical_interface_mapping_rules ADD COLUMN bundle_id VARCHAR(36)")
            )
        typical_columns = {column["name"] for column in inspector.get_columns("equipment_typicals")}
        if "lineage_id" not in typical_columns:
            connection.execute(text("ALTER TABLE equipment_typicals ADD COLUMN lineage_id VARCHAR(36)"))
        if "released_from_id" not in typical_columns:
            connection.execute(text("ALTER TABLE equipment_typicals ADD COLUMN released_from_id VARCHAR(36)"))
        connection.execute(text("UPDATE equipment_typicals SET lineage_id = id WHERE lineage_id IS NULL"))
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


@app.get("/api/v1/presets", response_model=list[ParameterDefinitionPresetRead])
def presets(code: str | None = None, db: Session = Depends(get_db)) -> list[ParameterDefinitionPresetRead]:
    return list_presets(db, code=code.lower() if code else None)


@app.post("/api/v1/presets", response_model=ParameterDefinitionPresetRead, status_code=201)
def presets_create(
    payload: ParameterDefinitionPresetCreate, db: Session = Depends(get_db)
) -> ParameterDefinitionPresetRead:
    return create_preset(db, payload)


@app.put("/api/v1/presets/{preset_id}", response_model=ParameterDefinitionPresetRead)
def preset_update(
    preset_id: str, payload: ParameterDefinitionPresetUpdate, db: Session = Depends(get_db)
) -> ParameterDefinitionPresetRead:
    result = update_preset(db, preset_id, payload)
    if result is None:
        raise HTTPException(status_code=404, detail="Preset not found")
    return result


@app.delete("/api/v1/presets/{preset_id}", status_code=204)
def preset_delete(preset_id: str, db: Session = Depends(get_db)) -> None:
    deleted = delete_preset(db, preset_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Preset not found")


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


@app.get("/api/v1/typicals/{typical_id}/versions", response_model=list[EquipmentTypicalListItem])
def typical_versions(typical_id: str, db: Session = Depends(get_db)) -> list[EquipmentTypicalListItem]:
    result = list_typical_versions(db, typical_id)
    if not result:
        raise HTTPException(status_code=404, detail="Typical not found")
    return result


@app.put("/api/v1/typicals/{typical_id}", response_model=EquipmentTypicalRead)
def typical_update(
    typical_id: str, payload: EquipmentTypicalUpdate, db: Session = Depends(get_db)
) -> EquipmentTypicalRead:
    try:
        result = update_typical(db, typical_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if result is None:
        raise HTTPException(status_code=404, detail="Typical not found")
    return result


@app.post("/api/v1/typicals/{typical_id}/release", response_model=EquipmentTypicalRead)
def typical_release(typical_id: str, db: Session = Depends(get_db)) -> EquipmentTypicalRead:
    try:
        result = release_typical(db, typical_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if result is None:
        raise HTTPException(status_code=404, detail="Typical not found")
    return result


@app.post("/api/v1/typicals/{typical_id}/drafts", response_model=EquipmentTypicalRead, status_code=201)
def typical_new_draft(typical_id: str, db: Session = Depends(get_db)) -> EquipmentTypicalRead:
    try:
        result = create_draft_from_released(db, typical_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if result is None:
        raise HTTPException(status_code=404, detail="Typical not found")
    return result


@app.post("/api/v1/typicals/validate", response_model=TypicalValidationResult)
def typical_validate(payload: EquipmentTypicalCreate) -> TypicalValidationResult:
    return validate_typical_payload(payload)


@app.delete("/api/v1/typicals/{typical_id}", status_code=204)
def typical_delete(typical_id: str, db: Session = Depends(get_db)) -> None:
    try:
        deleted = delete_typical(db, typical_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not deleted:
        raise HTTPException(status_code=404, detail="Typical not found")
