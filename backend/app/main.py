from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from app.config import settings
from app.database import Base, engine, get_db
from app.etim_repository import get_class_detail, list_classes, search_classes_extended
from app import connection_models  # noqa: F401
from app import library_models  # noqa: F401
from app import project_canvas_models  # noqa: F401
from app import project_models  # noqa: F401
from app.connection_schemas import (
    ConnectionInstanceCreate,
    ConnectionInstanceRead,
    ConnectionInstanceUpdate,
    ProjectConnectionList,
)
from app.connections import (
    create_project_connection,
    delete_project_connection,
    get_project_connection,
    get_project_connection_list,
    update_project_connection,
)
from app.library_schemas import LibraryNodeCreate, LibraryNodeRead, LibraryNodeUpdate, LibraryTreeNode, TypicalLibraryPlacementRead, TypicalLibraryPlacementUpdate
from app.library_taxonomy import create_library_node, delete_library_node, get_typical_library_placement, list_library_nodes, list_library_tree, replace_typical_library_placement, update_library_node
from app.project_canvas import get_project_canvas, replace_project_canvas
from app.project_canvas_schemas import ProjectCanvasPayload, ProjectCanvasRead
from app.presets import create_preset, delete_preset, list_presets, update_preset
from app.project_context import (
    create_cabinet,
    create_field_object,
    delete_cabinet,
    delete_field_object,
    get_cabinet,
    get_field_object,
    list_cabinets,
    list_field_objects,
    update_cabinet,
    update_field_object,
)
from app.project_schemas import (
    CabinetInstanceCreate,
    CabinetInstanceRead,
    CabinetInstanceUpdate,
    FieldObjectInstanceCreate,
    FieldObjectInstanceRead,
    FieldObjectInstanceUpdate,
    InstanceCreate,
    InstanceUpdate,
    ProjectEquipmentInstanceListItem,
    ProjectEquipmentInstanceRead,
    ProjectCreate,
    ProjectListItem,
    ProjectRead,
    ProjectUpdate,
)
from app.projects import (
    create_project,
    create_project_instance,
    delete_project,
    delete_project_instance,
    duplicate_project_instance,
    get_project,
    get_project_instance,
    list_project_instances,
    list_projects,
    update_project,
    update_project_instance,
    validate_project_instance,
)
from app.schemas import EquipmentTypicalCreate, EquipmentTypicalListItem, EquipmentTypicalRead, EquipmentTypicalUpdate, EtimClassDetail, EtimClassSummary, EtimSearchResult, ParameterDefinitionPresetCreate, ParameterDefinitionPresetRead, ParameterDefinitionPresetUpdate, TypicalDerivationPreview, TypicalDerivationPreviewRequest, TypicalValidationResult
from app.project_schemas import InstanceValidationResult
from app.typicals import create_draft_from_released, create_typical, delete_typical, derive_typical_preview, get_typical, list_typical_versions, list_typicals, release_typical, update_typical, validate_typical_payload


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
        if "show_on_canvas" not in preset_columns:
            connection.execute(
                text("ALTER TABLE parameter_definition_presets ADD COLUMN show_on_canvas INTEGER NOT NULL DEFAULT 0")
            )
        interface_columns = {column["name"] for column in inspector.get_columns("typical_interfaces")}
        if "group_code" not in interface_columns:
            connection.execute(text("ALTER TABLE typical_interfaces ADD COLUMN group_code VARCHAR(100)"))
        if "side" not in interface_columns:
            connection.execute(text("ALTER TABLE typical_interfaces ADD COLUMN side VARCHAR(20)"))
        if "side_order" not in interface_columns:
            connection.execute(text("ALTER TABLE typical_interfaces ADD COLUMN side_order INTEGER NOT NULL DEFAULT 0"))
        parameter_definition_columns = {
            column["name"] for column in inspector.get_columns("typical_parameter_definitions")
        }
        if "bundle_id" not in parameter_definition_columns:
            connection.execute(
                text("ALTER TABLE typical_parameter_definitions ADD COLUMN bundle_id VARCHAR(36)")
            )
        if "show_on_canvas" not in parameter_definition_columns:
            connection.execute(
                text("ALTER TABLE typical_parameter_definitions ADD COLUMN show_on_canvas INTEGER NOT NULL DEFAULT 0")
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
        instance_definition_columns = {
            column["name"] for column in inspector.get_columns("instance_parameter_definition_snapshots")
        }
        if "origin" not in instance_definition_columns:
            connection.execute(
                text(
                    "ALTER TABLE instance_parameter_definition_snapshots ADD COLUMN origin VARCHAR(30) NOT NULL DEFAULT 'inherited'"
                )
            )
        if "visibility" not in instance_definition_columns:
            connection.execute(
                text(
                    "ALTER TABLE instance_parameter_definition_snapshots ADD COLUMN visibility VARCHAR(20) NOT NULL DEFAULT 'active'"
                )
            )
        if "show_on_canvas" not in instance_definition_columns:
            connection.execute(
                text(
                    "ALTER TABLE instance_parameter_definition_snapshots ADD COLUMN show_on_canvas INTEGER NOT NULL DEFAULT 0"
                )
            )
        if "library_nodes" not in inspector.get_table_names():
            connection.execute(
                text(
                    """
                    CREATE TABLE library_nodes (
                        id VARCHAR(36) PRIMARY KEY,
                        parent_id VARCHAR(36) NULL REFERENCES library_nodes(id) ON DELETE CASCADE,
                        code VARCHAR(100) NOT NULL,
                        name VARCHAR(255) NOT NULL,
                        node_type VARCHAR(30) NOT NULL DEFAULT 'folder',
                        sort_order INTEGER NOT NULL DEFAULT 0,
                        is_active INTEGER NOT NULL DEFAULT 1,
                        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                    )
                    """
                )
            )
            connection.execute(
                text(
                    "CREATE UNIQUE INDEX uq_library_nodes_parent_code_idx ON library_nodes (parent_id, code)"
                )
            )
        if "typical_library_links" not in inspector.get_table_names():
            connection.execute(
                text(
                    """
                    CREATE TABLE typical_library_links (
                        id VARCHAR(36) PRIMARY KEY,
                        typical_lineage_id VARCHAR(36) NOT NULL,
                        library_node_id VARCHAR(36) NOT NULL REFERENCES library_nodes(id) ON DELETE CASCADE,
                        is_primary INTEGER NOT NULL DEFAULT 1,
                        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                    )
                    """
                )
            )
            connection.execute(
                text(
                    "CREATE UNIQUE INDEX uq_typical_library_links_lineage_node_idx ON typical_library_links (typical_lineage_id, library_node_id)"
                )
            )
        if "project_canvas_nodes" not in inspector.get_table_names():
            connection.execute(
                text(
                    """
                    CREATE TABLE project_canvas_nodes (
                        id VARCHAR(36) PRIMARY KEY,
                        project_id VARCHAR(36) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                        instance_id VARCHAR(36) NOT NULL REFERENCES project_equipment_instances(id) ON DELETE CASCADE,
                        x DOUBLE PRECISION NOT NULL DEFAULT 0,
                        y DOUBLE PRECISION NOT NULL DEFAULT 0,
                        width DOUBLE PRECISION NULL,
                        height DOUBLE PRECISION NULL,
                        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                    )
                    """
                )
            )
            connection.execute(text("CREATE INDEX ix_project_canvas_nodes_project_id ON project_canvas_nodes (project_id)"))
            connection.execute(text("CREATE INDEX ix_project_canvas_nodes_instance_id ON project_canvas_nodes (instance_id)"))
        if "project_canvas_edges" not in inspector.get_table_names():
            connection.execute(
                text(
                    """
                    CREATE TABLE project_canvas_edges (
                        id VARCHAR(36) PRIMARY KEY,
                        project_id VARCHAR(36) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                        source_instance_id VARCHAR(36) NOT NULL REFERENCES project_equipment_instances(id) ON DELETE CASCADE,
                        target_instance_id VARCHAR(36) NOT NULL REFERENCES project_equipment_instances(id) ON DELETE CASCADE,
                        source_handle VARCHAR(100) NULL,
                        target_handle VARCHAR(100) NULL,
                        label VARCHAR(255) NULL,
                        edge_type VARCHAR(50) NULL,
                        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                    )
                    """
                )
            )
            connection.execute(text("CREATE INDEX ix_project_canvas_edges_project_id ON project_canvas_edges (project_id)"))
            connection.execute(
                text("CREATE INDEX ix_project_canvas_edges_source_instance_id ON project_canvas_edges (source_instance_id)")
            )
            connection.execute(
                text("CREATE INDEX ix_project_canvas_edges_target_instance_id ON project_canvas_edges (target_instance_id)")
            )
        if "connection_instances" not in inspector.get_table_names():
            connection.execute(
                text(
                    """
                    CREATE TABLE connection_instances (
                        id VARCHAR(36) PRIMARY KEY,
                        project_id VARCHAR(36) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                        source_instance_id VARCHAR(36) NOT NULL REFERENCES project_equipment_instances(id) ON DELETE CASCADE,
                        source_interface_code VARCHAR(100) NOT NULL,
                        target_instance_id VARCHAR(36) NOT NULL REFERENCES project_equipment_instances(id) ON DELETE CASCADE,
                        target_interface_code VARCHAR(100) NOT NULL,
                        connection_kind VARCHAR(30) NOT NULL DEFAULT 'logical',
                        implementation_kind VARCHAR(30) NOT NULL DEFAULT 'conceptual',
                        label VARCHAR(255) NULL,
                        status VARCHAR(20) NOT NULL DEFAULT 'active',
                        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                    )
                    """
                )
            )
            connection.execute(text("CREATE INDEX ix_connection_instances_project_id ON connection_instances (project_id)"))
            connection.execute(
                text("CREATE INDEX ix_connection_instances_source_instance_id ON connection_instances (source_instance_id)")
            )
            connection.execute(
                text("CREATE INDEX ix_connection_instances_target_instance_id ON connection_instances (target_instance_id)")
            )
        if "cabinet_instances" not in inspector.get_table_names():
            connection.execute(
                text(
                    """
                    CREATE TABLE cabinet_instances (
                        id VARCHAR(36) PRIMARY KEY,
                        project_id VARCHAR(36) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                        parent_cabinet_id VARCHAR(36) NULL REFERENCES cabinet_instances(id) ON DELETE SET NULL,
                        name VARCHAR(255) NOT NULL,
                        tag VARCHAR(100) NOT NULL,
                        description TEXT NULL,
                        cabinet_kind VARCHAR(50) NULL,
                        status VARCHAR(20) NOT NULL DEFAULT 'active',
                        sort_order INTEGER NOT NULL DEFAULT 0,
                        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                    )
                    """
                )
            )
            connection.execute(text("CREATE INDEX ix_cabinet_instances_project_id ON cabinet_instances (project_id)"))
            connection.execute(text("CREATE INDEX ix_cabinet_instances_parent_cabinet_id ON cabinet_instances (parent_cabinet_id)"))
        if "field_object_instances" not in inspector.get_table_names():
            connection.execute(
                text(
                    """
                    CREATE TABLE field_object_instances (
                        id VARCHAR(36) PRIMARY KEY,
                        project_id VARCHAR(36) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                        parent_field_object_id VARCHAR(36) NULL REFERENCES field_object_instances(id) ON DELETE SET NULL,
                        name VARCHAR(255) NOT NULL,
                        tag VARCHAR(100) NOT NULL,
                        description TEXT NULL,
                        field_object_kind VARCHAR(50) NULL,
                        status VARCHAR(20) NOT NULL DEFAULT 'active',
                        sort_order INTEGER NOT NULL DEFAULT 0,
                        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                    )
                    """
                )
            )
            connection.execute(text("CREATE INDEX ix_field_object_instances_project_id ON field_object_instances (project_id)"))
            connection.execute(text("CREATE INDEX ix_field_object_instances_parent_field_object_id ON field_object_instances (parent_field_object_id)"))
        project_instance_columns = {column["name"] for column in inspector.get_columns("project_equipment_instances")}
        if "cabinet_instance_id" not in project_instance_columns:
            connection.execute(
                text(
                    "ALTER TABLE project_equipment_instances ADD COLUMN cabinet_instance_id VARCHAR(36) NULL REFERENCES cabinet_instances(id) ON DELETE SET NULL"
                )
            )
            connection.execute(text("CREATE INDEX ix_project_equipment_instances_cabinet_instance_id ON project_equipment_instances (cabinet_instance_id)"))
        if "field_object_instance_id" not in project_instance_columns:
            connection.execute(
                text(
                    "ALTER TABLE project_equipment_instances ADD COLUMN field_object_instance_id VARCHAR(36) NULL REFERENCES field_object_instances(id) ON DELETE SET NULL"
                )
            )
            connection.execute(text("CREATE INDEX ix_project_equipment_instances_field_object_instance_id ON project_equipment_instances (field_object_instance_id)"))
        instance_interface_columns = {column["name"] for column in inspector.get_columns("instance_interfaces")}
        if "side" not in instance_interface_columns:
            connection.execute(text("ALTER TABLE instance_interfaces ADD COLUMN side VARCHAR(20)"))
        if "side_order" not in instance_interface_columns:
            connection.execute(text("ALTER TABLE instance_interfaces ADD COLUMN side_order INTEGER NOT NULL DEFAULT 0"))
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
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
    ],
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


