from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class EquipmentTypical(Base):
    __tablename__ = "equipment_typicals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    etim_class_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    etim_class_description: Mapped[str] = mapped_column(String(255), nullable=False)
    template_key: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="draft", nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    parameters: Mapped[list["TypicalParameter"]] = relationship(
        back_populates="typical", cascade="all, delete-orphan"
    )
    parameter_definitions: Mapped[list["TypicalParameterDefinition"]] = relationship(
        back_populates="typical", cascade="all, delete-orphan"
    )
    interface_groups: Mapped[list["TypicalInterfaceGroup"]] = relationship(
        back_populates="typical", cascade="all, delete-orphan"
    )
    interfaces: Mapped[list["TypicalInterface"]] = relationship(
        back_populates="typical", cascade="all, delete-orphan"
    )


class ParameterDefinitionPreset(Base):
    __tablename__ = "parameter_definition_presets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    preset_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    code: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    source: Mapped[str] = mapped_column(String(30), nullable=False)
    input_type: Mapped[str] = mapped_column(String(30), nullable=False)
    unit: Mapped[str | None] = mapped_column(String(50), nullable=True)
    default_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    allowed_values: Mapped[str | None] = mapped_column(Text, nullable=True)
    required: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_parametrizable: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    drives_interfaces: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )


class TypicalParameterDefinition(Base):
    __tablename__ = "typical_parameter_definitions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    typical_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("equipment_typicals.id", ondelete="CASCADE"), nullable=False, index=True
    )
    code: Mapped[str] = mapped_column(String(100), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    source: Mapped[str] = mapped_column(String(30), nullable=False)
    input_type: Mapped[str] = mapped_column(String(30), nullable=False)
    unit: Mapped[str | None] = mapped_column(String(50), nullable=True)
    default_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    allowed_values: Mapped[str | None] = mapped_column(Text, nullable=True)
    required: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_parametrizable: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    drives_interfaces: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    typical: Mapped[EquipmentTypical] = relationship(back_populates="parameter_definitions")


class TypicalParameter(Base):
    __tablename__ = "typical_parameters"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    typical_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("equipment_typicals.id", ondelete="CASCADE"), nullable=False, index=True
    )
    code: Mapped[str] = mapped_column(String(100), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    source: Mapped[str] = mapped_column(String(30), nullable=False)
    data_type: Mapped[str] = mapped_column(String(30), nullable=False)
    unit: Mapped[str | None] = mapped_column(String(50), nullable=True)
    value: Mapped[str | None] = mapped_column(Text, nullable=True)
    required: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_parametrizable: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    drives_interfaces: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    typical: Mapped[EquipmentTypical] = relationship(back_populates="parameters")


class TypicalInterface(Base):
    __tablename__ = "typical_interfaces"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    typical_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("equipment_typicals.id", ondelete="CASCADE"), nullable=False, index=True
    )
    group_code: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    code: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[str] = mapped_column(String(100), nullable=False)
    logical_type: Mapped[str] = mapped_column(String(50), nullable=False)
    direction: Mapped[str] = mapped_column(String(20), nullable=False)
    source: Mapped[str] = mapped_column(String(30), default="derived", nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    typical: Mapped[EquipmentTypical] = relationship(back_populates="interfaces")


class TypicalInterfaceGroup(Base):
    __tablename__ = "typical_interface_groups"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    typical_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("equipment_typicals.id", ondelete="CASCADE"), nullable=False, index=True
    )
    code: Mapped[str] = mapped_column(String(100), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    side: Mapped[str | None] = mapped_column(String(100), nullable=True)
    source: Mapped[str] = mapped_column(String(30), default="profile", nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    typical: Mapped[EquipmentTypical] = relationship(back_populates="interface_groups")
