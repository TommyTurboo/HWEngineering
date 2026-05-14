from pydantic import BaseModel, Field


class ProjectCanvasNodePayload(BaseModel):
    instance_id: str
    x: float
    y: float
    width: float | None = None
    height: float | None = None


class ProjectCanvasEdgePayload(BaseModel):
    id: str | None = None
    source_instance_id: str
    target_instance_id: str
    source_handle: str | None = None
    target_handle: str | None = None
    label: str | None = None
    edge_type: str | None = None


class ProjectCanvasPayload(BaseModel):
    nodes: list[ProjectCanvasNodePayload] = Field(default_factory=list)
    edges: list[ProjectCanvasEdgePayload] = Field(default_factory=list)


class ProjectCanvasNodeRead(ProjectCanvasNodePayload):
    id: str

    class Config:
        from_attributes = True


class ProjectCanvasEdgeRead(ProjectCanvasEdgePayload):
    id: str

    class Config:
        from_attributes = True


class ProjectCanvasRead(BaseModel):
    project_id: str
    nodes: list[ProjectCanvasNodeRead] = Field(default_factory=list)
    edges: list[ProjectCanvasEdgeRead] = Field(default_factory=list)