@app.get("/api/v1/etim/search", response_model=list[EtimSearchResult])
def etim_search(search: str | None = None, limit: int = 25) -> list[EtimSearchResult]:
    safe_limit = min(max(limit, 1), 100)
    return search_classes_extended(search=search, limit=safe_limit)


@app.get("/api/v1/etim/classes/{class_id}", response_model=EtimClassDetail)
def etim_class_detail(class_id: str) -> EtimClassDetail:
    result = get_class_detail(class_id)
    if result is None:
        raise HTTPException(status_code=404, detail="ETIM class not found")
    return result


@app.get("/api/v1/typicals", response_model=list[EquipmentTypicalListItem])
def typicals(db: Session = Depends(get_db)) -> list[EquipmentTypicalListItem]:
    return list_typicals(db)


@app.get("/api/v1/typicals/library-tree", response_model=list[LibraryTreeNode])
def typicals_library_tree(db: Session = Depends(get_db)) -> list[LibraryTreeNode]:
    return list_library_tree(db)


@app.get("/api/v1/library/nodes", response_model=list[LibraryNodeRead])
def library_nodes(db: Session = Depends(get_db)) -> list[LibraryNodeRead]:
    return list_library_nodes(db)


@app.post("/api/v1/library/nodes", response_model=LibraryNodeRead, status_code=201)
def library_node_create(payload: LibraryNodeCreate, db: Session = Depends(get_db)) -> LibraryNodeRead:
    try:
        return create_library_node(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.put("/api/v1/library/nodes/{node_id}", response_model=LibraryNodeRead)
def library_node_update(
    node_id: str, payload: LibraryNodeUpdate, db: Session = Depends(get_db)
) -> LibraryNodeRead:
    try:
        result = update_library_node(db, node_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if result is None:
        raise HTTPException(status_code=404, detail="Library node not found")
    return result


@app.delete("/api/v1/library/nodes/{node_id}", status_code=204)
def library_node_delete(node_id: str, db: Session = Depends(get_db)) -> None:
    deleted = delete_library_node(db, node_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Library node not found")


@app.put("/api/v1/library/typicals/{typical_lineage_id}/placement", status_code=204)
def library_typical_placement_update(
    typical_lineage_id: str, payload: TypicalLibraryPlacementUpdate, db: Session = Depends(get_db)
) -> None:
    try:
        replace_typical_library_placement(
            db,
            typical_lineage_id=typical_lineage_id,
            library_node_ids=payload.library_node_ids,
            primary_library_node_id=payload.primary_library_node_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/v1/library/typicals/{typical_lineage_id}/placement", response_model=TypicalLibraryPlacementRead)
def library_typical_placement_read(
    typical_lineage_id: str, db: Session = Depends(get_db)
) -> TypicalLibraryPlacementRead:
    return get_typical_library_placement(db, typical_lineage_id)


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


@app.post("/api/v1/typicals/derive-preview", response_model=TypicalDerivationPreview)
def typical_derivation_preview(payload: TypicalDerivationPreviewRequest) -> TypicalDerivationPreview:
    return derive_typical_preview(payload.typical, payload.parameter_selections)


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


@app.get("/api/v1/projects", response_model=list[ProjectListItem])
def projects_list(db: Session = Depends(get_db)) -> list[ProjectListItem]:
    return list_projects(db)


@app.post("/api/v1/projects", response_model=ProjectRead, status_code=201)
def projects_create(payload: ProjectCreate, db: Session = Depends(get_db)) -> ProjectRead:
    try:
        return create_project(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/v1/projects/{project_id}", response_model=ProjectRead)
def project_detail(project_id: str, db: Session = Depends(get_db)) -> ProjectRead:
    result = get_project(db, project_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return result


@app.put("/api/v1/projects/{project_id}", response_model=ProjectRead)
def project_update(project_id: str, payload: ProjectUpdate, db: Session = Depends(get_db)) -> ProjectRead:
    try:
        result = update_project(db, project_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if result is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return result


@app.delete("/api/v1/projects/{project_id}", status_code=204)
def project_delete(project_id: str, db: Session = Depends(get_db)) -> None:
    deleted = delete_project(db, project_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Project not found")


@app.get("/api/v1/projects/{project_id}/cabinets", response_model=list[CabinetInstanceRead])
def project_cabinets(project_id: str, db: Session = Depends(get_db)) -> list[CabinetInstanceRead]:
    try:
        return list_cabinets(db, project_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/api/v1/projects/{project_id}/cabinets", response_model=CabinetInstanceRead, status_code=201)
def project_cabinet_create(
    project_id: str, payload: CabinetInstanceCreate, db: Session = Depends(get_db)
) -> CabinetInstanceRead:
    try:
        return create_cabinet(db, project_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.put("/api/v1/cabinets/{cabinet_id}", response_model=CabinetInstanceRead)
def cabinet_update(
    cabinet_id: str, payload: CabinetInstanceUpdate, db: Session = Depends(get_db)
) -> CabinetInstanceRead:
    try:
        result = update_cabinet(db, cabinet_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if result is None:
        raise HTTPException(status_code=404, detail="Cabinet not found")
    return result


@app.delete("/api/v1/cabinets/{cabinet_id}", status_code=204)
def cabinet_delete(cabinet_id: str, db: Session = Depends(get_db)) -> None:
    deleted = delete_cabinet(db, cabinet_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Cabinet not found")


@app.get("/api/v1/projects/{project_id}/field-objects", response_model=list[FieldObjectInstanceRead])
def project_field_objects(project_id: str, db: Session = Depends(get_db)) -> list[FieldObjectInstanceRead]:
    try:
        return list_field_objects(db, project_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post(
    "/api/v1/projects/{project_id}/field-objects",
    response_model=FieldObjectInstanceRead,
    status_code=201,
)
def project_field_object_create(
    project_id: str, payload: FieldObjectInstanceCreate, db: Session = Depends(get_db)
) -> FieldObjectInstanceRead:
    try:
        return create_field_object(db, project_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.put("/api/v1/field-objects/{field_object_id}", response_model=FieldObjectInstanceRead)
def field_object_update(
    field_object_id: str, payload: FieldObjectInstanceUpdate, db: Session = Depends(get_db)
) -> FieldObjectInstanceRead:
    try:
        result = update_field_object(db, field_object_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if result is None:
        raise HTTPException(status_code=404, detail="Field object not found")
    return result


@app.delete("/api/v1/field-objects/{field_object_id}", status_code=204)
def field_object_delete(field_object_id: str, db: Session = Depends(get_db)) -> None:
    deleted = delete_field_object(db, field_object_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Field object not found")


@app.get("/api/v1/projects/{project_id}/instances", response_model=list[ProjectEquipmentInstanceListItem])
def project_instances(project_id: str, db: Session = Depends(get_db)) -> list[ProjectEquipmentInstanceListItem]:
    if get_project(db, project_id) is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return list_project_instances(db, project_id)


@app.post(
    "/api/v1/projects/{project_id}/instances",
    response_model=ProjectEquipmentInstanceRead,
    status_code=201,
)
def project_instance_create(
    project_id: str, payload: InstanceCreate, db: Session = Depends(get_db)
) -> ProjectEquipmentInstanceRead:
    try:
        return create_project_instance(db, project_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/v1/instances/{instance_id}", response_model=ProjectEquipmentInstanceRead)
def project_instance_detail(instance_id: str, db: Session = Depends(get_db)) -> ProjectEquipmentInstanceRead:
    result = get_project_instance(db, instance_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Instance not found")
    return result


@app.put("/api/v1/instances/{instance_id}", response_model=ProjectEquipmentInstanceRead)
def project_instance_update(
    instance_id: str, payload: InstanceUpdate, db: Session = Depends(get_db)
) -> ProjectEquipmentInstanceRead:
    try:
        result = update_project_instance(db, instance_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if result is None:
        raise HTTPException(status_code=404, detail="Instance not found")
    return result


@app.delete("/api/v1/instances/{instance_id}", status_code=204)
def project_instance_delete(instance_id: str, db: Session = Depends(get_db)) -> None:
    deleted = delete_project_instance(db, instance_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Instance not found")


@app.post("/api/v1/instances/{instance_id}/duplicate", response_model=ProjectEquipmentInstanceRead, status_code=201)
def project_instance_duplicate(instance_id: str, db: Session = Depends(get_db)) -> ProjectEquipmentInstanceRead:
    result = duplicate_project_instance(db, instance_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Instance not found")
    return result


@app.post("/api/v1/instances/{instance_id}/validate", response_model=InstanceValidationResult)
def project_instance_validate(instance_id: str, db: Session = Depends(get_db)) -> InstanceValidationResult:
    instance = get_project_instance(db, instance_id)
    if instance is None:
        raise HTTPException(status_code=404, detail="Instance not found")
    return validate_project_instance(instance)


@app.get("/api/v1/projects/{project_id}/canvas", response_model=ProjectCanvasRead)
def project_canvas_detail(project_id: str, db: Session = Depends(get_db)) -> ProjectCanvasRead:
    result = get_project_canvas(db, project_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return result


@app.put("/api/v1/projects/{project_id}/canvas", response_model=ProjectCanvasRead)
def project_canvas_update(
    project_id: str, payload: ProjectCanvasPayload, db: Session = Depends(get_db)
) -> ProjectCanvasRead:
    try:
        result = replace_project_canvas(db, project_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if result is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return result


@app.get("/api/v1/projects/{project_id}/connections", response_model=ProjectConnectionList)
def project_connections(project_id: str, db: Session = Depends(get_db)) -> ProjectConnectionList:
    result = get_project_connection_list(db, project_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return result


@app.post("/api/v1/projects/{project_id}/connections", response_model=ConnectionInstanceRead, status_code=201)
def project_connection_create(
    project_id: str, payload: ConnectionInstanceCreate, db: Session = Depends(get_db)
) -> ConnectionInstanceRead:
    try:
        return create_project_connection(db, project_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/v1/connections/{connection_id}", response_model=ConnectionInstanceRead)
def project_connection_detail(connection_id: str, db: Session = Depends(get_db)) -> ConnectionInstanceRead:
    result = get_project_connection(db, connection_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Connection not found")
    return result


@app.put("/api/v1/connections/{connection_id}", response_model=ConnectionInstanceRead)
def project_connection_update(
    connection_id: str, payload: ConnectionInstanceUpdate, db: Session = Depends(get_db)
) -> ConnectionInstanceRead:
    try:
        result = update_project_connection(db, connection_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if result is None:
        raise HTTPException(status_code=404, detail="Connection not found")
    return result


@app.delete("/api/v1/connections/{connection_id}", status_code=204)
def project_connection_delete(connection_id: str, db: Session = Depends(get_db)) -> None:
    deleted = delete_project_connection(db, connection_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Connection not found")
