from sqlalchemy import delete, select
from sqlalchemy.orm import Session, selectinload

from app.connection_models import ConnectionInstance
from app.connection_schemas import ConnectionInstanceCreate, ConnectionInstanceUpdate, ProjectConnectionList
from app.project_models import InstanceInterface, Project, ProjectEquipmentInstance

ALLOWED_IMPLEMENTATION_KINDS = {
    "conceptual",
    "wire",
    "cable",
    "terminal_bridge",
    "busbar",
    "prewired_internal",
}


def list_project_connections(db: Session, project_id: str) -> list[ConnectionInstance]:
    stmt = (
        select(ConnectionInstance)
        .where(ConnectionInstance.project_id == project_id)
        .order_by(ConnectionInstance.created_at.asc())
    )
    return list(db.scalars(stmt))


def get_project_connection(db: Session, connection_id: str) -> ConnectionInstance | None:
    return db.get(ConnectionInstance, connection_id)


def _project_instances_with_interfaces(db: Session, project_id: str) -> dict[str, ProjectEquipmentInstance]:
    stmt = (
        select(ProjectEquipmentInstance)
        .options(selectinload(ProjectEquipmentInstance.interfaces))
        .where(ProjectEquipmentInstance.project_id == project_id)
    )
    return {instance.id: instance for instance in db.scalars(stmt)}


def infer_connection_kind_from_codes(source_interface_code: str, target_interface_code: str) -> str:
    source = source_interface_code.strip().upper()
    target = target_interface_code.strip().upper()
    combined = f"{source} {target}"

    if any(token in combined for token in ["ETH", "RJ45", "PROFINET", "ETHERNET", "LAN", "WAN"]):
        return "network"
    if any(token in combined for token in ["PE", "FE"]) and not any(
        token in combined for token in ["SPEED", "TEMP", "PRESSURE"]
    ):
        return "pe"
    if any(token in combined for token in ["L1", "L2", "L3", "N", "24V", "0V", "AC", "DC", "POWER"]):
        return "power"
    if any(token in combined for token in ["DI", "DO", "AI", "AO", "CMD", "FB", "SIG", "RUN", "START", "STOP"]):
        return "signal"
    return "logical"


def classify_interface_kind(interface: InstanceInterface | None) -> str | None:
    if interface is None:
        return None

    logical_type = (interface.logical_type or "").strip().lower()
    if logical_type in {"power", "signal", "network", "pe", "logical"}:
        return logical_type

    group_code = (interface.group_code or "").strip().lower()
    role = (interface.role or "").strip().lower()
    semantic_haystack = f"{group_code} {role}"

    if any(token in semantic_haystack for token in ["network", "ethernet", "profinet", "lan", "wan"]):
        return "network"
    if any(token in semantic_haystack for token in ["protective_earth", "earth", "pe", "fe"]):
        return "pe"
    if any(token in semantic_haystack for token in ["power", "line", "load", "supply"]):
        return "power"
    if any(token in semantic_haystack for token in ["signal", "command", "feedback", "control", "io"]):
        return "signal"

    return None


def infer_connection_kind(
    source_interface: InstanceInterface | None,
    target_interface: InstanceInterface | None,
    source_interface_code: str,
    target_interface_code: str,
) -> str:
    source_kind = classify_interface_kind(source_interface)
    target_kind = classify_interface_kind(target_interface)

    if source_kind and target_kind and source_kind == target_kind:
        return source_kind
    if source_kind and target_kind and {source_kind, target_kind} <= {"power", "pe"}:
        return "power" if "power" in {source_kind, target_kind} else "pe"
    if source_kind:
        return source_kind
    if target_kind:
        return target_kind
    return infer_connection_kind_from_codes(source_interface_code, target_interface_code)


def normalize_connection_label(label: str | None, connection_kind: str) -> str | None:
    if label is None:
        return None
    normalized = label.strip()
    if not normalized:
        return None
    if normalized.lower() in {"logical", "power", "signal", "network", "pe"}:
        return None
    if normalized.lower() == connection_kind.lower():
        return None
    return normalized


def normalize_implementation_kind(value: str | None) -> str:
    normalized = (value or "conceptual").strip().lower()
    if normalized not in ALLOWED_IMPLEMENTATION_KINDS:
        raise ValueError(
            "Ongeldige implementation_kind. Gebruik: conceptual, wire, cable, terminal_bridge, busbar, prewired_internal."
        )
    return normalized


def _find_interface(instance: ProjectEquipmentInstance, code: str, direction: str) -> InstanceInterface | None:
    for interface in instance.interfaces:
        if interface.direction == direction and interface.code == code:
            return interface
    return None


def _validate_interface_compatibility(
    source_interface: InstanceInterface,
    target_interface: InstanceInterface,
    source_instance: ProjectEquipmentInstance,
    target_instance: ProjectEquipmentInstance,
) -> str:
    inferred_kind = infer_connection_kind(
        source_interface,
        target_interface,
        source_interface.code,
        target_interface.code,
    )

    source_semantic = classify_interface_kind(source_interface)
    target_semantic = classify_interface_kind(target_interface)
    if source_semantic and target_semantic and source_semantic != target_semantic:
        allowed_pairs = {frozenset({"power", "pe"})}
        if frozenset({source_semantic, target_semantic}) not in allowed_pairs:
            raise ValueError(
                f"Incompatibele connectie tussen interfaces: {source_instance.tag}.{source_interface.code} "
                f"({source_semantic}) -> {target_instance.tag}.{target_interface.code} ({target_semantic})."
            )

    return inferred_kind


