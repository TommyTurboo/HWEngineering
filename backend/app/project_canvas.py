from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.connections import list_project_connections, replace_project_connections_from_canvas
from app.project_canvas_models import ProjectCanvasEdge, ProjectCanvasNode
from app.project_canvas_schemas import ProjectCanvasPayload, ProjectCanvasRead
from app.project_models import Project, ProjectEquipmentInstance


def get_project_canvas(db: Session, project_id: str) -> ProjectCanvasRead | None:
    project = db.get(Project, project_id)
    if project is None:
        return None

    node_stmt = (
        select(ProjectCanvasNode)
        .where(ProjectCanvasNode.project_id == project_id)
        .order_by(ProjectCanvasNode.created_at.asc())
    )
    edge_stmt = (
        select(ProjectCanvasEdge)
        .where(ProjectCanvasEdge.project_id == project_id)
        .order_by(ProjectCanvasEdge.created_at.asc())
    )
    nodes = list(db.scalars(node_stmt))
    edges = list(db.scalars(edge_stmt))
    if not edges:
        edges = [
            ProjectCanvasEdge(
                id=connection.id,
                project_id=project_id,
                source_instance_id=connection.source_instance_id,
                target_instance_id=connection.target_instance_id,
                source_handle=connection.source_interface_code,
                target_handle=connection.target_interface_code,
                label=connection.label,
                edge_type=connection.connection_kind,
            )
            for connection in list_project_connections(db, project_id)
        ]

    return ProjectCanvasRead(
        project_id=project_id,
        nodes=[
            {
                "id": node.id,
                "instance_id": node.instance_id,
                "x": node.x,
                "y": node.y,
                "width": node.width,
                "height": node.height,
            }
            for node in nodes
        ],
        edges=[
            {
                "id": edge.id,
                "source_instance_id": edge.source_instance_id,
                "target_instance_id": edge.target_instance_id,
                "source_handle": edge.source_handle,
                "target_handle": edge.target_handle,
                "label": edge.label,
                "edge_type": edge.edge_type,
            }
            for edge in edges
        ],
    )


def replace_project_canvas(
    db: Session, project_id: str, payload: ProjectCanvasPayload
) -> ProjectCanvasRead | None:
    project = db.get(Project, project_id)
    if project is None:
        return None

    valid_instance_ids = {
        row[0]
        for row in db.execute(
            select(ProjectEquipmentInstance.id).where(ProjectEquipmentInstance.project_id == project_id)
        ).all()
    }

    for node in payload.nodes:
        if node.instance_id not in valid_instance_ids:
            raise ValueError(f"Instance '{node.instance_id}' hoort niet bij dit project.")
    for edge in payload.edges:
        if edge.source_instance_id not in valid_instance_ids:
            raise ValueError(f"Edge source instance '{edge.source_instance_id}' hoort niet bij dit project.")
        if edge.target_instance_id not in valid_instance_ids:
            raise ValueError(f"Edge target instance '{edge.target_instance_id}' hoort niet bij dit project.")

    db.execute(delete(ProjectCanvasEdge).where(ProjectCanvasEdge.project_id == project_id))
    db.execute(delete(ProjectCanvasNode).where(ProjectCanvasNode.project_id == project_id))
    db.flush()

    for node in payload.nodes:
        db.add(
            ProjectCanvasNode(
                project_id=project_id,
                instance_id=node.instance_id,
                x=node.x,
                y=node.y,
                width=node.width,
                height=node.height,
            )
        )

    for edge in payload.edges:
        edge_model = ProjectCanvasEdge(
            project_id=project_id,
            source_instance_id=edge.source_instance_id,
            target_instance_id=edge.target_instance_id,
            source_handle=edge.source_handle,
            target_handle=edge.target_handle,
            label=edge.label,
            edge_type=edge.edge_type,
        )
        if edge.id and len(edge.id) <= 36:
            edge_model.id = edge.id
        db.add(edge_model)

    replace_project_connections_from_canvas(
        db,
        project_id,
        [
            {
                "source_instance_id": edge.source_instance_id,
                "target_instance_id": edge.target_instance_id,
                "source_handle": edge.source_handle,
                "target_handle": edge.target_handle,
                "label": edge.label,
            }
            for edge in payload.edges
        ],
    )

    db.commit()
    return get_project_canvas(db, project_id)
