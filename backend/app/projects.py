import json

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models import EquipmentTypical
from app.project_models import (
    InstanceInterface,
    InstanceInterfaceGroup,
    InstanceInterfaceMappingRuleSnapshot,
    InstanceParameterDefinitionSnapshot,
    InstanceParameterSelection,
    Project,
    ProjectEquipmentInstance,
)
from app.project_schemas import InstanceCreate, InstanceUpdate, ProjectCreate, ProjectUpdate
from app.project_schemas import InstanceValidationIssue, InstanceValidationResult


def _instance_query():
    return (
        select(ProjectEquipmentInstance)
        .options(
            selectinload(ProjectEquipmentInstance.parameter_definition_snapshots),
            selectinload(ProjectEquipmentInstance.parameter_selections),
            selectinload(ProjectEquipmentInstance.interface_groups),
            selectinload(ProjectEquipmentInstance.interface_mapping_rule_snapshots),
            selectinload(ProjectEquipmentInstance.interfaces),
        )
    )


def _normalize_instance(instance: ProjectEquipmentInstance) -> ProjectEquipmentInstance:
    instance.parameter_definition_snapshots = sorted(
        instance.parameter_definition_snapshots, key=lambda item: (item.sort_order, item.parameter_code)
    )
    instance.parameter_selections = sorted(
        instance.parameter_selections, key=lambda item: (item.sort_order, item.parameter_code)
    )
    instance.interface_groups = sorted(instance.interface_groups, key=lambda item: (item.sort_order, item.code))
    instance.interface_mapping_rule_snapshots = sorted(
        instance.interface_mapping_rule_snapshots,
        key=lambda item: (item.driver_parameter_code, item.driver_value, item.sort_order, item.interface_code),
    )
    instance.interfaces = sorted(instance.interfaces, key=lambda item: (item.sort_order, item.code))
    for definition in instance.parameter_definition_snapshots:
        raw_value = definition.allowed_values_json
        if raw_value:
            try:
                definition.allowed_values_json = json.dumps(json.loads(raw_value))
            except json.JSONDecodeError:
                definition.allowed_values_json = json.dumps(
                    [item.strip() for item in raw_value.split(",") if item.strip()]
                )
        else:
            definition.allowed_values_json = json.dumps([])
    return instance


def _derive_instance_interfaces(
    selections: list[InstanceParameterSelection],
    rules: list[InstanceInterfaceMappingRuleSnapshot],
) -> list[InstanceInterface]:
    selected_values = {
        selection.parameter_code.strip().lower(): (selection.selected_value or "").strip()
        for selection in selections
    }
    interfaces: list[InstanceInterface] = []
    for rule in rules:
        if selected_values.get(rule.driver_parameter_code.strip().lower(), "") == rule.driver_value:
            interfaces.append(
                InstanceInterface(
                    group_code=rule.group_code,
                    code=rule.interface_code,
                    role=rule.role,
                    logical_type=rule.logical_type,
                    direction=rule.direction,
                    source="derived",
                    sort_order=rule.sort_order,
                )
            )
    return sorted(interfaces, key=lambda item: (item.sort_order, item.code))


def validate_project_instance(instance: ProjectEquipmentInstance) -> InstanceValidationResult:
    issues: list[InstanceValidationIssue] = []
    definition_by_code = {
        definition.parameter_code.strip().lower(): definition
        for definition in instance.parameter_definition_snapshots
    }
    selection_by_code = {
        selection.parameter_code.strip().lower(): selection
        for selection in instance.parameter_selections
    }

    for definition in instance.parameter_definition_snapshots:
        allowed_values: list[str] = []
        if definition.allowed_values_json:
            try:
                allowed_values = json.loads(definition.allowed_values_json)
            except json.JSONDecodeError:
                allowed_values = []
        current_value = (
            selection_by_code.get(definition.parameter_code.strip().lower(), None).selected_value
            if selection_by_code.get(definition.parameter_code.strip().lower(), None) is not None
            else None
        )
        if definition.required and not (current_value or "").strip():
            issues.append(
                InstanceValidationIssue(
                    severity="error",
                    code="required_parameter_missing",
                    message=f"Verplichte parameter '{definition.parameter_name}' heeft geen waarde.",
                    parameter_code=definition.parameter_code,
                    parameter_name=definition.parameter_name,
                )
            )
        if current_value and allowed_values and current_value not in allowed_values:
            issues.append(
                InstanceValidationIssue(
                    severity="error",
                    code="selected_value_not_allowed",
                    message=f"Waarde '{current_value}' is niet toegelaten voor '{definition.parameter_name}'.",
                    parameter_code=definition.parameter_code,
                    parameter_name=definition.parameter_name,
                )
            )

    driver_codes = {
        rule.driver_parameter_code.strip().lower()
        for rule in instance.interface_mapping_rule_snapshots
        if rule.driver_parameter_code.strip()
    }
    for driver_code in driver_codes:
        definition = definition_by_code.get(driver_code)
        selection = selection_by_code.get(driver_code)
        if definition is None:
            issues.append(
                InstanceValidationIssue(
                    severity="error",
                    code="mapping_driver_missing_in_instance",
                    message=f"Driver '{driver_code}' ontbreekt in de instance-parameterdefinities.",
                    parameter_code=driver_code,
                    parameter_name=driver_code,
                )
            )
            continue
        if not selection or not (selection.selected_value or "").strip():
            issues.append(
                InstanceValidationIssue(
                    severity="warning",
                    code="mapping_driver_without_selection",
                    message=f"Driver '{definition.parameter_name}' heeft geen geselecteerde waarde.",
                    parameter_code=definition.parameter_code,
                    parameter_name=definition.parameter_name,
                )
            )

    derived_interfaces = _derive_instance_interfaces(
        instance.parameter_selections, instance.interface_mapping_rule_snapshots
    )
    if not derived_interfaces:
        issues.append(
            InstanceValidationIssue(
                severity="warning",
                code="no_derived_interfaces",
                message="De huidige parameterselecties leveren geen afgeleide interfaces op.",
            )
        )

    return InstanceValidationResult(
        valid=not any(issue.severity == "error" for issue in issues),
        issues=issues,
    )


def list_projects(db: Session) -> list[dict]:
    stmt = (
        select(Project, func.count(ProjectEquipmentInstance.id))
        .outerjoin(ProjectEquipmentInstance, ProjectEquipmentInstance.project_id == Project.id)
        .group_by(Project.id)
        .order_by(Project.updated_at.desc())
    )
    rows = db.execute(stmt).all()
    return [
        {
            "id": project.id,
            "name": project.name,
            "code": project.code,
            "description": project.description,
            "status": project.status,
            "created_at": project.created_at,
            "updated_at": project.updated_at,
            "instance_count": instance_count,
        }
        for project, instance_count in rows
    ]


def create_project(db: Session, payload: ProjectCreate) -> Project:
    project = Project(
        name=payload.name,
        code=payload.code,
        description=payload.description,
        status=payload.status,
    )
    db.add(project)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ValueError(f"Project code '{payload.code}' bestaat al.") from exc
    db.refresh(project)
    return project


def get_project(db: Session, project_id: str) -> Project | None:
    return db.get(Project, project_id)


def update_project(db: Session, project_id: str, payload: ProjectUpdate) -> Project | None:
    project = db.get(Project, project_id)
    if project is None:
        return None
    project.name = payload.name
    project.code = payload.code
    project.description = payload.description
    project.status = payload.status
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ValueError(f"Project code '{payload.code}' bestaat al.") from exc
    db.refresh(project)
    return project


def delete_project(db: Session, project_id: str) -> bool:
    project = db.get(Project, project_id)
    if project is None:
        return False
    db.delete(project)
    db.commit()
    return True


def list_project_instances(db: Session, project_id: str) -> list[ProjectEquipmentInstance]:
    stmt = _instance_query().where(ProjectEquipmentInstance.project_id == project_id).order_by(
        ProjectEquipmentInstance.updated_at.desc()
    )
    return [_normalize_instance(item) for item in db.scalars(stmt)]