def _validate_project_and_instances(
    db: Session, project_id: str, payload: ConnectionInstanceCreate | ConnectionInstanceUpdate
) -> str:
    if db.get(Project, project_id) is None:
        raise ValueError("Project niet gevonden.")

    if payload.source_instance_id == payload.target_instance_id:
        raise ValueError("Self-connections binnen dezelfde instance zijn niet toegestaan op projectniveau.")

    instances = _project_instances_with_interfaces(db, project_id)
    source_instance = instances.get(payload.source_instance_id)
    target_instance = instances.get(payload.target_instance_id)

    if source_instance is None:
        raise ValueError("Source instance hoort niet bij dit project.")
    if target_instance is None:
        raise ValueError("Target instance hoort niet bij dit project.")

    source_interface = _find_interface(source_instance, payload.source_interface_code, "out")
    target_interface = _find_interface(target_instance, payload.target_interface_code, "in")

    if source_interface is None:
        raise ValueError("Source interface bestaat niet of is geen geldige output-interface.")
    if target_interface is None:
        raise ValueError("Target interface bestaat niet of is geen geldige input-interface.")

    return _validate_interface_compatibility(
        source_interface,
        target_interface,
        source_instance,
        target_instance,
    )


def create_project_connection(db: Session, project_id: str, payload: ConnectionInstanceCreate) -> ConnectionInstance:
    inferred_kind = _validate_project_and_instances(db, project_id, payload)
    values = payload.model_dump()
    values["connection_kind"] = inferred_kind
    values["implementation_kind"] = normalize_implementation_kind(payload.implementation_kind)
    values["label"] = normalize_connection_label(payload.label, inferred_kind)
    connection = ConnectionInstance(project_id=project_id, **values)
    db.add(connection)
    db.commit()
    db.refresh(connection)
    return connection


def update_project_connection(
    db: Session, connection_id: str, payload: ConnectionInstanceUpdate
) -> ConnectionInstance | None:
    connection = db.get(ConnectionInstance, connection_id)
    if connection is None:
        return None
    inferred_kind = _validate_project_and_instances(db, connection.project_id, payload)
    values = payload.model_dump()
    values["connection_kind"] = inferred_kind
    values["implementation_kind"] = normalize_implementation_kind(payload.implementation_kind)
    values["label"] = normalize_connection_label(payload.label, inferred_kind)
    for field, value in values.items():
        setattr(connection, field, value)
    db.commit()
    db.refresh(connection)
    return connection


def delete_project_connection(db: Session, connection_id: str) -> bool:
    connection = db.get(ConnectionInstance, connection_id)
    if connection is None:
        return False
    db.delete(connection)
    db.commit()
    return True


def get_project_connection_list(db: Session, project_id: str) -> ProjectConnectionList | None:
    if db.get(Project, project_id) is None:
        return None
    return ProjectConnectionList(project_id=project_id, connections=list_project_connections(db, project_id))


def replace_project_connections_from_canvas(
    db: Session,
    project_id: str,
    edges: list[dict[str, str | None]],
) -> None:
    db.execute(delete(ConnectionInstance).where(ConnectionInstance.project_id == project_id))
    for edge in edges:
        source_interface_code = edge.get("source_handle")
        target_interface_code = edge.get("target_handle")
        if not source_interface_code or not target_interface_code:
            continue
        payload = ConnectionInstanceCreate(
            source_instance_id=str(edge["source_instance_id"]),
            source_interface_code=source_interface_code,
            target_instance_id=str(edge["target_instance_id"]),
            target_interface_code=target_interface_code,
            connection_kind="logical",
            implementation_kind="conceptual",
            label=str(edge["label"]) if edge.get("label") is not None else None,
            status="active",
        )
        inferred_kind = _validate_project_and_instances(db, project_id, payload)
        values = payload.model_dump()
        values["connection_kind"] = inferred_kind
        values["implementation_kind"] = normalize_implementation_kind(payload.implementation_kind)
        values["label"] = normalize_connection_label(payload.label, inferred_kind)
        db.add(ConnectionInstance(project_id=project_id, **values))


def prune_invalid_project_connections_for_instance(db: Session, instance: ProjectEquipmentInstance) -> int:
    valid_input_handles = {item.code for item in instance.interfaces if item.direction == "in"}
    valid_output_handles = {item.code for item in instance.interfaces if item.direction == "out"}
    stmt = (
        select(ConnectionInstance)
        .where(ConnectionInstance.project_id == instance.project_id)
        .where(
            (ConnectionInstance.source_instance_id == instance.id)
            | (ConnectionInstance.target_instance_id == instance.id)
        )
    )
    removed = 0
    for connection in db.scalars(stmt):
        invalid_source = (
            connection.source_instance_id == instance.id
            and connection.source_interface_code not in valid_output_handles
        )
        invalid_target = (
            connection.target_instance_id == instance.id
            and connection.target_interface_code not in valid_input_handles
        )
        if invalid_source or invalid_target:
            db.delete(connection)
            removed += 1
    return removed
