from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class LibraryTypicalLeaf(BaseModel):
    id: str
    lineage_id: str | None = None
    name: str
    code: str
    etim_class_id: str
    etim_class_description: str
    status: str
    version: int
    updated_at: datetime


class LibraryTreeNode(BaseModel):
    node_id: str
    parent_id: str | None = None
    code: str
    name: str
    node_type: str
    source: str = "library"
    sort_order: int = 0
    children: list["LibraryTreeNode"] = Field(default_factory=list)
    typicals: list[LibraryTypicalLeaf] = Field(default_factory=list)


class LibraryNodeCreate(BaseModel):
    parent_id: str | None = None
    code: str
    name: str
    node_type: str = "folder"
    sort_order: int = 0
    is_active: bool = True


class LibraryNodeUpdate(LibraryNodeCreate):
    pass


class LibraryNodeRead(BaseModel):
    id: str
    parent_id: str | None = None
    code: str
    name: str
    node_type: str
    sort_order: int
    is_active: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TypicalLibraryPlacementUpdate(BaseModel):
    library_node_ids: list[str] = Field(default_factory=list)
    primary_library_node_id: str | None = None


class TypicalLibraryPlacementRead(BaseModel):
    typical_lineage_id: str
    library_node_ids: list[str] = Field(default_factory=list)
    primary_library_node_id: str | None = None
