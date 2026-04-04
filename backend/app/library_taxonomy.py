from __future__ import annotations

from collections import defaultdict

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.etim_repository import get_art_group_descriptions, get_class_detail
from app.library_models import LibraryNode, TypicalLibraryLink
from app.library_schemas import LibraryNodeCreate, LibraryNodeUpdate, TypicalLibraryPlacementRead
from app.models import EquipmentTypical


def list_library_nodes(db: Session) -> list[LibraryNode]:
    stmt = select(LibraryNode).order_by(LibraryNode.sort_order.asc(), LibraryNode.name.asc())
    return list(db.scalars(stmt))


def create_library_node(db: Session, payload: LibraryNodeCreate) -> LibraryNode:
    node = LibraryNode(
        parent_id=payload.parent_id,
        code=payload.code.strip(),
        name=payload.name.strip(),
        node_type=payload.node_type.strip() or "folder",
        sort_order=payload.sort_order,
        is_active=1 if payload.is_active else 0,
    )
    db.add(node)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ValueError("Library node code bestaat al onder deze parent.") from exc
    db.refresh(node)
    return node


def update_library_node(db: Session, node_id: str, payload: LibraryNodeUpdate) -> LibraryNode | None:
    node = db.get(LibraryNode, node_id)
    if node is None:
        return None
    node.parent_id = payload.parent_id
    node.code = payload.code.strip()
    node.name = payload.name.strip()
    node.node_type = payload.node_type.strip() or "folder"
    node.sort_order = payload.sort_order
    node.is_active = 1 if payload.is_active else 0
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ValueError("Library node code bestaat al onder deze parent.") from exc
    db.refresh(node)
    return node


def delete_library_node(db: Session, node_id: str) -> bool:
    node = db.get(LibraryNode, node_id)
    if node is None:
        return False
    db.delete(node)
    db.commit()
    return True


def replace_typical_library_placement(
    db: Session, typical_lineage_id: str, library_node_ids: list[str], primary_library_node_id: str | None
) -> list[TypicalLibraryLink]:
    unique_node_ids = []
    seen: set[str] = set()
    for node_id in library_node_ids:
        normalized = node_id.strip()
        if normalized and normalized not in seen:
            seen.add(normalized)
            unique_node_ids.append(normalized)

    if primary_library_node_id and primary_library_node_id not in unique_node_ids:
        unique_node_ids.insert(0, primary_library_node_id)

    if unique_node_ids:
        existing_nodes = {
            node.id for node in db.scalars(select(LibraryNode).where(LibraryNode.id.in_(unique_node_ids)))
        }
        missing = [node_id for node_id in unique_node_ids if node_id not in existing_nodes]
        if missing:
            raise ValueError("Een of meer library nodes bestaan niet.")

    db.execute(delete(TypicalLibraryLink).where(TypicalLibraryLink.typical_lineage_id == typical_lineage_id))
    for node_id in unique_node_ids:
        db.add(
            TypicalLibraryLink(
                typical_lineage_id=typical_lineage_id,
                library_node_id=node_id,
                is_primary=1 if node_id == primary_library_node_id else 0,
            )
        )
    db.commit()

    stmt = (
        select(TypicalLibraryLink)
        .where(TypicalLibraryLink.typical_lineage_id == typical_lineage_id)
        .order_by(TypicalLibraryLink.is_primary.desc(), TypicalLibraryLink.library_node_id.asc())
    )
    return list(db.scalars(stmt))


def get_typical_library_placement(db: Session, typical_lineage_id: str) -> TypicalLibraryPlacementRead:
    stmt = (
        select(TypicalLibraryLink)
        .where(TypicalLibraryLink.typical_lineage_id == typical_lineage_id)
        .order_by(TypicalLibraryLink.is_primary.desc(), TypicalLibraryLink.library_node_id.asc())
    )
    links = list(db.scalars(stmt))
    return TypicalLibraryPlacementRead(
        typical_lineage_id=typical_lineage_id,
        library_node_ids=[link.library_node_id for link in links],
        primary_library_node_id=next(
            (link.library_node_id for link in links if link.is_primary),
            links[0].library_node_id if links else None,
        ),
    )


def _latest_typicals_by_lineage(db: Session) -> list[EquipmentTypical]:
    stmt = select(EquipmentTypical).order_by(EquipmentTypical.updated_at.desc())
    latest_by_lineage: dict[str, EquipmentTypical] = {}
    for typical in db.scalars(stmt):
        lineage_key = typical.lineage_id or typical.id
        existing = latest_by_lineage.get(lineage_key)
        if existing is None or (typical.version, typical.updated_at) > (existing.version, existing.updated_at):
            latest_by_lineage[lineage_key] = typical
    return list(latest_by_lineage.values())


