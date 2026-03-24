from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.etim_repository import get_class_detail
from app.models import EquipmentTypical, TypicalInterface, TypicalParameter
from app.schemas import EquipmentTypicalCreate


def derive_interfaces(payload: EquipmentTypicalCreate) -> list[TypicalInterface]:
    pole_count = 1
    for parameter in payload.parameters:
        if parameter.code.lower() in {"number_of_poles", "poles", "pole_count"} and parameter.value:
            try:
                pole_count = max(1, int(parameter.value))
            except ValueError:
                pole_count = 1

    interfaces: list[TypicalInterface] = []
    if payload.template_key == "multi_pole_switch_device":
        labels = ["L1", "L2", "L3", "N"]
        for index in range(pole_count):
            label = labels[index] if index < len(labels) else f"P{index + 1}"
            interfaces.append(
                TypicalInterface(
                    code=f"{label}_IN",
                    role="line_in",
                    logical_type="power",
                    direction="in",
                    source="derived",
                    sort_order=index * 2,
                )
            )
            interfaces.append(
                TypicalInterface(
                    code=f"{label}_OUT",
                    role="load_out",
                    logical_type="power",
                    direction="out",
                    source="derived",
                    sort_order=index * 2 + 1,
                )
            )
    elif payload.template_key == "dc_power_supply":
        interfaces.extend(
            [
                TypicalInterface(
                    code="AC_IN",
                    role="power_input",
                    logical_type="power",
                    direction="in",
                    source="derived",
                    sort_order=0,
                ),
                TypicalInterface(
                    code="PE",
                    role="protective_earth",
                    logical_type="protective_earth",
                    direction="bidirectional",
                    source="derived",
                    sort_order=1,
                ),
                TypicalInterface(
                    code="+24V_OUT",
                    role="positive_output",
                    logical_type="power",
                    direction="out",
                    source="derived",
                    sort_order=2,
                ),
                TypicalInterface(
                    code="0V_OUT",
                    role="return_output",
                    logical_type="power",
                    direction="out",
                    source="derived",
                    sort_order=3,
                ),
            ]
        )

    return interfaces


def create_typical(db: Session, payload: EquipmentTypicalCreate) -> EquipmentTypical:
    etim_class = get_class_detail(payload.etim_class_id)
    if etim_class is None:
        raise ValueError(f"Unknown ETIM class: {payload.etim_class_id}")

    typical = EquipmentTypical(
        name=payload.name,
        code=payload.code,
        description=payload.description,
        etim_class_id=payload.etim_class_id,
        etim_class_description=etim_class.description,
        template_key=payload.template_key,
        status="draft",
        version=1,
    )

    typical.parameters = [
        TypicalParameter(
            code=parameter.code,
            name=parameter.name,
            source=parameter.source,
            data_type=parameter.data_type,
            unit=parameter.unit,
            value=parameter.value,
            required=1 if parameter.required else 0,
            is_parametrizable=1 if parameter.is_parametrizable else 0,
            drives_interfaces=1 if parameter.drives_interfaces else 0,
            sort_order=parameter.sort_order,
        )
        for parameter in payload.parameters
    ]
    typical.interfaces = derive_interfaces(payload)

    db.add(typical)
    db.commit()
    db.refresh(typical)
    return get_typical(db, typical.id)


def list_typicals(db: Session) -> list[EquipmentTypical]:
    stmt = (
        select(EquipmentTypical)
        .options(selectinload(EquipmentTypical.parameters), selectinload(EquipmentTypical.interfaces))
        .order_by(EquipmentTypical.updated_at.desc())
    )
    return list(db.scalars(stmt))


def get_typical(db: Session, typical_id: str) -> EquipmentTypical | None:
    stmt = (
        select(EquipmentTypical)
        .where(EquipmentTypical.id == typical_id)
        .options(selectinload(EquipmentTypical.parameters), selectinload(EquipmentTypical.interfaces))
    )
    return db.scalars(stmt).first()


def delete_typical(db: Session, typical_id: str) -> bool:
    typical = db.get(EquipmentTypical, typical_id)
    if typical is None:
        return False

    db.delete(typical)
    db.commit()
    return True
