from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class LibraryNode(Base):
    __tablename__ = "library_nodes"
    __table_args__ = (
        UniqueConstraint("parent_id", "code", name="uq_library_nodes_parent_code"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    parent_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("library_nodes.id", ondelete="CASCADE"), nullable=True, index=True
    )
    code: Mapped[str] = mapped_column(String(100), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    node_type: Mapped[str] = mapped_column(String(30), default="folder", nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )


class TypicalLibraryLink(Base):
    __tablename__ = "typical_library_links"
    __table_args__ = (
        UniqueConstraint("typical_lineage_id", "library_node_id", name="uq_typical_library_links_lineage_node"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    typical_lineage_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    library_node_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("library_nodes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    is_primary: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )
