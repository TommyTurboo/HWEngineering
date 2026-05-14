from typing import Literal

from pydantic import BaseModel, Field

ConnectionKind = Literal["power", "signal", "network", "pe", "logical"]
ImplementationKind = Literal[
    "conceptual",
    "wire",
    "cable",
    "terminal_bridge",
    "busbar",
    "prewired_internal",
]


class ConnectionInstanceBase(BaseModel):
    source_instance_id: str
    source_interface_code: str
    target_instance_id: str
    target_interface_code: str
    connection_kind: ConnectionKind = "logical"
    implementation_kind: ImplementationKind = "conceptual"
    label: str | None = None
    status: str = "active"


class ConnectionInstanceCreate(ConnectionInstanceBase):
    pass


class ConnectionInstanceUpdate(ConnectionInstanceBase):
    pass


class ConnectionInstanceRead(ConnectionInstanceBase):
    id: str
    project_id: str

    class Config:
        from_attributes = True


class ProjectConnectionList(BaseModel):
    project_id: str
    connections: list[ConnectionInstanceRead] = Field(default_factory=list)
