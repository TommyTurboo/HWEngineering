import json

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.etim_repository import get_class_detail
from app.models import (
    EquipmentTypical,
    TypicalInterface,
    TypicalInterfaceGroup,
    TypicalInterfaceMappingRule,
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
            bundle_id=group.bundle_id,
            sort_order=group.sort_order,
        )
        for group in groups
    ]


def default_interface_mapping_rules(payload: EquipmentTypicalCreate) -> list[TypicalInterfaceMappingRule]:
    if payload.template_key == "multi_pole_switch_device":
        rules: list[TypicalInterfaceMappingRule] = []
        for driver_value, labels in SWITCH_TOPOLOGIES.items():
            for index, label in enumerate(labels):
                rules.append(
                    TypicalInterfaceMappingRule(
                        driver_parameter_code="power_topology",
                        driver_value=driver_value,
                        group_code="input_power",
                        interface_code=f"{label}_IN",
                        role="line_in",
                        logical_type="power",
                        direction="in",
                        source="rule",
                        sort_order=index * 2,
                    )
                )
                rules.append(
                    TypicalInterfaceMappingRule(
                        driver_parameter_code="power_topology",
                        driver_value=driver_value,
                        group_code="output_power",
                        interface_code=f"{label}_OUT",
                        role="load_out",
                        logical_type="power",
                        direction="out",
                        source="rule",
                        sort_order=index * 2 + 1,
                    )
                )
        return rules

    return []


def build_interface_mapping_rules(payload: EquipmentTypicalCreate) -> list[TypicalInterfaceMappingRule]:
    rules = payload.interface_mapping_rules or default_interface_mapping_rules(payload)
    return [
        TypicalInterfaceMappingRule(
            driver_parameter_code=rule.driver_parameter_code,
            driver_value=rule.driver_value,
            group_code=rule.group_code,
            interface_code=rule.interface_code,
            role=rule.role,
            logical_type=rule.logical_type,
            direction=rule.direction,
            source=rule.source,
            bundle_id=rule.bundle_id,
            sort_order=rule.sort_order,
        )
        for rule in rules
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
    mapping_rules = build_interface_mapping_rules(payload)
    if mapping_rules:
        parameter_values = {
            parameter.code.strip().lower(): (
                getattr(parameter, "default_value", None) or getattr(parameter, "value", None) or ""
            ).strip()
            for parameter in _source_parameters(payload)
        }
        resolved_interfaces: list[TypicalInterface] = []
        for rule in mapping_rules:
            current_value = parameter_values.get(rule.driver_parameter_code.strip().lower(), "")
            if current_value == rule.driver_value:
                resolved_interfaces.append(
                    TypicalInterface(
                        group_code=rule.group_code,
                        code=rule.interface_code,
                        role=rule.role,
                        logical_type=rule.logical_type,
                        direction=rule.direction,
                        source="derived",
                        sort_order=rule.sort_order,
                    )
                )
        if resolved_interfaces:
            return resolved_interfaces

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
    mapping_rules = build_interface_mapping_rules(payload)
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

    seen_mapping_keys: set[tuple[str, str, str]] = set()
    for rule in mapping_rules:
        driver_code = rule.driver_parameter_code.strip().lower()
        driver_value = rule.driver_value.strip()
        interface_code = rule.interface_code.strip().lower()

        if not driver_code:
            issues.append(
                ValidationIssue(
                    severity="error",
                    code="missing_mapping_driver_parameter",
                    message="Een interfacemapping heeft geen driver parameter.",
                )
            )
        if not driver_value:
            issues.append(
                ValidationIssue(
                    severity="error",
                    code="missing_mapping_driver_value",
                    message="Een interfacemapping heeft geen driver value.",
                )
            )
        if not interface_code:
            issues.append(
                ValidationIssue(
                    severity="error",
                    code="missing_mapping_interface_code",
                    message="Een interfacemapping heeft geen interface code.",
                )
            )
            continue

        mapping_key = (driver_code, driver_value.casefold(), interface_code)
        if mapping_key in seen_mapping_keys:
            issues.append(
                ValidationIssue(
                    severity="error",
                    code="duplicate_interface_mapping_rule",
                    message=f"Dubbele interfacemapping voor '{rule.interface_code}'.",
                )
            )
        seen_mapping_keys.add(mapping_key)

        if rule.group_code and rule.group_code.strip().lower() not in seen_group_codes:
            issues.append(
                ValidationIssue(
                    severity="error",
                    code="mapping_group_missing",
                    message=f"Mapping voor '{rule.interface_code}' verwijst naar een onbekende interfacegroep.",
                )
            )

        if driver_code not in seen_codes:
            issues.append(
                ValidationIssue(
                    severity="warning",
                    code="mapping_driver_parameter_missing",
                    message=f"Mapping gebruikt driver parameter '{rule.driver_parameter_code}' die niet in de parameterdefinities staat.",
                )
            )

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
                bundle_id=None,
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
            bundle_id=definition.bundle_id,
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


def _build_interface_mapping_rules(payload: EquipmentTypicalCreate) -> list[TypicalInterfaceMappingRule]:
    return build_interface_mapping_rules(payload)


def _normalize_interface_groups(typical: EquipmentTypical) -> EquipmentTypical:
    typical.interface_groups = sorted(typical.interface_groups, key=lambda item: (item.sort_order, item.code))
    typical.interface_mapping_rules = sorted(
        typical.interface_mapping_rules,
        key=lambda item: (item.driver_parameter_code, item.driver_value, item.sort_order, item.interface_code),
    )
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


def _to_payload(typical: EquipmentTypical) -> EquipmentTypicalCreate:
    return EquipmentTypicalCreate(
        name=typical.name,
        code=typical.code,
        description=typical.description,
        etim_class_id=typical.etim_class_id,
        template_key=typical.template_key,
        parameter_definitions=[
            {
                "code": definition.code,
                "name": definition.name,
                "source": definition.source,
                "input_type": definition.input_type,
                "unit": definition.unit,
                "default_value": definition.default_value,
                "allowed_values": json.loads(definition.allowed_values) if definition.allowed_values else [],
                "required": bool(definition.required),
                "is_parametrizable": bool(definition.is_parametrizable),
                "drives_interfaces": bool(definition.drives_interfaces),
                "bundle_id": definition.bundle_id,
                "sort_order": definition.sort_order,
            }
            for definition in typical.parameter_definitions
        ],
        interface_groups=[
            {
                "code": group.code,
                "name": group.name,
                "category": group.category,
                "side": group.side,
                "source": group.source,
                "bundle_id": group.bundle_id,
                "sort_order": group.sort_order,
            }
            for group in typical.interface_groups
        ],
        interface_mapping_rules=[
            {
                "driver_parameter_code": rule.driver_parameter_code,
                "driver_value": rule.driver_value,
                "group_code": rule.group_code,
                "interface_code": rule.interface_code,
                "role": rule.role,
                "logical_type": rule.logical_type,
                "direction": rule.direction,
                "source": rule.source,
                "bundle_id": rule.bundle_id,
                "sort_order": rule.sort_order,
            }
            for rule in typical.interface_mapping_rules
        ],
        interfaces=[
            {
                "group_code": interface.group_code,
                "code": interface.code,
                "role": interface.role,
                "logical_type": interface.logical_type,
                "direction": interface.direction,
                "source": interface.source,
                "sort_order": interface.sort_order,
            }
            for interface in typical.interfaces
        ],
        disabled_interface_codes=[],
        parameters=[],
    )


def _next_version_code(base_code: str, version: int) -> str:
    return f"{base_code}-draft-v{version}"


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
    typical.interface_mapping_rules = _build_interface_mapping_rules(payload)
    typical.interfaces = build_interfaces(payload)

    db.add(typical)
    try:
        db.flush()
        typical.lineage_id = typical.id
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
    if typical.status == "released":
        raise ValueError("Released typicals zijn readonly. Maak eerst een nieuwe draft.")

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

    typical.interface_mapping_rules.clear()
    typical.interface_mapping_rules.extend(_build_interface_mapping_rules(payload))

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
            selectinload(EquipmentTypical.interface_mapping_rules),
            selectinload(EquipmentTypical.interfaces),
        )
        .order_by(EquipmentTypical.updated_at.desc())
    )
    return [_normalize_allowed_values(item) for item in db.scalars(stmt)]


def list_typical_versions(db: Session, typical_id: str) -> list[EquipmentTypical]:
    typical = db.get(EquipmentTypical, typical_id)
    if typical is None:
        return []
    lineage_id = typical.lineage_id or typical.id
    stmt = (
        select(EquipmentTypical)
        .options(
            selectinload(EquipmentTypical.parameter_definitions),
            selectinload(EquipmentTypical.parameters),
            selectinload(EquipmentTypical.interface_groups),
            selectinload(EquipmentTypical.interface_mapping_rules),
            selectinload(EquipmentTypical.interfaces),
        )
        .where(EquipmentTypical.lineage_id == lineage_id)
        .order_by(EquipmentTypical.version.desc(), EquipmentTypical.updated_at.desc())
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
            selectinload(EquipmentTypical.interface_mapping_rules),
            selectinload(EquipmentTypical.interfaces),
        )
    )
    result = db.scalars(stmt).first()
    return _normalize_allowed_values(result) if result is not None else None


def delete_typical(db: Session, typical_id: str) -> bool:
    typical = db.get(EquipmentTypical, typical_id)
    if typical is None:
        return False
    if typical.status == "released":
        raise ValueError("Released typicals kunnen niet verwijderd worden.")

    db.delete(typical)
    db.commit()
    return True


def release_typical(db: Session, typical_id: str) -> EquipmentTypical | None:
    typical = get_typical(db, typical_id)
    if typical is None:
        return None
    if typical.status == "released":
        return typical

    validation = validate_typical_payload(_to_payload(typical))
    if not validation.valid:
        raise ValueError("Typical kan niet gereleased worden zolang er validatiefouten zijn.")

    db_typical = db.get(EquipmentTypical, typical_id)
    if db_typical is None:
        return None
    db_typical.status = "released"
    db.commit()
    db.refresh(db_typical)
    result = get_typical(db, db_typical.id)
    return _normalize_allowed_values(result) if result is not None else None


def create_draft_from_released(db: Session, typical_id: str) -> EquipmentTypical | None:
    typical = get_typical(db, typical_id)
    if typical is None:
        return None
    if typical.status != "released":
        raise ValueError("Alleen vanuit een released typical kan een nieuwe draft gemaakt worden.")

    next_version = typical.version + 1
    base_code = typical.code.split("-draft-v")[0]
    next_code = _next_version_code(base_code, next_version)
    suffix = 2
    while db.scalar(select(EquipmentTypical.id).where(EquipmentTypical.code == next_code)):
        next_code = f"{_next_version_code(base_code, next_version)}-{suffix}"
        suffix += 1

    clone_payload = _to_payload(typical)
    clone_payload.code = next_code
    clone = EquipmentTypical(
        name=typical.name,
        code=clone_payload.code,
        description=typical.description,
        etim_class_id=typical.etim_class_id,
        etim_class_description=typical.etim_class_description,
        template_key=typical.template_key,
        lineage_id=typical.lineage_id or typical.id,
        released_from_id=typical.id,
        status="draft",
        version=next_version,
    )
    clone.parameter_definitions = _build_parameter_definitions(clone_payload)
    clone.parameters = _build_parameters(clone_payload)
    clone.interface_groups = build_interface_groups(clone_payload)
    clone.interface_mapping_rules = _build_interface_mapping_rules(clone_payload)
    clone.interfaces = build_interfaces(clone_payload)

    db.add(clone)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ValueError("Nieuwe draft kon niet aangemaakt worden.") from exc

    db.refresh(clone)
    result = get_typical(db, clone.id)
    return _normalize_allowed_values(result) if result is not None else None
