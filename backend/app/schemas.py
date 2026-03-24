from datetime import datetime

from pydantic import BaseModel, Field


class EtimClassSummary(BaseModel):
    id: str
    description: str
    version: str | None = None
    group_id: str | None = None


class EtimFeatureOption(BaseModel):
    value_id: str
    value_description: str | None = None
    sort_order: int | None = None


class EtimFeatureDetail(BaseModel):
    art_class_feature_nr: str
    feature_id: str
    feature_description: str | None = None
    feature_group_id: str | None = None
    feature_group_description: str | None = None
    feature_type: str | None = None
    unit_id: str | None = None
    unit_description: str | None = None
    sort_order: int | None = None
    values: list[EtimFeatureOption] = Field(default_factory=list)


class EtimClassDetail(EtimClassSummary):
    features: list[EtimFeatureDetail] = Field(default_factory=list)


class TypicalParameterCreate(BaseModel):
    code: str
    name: str
    source: str
    data_type: str
    unit: str | None = None
    value: str | None = None
    required: bool = False
    is_parametrizable: bool = True
    drives_interfaces: bool = False
    sort_order: int = 0


class TypicalInterfaceRead(BaseModel):
    id: str
    code: str
    role: str
    logical_type: str
    direction: str
    source: str
    sort_order: int

    class Config:
        from_attributes = True


class TypicalParameterRead(BaseModel):
    id: str
    code: str
    name: str
    source: str
    data_type: str
    unit: str | None = None
    value: str | None = None
    required: int
    is_parametrizable: int
    drives_interfaces: int
    sort_order: int

    class Config:
        from_attributes = True


class EquipmentTypicalCreate(BaseModel):
    name: str
    code: str
    description: str | None = None
    etim_class_id: str
    template_key: str | None = None
    parameters: list[TypicalParameterCreate] = Field(default_factory=list)


class EquipmentTypicalRead(BaseModel):
    id: str
    name: str
    code: str
    description: str | None = None
    etim_class_id: str
    etim_class_description: str
    template_key: str | None = None
    status: str
    version: int
    created_at: datetime
    updated_at: datetime
    parameters: list[TypicalParameterRead]
    interfaces: list[TypicalInterfaceRead]

    class Config:
        from_attributes = True


class EquipmentTypicalListItem(BaseModel):
    id: str
    name: str
    code: str
    etim_class_id: str
    etim_class_description: str
    status: str
    version: int
    updated_at: datetime

    class Config:
        from_attributes = True