def _released_typical_or_error(db: Session, typical_id: str) -> EquipmentTypical:
    stmt = (
        select(EquipmentTypical)
        .options(
            selectinload(EquipmentTypical.parameter_definitions),
            selectinload(EquipmentTypical.parameters),
            selectinload(EquipmentTypical.interface_groups),
            selectinload(EquipmentTypical.interface_mapping_rules),
            selectinload(EquipmentTypical.interfaces),
        )
        .where(EquipmentTypical.id == typical_id)
    )
    typical = db.scalars(stmt).first()
    if typical is None:
        raise ValueError("Released typical niet gevonden.")
    if typical.status != "released":
        raise ValueError("Alleen released typicals kunnen in een project geïnstantieerd worden.")
    return typical


def _snapshot_definitions_and_selections(typical: EquipmentTypical) -> tuple[
    list[InstanceParameterDefinitionSnapshot], list[InstanceParameterSelection]
]:
    definitions_by_code = {
        definition.code.strip().lower(): definition for definition in typical.parameter_definitions
    }
    parameters_by_code = {parameter.code.strip().lower(): parameter for parameter in typical.parameters}
    required_driver_codes = {
        rule.driver_parameter_code.strip().lower()
        for rule in typical.interface_mapping_rules
        if rule.driver_parameter_code.strip()
    }
    driver_values_by_code: dict[str, list[str]] = {}
    for rule in typical.interface_mapping_rules:
        normalized_code = rule.driver_parameter_code.strip().lower()
        if not normalized_code:
            continue
        driver_values_by_code.setdefault(normalized_code, [])
        if rule.driver_value not in driver_values_by_code[normalized_code]:
            driver_values_by_code[normalized_code].append(rule.driver_value)

    snapshots: list[InstanceParameterDefinitionSnapshot] = []
    selections: list[InstanceParameterSelection] = []

    for definition in typical.parameter_definitions:
        snapshots.append(
            InstanceParameterDefinitionSnapshot(
                parameter_code=definition.code,
                parameter_name=definition.name,
                source=definition.source,
                input_type=definition.input_type,
                unit=definition.unit,
                allowed_values_json=definition.allowed_values,
                default_value=definition.default_value,
                required=definition.required,
                is_parametrizable=definition.is_parametrizable,
                drives_interfaces=definition.drives_interfaces,
                sort_order=definition.sort_order,
            )
        )
        selections.append(
            InstanceParameterSelection(
                parameter_code=definition.code,
                parameter_name=definition.name,
                source=definition.source,
                input_type=definition.input_type,
                unit=definition.unit,
                selected_value=definition.default_value,
                sort_order=definition.sort_order,
            )
        )

    next_sort_order = max((definition.sort_order for definition in typical.parameter_definitions), default=0) + 1
    for driver_code in required_driver_codes:
        if driver_code in definitions_by_code:
            continue
        fallback = parameters_by_code.get(driver_code)
        if fallback is not None:
            parameter_code = fallback.code
            parameter_name = fallback.name
            source = fallback.source
            input_type = fallback.data_type
            unit = fallback.unit
            default_value = fallback.value
            required = fallback.required
            is_parametrizable = fallback.is_parametrizable
            allowed_values_json = json.dumps([])
        else:
            allowed_values = driver_values_by_code.get(driver_code, [])
            parameter_code = driver_code
            parameter_name = driver_code
            source = "instance_derived"
            input_type = "enum" if allowed_values else "managed_value"
            unit = None
            default_value = allowed_values[0] if allowed_values else None
            required = 0
            is_parametrizable = 1
            allowed_values_json = json.dumps(allowed_values)

        snapshots.append(
            InstanceParameterDefinitionSnapshot(
                parameter_code=parameter_code,
                parameter_name=parameter_name,
                source=source,
                input_type=input_type,
                unit=unit,
                allowed_values_json=allowed_values_json,
                default_value=default_value,
                required=required,
                is_parametrizable=is_parametrizable,
                drives_interfaces=1,
                sort_order=next_sort_order,
            )
        )
        selections.append(
            InstanceParameterSelection(
                parameter_code=parameter_code,
                parameter_name=parameter_name,
                source=source,
                input_type=input_type,
                unit=unit,
                selected_value=default_value,
                sort_order=next_sort_order,
            )
        )
        next_sort_order += 1

    return snapshots, selections