def _fallback_etim_tree(db: Session) -> list[dict]:
    latest_typicals = _latest_typicals_by_lineage(db)
    group_ids = [
        item.group_id
        for item in [get_class_detail(typical.etim_class_id) for typical in latest_typicals]
        if item and item.group_id
    ]
    group_descriptions = get_art_group_descriptions(group_ids)

    grouped: dict[str, dict] = {}
    for typical in latest_typicals:
        etim_class = get_class_detail(typical.etim_class_id)
        group_id = etim_class.group_id if etim_class and etim_class.group_id else "UNGROUPED"
        group_description = group_descriptions.get(
            group_id, group_id if group_id != "UNGROUPED" else "Ungrouped"
        )
        node = grouped.setdefault(
            group_id,
            {
                "node_id": f"etim-group:{group_id}",
                "parent_id": None,
                "code": group_id,
                "name": group_description,
                "node_type": "etim_group",
                "source": "etim",
                "sort_order": 0,
                "children": [],
                "typicals": [],
            },
        )
        node["typicals"].append(
            {
                "id": typical.id,
                "lineage_id": typical.lineage_id,
                "name": typical.name,
                "code": typical.code,
                "etim_class_id": typical.etim_class_id,
                "etim_class_description": typical.etim_class_description,
                "status": typical.status,
                "version": typical.version,
                "updated_at": typical.updated_at,
            }
        )

    for node in grouped.values():
        node["typicals"] = sorted(node["typicals"], key=lambda item: item["name"].lower())
    return sorted(grouped.values(), key=lambda item: item["name"].lower())


def list_library_tree(db: Session) -> list[dict]:
    nodes = list_library_nodes(db)
    active_nodes = [node for node in nodes if node.is_active]
    if not active_nodes:
        return _fallback_etim_tree(db)

    latest_typicals = _latest_typicals_by_lineage(db)
    latest_by_lineage = {typical.lineage_id or typical.id: typical for typical in latest_typicals}

    link_stmt = select(TypicalLibraryLink).order_by(TypicalLibraryLink.is_primary.desc())
    links = list(db.scalars(link_stmt))
    links_by_node: dict[str, list[TypicalLibraryLink]] = defaultdict(list)
    linked_lineages: set[str] = set()
    for link in links:
        links_by_node[link.library_node_id].append(link)
        linked_lineages.add(link.typical_lineage_id)

    node_map: dict[str, dict] = {}
    for node in active_nodes:
        node_map[node.id] = {
            "node_id": node.id,
            "parent_id": node.parent_id,
            "code": node.code,
            "name": node.name,
            "node_type": node.node_type,
            "source": "library",
            "sort_order": node.sort_order,
            "children": [],
            "typicals": [],
        }

    for node in active_nodes:
        for link in links_by_node.get(node.id, []):
            typical = latest_by_lineage.get(link.typical_lineage_id)
            if typical is None:
                continue
            node_map[node.id]["typicals"].append(
                {
                    "id": typical.id,
                    "lineage_id": typical.lineage_id,
                    "name": typical.name,
                    "code": typical.code,
                    "etim_class_id": typical.etim_class_id,
                    "etim_class_description": typical.etim_class_description,
                    "status": typical.status,
                    "version": typical.version,
                    "updated_at": typical.updated_at,
                }
            )

    roots: list[dict] = []
    for node in active_nodes:
        current = node_map[node.id]
        current["typicals"] = sorted(current["typicals"], key=lambda item: item["name"].lower())
        if node.parent_id and node.parent_id in node_map:
            node_map[node.parent_id]["children"].append(current)
        else:
            roots.append(current)

    for current in node_map.values():
        current["children"] = sorted(
            current["children"], key=lambda item: (item["sort_order"], item["name"].lower())
        )

    unlinked_typicals = [
        typical
        for lineage_id, typical in latest_by_lineage.items()
        if lineage_id not in linked_lineages
    ]
    if unlinked_typicals:
        roots.append(
            {
                "node_id": "unlinked",
                "parent_id": None,
                "code": "unlinked",
                "name": "Unlinked typicals",
                "node_type": "system",
                "source": "system",
                "sort_order": 9999,
                "children": [],
                "typicals": sorted(
                    [
                        {
                            "id": typical.id,
                            "lineage_id": typical.lineage_id,
                            "name": typical.name,
                            "code": typical.code,
                            "etim_class_id": typical.etim_class_id,
                            "etim_class_description": typical.etim_class_description,
                            "status": typical.status,
                            "version": typical.version,
                            "updated_at": typical.updated_at,
                        }
                        for typical in unlinked_typicals
                    ],
                    key=lambda item: item["name"].lower(),
                ),
            }
        )

    return sorted(roots, key=lambda item: (item["sort_order"], item["name"].lower()))
