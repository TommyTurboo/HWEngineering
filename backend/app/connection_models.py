from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ConnectionInstance(Base):
    __tablename__ = "connection_instances"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    source_instance_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("project_equipment_instances.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    source_interface_code: Mapped[str] = mapped_column(String(100), nullable=False)
    target_instance_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("project_equipment_instances.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    target_interface_code: Mapped[str] = mapped_column(String(100), nullable=False)
    connection_kind: Mapped[str] = mapped_column(String(30), nullable=False, default="logical")
    implementation_kind: Mapped[str] = mapped_column(String(30), nullable=False, default="conceptual")
    label: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )
