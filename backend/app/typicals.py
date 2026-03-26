import json

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.etim_repository import get_class_detail
from app.models import (
    EquipmentTypical,
    TypicalInterface,
    TypicalInterfaceGroup,
    TypicalParameter,
    TypicalParameterDefinition,
)
from app.schemas import EquipmentTypicalCreate, EquipmentTypicalUpdate, TypicalValidationResult, ValidationIssue


SWITCH_TOPOLOGIES: dict[str, list[str]] = {
    "L": ["L"],
    "L+N": ["L", "N"],
    "3L": ["L1", "L2", "L3"],
    "3L+N": ["L1", "L2", "L3", "N"],
}


def default_interface_groups(payload: EquipmentTypicalCreate) -> list[TypicalInterfaceGroup]:
    if payload.template_key == "multi_pole_switch_device":
        return [
            TypicalInterfaceGroup(
                code="input_power",
                name="Input power",
                category="power_input",
                side="line",
                source="profile",
                sort_order=0,
            ),
            TypicalInterfaceGroup(
                code="output_power",
                name="Output power",
                category="power_output",
                side="load",
                source="profile",
                sort_order=1,
            ),
        ]

    if payload.template_key == "dc_power_supply":
        return [
            TypicalInterfaceGroup(
                code="input_power",
                name="Input power",
                category="power_input",
                side="primary",
                source="profile",
                sort_order=0,
            ),
            TypicalInterfaceGroup(
                code="output_power",
                name="Output power",
                category="power_output",
                side="secondary",
                source="profile",
                sort_order=1,
            ),
        ]

    return []


def build_interface_groups(payload: EquipmentTypicalCreate) -> list[TypicalInterfaceGroup]:
    groups = payload.interface_groups or default_interface_groups(payload)
    return [
        TypicalInterfaceGroup(
            code=group.code,
            name=group.name,
            category=group.category,
            side=group.side,
            source=group.source,
            sort_order=group.sort_order,
        )
        for group in groups
    ]


def _source_parameters(payload: EquipmentTypicalCreate):
    return payload.parameter_definitions or payload.parameters


def resolve_switch_topology(payload: EquipmentTypicalCreate) -> str:
    source_parameters = _source_parameters(payload)
    pole_count = 1

    for parameter in source_parameters:
        parameter_code = parameter.code.lower()
        parameter_name = parameter.name.lower()
        parameter_value = (getattr(parameter, "default_value", None) or getattr(parameter, "value", None) or "").strip()

        if parameter_code == "power_topology" and parameter_value in SWITCH_TOPOLOGIES:
            return parameter_value

        if (
            parameter_value
            and (
                parameter_code in {"number_of_poles", "poles", "pole_count", "ef008618"}
                or "number of poles" in parameter_name
            )
        ):
            try:
                pole_count = max(1, int(parameter_value))
            except ValueError:
                pole_count = 1

    return {
        1: "L",
        2: "L+N",
        3: "3L",
        4: "3L+N",
    }.get(pole_count, "L")


def derive_interfaces(payload: EquipmentTypicalCreate) -> list[TypicalInterface]:
    interfaces: list[TypicalInterface] = []
    if payload.template_key == "multi_pole_switch_device":
        topology = resolve_switch_topology(payload)
        labels = SWITCH_TOPOLOGIES.get(topology, SWITCH_TOPOLOGIES["L"])
        for index, label in enumerate(labels):
            interfaces.append(
                TypicalInterface(
                    group_code="input_power",
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
                    group_code="output_power",
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
                    group_code="input_power",
                    code="AC_IN",
                    role="power_input",
                    logical_type="power",
                    direction="in",
                    source="derived",
                    sort_order=0,
                ),
                TypicalInterface(
                    group_code="input_power",
                    code="PE",
                    role="protective_earth",
                    logical_type="protective_earth",
                    direction="bidirectional",
                    source="derived",
                    sort_order=1,
                ),
                TypicalInterface(
                    group_code="output_power",
                    code="+24V_OUT",
                    role="positive_output",
                    logical_type="power",
                    direction="out",
                    source="derived",
                    sort_order=2,
                ),
                TypicalInterface(
                    group_code="output_power",
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


def build_interfaces(payload: EquipmentTypicalCreate) -> list[TypicalInterface]:
    disabled_codes = {code.strip().upper() for code in payload.disabled_interface_codes if code.strip()}
    derived_interfaces = derive_interfaces(payload)
    visible_derived = [
        interface for interface in derived_interfaces if interface.code.strip().upper() not in disabled_codes
    ]

    override_interfaces = [
        TypicalInterface(
            group_code=interface.group_code,
            code=interface.code,
            role=interface.role,
            logical_type=interface.logical_type,
            direction=interface.direction,
            source="override",
            sort_order=interface.sort_order,
        )
        for interface in payload.interfaces
        if interface.source == "override"
    ]

    all_interfaces = visible_derived + override_interfaces
    return sorted(all_interfaces, key=lambda interface: (interface.sort_order, interface.code))


def validate_typical_payload(payload: EquipmentTypicalCreate) -> TypicalValidationResult:
    issues: list[ValidationIssue] = []
    definitions = payload.parameter_definitions
    groups = build_interface_groups(payload)
    interfaces = build_interfaces(payload)

    if not payload.name.strip():
        issues.append(
            ValidationIssue(
                severity="error",
                code="missing_typical_name",
                message="Typical naam ontbreekt.",
            )
        )

    if not payload.code.strip():
        issues.append(
            ValidationIssue(
                severity="error",
                code="missing_typical_code",
                message="Typical code ontbreekt.",
            )
        )

    if not payload.etim_class_id.strip():
        issues.append(
            ValidationIssue(
                severity="error",
                code="missing_etim_class",
                message="ETIM-klasse ontbreekt.",
            )
        )

    driver_definitions = [definition for definition in definitions if definition.drives_interfaces]
    if len(driver_definitions) > 1:
        issues.append(
            ValidationIssue(
                severity="warning",
                code="multiple_interface_drivers",
                message="Meerdere parameterdefinities staan als interface-driver gemarkeerd.",
            )
        )

    seen_codes: set[str] = set()
    for definition in definitions:
        normalized_code = definition.code.strip().lower()
        allowed_values = [value.strip() for value in definition.allowed_values if value.strip()]
        default_value = (definition.default_value or "").strip()
        normalized_allowed_values = [value.casefold() for value in allowed_values]

        if not normalized_code:
            issues.append(
                ValidationIssue(
                    severity="error",
                    code="missing_parameter_code",
                    message="Parametercode ontbreekt.",
                    parameter_code=definition.code,
                    parameter_name=definition.name,
                )
            )
            continue

        if normalized_code in seen_codes:
            issues.append(
                ValidationIssue(
                    severity="error",
                    code="duplicate_parameter_code",
                    message=f"Parametercode '{definition.code}' komt meer dan eens voor.",
                    parameter_code=definition.code,
                    parameter_name=definition.name,
                )
            )
        seen_codes.add(normalized_code)

        if len(normalized_allowed_values) != len(set(normalized_allowed_values)):
            issues.append(
                ValidationIssue(
                    severity="error",
                    code="duplicate_allowed_values",
                    message="Allowed values bevat dubbele waarden.",
                    parameter_code=definition.code,
                    parameter_name=definition.name,
                )
            )

        if definition.input_type == "enum" and not allowed_values:
            issues.append(
                ValidationIssue(
                    severity="error",
                    code="enum_without_values",
                    message="Enum-parameter heeft geen allowed values.",
                    parameter_code=definition.code,
                    parameter_name=definition.name,
                )
            )

        if definition.input_type == "boolean":
            if allowed_values and set(normalized_allowed_values) != {"true", "false"}:
                issues.append(
                    ValidationIssue(
                        severity="error",
                        code="boolean_with_custom_values",
                        message="Boolean-parameter moet allowed values 'true, false' gebruiken.",
                        parameter_code=definition.code,
                        parameter_name=definition.name,
                    )
                )
            if default_value and default_value.casefold() not in {"true", "false"}:
                issues.append(
                    ValidationIssue(
                        severity="error",
                        code="boolean_default_not_boolean",
                        message="Boolean-parameter heeft een niet-booleaanse defaultwaarde.",
                        parameter_code=definition.code,
                        parameter_name=definition.name,
                    )
                )

        if definition.input_type == "managed_numeric":
            if default_value:
                try:
                    float(default_value.replace(",", "."))
                except ValueError:
                    issues.append(
                        ValidationIssue(
                            severity="error",
                            code="managed_numeric_default_not_numeric",
                            message=f"Defaultwaarde '{default_value}' is niet numeriek.",
                            parameter_code=definition.code,
                            parameter_name=definition.name,
                        )
                    )
            for value in allowed_values:
                try:
                    float(value.replace(",", "."))
                except ValueError:
                    issues.append(
                        ValidationIssue(
                            severity="error",
                            code="managed_numeric_allowed_value_not_numeric",
                            message=f"Allowed value '{value}' is niet numeriek.",
                            parameter_code=definition.code,
                            parameter_name=definition.name,
                        )
                    )

        if default_value and allowed_values and default_value not in allowed_values:
            issues.append(
                ValidationIssue(
                    severity="error",
                    code="default_not_in_allowed_values",
                    message=f"Defaultwaarde '{default_value}' zit niet in allowed values.",
                    parameter_code=definition.code,
                    parameter_name=definition.name,
                )
            )

        if definition.required and not default_value:
            issues.append(
                ValidationIssue(
                    severity="warning",
                    code="required_without_default",
                    message="Required parameter heeft geen defaultwaarde.",
                    parameter_code=definition.code,
                    parameter_name=definition.name,
                )
            )

        if definition.drives_interfaces and not default_value:
            issues.append(
                ValidationIssue(
                    severity="warning",
                    code="interface_driver_without_default",
                    message="Interface-driver heeft geen defaultwaarde; interface-afleiding is dan onzeker.",
                    parameter_code=definition.code,
                    parameter_name=definition.name,
                )
            )

        if definition.drives_interfaces and definition.input_type == "enum" and not allowed_values:
            issues.append(
                ValidationIssue(
                    severity="error",
                    code="interface_driver_without_allowed_values",
                    message="Enum interface-driver heeft geen allowed values.",
                    parameter_code=definition.code,
                    parameter_name=definition.name,
                )
            )

        if definition.code.strip().lower() == "power_topology":
            invalid_values = [value for value in allowed_values if value not in SWITCH_TOPOLOGIES]
            if invalid_values:
                issues.append(
                    ValidationIssue(
                        severity="error",
                        code="invalid_power_topology_allowed_value",
                        message=f"Power topology bevat ongeldige waarde(n): {', '.join(invalid_values)}.",
                        parameter_code=definition.code,
                        parameter_name=definition.name,
                    )
                )

            if default_value and default_value not in SWITCH_TOPOLOGIES:
                issues.append(
                    ValidationIssue(
                        severity="error",
                        code="invalid_power_topology_default",
                        message=f"Power topology default '{default_value}' is ongeldig.",
                        parameter_code=definition.code,
                        parameter_name=definition.name,
                    )
                )

    seen_group_codes: set[str] = set()
    for group in groups:
        normalized_group_code = group.code.strip().lower()
        if not normalized_group_code:
            issues.append(
                ValidationIssue(
                    severity="error",
                    code="missing_interface_group_code",
                    message="Interfacegroepcode ontbreekt.",
                )
            )
            continue

        if not group.name.strip():
            issues.append(
                ValidationIssue(
                    severity="error",
                    code="missing_interface_group_name",
                    message=f"Interfacegroep '{group.code or 'zonder code'}' heeft geen naam.",
                )
            )

        if not group.category.strip():
            issues.append(
                ValidationIssue(
                    severity="error",
                    code="missing_interface_group_category",
                    message=f"Interfacegroep '{group.code}' heeft geen categorie.",
                )
            )

        if normalized_group_code in seen_group_codes:
            issues.append(
                ValidationIssue(
                    severity="error",
                    code="duplicate_interface_group_code",
                    message=f"Interfacegroepcode '{group.code}' komt meer dan eens voor.",
                )
            )
        seen_group_codes.add(normalized_group_code)

    seen_interface_codes: set[str] = set()
    for interface in interfaces:
        normalized_code = interface.code.strip().lower()
        if not normalized_code:
            issues.append(
                ValidationIssue(
                    severity="error",
                    code="missing_interface_code",
                    message="Interfacecode ontbreekt.",
                )
            )
            continue

        if normalized_code in seen_interface_codes:
            issues.append(
                ValidationIssue(
                    severity="error",
                    code="duplicate_interface_code",
                    message=f"Interfacecode '{interface.code}' komt meer dan eens voor.",
                )
            )
        seen_interface_codes.add(normalized_code)

        if interface.group_code and interface.group_code.strip().lower() not in seen_group_codes:
            issues.append(
                ValidationIssue(
                    severity="error",
                    code="interface_group_missing",
                    message=f"Interface '{interface.code}' verwijst naar een onbekende interfacegroep.",
                )
            )

        if not interface.role.strip():
            issues.append(
                ValidationIssue(
                    severity="error",
                    code="missing_interface_role",
                    message=f"Interface '{interface.code}' heeft geen rol.",
                )
            )

        if interface.direction.strip() not in {"in", "out", "bidirectional"}:
            issues.append(
                ValidationIssue(
                    severity="error",
                    code="invalid_interface_direction",
                    message=f"Interface '{interface.code}' heeft een ongeldige richting.",
                )
            )

    return TypicalValidationResult(
        valid=not any(issue.severity == "error" for issue in issues),
        issues=issues,
    )


def _build_parameter_definitions(payload: EquipmentTypicalCreate) -> list[TypicalParameterDefinition]:
    definitions = payload.parameter_definitions
    if not definitions and payload.parameters:
        return [
            TypicalParameterDefinition(
                code=parameter.code,
                name=parameter.name,
                source=parameter.source,
                input_type=parameter.data_type,
                unit=parameter.unit,
                default_value=parameter.value,
                allowed_values=None,
                required=1 if parameter.required else 0,
                is_parametrizable=1 if parameter.is_parametrizable else 0,
                drives_interfaces=1 if parameter.drives_interfaces else 0,
                sort_order=parameter.sort_order,
            )
            for parameter in payload.parameters
        ]

    return [
        TypicalParameterDefinition(
            code=definition.code,
            name=definition.name,
            source=definition.source,
            input_type=definition.input_type,
            unit=definition.unit,
            default_value=definition.default_value,
            allowed_values=json.dumps(definition.allowed_values),
            required=1 if definition.required else 0,
            is_parametrizable=1 if definition.is_parametrizable else 0,
            drives_interfaces=1 if definition.drives_interfaces else 0,
            sort_order=definition.sort_order,
        )
        for definition in definitions
    ]


def _build_parameters(payload: EquipmentTypicalCreate) -> list[TypicalParameter]:
    if payload.parameter_definitions:
        return [
            TypicalParameter(
                code=definition.code,
                name=definition.name,
                source=definition.source,
                data_type=definition.input_type,
                unit=definition.unit,
                value=definition.default_value,
                required=1 if definition.required else 0,
                is_parametrizable=1 if definition.is_parametrizable else 0,
                drives_interfaces=1 if definition.drives_interfaces else 0,
                sort_order=definition.sort_order,
            )
            for definition in payload.parameter_definitions
        ]

    return [
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


def _normalize_interface_groups(typical: EquipmentTypical) -> EquipmentTypical:
    typical.interface_groups = sorted(typical.interface_groups, key=lambda item: (item.sort_order, item.code))
    typical.interfaces = sorted(typical.interfaces, key=lambda item: (item.sort_order, item.code))
    return typical


def _normalize_allowed_values(typical: EquipmentTypical) -> EquipmentTypical:
    for definition in typical.parameter_definitions:
        raw_value = definition.allowed_values
        if raw_value:
            try:
                definition.allowed_values = json.dumps(json.loads(raw_value))
            except json.JSONDecodeError:
                definition.allowed_values = json.dumps(
                    [item.strip() for item in raw_value.split(",") if item.strip()]
                )
        else:
            definition.allowed_values = json.dumps([])
    return _normalize_interface_groups(typical)


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

    typical.parameter_definitions = _build_parameter_definitions(payload)
    typical.parameters = _build_parameters(payload)
    typical.interface_groups = build_interface_groups(payload)
    typical.interfaces = build_interfaces(payload)

    db.add(typical)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ValueError(
            f"Typical code '{payload.code}' bestaat al. Kies een unieke code."
        ) from exc

    db.refresh(typical)
    result = get_typical(db, typical.id)
    if result is None:
        raise ValueError("Typical kon niet opnieuw geladen worden.")
    return _normalize_allowed_values(result)


def update_typical(db: Session, typical_id: str, payload: EquipmentTypicalUpdate) -> EquipmentTypical | None:
    typical = db.get(EquipmentTypical, typical_id)
    if typical is None:
        return None

    etim_class = get_class_detail(payload.etim_class_id)
    if etim_class is None:
        raise ValueError(f"Unknown ETIM class: {payload.etim_class_id}")

    typical.name = payload.name
    typical.code = payload.code
    typical.description = payload.description
    typical.etim_class_id = payload.etim_class_id
    typical.etim_class_description = etim_class.description
    typical.template_key = payload.template_key

    typical.parameter_definitions.clear()
    typical.parameter_definitions.extend(_build_parameter_definitions(payload))

    typical.parameters.clear()
    typical.parameters.extend(_build_parameters(payload))

    typical.interface_groups.clear()
    typical.interface_groups.extend(build_interface_groups(payload))

    typical.interfaces.clear()
    typical.interfaces.extend(build_interfaces(payload))

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ValueError(
            f"Typical code '{payload.code}' bestaat al. Kies een unieke code."
        ) from exc

    db.refresh(typical)
    result = get_typical(db, typical.id)
    return _normalize_allowed_values(result) if result is not None else None


def list_typicals(db: Session) -> list[EquipmentTypical]:
    stmt = (
        select(EquipmentTypical)
        .options(
            selectinload(EquipmentTypical.parameter_definitions),
            selectinload(EquipmentTypical.parameters),
            selectinload(EquipmentTypical.interface_groups),
            selectinload(EquipmentTypical.interfaces),
        )
        .order_by(EquipmentTypical.updated_at.desc())
    )
    return [_normalize_allowed_values(item) for item in db.scalars(stmt)]


def get_typical(db: Session, typical_id: str) -> EquipmentTypical | None:
    stmt = (
        select(EquipmentTypical)
        .where(EquipmentTypical.id == typical_id)
        .options(
            selectinload(EquipmentTypical.parameter_definitions),
            selectinload(EquipmentTypical.parameters),
            selectinload(EquipmentTypical.interface_groups),
            selectinload(EquipmentTypical.interfaces),
        )
    )
    result = db.scalars(stmt).first()
    return _normalize_allowed_values(result) if result is not None else None


def delete_typical(db: Session, typical_id: str) -> bool:
    typical = db.get(EquipmentTypical, typical_id)
    if typical is None:
        return False

    db.delete(typical)
    db.commit()
    return True
