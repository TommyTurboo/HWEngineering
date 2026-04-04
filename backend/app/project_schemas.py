import json
from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class ProjectCreate(BaseModel):
    name: str
    code: str
    description: str | None = None
    status: str = "active"


class ProjectUpdate(ProjectCreate):
    pass


class ProjectRead(BaseModel):
    id: str
    name: str
    code: str
    description: str | None = None
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProjectListItem(ProjectRead):
    instance_count: int = 0


class InstanceCreate(BaseModel):
    name: str
    tag: str
    description: str | None = None
    released_typical_id: str


class InstanceUpdate(BaseModel):
    name: str
    tag: str
    description: str | None = None
    parameter_definition_snapshots: list["InstanceParameterDefinitionSnapshotWrite"] = Field(default_factory=list)
    parameter_selections: list["InstanceParameterSelectionWrite"] = Field(default_factory=list)


class InstanceParameterSelectionWrite(BaseModel):
    parameter_code: str
    selected_value: str | None = None


class InstanceParameterDefinitionSnapshotWrite(BaseModel):
    parameter_code: str
    parameter_name: str
    source: str
    input_type: str
    unit: str | None = None
    allowed_values: list[str] = Field(default_factory=list)
    default_value: str | None = None
    required: bool = False
    is_parametrizable: bool = True
    drives_interfaces: bool = False
    origin: str = "inherited"
    visibility: str = "active"
    sort_order: int = 0


class InstanceParameterDefinitionSnapshotRead(BaseModel):
    id: str
    parameter_code: str
    parameter_name: str
    source: str
    input_type: str
    unit: str | None = None
    allowed_values: list[str] = Field(default_factory=list)
    default_value: str | None = None
    required: int
    is_parametrizable: int
    drives_interfaces: int
    origin: str
    visibility: str
    sort_order: int

    class Config:
        from_attributes = True

    @field_validator("allowed_values", mode="before")
    @classmethod
    def parse_allowed_values(cls, value: object) -> list[str]:
        if value is None or value == "":
            return []
        if isinstance(value, list):
            return [str(item) for item in value]
        if isinstance(value, str):
            try:
                parsed = json.loads(value)
            except json.JSONDecodeError:
                return [item.strip() for item in value.split(",") if item.strip()]
            if isinstance(parsed, list):
                return [str(item) for item in parsed]
        return []


class InstanceParameterSelectionRead(BaseModel):
    id: str
    parameter_code: str
    parameter_name: str
    source: str
    input_type: str
    unit: str | None = None
    selected_value: str | None = None
    sort_order: int

    class Config:
        from_attributes = True


class InstanceInterfaceGroupRead(BaseModel):
    id: str
    code: str
    name: str
    category: str
    side: str | None = None
    sort_order: int

    class Config:
        from_attributes = True


class InstanceInterfaceMappingRuleSnapshotRead(BaseModel):
    id: str
    driver_parameter_code: str
    driver_value: str
    group_code: str | None = None
    interface_code: str
    role: str
    logical_type: str
    direction: str
    sort_order: int

    class Config:
        from_attributes = True


class InstanceInterfaceRead(BaseModel):
    id: str
    group_code: str | None = None
    code: str
    role: str
    logical_type: str
    direction: str
    source: str
    sort_order: int

    class Config:
        from_attributes = True


class ProjectEquipmentInstanceListItem(BaseModel):
    id: str
    name: str
    tag: str
    description: str | None = None
    typical_id: str
    typical_lineage_id: str | None = None
    typical_version: int
    typical_code: str
    typical_name: str
    etim_class_id: str
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProjectEquipmentInstanceRead(ProjectEquipmentInstanceListItem):
    parameter_definition_snapshots: list[InstanceParameterDefinitionSnapshotRead]
    parameter_selections: list[InstanceParameterSelectionRead]
    interface_groups: list[InstanceInterfaceGroupRead]
    interface_mapping_rule_snapshots: list[InstanceInterfaceMappingRuleSnapshotRead]
    interfaces: list[InstanceInterfaceRead]

    class Config:
        from_attributes = True


class InstanceValidationIssue(BaseModel):
    severity: str
    code: str
    message: str
    parameter_code: str | None = None
    parameter_name: str | None = None


class InstanceValidationResult(BaseModel):
    valid: bool
    issues: list[InstanceValidationIssue] = Field(default_factory=list)


InstanceUpdate.model_rebuild()