def create_project_instance(db: Session, project_id: str, payload: InstanceCreate) -> ProjectEquipmentInstance:
    project = db.get(Project, project_id)
    if project is None:
        raise ValueError("Project niet gevonden.")
    typical = _released_typical_or_error(db, payload.released_typical_id)

    instance = ProjectEquipmentInstance(
        project_id=project_id,
        name=payload.name,
        tag=payload.tag,
        description=payload.description,
        typical_id=typical.id,
        typical_lineage_id=typical.lineage_id,
        typical_version=typical.version,
        typical_code=typical.code,
        typical_name=typical.name,
        etim_class_id=typical.etim_class_id,
        status="active",
    )

    definition_snapshots, parameter_selections = _snapshot_definitions_and_selections(typical)
    instance.parameter_definition_snapshots = definition_snapshots
    instance.parameter_selections = parameter_selections
    instance.interface_groups = [
        InstanceInterfaceGroup(
            code=group.code,
            name=group.name,
            category=group.category,
            side=group.side,
            sort_order=group.sort_order,
        )
        for group in typical.interface_groups
    ]
    instance.interface_mapping_rule_snapshots = [
        InstanceInterfaceMappingRuleSnapshot(
            driver_parameter_code=rule.driver_parameter_code,
            driver_value=rule.driver_value,
            group_code=rule.group_code,
            interface_code=rule.interface_code,
            role=rule.role,
            logical_type=rule.logical_type,
            direction=rule.direction,
            sort_order=rule.sort_order,
        )
        for rule in typical.interface_mapping_rules
    ]
    instance.interfaces = _derive_instance_interfaces(
        instance.parameter_selections, instance.interface_mapping_rule_snapshots
    )

    db.add(instance)
    db.commit()
    db.refresh(instance)
    result = get_project_instance(db, instance.id)
    if result is None:
        raise ValueError("Instance kon niet opnieuw geladen worden.")
    return result


def get_project_instance(db: Session, instance_id: str) -> ProjectEquipmentInstance | None:
    stmt = _instance_query().where(ProjectEquipmentInstance.id == instance_id)
    result = db.scalars(stmt).first()
    return _normalize_instance(result) if result is not None else None


def update_project_instance(
    db: Session, instance_id: str, payload: InstanceUpdate
) -> ProjectEquipmentInstance | None:
    instance = db.get(ProjectEquipmentInstance, instance_id)
    if instance is None:
        return None

    instance.name = payload.name
    instance.tag = payload.tag
    instance.description = payload.description

    snapshot_stmt = _instance_query().where(ProjectEquipmentInstance.id == instance_id)
    hydrated = db.scalars(snapshot_stmt).first()
    if hydrated is None:
        return None

    selection_by_code = {
        selection.parameter_code.strip().lower(): selection for selection in hydrated.parameter_selections
    }
    definition_by_code = {
        definition.parameter_code.strip().lower(): definition
        for definition in hydrated.parameter_definition_snapshots
    }
    for incoming in payload.parameter_selections:
        normalized_code = incoming.parameter_code.strip().lower()
        selection = selection_by_code.get(normalized_code)
        definition = definition_by_code.get(normalized_code)
        if selection is None or definition is None:
            continue
        normalized_value = incoming.selected_value
        if normalized_value in {None, "", "None"}:
            normalized_value = None
        allowed_values = []
        if definition.allowed_values_json:
            try:
                allowed_values = json.loads(definition.allowed_values_json)
            except json.JSONDecodeError:
                allowed_values = []
        if normalized_value is not None and allowed_values and normalized_value not in allowed_values:
            raise ValueError(
                f"Waarde '{normalized_value}' is niet toegelaten voor parameter '{definition.parameter_name}'."
            )
        selection.selected_value = normalized_value

    hydrated.interfaces.clear()
    hydrated.interfaces.extend(
        _derive_instance_interfaces(hydrated.parameter_selections, hydrated.interface_mapping_rule_snapshots)
    )

    db.commit()
    db.refresh(instance)
    result = get_project_instance(db, instance.id)
    return result


def delete_project_instance(db: Session, instance_id: str) -> bool:
    instance = db.get(ProjectEquipmentInstance, instance_id)
    if instance is None:
        return False
    db.delete(instance)
    db.commit()
    return True
