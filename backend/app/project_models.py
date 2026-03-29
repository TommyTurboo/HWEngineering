import json
from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    instances: Mapped[list["ProjectEquipmentInstance"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )


class ProjectEquipmentInstance(Base):
    __tablename__ = "project_equipment_instances"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    tag: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    typical_id: Mapped[str] = mapped_column(String(36), ForeignKey("equipment_typicals.id"), nullable=False)
    typical_lineage_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    typical_version: Mapped[int] = mapped_column(Integer, nullable=False)
    typical_code: Mapped[str] = mapped_column(String(100), nullable=False)
    typical_name: Mapped[str] = mapped_column(String(255), nullable=False)
    etim_class_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    project: Mapped[Project] = relationship(back_populates="instances")
    parameter_definition_snapshots: Mapped[list["InstanceParameterDefinitionSnapshot"]] = relationship(
        back_populates="instance", cascade="all, delete-orphan"
    )
    parameter_selections: Mapped[list["InstanceParameterSelection"]] = relationship(
        back_populates="instance", cascade="all, delete-orphan"
    )
    interface_groups: Mapped[list["InstanceInterfaceGroup"]] = relationship(
        back_populates="instance", cascade="all, delete-orphan"
    )
    interface_mapping_rule_snapshots: Mapped[list["InstanceInterfaceMappingRuleSnapshot"]] = relationship(
        back_populates="instance", cascade="all, delete-orphan"
    )
    interfaces: Mapped[list["InstanceInterface"]] = relationship(
        back_populates="instance", cascade="all, delete-orphan"
    )


class InstanceParameterDefinitionSnapshot(Base):
    __tablename__ = "instance_parameter_definition_snapshots"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    instance_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("project_equipment_instances.id", ondelete="CASCADE"), nullable=False, index=True
    )
    parameter_code: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    parameter_name: Mapped[str] = mapped_column(String(255), nullable=False)
    source: Mapped[str] = mapped_column(String(30), nullable=False)
    input_type: Mapped[str] = mapped_column(String(30), nullable=False)
    unit: Mapped[str | None] = mapped_column(String(50), nullable=True)
    allowed_values_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    default_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    required: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_parametrizable: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    drives_interfaces: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    instance: Mapped[ProjectEquipmentInstance] = relationship(back_populates="parameter_definition_snapshots")

    @property
    def allowed_values(self) -> list[str]:
        if not self.allowed_values_json:
            return []
        try:
            parsed = json.loads(self.allowed_values_json)
        except json.JSONDecodeError:
            return []
        return [str(item) for item in parsed] if isinstance(parsed, list) else []


class InstanceParameterSelection(Base):
    __tablename__ = "instance_parameter_selections"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    instance_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("project_equipment_instances.id", ondelete="CASCADE"), nullable=False, index=True
    )
    parameter_code: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    parameter_name: Mapped[str] = mapped_column(String(255), nullable=False)
    source: Mapped[str] = mapped_column(String(30), nullable=False)
    input_type: Mapped[str] = mapped_column(String(30), nullable=False)
    unit: Mapped[str | None] = mapped_column(String(50), nullable=True)
    selected_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    instance: Mapped[ProjectEquipmentInstance] = relationship(back_populates="parameter_selections")


class InstanceInterfaceGroup(Base):
    __tablename__ = "instance_interface_groups"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    instance_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("project_equipment_instances.id", ondelete="CASCADE"), nullable=False, index=True
    )
    code: Mapped[str] = mapped_column(String(100), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    side: Mapped[str | None] = mapped_column(String(100), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    instance: Mapped[ProjectEquipmentInstance] = relationship(back_populates="interface_groups")


class InstanceInterfaceMappingRuleSnapshot(Base):
    __tablename__ = "instance_interface_mapping_rule_snapshots"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    instance_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("project_equipment_instances.id", ondelete="CASCADE"), nullable=False, index=True
    )
    driver_parameter_code: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    driver_value: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    group_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    interface_code: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[str] = mapped_column(String(100), nullable=False)
    logical_type: Mapped[str] = mapped_column(String(50), nullable=False)
    direction: Mapped[str] = mapped_column(String(20), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    instance: Mapped[ProjectEquipmentInstance] = relationship(
        back_populates="interface_mapping_rule_snapshots"
    )


class InstanceInterface(Base):
    __tablename__ = "instance_interfaces"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    instance_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("project_equipment_instances.id", ondelete="CASCADE"), nullable=False, index=True
    )
    group_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    code: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[str] = mapped_column(String(100), nullable=False)
    logical_type: Mapped[str] = mapped_column(String(50), nullable=False)
    direction: Mapped[str] = mapped_column(String(20), nullable=False)
    source: Mapped[str] = mapped_column(String(30), default="derived", nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    instance: Mapped[ProjectEquipmentInstance] = relationship(back_populates="interfaces")
