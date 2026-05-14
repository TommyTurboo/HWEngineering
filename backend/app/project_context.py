from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.project_models import CabinetInstance, FieldObjectInstance, Project, ProjectEquipmentInstance
from app.project_schemas import (
    CabinetInstanceCreate,
    CabinetInstanceRead,
    CabinetInstanceUpdate,
    FieldObjectInstanceCreate,
    FieldObjectInstanceRead,
    FieldObjectInstanceUpdate,
)


def _ensure_project_exists(db: Session, project_id: str) -> None:
    if db.get(Project, project_id) is None:
        raise ValueError("Project niet gevonden.")


def _validate_cabinet_parent(db: Session, project_id: str, parent_cabinet_id: str | None) -> None:
    if not parent_cabinet_id:
        return
    cabinet = db.get(CabinetInstance, parent_cabinet_id)
    if cabinet is None or cabinet.project_id != project_id:
        raise ValueError("Parent cabinet hoort niet bij dit project.")


def _validate_field_object_parent(db: Session, project_id: str, parent_field_object_id: str | None) -> None:
    if not parent_field_object_id:
        return
    field_object = db.get(FieldObjectInstance, parent_field_object_id)
    if field_object is None or field_object.project_id != project_id:
        raise ValueError("Parent field object hoort niet bij dit project.")


def list_cabinets(db: Session, project_id: str) -> list[dict]:
    _ensure_project_exists(db, project_id)
    stmt = (
        select(CabinetInstance, func.count(ProjectEquipmentInstance.id))
        .outerjoin(ProjectEquipmentInstance, ProjectEquipmentInstance.cabinet_instance_id == CabinetInstance.id)
        .where(CabinetInstance.project_id == project_id)
        .group_by(CabinetInstance.id)
        .order_by(CabinetInstance.sort_order.asc(), CabinetInstance.name.asc())
    )
    rows = db.execute(stmt).all()
    return [
        {
            "id": cabinet.id,
            "project_id": cabinet.project_id,
            "parent_cabinet_id": cabinet.parent_cabinet_id,
            "name": cabinet.name,
            "tag": cabinet.tag,
            "description": cabinet.description,
            "cabinet_kind": cabinet.cabinet_kind,
            "status": cabinet.status,
            "sort_order": cabinet.sort_order,
            "created_at": cabinet.created_at,
            "updated_at": cabinet.updated_at,
            "equipment_instance_count": equipment_instance_count,
        }
        for cabinet, equipment_instance_count in rows
    ]


def create_cabinet(db: Session, project_id: str, payload: CabinetInstanceCreate) -> CabinetInstance:
    _ensure_project_exists(db, project_id)
    _validate_cabinet_parent(db, project_id, payload.parent_cabinet_id)
    cabinet = CabinetInstance(
        project_id=project_id,
        parent_cabinet_id=payload.parent_cabinet_id,
        name=payload.name,
        tag=payload.tag,
        description=payload.description,
        cabinet_kind=payload.cabinet_kind,
        status=payload.status,
        sort_order=payload.sort_order,
    )
    db.add(cabinet)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ValueError("Cabinet kon niet opgeslagen worden.") from exc
    db.refresh(cabinet)
    return cabinet


def get_cabinet(db: Session, cabinet_id: str) -> CabinetInstance | None:
    return db.get(CabinetInstance, cabinet_id)


def update_cabinet(db: Session, cabinet_id: str, payload: CabinetInstanceUpdate) -> CabinetInstance | None:
    cabinet = db.get(CabinetInstance, cabinet_id)
    if cabinet is None:
        return None
    if payload.parent_cabinet_id == cabinet.id:
        raise ValueError("Een cabinet kan niet zichzelf als parent hebben.")
    _validate_cabinet_parent(db, cabinet.project_id, payload.parent_cabinet_id)
    cabinet.parent_cabinet_id = payload.parent_cabinet_id
    cabinet.name = payload.name
    cabinet.tag = payload.tag
    cabinet.description = payload.description
    cabinet.cabinet_kind = payload.cabinet_kind
    cabinet.status = payload.status
    cabinet.sort_order = payload.sort_order
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ValueError("Cabinet kon niet opgeslagen worden.") from exc
    db.refresh(cabinet)
    return cabinet


def delete_cabinet(db: Session, cabinet_id: str) -> bool:
    cabinet = db.get(CabinetInstance, cabinet_id)
    if cabinet is None:
        return False
    db.delete(cabinet)
    db.commit()
    return True


def list_field_objects(db: Session, project_id: str) -> list[dict]:
    _ensure_project_exists(db, project_id)
    stmt = (
        select(FieldObjectInstance, func.count(ProjectEquipmentInstance.id))
        .outerjoin(ProjectEquipmentInstance, ProjectEquipmentInstance.field_object_instance_id == FieldObjectInstance.id)
        .where(FieldObjectInstance.project_id == project_id)
        .group_by(FieldObjectInstance.id)
        .order_by(FieldObjectInstance.sort_order.asc(), FieldObjectInstance.name.asc())
    )
    rows = db.execute(stmt).all()
    return [
        {
            "id": field_object.id,
            "project_id": field_object.project_id,
            "parent_field_object_id": field_object.parent_field_object_id,
            "name": field_object.name,
            "tag": field_object.tag,
            "description": field_object.description,
            "field_object_kind": field_object.field_object_kind,
            "status": field_object.status,
            "sort_order": field_object.sort_order,
            "created_at": field_object.created_at,
            "updated_at": field_object.updated_at,
            "equipment_instance_count": equipment_instance_count,
        }
        for field_object, equipment_instance_count in rows
    ]


def create_field_object(
    db: Session, project_id: str, payload: FieldObjectInstanceCreate
) -> FieldObjectInstance:
    _ensure_project_exists(db, project_id)
    _validate_field_object_parent(db, project_id, payload.parent_field_object_id)
    field_object = FieldObjectInstance(
        project_id=project_id,
        parent_field_object_id=payload.parent_field_object_id,
        name=payload.name,
        tag=payload.tag,
        description=payload.description,
        field_object_kind=payload.field_object_kind,
        status=payload.status,
        sort_order=payload.sort_order,
    )
    db.add(field_object)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ValueError("Field object kon niet opgeslagen worden.") from exc
    db.refresh(field_object)
    return field_object


def get_field_object(db: Session, field_object_id: str) -> FieldObjectInstance | None:
    return db.get(FieldObjectInstance, field_object_id)


def update_field_object(
    db: Session, field_object_id: str, payload: FieldObjectInstanceUpdate
) -> FieldObjectInstance | None:
    field_object = db.get(FieldObjectInstance, field_object_id)
    if field_object is None:
        return None
    if payload.parent_field_object_id == field_object.id:
        raise ValueError("Een field object kan niet zichzelf als parent hebben.")
    _validate_field_object_parent(db, field_object.project_id, payload.parent_field_object_id)
    field_object.parent_field_object_id = payload.parent_field_object_id
    field_object.name = payload.name
    field_object.tag = payload.tag
    field_object.description = payload.description
    field_object.field_object_kind = payload.field_object_kind
    field_object.status = payload.status
    field_object.sort_order = payload.sort_order
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ValueError("Field object kon niet opgeslagen worden.") from exc
    db.refresh(field_object)
    return field_object


def delete_field_object(db: Session, field_object_id: str) -> bool:
    field_object = db.get(FieldObjectInstance, field_object_id)
    if field_object is None:
        return False
    db.delete(field_object)
    db.commit()
    return True
