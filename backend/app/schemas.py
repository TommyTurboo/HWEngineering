from datetime import datetime
import json

from pydantic import BaseModel, Field, field_validator


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


class TypicalParameterDefinitionCreate(BaseModel):
    code: str
    name: str
    source: str
    input_type: str
    unit: str | None = None
    default_value: str | None = None
    allowed_values: list[str] = Field(default_factory=list)
    required: bool = False
    is_parametrizable: bool = True
    drives_interfaces: bool = False
    bundle_id: str | None = None
    sort_order: int = 0


class TypicalInterfaceCreate(BaseModel):
    group_code: str | None = None
    code: str
    role: str
    logical_type: str
    direction: str
    source: str = "derived"
    sort_order: int = 0


class TypicalInterfaceGroupCreate(BaseModel):
    code: str
    name: str
    category: str
    side: str | None = None
    source: str = "profile"
    bundle_id: str | None = None
    sort_order: int = 0


class TypicalInterfaceGroupRead(BaseModel):
    id: str | None = None
    code: str
    name: str
    category: str
    side: str | None = None
    source: str
    bundle_id: str | None = None
    sort_order: int

    class Config:
        from_attributes = True


class TypicalInterfaceMappingRuleCreate(BaseModel):
    driver_parameter_code: str
    driver_value: str
    group_code: str | None = None
    interface_code: str
    role: str
    logical_type: str
    direction: str
    source: str = "rule"
    bundle_id: str | None = None
    sort_order: int = 0


class TypicalInterfaceMappingRuleRead(BaseModel):
    id: str | None = None
    driver_parameter_code: str
    driver_value: str
    group_code: str | None = None
    interface_code: str
    role: str
    logical_type: str
    direction: str
    source: str
    bundle_id: str | None = None
    sort_order: int

    class Config:
        from_attributes = True


class TypicalInterfaceRead(BaseModel):
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


class TypicalParameterDefinitionRead(BaseModel):
    id: str
    code: str
    name: str
    source: str
    input_type: str
    unit: str | None = None
    default_value: str | None = None
    allowed_values: list[str] = Field(default_factory=list)
    required: int
    is_parametrizable: int
    drives_interfaces: int
    bundle_id: str | None = None
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


class ParameterDefinitionPresetCreate(BaseModel):
    preset_name: str
    description: str | None = None
    code: str
    name: str
    source: str
    input_type: str
    unit: str | None = None
    default_value: str | None = None
    allowed_values: list[str] = Field(default_factory=list)
    required: bool = False
    is_parametrizable: bool = True
    drives_interfaces: bool = False
    sort_order: int = 0
    interface_groups: list[TypicalInterfaceGroupCreate] = Field(default_factory=list)
    interface_mapping_rules: list[TypicalInterfaceMappingRuleCreate] = Field(default_factory=list)


class ParameterDefinitionPresetUpdate(ParameterDefinitionPresetCreate):
    pass


class ParameterDefinitionPresetRead(BaseModel):
    id: str
    preset_name: str
    description: str | None = None
    code: str
    name: str
    source: str
    input_type: str
    unit: str | None = None
    default_value: str | None = None
    allowed_values: list[str] = Field(default_factory=list)
    required: int
    is_parametrizable: int
    drives_interfaces: int
    sort_order: int
    interface_groups: list[TypicalInterfaceGroupRead] = Field(default_factory=list)
    interface_mapping_rules: list[TypicalInterfaceMappingRuleRead] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

    @field_validator("allowed_values", mode="before")
    @classmethod
    def parse_preset_allowed_values(cls, value: object) -> list[str]:
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

    @field_validator("interface_groups", mode="before")
    @classmethod
    def parse_preset_interface_groups(cls, value: object) -> list[dict]:
        if value is None or value == "":
            return []
        if isinstance(value, list):
            return value
        if isinstance(value, str):
            try:
                parsed = json.loads(value)
            except json.JSONDecodeError:
                return []
            if isinstance(parsed, list):
                return parsed
        return []

    @field_validator("interface_mapping_rules", mode="before")
    @classmethod
    def parse_preset_interface_mapping_rules(cls, value: object) -> list[dict]:
        if value is None or value == "":
            return []
        if isinstance(value, list):
            return value
        if isinstance(value, str):
            try:
                parsed = json.loads(value)
            except json.JSONDecodeError:
                return []
            if isinstance(parsed, list):
                return parsed
        return []


class ValidationIssue(BaseModel):
    severity: str
    code: str
    message: str
    parameter_code: str | None = None
    parameter_name: str | None = None


class TypicalValidationResult(BaseModel):
    valid: bool
    issues: list[ValidationIssue] = Field(default_factory=list)


class EquipmentTypicalCreate(BaseModel):
    name: str
    code: str
    description: str | None = None
    etim_class_id: str
    template_key: str | None = None
    parameter_definitions: list[TypicalParameterDefinitionCreate] = Field(default_factory=list)
    parameters: list[TypicalParameterCreate] = Field(default_factory=list)
    interface_groups: list[TypicalInterfaceGroupCreate] = Field(default_factory=list)
    interface_mapping_rules: list[TypicalInterfaceMappingRuleCreate] = Field(default_factory=list)
    interfaces: list[TypicalInterfaceCreate] = Field(default_factory=list)
    disabled_interface_codes: list[str] = Field(default_factory=list)


class EquipmentTypicalUpdate(EquipmentTypicalCreate):
    pass


class EquipmentTypicalRead(BaseModel):
    id: str
    name: str
    code: str
    description: str | None = None
    etim_class_id: str
    etim_class_description: str
    template_key: str | None = None
    lineage_id: str | None = None
    released_from_id: str | None = None
    status: str
    version: int
    created_at: datetime
    updated_at: datetime
    parameter_definitions: list[TypicalParameterDefinitionRead]
    parameters: list[TypicalParameterRead]
    interface_groups: list[TypicalInterfaceGroupRead]
    interface_mapping_rules: list[TypicalInterfaceMappingRuleRead]
    interfaces: list[TypicalInterfaceRead]

    class Config:
        from_attributes = True


class EquipmentTypicalListItem(BaseModel):
    id: str
    name: str
    code: str
    etim_class_id: str
    etim_class_description: str
    lineage_id: str | None = None
    released_from_id: str | None = None
    status: str
    version: int
    updated_at: datetime

    class Config:
        from_attributes = True
