import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ParameterDefinitionPreset
from app.schemas import ParameterDefinitionPresetCreate, ParameterDefinitionPresetUpdate


def _to_model(payload: ParameterDefinitionPresetCreate) -> ParameterDefinitionPreset:
    return ParameterDefinitionPreset(
        preset_name=payload.preset_name,
        description=payload.description,
        code=payload.code,
        name=payload.name,
        source=payload.source,
        input_type=payload.input_type,
        unit=payload.unit,
        default_value=payload.default_value,
        allowed_values=json.dumps(payload.allowed_values),
        required=1 if payload.required else 0,
        is_parametrizable=1 if payload.is_parametrizable else 0,
        drives_interfaces=1 if payload.drives_interfaces else 0,
        sort_order=payload.sort_order,
        interface_groups_json=json.dumps([group.model_dump() for group in payload.interface_groups]),
        interface_mapping_rules_json=json.dumps(
            [rule.model_dump() for rule in payload.interface_mapping_rules]
        ),
    )


def create_preset(db: Session, payload: ParameterDefinitionPresetCreate) -> ParameterDefinitionPreset:
    preset = _to_model(payload)
    db.add(preset)
    db.commit()
    db.refresh(preset)
    return preset


def list_presets(db: Session, code: str | None = None) -> list[ParameterDefinitionPreset]:
    stmt = select(ParameterDefinitionPreset)
    if code:
        stmt = stmt.where(ParameterDefinitionPreset.code == code.lower())
    stmt = stmt.order_by(ParameterDefinitionPreset.code.asc(), ParameterDefinitionPreset.preset_name.asc())
    return list(db.scalars(stmt))


def get_preset(db: Session, preset_id: str) -> ParameterDefinitionPreset | None:
    return db.get(ParameterDefinitionPreset, preset_id)


def update_preset(
    db: Session, preset_id: str, payload: ParameterDefinitionPresetUpdate
) -> ParameterDefinitionPreset | None:
    preset = db.get(ParameterDefinitionPreset, preset_id)
    if preset is None:
        return None

    preset.preset_name = payload.preset_name
    preset.description = payload.description
    preset.code = payload.code
    preset.name = payload.name
    preset.source = payload.source
    preset.input_type = payload.input_type
    preset.unit = payload.unit
    preset.default_value = payload.default_value
    preset.allowed_values = json.dumps(payload.allowed_values)
    preset.required = 1 if payload.required else 0
    preset.is_parametrizable = 1 if payload.is_parametrizable else 0
    preset.drives_interfaces = 1 if payload.drives_interfaces else 0
    preset.sort_order = payload.sort_order
    preset.interface_groups_json = json.dumps([group.model_dump() for group in payload.interface_groups])
    preset.interface_mapping_rules_json = json.dumps(
        [rule.model_dump() for rule in payload.interface_mapping_rules]
    )

    db.commit()
    db.refresh(preset)
    return preset


def delete_preset(db: Session, preset_id: str) -> bool:
    preset = db.get(ParameterDefinitionPreset, preset_id)
    if preset is None:
        return False

    db.delete(preset)
    db.commit()
    return True
