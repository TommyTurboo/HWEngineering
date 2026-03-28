import { FormEvent, useEffect, useMemo, useState } from "react";
import { DataGrid, GridColDef, GridRenderCellParams } from "@mui/x-data-grid";

type HealthResponse = {
  status: string;
  environment: string;
};

type EtimClassSummary = {
  id: string;
  description: string;
  version: string | null;
  group_id: string | null;
};

type EtimFeatureOption = {
  value_id: string;
  value_description: string | null;
  sort_order: number | null;
};

type EtimFeatureDetail = {
  art_class_feature_nr: string;
  feature_id: string;
  feature_description: string | null;
  feature_group_id: string | null;
  feature_group_description: string | null;
  feature_type: string | null;
  unit_id: string | null;
  unit_description: string | null;
  sort_order: number | null;
  values: EtimFeatureOption[];
};

type EtimClassDetail = EtimClassSummary & {
  features: EtimFeatureDetail[];
};

type GovernedParameterDefinition = {
  feature_key: string;
  bundle_id: string | null;
  code: string;
  name: string;
  source: string;
  input_type: string;
  unit: string | null;
  default_value: string;
  allowed_values: string[];
  allowed_values_text: string;
  required: boolean;
  is_parametrizable: boolean;
  drives_interfaces: boolean;
  sort_order: number;
};

type EditableInterface = {
  local_key: string;
  group_code: string | null;
  code: string;
  role: string;
  logical_type: string;
  direction: string;
  source: "derived" | "override";
  sort_order: number;
};

type EditableInterfaceGroup = {
  local_key: string;
  bundle_id: string | null;
  code: string;
  name: string;
  category: string;
  side: string;
  source: "profile" | "custom";
  sort_order: number;
};

type EditableInterfaceMappingRule = {
  local_key: string;
  bundle_id: string | null;
  driver_parameter_code: string;
  driver_value: string;
  group_code: string | null;
  interface_code: string;
  role: string;
  logical_type: string;
  direction: string;
  source: "rule";
  sort_order: number;
};

type EquipmentTypical = {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  etim_class_id: string;
  etim_class_description: string;
  template_key?: string | null;
  lineage_id?: string | null;
  released_from_id?: string | null;
  status: string;
  version: number;
};

type EquipmentTypicalDetail = EquipmentTypical & {
  parameter_definitions: {
    id: string;
    bundle_id?: string | null;
    code: string;
    name: string;
    source: string;
    input_type: string;
    unit: string | null;
    default_value: string | null;
    allowed_values: string[];
    required: number;
    is_parametrizable: number;
    drives_interfaces: number;
    sort_order: number;
  }[];
  parameters: {
    id: string;
    code: string;
    name: string;
    source: string;
    data_type: string;
    unit: string | null;
    value: string | null;
    required: number;
    is_parametrizable: number;
    drives_interfaces: number;
    sort_order: number;
  }[];
  interfaces: {
    id: string;
    group_code: string | null;
    code: string;
    role: string;
    logical_type: string;
    direction: string;
    source: string;
    sort_order: number;
  }[];
  interface_groups: {
    id: string;
    bundle_id?: string | null;
    code: string;
    name: string;
    category: string;
    side: string | null;
    source: string;
    sort_order: number;
  }[];
  interface_mapping_rules: {
    id: string;
    bundle_id?: string | null;
    driver_parameter_code: string;
    driver_value: string;
    group_code: string | null;
    interface_code: string;
    role: string;
    logical_type: string;
    direction: string;
    source: string;
    sort_order: number;
  }[];
};

type ParameterDefinitionPreset = {
  id: string;
  preset_name: string;
  description?: string | null;
  code: string;
  name: string;
  source: string;
  input_type: string;
  unit: string | null;
  default_value: string | null;
  allowed_values: string[];
  required: number;
  is_parametrizable: number;
  drives_interfaces: number;
  sort_order: number;
  interface_groups: {
    code: string;
    name: string;
    category: string;
    side: string | null;
    source: string;
    sort_order: number;
  }[];
  interface_mapping_rules: {
    driver_parameter_code: string;
    driver_value: string;
    group_code: string | null;
    interface_code: string;
    role: string;
    logical_type: string;
    direction: string;
    source: string;
    sort_order: number;
  }[];
};

type ValidationIssue = {
  severity: string;
  code: string;
  message: string;
  parameter_code?: string | null;
  parameter_name?: string | null;
};

type TypicalValidationResult = {
  valid: boolean;
  issues: ValidationIssue[];
};

type EditablePreset = {
  id: string;
  preset_name: string;
  description: string;
  code: string;
  name: string;
  source: string;
  input_type: string;
  unit: string | null;
  default_value: string;
  allowed_values: string[];
  allowed_values_text: string;
  required: boolean;
  is_parametrizable: boolean;
  drives_interfaces: boolean;
  sort_order: number;
  interface_groups: ParameterDefinitionPreset["interface_groups"];
  interface_mapping_rules: ParameterDefinitionPreset["interface_mapping_rules"];
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
const SWITCH_TOPOLOGIES = ["L", "L+N", "3L", "3L+N"] as const;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function inferTemplate(etimClass: EtimClassSummary | undefined): string | null {
  if (!etimClass) return null;
  const description = etimClass.description.toLowerCase();

  if (
    description.includes("circuit breaker") ||
    description.includes("disconnector") ||
    description.includes("switch disconnector")
  ) {
    return "multi_pole_switch_device";
  }

  if (description.includes("power supply")) {
    return "dc_power_supply";
  }

  return null;
}

function featureInputType(feature: EtimFeatureDetail): string {
  if (feature.values.length > 0 || feature.feature_type === "A") {
    return "enum";
  }
  if (feature.feature_type === "L") {
    return "boolean";
  }
  if (feature.feature_type === "N") {
    return "managed_numeric";
  }
  if (feature.feature_type === "R") {
    return "range";
  }
  return "managed_value";
}

function featureCode(feature: EtimFeatureDetail): string {
  return feature.feature_id.toLowerCase();
}

function defaultFeatureValue(feature: EtimFeatureDetail): string {
  if (feature.values.length > 0) {
    return feature.values[0].value_description ?? feature.values[0].value_id;
  }
  if (feature.feature_type === "L") {
    return "false";
  }
  return "";
}

function recommendedFeatures(
  etimClass: EtimClassSummary | undefined,
  detail: EtimClassDetail | null,
): string[] {
  if (!etimClass || !detail) return [];

  const description = etimClass.description.toLowerCase();

  if (description.includes("circuit breaker")) {
    return detail.features
      .filter((feature) =>
        [
          "release characteristic",
          "number of poles (total)",
          "rated current",
          "rated voltage",
        ].includes((feature.feature_description ?? "").toLowerCase()),
      )
      .map((feature) => feature.art_class_feature_nr);
  }

  if (description.includes("power supply")) {
    return detail.features
      .filter((feature) =>
        [
          "output voltage",
          "output current",
          "input voltage",
          "voltage type",
        ].includes((feature.feature_description ?? "").toLowerCase()),
      )
      .map((feature) => feature.art_class_feature_nr);
  }

  return detail.features.slice(0, 5).map((feature) => feature.art_class_feature_nr);
}

function createDefinitionFromFeature(feature: EtimFeatureDetail): GovernedParameterDefinition {
  const name = feature.feature_description ?? feature.feature_id;
  const allowedValues = feature.values.map(
    (value) => value.value_description ?? value.value_id,
  );
  return {
    feature_key: feature.art_class_feature_nr,
    bundle_id: null,
    code: featureCode(feature),
    name,
    source: "etim_feature",
    input_type: featureInputType(feature),
    unit: feature.unit_description,
    default_value: defaultFeatureValue(feature),
    allowed_values: allowedValues,
    allowed_values_text: allowedValues.join(", "),
    required: false,
    is_parametrizable: true,
    drives_interfaces: false,
    sort_order: feature.sort_order ?? 0,
  };
}

function definitionAllowedValues(
  definitions: GovernedParameterDefinition[],
  parameterCode: string,
): string[] {
  const definition = definitions.find((item) => item.code === parameterCode);
  return definition?.allowed_values ?? [];
}

function createDefinitionFromPreset(
  preset: ParameterDefinitionPreset,
  existingDefinitions: GovernedParameterDefinition[],
  bundleId: string,
): GovernedParameterDefinition {
  const existingCodes = new Set(existingDefinitions.map((definition) => definition.code));
  let nextCode = preset.code;
  let suffix = 2;
  while (nextCode && existingCodes.has(nextCode)) {
    nextCode = `${preset.code}_${suffix}`;
    suffix += 1;
  }

  return {
    feature_key: `local:${createLocalKey()}`,
    bundle_id: bundleId,
    code: nextCode,
    name: preset.name,
    source: preset.source,
    input_type: preset.input_type,
    unit: preset.unit,
    default_value: preset.default_value ?? "",
    allowed_values: preset.allowed_values,
    allowed_values_text: preset.allowed_values.join(", "),
    required: preset.required === 1,
    is_parametrizable: preset.is_parametrizable === 1,
    drives_interfaces: preset.drives_interfaces === 1,
    sort_order: existingDefinitions.length + 100,
  };
}

function hydratePresetBundle(preset: ParameterDefinitionPreset): ParameterDefinitionPreset {
  const hasBundleData =
    preset.interface_groups.length > 0 || preset.interface_mapping_rules.length > 0;

  if (hasBundleData) {
    return preset;
  }

  if (preset.source === "typical_local" && preset.code === "power_topology") {
    return {
      ...preset,
      interface_groups: defaultInterfaceGroups("multi_pole_switch_device").map((group) => ({
        code: group.code,
        name: group.name,
        category: group.category,
        side: group.side || null,
        source: group.source,
        sort_order: group.sort_order,
      })),
      interface_mapping_rules: defaultInterfaceMappingRules("multi_pole_switch_device").map(
        (rule) => ({
          driver_parameter_code: rule.driver_parameter_code,
          driver_value: rule.driver_value,
          group_code: rule.group_code,
          interface_code: rule.interface_code,
          role: rule.role,
          logical_type: rule.logical_type,
          direction: rule.direction,
          source: rule.source,
          sort_order: rule.sort_order,
        }),
      ),
    };
  }

  return preset;
}

function toEditablePreset(preset: ParameterDefinitionPreset): EditablePreset {
  return {
    id: preset.id,
    preset_name: preset.preset_name,
    description: preset.description ?? "",
    code: preset.code,
    name: preset.name,
    source: preset.source,
    input_type: preset.input_type,
    unit: preset.unit,
    default_value: preset.default_value ?? "",
    allowed_values: preset.allowed_values,
    allowed_values_text: preset.allowed_values.join(", "),
    required: preset.required === 1,
    is_parametrizable: preset.is_parametrizable === 1,
    drives_interfaces: preset.drives_interfaces === 1,
    sort_order: preset.sort_order,
    interface_groups: preset.interface_groups,
    interface_mapping_rules: preset.interface_mapping_rules,
  };
}

function presetKind(preset: ParameterDefinitionPreset | EditablePreset): string {
  return preset.interface_groups.length > 0 || preset.interface_mapping_rules.length > 0
    ? "bundle"
    : "parameter";
}

function collectDefinitionBundleArtifacts(args: {
  definition: GovernedParameterDefinition;
  interfaceGroups: EditableInterfaceGroup[];
  interfaceMappingRules: EditableInterfaceMappingRule[];
}): {
  relatedGroups: EditableInterfaceGroup[];
  relatedMappings: EditableInterfaceMappingRule[];
} {
  const { definition, interfaceGroups, interfaceMappingRules } = args;

  let relatedMappings =
    definition.bundle_id !== null
      ? interfaceMappingRules.filter((rule) => rule.bundle_id === definition.bundle_id)
      : [];

  if (relatedMappings.length === 0 && definition.drives_interfaces) {
    relatedMappings = interfaceMappingRules.filter(
      (rule) => rule.driver_parameter_code === definition.code,
    );
  }

  const mappingGroupCodes = new Set(
    relatedMappings.map((rule) => rule.group_code).filter((code): code is string => Boolean(code)),
  );

  let relatedGroups =
    definition.bundle_id !== null
      ? interfaceGroups.filter((group) => group.bundle_id === definition.bundle_id)
      : [];

  if (relatedGroups.length === 0 && mappingGroupCodes.size > 0) {
    relatedGroups = interfaceGroups.filter((group) => mappingGroupCodes.has(group.code));
  }

  return { relatedGroups, relatedMappings };
}

function mergePresetGroups(
  currentGroups: EditableInterfaceGroup[],
  preset: ParameterDefinitionPreset,
  bundleId: string,
): EditableInterfaceGroup[] {
  const existingCodes = new Set(currentGroups.map((group) => group.code));
  const additions = preset.interface_groups
    .filter((group) => group.code && !existingCodes.has(group.code))
    .map((group, index) => ({
      local_key: createLocalKey(),
      bundle_id: bundleId,
      code: group.code,
      name: group.name,
      category: group.category,
      side: group.side ?? "",
      source: (group.source === "profile" ? "profile" : "custom") as "profile" | "custom",
      sort_order: currentGroups.length + index,
    }));
  return [...currentGroups, ...additions];
}

function mergePresetMappingRules(
  currentRules: EditableInterfaceMappingRule[],
  preset: ParameterDefinitionPreset,
  finalParameterCode: string,
  bundleId: string,
): EditableInterfaceMappingRule[] {
  const existingKeys = new Set(
    currentRules.map(
      (rule) =>
        `${rule.driver_parameter_code}::${rule.driver_value}::${rule.group_code ?? ""}::${rule.interface_code}`,
    ),
  );

  const additions = preset.interface_mapping_rules
    .map((rule, index) => ({
      local_key: createLocalKey(),
      bundle_id: bundleId,
      driver_parameter_code: rule.driver_parameter_code === preset.code ? finalParameterCode : rule.driver_parameter_code,
      driver_value: rule.driver_value,
      group_code: rule.group_code,
      interface_code: rule.interface_code,
      role: rule.role,
      logical_type: rule.logical_type,
      direction: rule.direction,
      source: "rule" as const,
      sort_order: currentRules.length + index,
    }))
    .filter((rule) => {
      const key = `${rule.driver_parameter_code}::${rule.driver_value}::${rule.group_code ?? ""}::${rule.interface_code}`;
      if (existingKeys.has(key)) {
        return false;
      }
      existingKeys.add(key);
      return true;
    });

  return [...currentRules, ...additions];
}

function normalizeInterfaceCode(code: string): string {
  return code.trim().toUpperCase();
}

function defaultInterfaceGroups(templateKey: string | null): EditableInterfaceGroup[] {
  if (templateKey === "multi_pole_switch_device") {
    return [
      {
        local_key: "group-input-power",
        bundle_id: null,
        code: "input_power",
        name: "Input power",
        category: "power_input",
        side: "line",
        source: "profile",
        sort_order: 0,
      },
      {
        local_key: "group-output-power",
        bundle_id: null,
        code: "output_power",
        name: "Output power",
        category: "power_output",
        side: "load",
        source: "profile",
        sort_order: 1,
      },
    ];
  }

  if (templateKey === "dc_power_supply") {
    return [
      {
        local_key: "group-input-power",
        bundle_id: null,
        code: "input_power",
        name: "Input power",
        category: "power_input",
        side: "primary",
        source: "profile",
        sort_order: 0,
      },
      {
        local_key: "group-output-power",
        bundle_id: null,
        code: "output_power",
        name: "Output power",
        category: "power_output",
        side: "secondary",
        source: "profile",
        sort_order: 1,
      },
    ];
  }

  return [];
}

function defaultInterfaceMappingRules(templateKey: string | null): EditableInterfaceMappingRule[] {
  if (templateKey !== "multi_pole_switch_device") {
    return [];
  }

  const topologyLabels: Record<string, string[]> = {
    L: ["L"],
    "L+N": ["L", "N"],
    "3L": ["L1", "L2", "L3"],
    "3L+N": ["L1", "L2", "L3", "N"],
  };

  const rules: EditableInterfaceMappingRule[] = [];
  Object.entries(topologyLabels).forEach(([driverValue, labels]) => {
    labels.forEach((label, index) => {
      rules.push({
        local_key: createLocalKey(),
        bundle_id: null,
        driver_parameter_code: "power_topology",
        driver_value: driverValue,
        group_code: "input_power",
        interface_code: `${label}_IN`,
        role: "line_in",
        logical_type: "power",
        direction: "in",
        source: "rule",
        sort_order: index * 2,
      });
      rules.push({
        local_key: createLocalKey(),
        bundle_id: null,
        driver_parameter_code: "power_topology",
        driver_value: driverValue,
        group_code: "output_power",
        interface_code: `${label}_OUT`,
        role: "load_out",
        logical_type: "power",
        direction: "out",
        source: "rule",
        sort_order: index * 2 + 1,
      });
    });
  });

  return rules;
}

function createLocalKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function inferSwitchTopologyFromDefinitions(definitions: GovernedParameterDefinition[]): string {
  const topologyDefinition = definitions.find((definition) => definition.code.toLowerCase() === "power_topology");
  if (topologyDefinition && SWITCH_TOPOLOGIES.includes(topologyDefinition.default_value as (typeof SWITCH_TOPOLOGIES)[number])) {
    return topologyDefinition.default_value;
  }

  const poleDefinition = definitions.find((definition) => {
    const code = definition.code.toLowerCase();
    const name = definition.name.toLowerCase();
    return code === "ef008618" || code === "number_of_poles" || name.includes("number of poles");
  });

  switch (poleDefinition?.default_value) {
    case "2":
      return "L+N";
    case "3":
      return "3L";
    case "4":
      return "3L+N";
    default:
      return "L";
  }
}

function ensureTemplateDefinitions(
  templateKey: string | null,
  definitions: GovernedParameterDefinition[],
): GovernedParameterDefinition[] {
  if (templateKey !== "multi_pole_switch_device") {
    return definitions;
  }

  const hasTopology = definitions.some((definition) => definition.code.toLowerCase() === "power_topology");
  if (hasTopology) {
    return definitions.map((definition) =>
      definition.code.toLowerCase() === "power_topology"
        ? {
            ...definition,
            input_type: "enum",
            allowed_values: [...SWITCH_TOPOLOGIES],
            allowed_values_text: SWITCH_TOPOLOGIES.join(", "),
            required: true,
            drives_interfaces: true,
            default_value:
              definition.default_value && SWITCH_TOPOLOGIES.includes(definition.default_value as (typeof SWITCH_TOPOLOGIES)[number])
                ? definition.default_value
                : inferSwitchTopologyFromDefinitions(definitions),
            sort_order: -10,
          }
        : {
            ...definition,
            drives_interfaces:
              definition.code.toLowerCase() === "ef008618" || definition.name.toLowerCase().includes("number of poles")
                ? false
                : definition.drives_interfaces,
          },
    );
  }

  return [
    {
      feature_key: "local:power_topology",
      bundle_id: null,
      code: "power_topology",
      name: "Power topology",
      source: "typical_local",
      input_type: "enum",
      unit: null,
      default_value: inferSwitchTopologyFromDefinitions(definitions),
      allowed_values: [...SWITCH_TOPOLOGIES],
      allowed_values_text: SWITCH_TOPOLOGIES.join(", "),
      required: true,
      is_parametrizable: true,
      drives_interfaces: true,
      sort_order: -10,
    },
    ...definitions,
  ].sort((left, right) => left.sort_order - right.sort_order);
}

function deriveInterfacesFromDefinitions(
  templateKey: string | null,
  definitions: GovernedParameterDefinition[],
  groups: EditableInterfaceGroup[],
  mappingRules: EditableInterfaceMappingRule[],
): EditableInterface[] {
  const validGroupCodes = new Set(groups.map((group) => group.code));
  const parameterValues = new Map(
    definitions.map((definition) => [definition.code.toLowerCase(), definition.default_value]),
  );
  if (mappingRules.length > 0) {
    const mappedInterfaces = mappingRules
      .filter((rule) => parameterValues.get(rule.driver_parameter_code.toLowerCase()) === rule.driver_value)
      .map((rule) => ({
        local_key: `derived-${rule.driver_parameter_code}-${rule.driver_value}-${rule.interface_code}`,
        group_code: rule.group_code && validGroupCodes.has(rule.group_code) ? rule.group_code : null,
        code: rule.interface_code,
        role: rule.role,
        logical_type: rule.logical_type,
        direction: rule.direction,
        source: "derived" as const,
        sort_order: rule.sort_order,
      }));

    if (mappedInterfaces.length > 0) {
      return mappedInterfaces;
    }
  }

  const interfaces: EditableInterface[] = [];
  if (templateKey === "multi_pole_switch_device") {
    const topology = inferSwitchTopologyFromDefinitions(definitions);
    const labels =
      topology === "L"
        ? ["L"]
        : topology === "L+N"
          ? ["L", "N"]
          : topology === "3L"
            ? ["L1", "L2", "L3"]
            : ["L1", "L2", "L3", "N"];
    for (let index = 0; index < labels.length; index += 1) {
      const label = labels[index];
      interfaces.push({
        local_key: `derived-${label}-in`,
        group_code: groups.find((group) => group.code === "input_power")?.code ?? null,
        code: `${label}_IN`,
        role: "line_in",
        logical_type: "power",
        direction: "in",
        source: "derived",
        sort_order: index * 2,
      });
      interfaces.push({
        local_key: `derived-${label}-out`,
        group_code: groups.find((group) => group.code === "output_power")?.code ?? null,
        code: `${label}_OUT`,
        role: "load_out",
        logical_type: "power",
        direction: "out",
        source: "derived",
        sort_order: index * 2 + 1,
      });
    }
  } else if (templateKey === "dc_power_supply") {
    interfaces.push(
      {
        local_key: "derived-ac-in",
        group_code: groups.find((group) => group.code === "input_power")?.code ?? null,
        code: "AC_IN",
        role: "power_input",
        logical_type: "power",
        direction: "in",
        source: "derived",
        sort_order: 0,
      },
      {
        local_key: "derived-pe",
        group_code: groups.find((group) => group.code === "input_power")?.code ?? null,
        code: "PE",
        role: "protective_earth",
        logical_type: "protective_earth",
        direction: "bidirectional",
        source: "derived",
        sort_order: 1,
      },
      {
        local_key: "derived-24v-out",
        group_code: groups.find((group) => group.code === "output_power")?.code ?? null,
        code: "+24V_OUT",
        role: "positive_output",
        logical_type: "power",
        direction: "out",
        source: "derived",
        sort_order: 2,
      },
      {
        local_key: "derived-0v-out",
        group_code: groups.find((group) => group.code === "output_power")?.code ?? null,
        code: "0V_OUT",
        role: "return_output",
        logical_type: "power",
        direction: "out",
        source: "derived",
        sort_order: 3,
      },
    );
  }

  return interfaces;
}

function mergeInterfaces(
  derivedInterfaces: EditableInterface[],
  currentInterfaces: EditableInterface[],
  disabledCodes: string[],
): EditableInterface[] {
  const disabled = new Set(disabledCodes.map(normalizeInterfaceCode));
  const overrides = currentInterfaces.filter((item) => item.source === "override");
  const visibleDerived = derivedInterfaces.filter(
    (item) => !disabled.has(normalizeInterfaceCode(item.code)),
  );

  return [...visibleDerived, ...overrides]
    .sort((left, right) => left.sort_order - right.sort_order || left.code.localeCompare(right.code))
      .map((item) => ({
      ...item,
      local_key: item.local_key || createLocalKey(),
    }));
}

function normalizeGroup(
  group: EquipmentTypicalDetail["interface_groups"][number],
): EditableInterfaceGroup {
  return {
    local_key: group.id,
    bundle_id: group.bundle_id ?? null,
    code: group.code,
    name: group.name,
    category: group.category,
    side: group.side ?? "",
    source: group.source === "custom" ? "custom" : "profile",
    sort_order: group.sort_order,
  };
}

function normalizeMappingRule(
  rule: EquipmentTypicalDetail["interface_mapping_rules"][number],
): EditableInterfaceMappingRule {
  return {
    local_key: rule.id,
    bundle_id: rule.bundle_id ?? null,
    driver_parameter_code: rule.driver_parameter_code,
    driver_value: rule.driver_value,
    group_code: rule.group_code,
    interface_code: rule.interface_code,
    role: rule.role,
    logical_type: rule.logical_type,
    direction: rule.direction,
    source: "rule",
    sort_order: rule.sort_order,
  };
}

function normalizeDefinition(
  definition: EquipmentTypicalDetail["parameter_definitions"][number],
  classDetail: EtimClassDetail | null,
): GovernedParameterDefinition {
  const linkedFeature = classDetail?.features.find(
    (feature) =>
      feature.art_class_feature_nr === definition.code.toUpperCase() ||
      feature.feature_id.toLowerCase() === definition.code.toLowerCase(),
  );

  return {
    feature_key: linkedFeature?.art_class_feature_nr ?? definition.code.toUpperCase(),
    bundle_id: definition.bundle_id ?? null,
    code: definition.code,
    name: definition.name,
    source: definition.source,
    input_type: definition.input_type,
    unit: definition.unit,
    default_value: definition.default_value ?? "",
    allowed_values: definition.allowed_values ?? [],
    allowed_values_text: (definition.allowed_values ?? []).join(", "),
    required: definition.required === 1,
    is_parametrizable: definition.is_parametrizable === 1,
    drives_interfaces: definition.drives_interfaces === 1,
    sort_order: definition.sort_order,
  };
}

function serializeEditorState(args: {
  mode: "create" | "edit";
  selectedTypicalId: string | null;
  selectedClassId: string;
  typicalName: string;
  typicalCode: string;
  typicalDescription: string;
  definitions: GovernedParameterDefinition[];
  interfaceGroups: EditableInterfaceGroup[];
  interfaceMappingRules: EditableInterfaceMappingRule[];
  interfaces: EditableInterface[];
  disabledInterfaceCodes: string[];
}): string {
  return JSON.stringify({
    mode: args.mode,
    selectedTypicalId: args.selectedTypicalId,
    selectedClassId: args.selectedClassId,
    typicalName: args.typicalName,
    typicalCode: args.typicalCode,
    typicalDescription: args.typicalDescription,
    definitions: args.definitions
      .map((definition) => ({
        feature_key: definition.feature_key,
        bundle_id: definition.bundle_id,
        code: definition.code,
        name: definition.name,
        source: definition.source,
        input_type: definition.input_type,
        unit: definition.unit,
        default_value: definition.default_value,
        allowed_values: definition.allowed_values,
        required: definition.required,
        is_parametrizable: definition.is_parametrizable,
        drives_interfaces: definition.drives_interfaces,
        sort_order: definition.sort_order,
      }))
      .sort((left, right) => left.sort_order - right.sort_order),
    interface_groups: args.interfaceGroups
      .map((group) => ({
        code: group.code,
        bundle_id: group.bundle_id,
        name: group.name,
        category: group.category,
        side: group.side,
        source: group.source,
        sort_order: group.sort_order,
      }))
      .sort((left, right) => left.sort_order - right.sort_order || left.code.localeCompare(right.code)),
    interface_mapping_rules: args.interfaceMappingRules
      .map((rule) => ({
        driver_parameter_code: rule.driver_parameter_code,
        bundle_id: rule.bundle_id,
        driver_value: rule.driver_value,
        group_code: rule.group_code,
        interface_code: rule.interface_code,
        role: rule.role,
        logical_type: rule.logical_type,
        direction: rule.direction,
        source: rule.source,
        sort_order: rule.sort_order,
      }))
      .sort(
        (left, right) =>
          left.driver_parameter_code.localeCompare(right.driver_parameter_code) ||
          left.driver_value.localeCompare(right.driver_value) ||
          left.sort_order - right.sort_order ||
          left.interface_code.localeCompare(right.interface_code),
      ),
    interfaces: args.interfaces
      .map((item) => ({
        group_code: item.group_code,
        code: item.code,
        role: item.role,
        logical_type: item.logical_type,
        direction: item.direction,
        source: item.source,
        sort_order: item.sort_order,
      }))
      .sort((left, right) => left.sort_order - right.sort_order || left.code.localeCompare(right.code)),
    disabled_interface_codes: [...args.disabledInterfaceCodes].sort(),
  });
}

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [classes, setClasses] = useState<EtimClassSummary[]>([]);
  const [classDetail, setClassDetail] = useState<EtimClassDetail | null>(null);
  const [typicals, setTypicals] = useState<EquipmentTypical[]>([]);
  const [typicalVersions, setTypicalVersions] = useState<EquipmentTypical[]>([]);
  const [selectedTypicalId, setSelectedTypicalId] = useState<string | null>(null);
  const [selectedTypicalStatus, setSelectedTypicalStatus] = useState<"draft" | "released">("draft");
  const [selectedTypicalVersion, setSelectedTypicalVersion] = useState<number>(1);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [search, setSearch] = useState("circuit breaker");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [typicalName, setTypicalName] = useState("");
  const [typicalCode, setTypicalCode] = useState("");
  const [typicalDescription, setTypicalDescription] = useState("");
  const [definitions, setDefinitions] = useState<GovernedParameterDefinition[]>([]);
  const [interfaceGroups, setInterfaceGroups] = useState<EditableInterfaceGroup[]>([]);
  const [interfaceMappingRules, setInterfaceMappingRules] = useState<EditableInterfaceMappingRule[]>([]);
  const [interfaces, setInterfaces] = useState<EditableInterface[]>([]);
  const [disabledInterfaceCodes, setDisabledInterfaceCodes] = useState<string[]>([]);
  const [presets, setPresets] = useState<ParameterDefinitionPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [presetDraft, setPresetDraft] = useState<EditablePreset | null>(null);
  const [presetSelection, setPresetSelection] = useState<Record<string, string>>({});
  const [localPresetSelection, setLocalPresetSelection] = useState("");
  const [validation, setValidation] = useState<TypicalValidationResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [loadingTypical, setLoadingTypical] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const isReleasedTypical = mode === "edit" && selectedTypicalStatus === "released";

  const selectedClass =
    classes.find((item) => item.id === selectedClassId) ??
    (classDetail
      ? {
          id: classDetail.id,
          description: classDetail.description,
          version: classDetail.version,
          group_id: classDetail.group_id,
        }
      : undefined);
  const selectedFeatureKeys = useMemo(
    () => definitions.map((definition) => definition.feature_key),
    [definitions],
  );
  const currentSnapshot = useMemo(
    () =>
      serializeEditorState({
        mode,
        selectedTypicalId,
        selectedClassId,
        typicalName,
        typicalCode,
        typicalDescription,
        definitions,
        interfaceGroups,
        interfaceMappingRules,
        interfaces,
        disabledInterfaceCodes,
      }),
    [
      definitions,
      interfaceGroups,
      interfaceMappingRules,
      disabledInterfaceCodes,
      interfaces,
      mode,
      selectedClassId,
      selectedTypicalId,
      typicalCode,
      typicalDescription,
      typicalName,
    ],
  );
  const isDirty = savedSnapshot !== "" && currentSnapshot !== savedSnapshot;

  function confirmDiscardChanges() {
    if (!isDirty) {
      return true;
    }
    return window.confirm("Je hebt niet-opgeslagen wijzigingen. Wil je deze verlaten?");
  }

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [healthResponse, classesResponse, typicalsResponse, presetsResponse] = await Promise.all([
          fetch(`${apiBaseUrl}/health`),
          fetch(
            `${apiBaseUrl}/api/v1/etim/classes?search=${encodeURIComponent(
              "circuit breaker",
            )}&limit=8`,
          ),
          fetch(`${apiBaseUrl}/api/v1/typicals`),
          fetch(`${apiBaseUrl}/api/v1/presets`),
        ]);

        if (!healthResponse.ok || !classesResponse.ok || !typicalsResponse.ok || !presetsResponse.ok) {
          throw new Error("API bootstrap failed");
        }

        setHealth((await healthResponse.json()) as HealthResponse);
        const classesPayload = (await classesResponse.json()) as EtimClassSummary[];
        setClasses(classesPayload);
        setTypicals((await typicalsResponse.json()) as EquipmentTypical[]);
        setPresets(
          ((await presetsResponse.json()) as ParameterDefinitionPreset[]).map(hydratePresetBundle),
        );
        if (classesPayload.length > 0) {
          setSelectedClassId(classesPayload[0].id);
        }
        setSavedSnapshot(
      serializeEditorState({
        mode: "create",
        selectedTypicalId: null,
        selectedClassId: classesPayload[0]?.id ?? "",
        typicalName: "",
        typicalCode: "",
        typicalDescription: "",
        definitions: [],
        interfaceGroups: [],
        interfaceMappingRules: [],
        interfaces: [],
        disabledInterfaceCodes: [],
      }),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    }

    void loadInitialData();
  }, []);

  useEffect(() => {
    async function loadClassDetail() {
      if (!selectedClassId) {
        setClassDetail(null);
        if (mode === "create") {
          setDefinitions([]);
          setInterfaceGroups([]);
          setInterfaceMappingRules([]);
          setInterfaces([]);
          setDisabledInterfaceCodes([]);
        }
        return;
      }

      const response = await fetch(`${apiBaseUrl}/api/v1/etim/classes/${selectedClassId}`);
      if (!response.ok) {
        setClassDetail(null);
        if (mode === "create") {
          setDefinitions([]);
          setInterfaceGroups([]);
          setInterfaceMappingRules([]);
          setInterfaces([]);
          setDisabledInterfaceCodes([]);
        }
        return;
      }

      const payload = (await response.json()) as EtimClassDetail;
      setClassDetail(payload);

      if (mode === "create") {
        const selectedClassSummary = classes.find((item) => item.id === selectedClassId) ?? {
          id: payload.id,
          description: payload.description,
          version: payload.version,
          group_id: payload.group_id,
        };
        const recommended = new Set(recommendedFeatures(selectedClassSummary, payload));
        const nextDefinitions = ensureTemplateDefinitions(
          inferTemplate(selectedClassSummary),
          payload.features
          .filter((feature) => recommended.has(feature.art_class_feature_nr))
          .map(createDefinitionFromFeature),
        );
        const nextGroups = defaultInterfaceGroups(inferTemplate(selectedClassSummary));
        const nextMappingRules = defaultInterfaceMappingRules(inferTemplate(selectedClassSummary));
        setDefinitions(nextDefinitions);
        setInterfaceGroups(nextGroups);
        setInterfaceMappingRules(nextMappingRules);
        setDisabledInterfaceCodes([]);
        setInterfaces(
          deriveInterfacesFromDefinitions(
            inferTemplate(selectedClassSummary),
            nextDefinitions,
            nextGroups,
            nextMappingRules,
          ),
        );
      }
    }

    void loadClassDetail();
  }, [classes, mode, selectedClassId]);

  useEffect(() => {
    if (mode === "edit") return;
    if (!selectedClass) return;
    setTypicalName(selectedClass.description);
    setTypicalCode(`typ-${slugify(selectedClass.description)}-${selectedClass.id.toLowerCase()}`);
    setTypicalDescription(`Typical gebaseerd op ${selectedClass.description}`);
  }, [selectedClass, mode]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (savedSnapshot !== "") {
      return;
    }
    if (mode !== "create" || selectedTypicalId !== null || !selectedClassId) {
      return;
    }
    setSavedSnapshot(currentSnapshot);
  }, [currentSnapshot, mode, savedSnapshot, selectedClassId, selectedTypicalId]);

  async function refreshTypicals(selectedId?: string | null) {
    const listResponse = await fetch(`${apiBaseUrl}/api/v1/typicals`);
    if (!listResponse.ok) {
      throw new Error("Typicals laden mislukt");
    }
    const listPayload = (await listResponse.json()) as EquipmentTypical[];
    setTypicals(listPayload);
    if (selectedId !== undefined) {
      setSelectedTypicalId(selectedId);
    }
  }

  async function refreshTypicalVersions(typicalId: string) {
    const response = await fetch(`${apiBaseUrl}/api/v1/typicals/${typicalId}/versions`);
    if (!response.ok) {
      throw new Error("Versies laden mislukt");
    }
    setTypicalVersions((await response.json()) as EquipmentTypical[]);
  }

  async function refreshPresets() {
    const response = await fetch(`${apiBaseUrl}/api/v1/presets`);
    if (!response.ok) {
      throw new Error("Presets laden mislukt");
    }
    const nextPresets = ((await response.json()) as ParameterDefinitionPreset[]).map(hydratePresetBundle);
    setPresets(nextPresets);
    if (selectedPresetId) {
      const selected = nextPresets.find((preset) => preset.id === selectedPresetId) ?? null;
      setPresetDraft(selected ? toEditablePreset(selected) : null);
      if (!selected) {
        setSelectedPresetId(null);
      }
    }
  }

  async function handleSavePreset(definition: GovernedParameterDefinition) {
    const presetName = window.prompt(
      `Presetnaam voor ${definition.name}`,
      `${definition.name} preset`,
    );
    if (!presetName || presetName.trim() === "") {
      return;
    }

    const { relatedGroups, relatedMappings } = collectDefinitionBundleArtifacts({
      definition,
      interfaceGroups,
      interfaceMappingRules,
    });
    const presetPayload = {
      description: `Preset voor ${definition.name}`,
      code: definition.code,
      name: definition.name,
      source: definition.source,
      input_type: definition.input_type,
      unit: definition.unit,
      default_value: definition.default_value || null,
      allowed_values: definition.allowed_values,
      required: definition.required,
      is_parametrizable: definition.is_parametrizable,
      drives_interfaces: definition.drives_interfaces,
      sort_order: definition.sort_order,
      interface_groups: relatedGroups.map((group) => ({
        code: group.code,
        name: group.name,
        category: group.category,
        side: group.side || null,
        source: group.source,
        sort_order: group.sort_order,
      })),
      interface_mapping_rules: relatedMappings.map((rule) => ({
        driver_parameter_code: rule.driver_parameter_code,
        driver_value: rule.driver_value,
        group_code: rule.group_code,
        interface_code: rule.interface_code,
        role: rule.role,
        logical_type: rule.logical_type,
        direction: rule.direction,
        source: rule.source,
        sort_order: rule.sort_order,
      })),
    };

    setError(null);
    setSuccessMessage(null);
    const response = await fetch(`${apiBaseUrl}/api/v1/presets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...presetPayload,
        preset_name: presetName.trim(),
      }),
    });

    if (!response.ok) {
      setError("Preset opslaan mislukt");
      return;
    }

    await refreshPresets();
    setSuccessMessage(`Preset voor ${definition.name} opgeslagen.`);
  }

  async function handleUpdatePreset(
    definition: GovernedParameterDefinition,
    presetId: string,
  ) {
    const preset = presets.find((item) => item.id === presetId);
    if (!preset) {
      setError("Selecteer eerst een preset om bij te werken.");
      setSuccessMessage(null);
      return;
    }

    const { relatedGroups, relatedMappings } = collectDefinitionBundleArtifacts({
      definition,
      interfaceGroups,
      interfaceMappingRules,
    });

    setError(null);
    setSuccessMessage(null);
    const response = await fetch(`${apiBaseUrl}/api/v1/presets/${presetId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        preset_name: preset.preset_name,
        description: preset.description ?? `Preset voor ${definition.name}`,
        code: definition.code,
        name: definition.name,
        source: definition.source,
        input_type: definition.input_type,
        unit: definition.unit,
        default_value: definition.default_value || null,
        allowed_values: definition.allowed_values,
        required: definition.required,
        is_parametrizable: definition.is_parametrizable,
        drives_interfaces: definition.drives_interfaces,
        sort_order: definition.sort_order,
        interface_groups: relatedGroups.map((group) => ({
          code: group.code,
          name: group.name,
          category: group.category,
          side: group.side || null,
          source: group.source,
          sort_order: group.sort_order,
        })),
        interface_mapping_rules: relatedMappings.map((rule) => ({
          driver_parameter_code: rule.driver_parameter_code,
          driver_value: rule.driver_value,
          group_code: rule.group_code,
          interface_code: rule.interface_code,
          role: rule.role,
          logical_type: rule.logical_type,
          direction: rule.direction,
          source: rule.source,
          sort_order: rule.sort_order,
        })),
      }),
    });

    if (!response.ok) {
      setError("Preset bijwerken mislukt");
      return;
    }

    if (definition.drives_interfaces) {
      const nextDefinitions = definitions.map((item) =>
        item.feature_key === definition.feature_key
          ? { ...item, bundle_id: item.bundle_id ?? presetId }
          : item,
      );
      const nextRules = interfaceMappingRules.map((rule) =>
        rule.driver_parameter_code === definition.code
          ? { ...rule, bundle_id: rule.bundle_id ?? presetId }
          : rule,
      );
      const mappedGroupCodes = new Set(
        nextRules
          .filter((rule) => rule.driver_parameter_code === definition.code)
          .map((rule) => rule.group_code)
          .filter((code): code is string => Boolean(code)),
      );
      const nextGroups = interfaceGroups.map((group) =>
        mappedGroupCodes.has(group.code)
          ? { ...group, bundle_id: group.bundle_id ?? presetId }
          : group,
      );
      setDefinitions(nextDefinitions);
      setInterfaceMappingRules(nextRules);
      setInterfaceGroups(nextGroups);
    }

    await refreshPresets();
    setSuccessMessage(`Preset ${preset.preset_name} bijgewerkt.`);
  }

  function applyPresetToDefinition(featureKey: string, presetId: string) {
    const preset = presets.find((item) => item.id === presetId);
    if (!preset) {
      return;
    }

    const targetDefinition = definitions.find((item) => item.feature_key === featureKey);
    const bundleId = targetDefinition?.bundle_id ?? crypto.randomUUID();

    updateDefinition(featureKey, {
      bundle_id: bundleId,
      code: preset.code,
      name: preset.name,
      source: preset.source,
      input_type: preset.input_type,
      unit: preset.unit,
      default_value: preset.default_value ?? "",
      allowed_values: preset.allowed_values,
      allowed_values_text: preset.allowed_values.join(", "),
      required: preset.required === 1,
      is_parametrizable: preset.is_parametrizable === 1,
      drives_interfaces: preset.drives_interfaces === 1,
      sort_order: preset.sort_order,
    });

    if (preset.interface_groups.length > 0) {
      setInterfaceGroups((current) => mergePresetGroups(current, preset, bundleId));
    }
    if (preset.interface_mapping_rules.length > 0) {
      setInterfaceMappingRules((current) =>
        mergePresetMappingRules(current, preset, preset.code, bundleId),
      );
    }
    const nextDefinitions = definitions.map((definition) =>
      definition.feature_key === featureKey
        ? {
            ...definition,
            code: preset.code,
            name: preset.name,
            source: preset.source,
            input_type: preset.input_type,
            unit: preset.unit,
            default_value: preset.default_value ?? "",
            allowed_values: preset.allowed_values,
            allowed_values_text: preset.allowed_values.join(", "),
            required: preset.required === 1,
            is_parametrizable: preset.is_parametrizable === 1,
            drives_interfaces: preset.drives_interfaces === 1,
            sort_order: preset.sort_order,
          }
        : definition,
    );
    const nextGroups =
      preset.interface_groups.length > 0
        ? mergePresetGroups(interfaceGroups, preset, bundleId)
        : interfaceGroups;
    const nextRules =
      preset.interface_mapping_rules.length > 0
        ? mergePresetMappingRules(interfaceMappingRules, preset, preset.code, bundleId)
        : interfaceMappingRules;
    const nextDerived = deriveInterfacesFromDefinitions(
      inferTemplate(selectedClass),
      nextDefinitions,
      nextGroups,
      nextRules,
    );
    setInterfaces((current) => mergeInterfaces(nextDerived, current, disabledInterfaceCodes));
  }

  function addLocalParameterFromPreset(presetId: string) {
    const preset = presets.find((item) => item.id === presetId);
    if (!preset) {
      return;
    }

    const bundleId = crypto.randomUUID();
    const createdDefinition = createDefinitionFromPreset(preset, definitions, bundleId);
    setDefinitions((current) => [...current, createdDefinition]);
    const nextGroups =
      preset.interface_groups.length > 0
        ? mergePresetGroups(interfaceGroups, preset, bundleId)
        : interfaceGroups;
    const nextRules =
      preset.interface_mapping_rules.length > 0
        ? mergePresetMappingRules(
            interfaceMappingRules,
            preset,
            createdDefinition.code,
            bundleId,
          )
        : interfaceMappingRules;
    if (preset.interface_groups.length > 0) {
      setInterfaceGroups(nextGroups);
    }
    if (preset.interface_mapping_rules.length > 0) {
      setInterfaceMappingRules(nextRules);
    }
    const nextDefinitions = [...definitions, createdDefinition];
    const nextDerived = deriveInterfacesFromDefinitions(
      inferTemplate(selectedClass),
      nextDefinitions,
      nextGroups,
      nextRules,
    );
    setInterfaces((current) => mergeInterfaces(nextDerived, current, disabledInterfaceCodes));
    setLocalPresetSelection("");
  }

  async function handleDeletePreset(presetId: string) {
    const confirmed = window.confirm("Wil je deze preset verwijderen?");
    if (!confirmed) {
      return;
    }

    setError(null);
    setSuccessMessage(null);
    const response = await fetch(`${apiBaseUrl}/api/v1/presets/${presetId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      setError("Preset verwijderen mislukt");
      return;
    }

    setPresetSelection((current) => {
      const next = { ...current };
      for (const [key, value] of Object.entries(next)) {
        if (value === presetId) {
          next[key] = "";
        }
      }
      return next;
    });
    await refreshPresets();
    setSuccessMessage("Preset verwijderd.");
  }

  function selectPresetForEditing(presetId: string) {
    const preset = presets.find((item) => item.id === presetId) ?? null;
    setSelectedPresetId(presetId);
    setPresetDraft(preset ? toEditablePreset(preset) : null);
  }

  async function handleSavePresetDraft() {
    if (!presetDraft) {
      return;
    }

    setError(null);
    setSuccessMessage(null);
    const response = await fetch(`${apiBaseUrl}/api/v1/presets/${presetDraft.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        preset_name: presetDraft.preset_name,
        description: presetDraft.description || null,
        code: presetDraft.code,
        name: presetDraft.name,
        source: presetDraft.source,
        input_type: presetDraft.input_type,
        unit: presetDraft.unit,
        default_value: presetDraft.default_value || null,
        allowed_values: presetDraft.allowed_values,
        required: presetDraft.required,
        is_parametrizable: presetDraft.is_parametrizable,
        drives_interfaces: presetDraft.drives_interfaces,
        sort_order: presetDraft.sort_order,
        interface_groups: presetDraft.interface_groups,
        interface_mapping_rules: presetDraft.interface_mapping_rules,
      }),
    });

    if (!response.ok) {
      setError("Preset opslaan mislukt");
      return;
    }

    await refreshPresets();
    setSuccessMessage("Presetdetail opgeslagen.");
  }

  async function handleRepairPreset(presetId: string) {
    const preset = presets.find((item) => item.id === presetId);
    if (!preset) {
      return;
    }
    const repaired = hydratePresetBundle(preset);
    if (
      repaired.interface_groups.length === preset.interface_groups.length &&
      repaired.interface_mapping_rules.length === preset.interface_mapping_rules.length
    ) {
      return;
    }

    setError(null);
    setSuccessMessage(null);
    const response = await fetch(`${apiBaseUrl}/api/v1/presets/${presetId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        preset_name: repaired.preset_name,
        description: repaired.description || null,
        code: repaired.code,
        name: repaired.name,
        source: repaired.source,
        input_type: repaired.input_type,
        unit: repaired.unit,
        default_value: repaired.default_value || null,
        allowed_values: repaired.allowed_values,
        required: repaired.required === 1,
        is_parametrizable: repaired.is_parametrizable === 1,
        drives_interfaces: repaired.drives_interfaces === 1,
        sort_order: repaired.sort_order,
        interface_groups: repaired.interface_groups,
        interface_mapping_rules: repaired.interface_mapping_rules,
      }),
    });

    if (!response.ok) {
      setError("Preset herstellen mislukt");
      return;
    }

    await refreshPresets();
    setSuccessMessage("Preset hersteld.");
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confirmDiscardChanges()) {
      return;
    }
    const response = await fetch(
      `${apiBaseUrl}/api/v1/etim/classes?search=${encodeURIComponent(search)}&limit=12`,
    );
    const payload = (await response.json()) as EtimClassSummary[];
    setClasses(payload);
    if (payload.length > 0) {
      setSelectedClassId(payload[0].id);
      if (mode === "create") {
        setSelectedTypicalId(null);
      }
    }
    setSavedSnapshot("");
  }

  function buildPayload() {
    if (!selectedClass) return null;

    return {
      name: typicalName.trim() || selectedClass.description,
      code:
        typicalCode.trim() ||
        `typ-${slugify(selectedClass.description)}-${selectedClass.id.toLowerCase()}`,
      description:
        typicalDescription.trim() || `Typical gebaseerd op ${selectedClass.description}`,
      etim_class_id: selectedClass.id,
      template_key: inferTemplate(selectedClass),
      parameter_definitions: definitions.map((definition) => ({
        code: definition.code,
        name: definition.name,
        source: definition.source,
        input_type: definition.input_type,
        unit: definition.unit,
        default_value: definition.default_value || null,
        allowed_values: definition.allowed_values,
        required: definition.required,
        is_parametrizable: definition.is_parametrizable,
        drives_interfaces: definition.drives_interfaces,
        bundle_id: definition.bundle_id,
        sort_order: definition.sort_order,
      })),
      parameters: [],
      interface_groups: interfaceGroups.map((group) => ({
        code: group.code,
        name: group.name,
        category: group.category,
        side: group.side || null,
        source: group.source,
        bundle_id: group.bundle_id,
        sort_order: group.sort_order,
      })),
      interface_mapping_rules: interfaceMappingRules.map((rule) => ({
        driver_parameter_code: rule.driver_parameter_code,
        driver_value: rule.driver_value,
        group_code: rule.group_code,
        interface_code: rule.interface_code,
        role: rule.role,
        logical_type: rule.logical_type,
        direction: rule.direction,
        source: rule.source,
        bundle_id: rule.bundle_id,
        sort_order: rule.sort_order,
      })),
      interfaces: interfaces.map((item) => ({
        group_code: item.group_code,
        code: item.code,
        role: item.role,
        logical_type: item.logical_type,
        direction: item.direction,
        source: item.source,
        sort_order: item.sort_order,
      })),
      disabled_interface_codes: disabledInterfaceCodes,
    };
  }

  async function handleSaveTypical() {
    if (!selectedClassId || !selectedClass) {
      setError("De geselecteerde ETIM-klasse is niet geladen.");
      return;
    }
    if (isReleasedTypical) {
      setError("Released typicals zijn readonly. Maak eerst een nieuwe draft.");
      setSuccessMessage(null);
      return;
    }

    const payload = buildPayload();
    if (!payload) return;

    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const isEdit = mode === "edit" && selectedTypicalId;
      const response = await fetch(
        isEdit ? `${apiBaseUrl}/api/v1/typicals/${selectedTypicalId}` : `${apiBaseUrl}/api/v1/typicals`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        let detail = isEdit ? "Update typical failed" : "Create typical failed";
        try {
          const errorPayload = (await response.json()) as { detail?: string };
          if (errorPayload.detail) {
            detail = errorPayload.detail;
          }
        } catch {
          undefined;
        }
        throw new Error(detail);
      }

      const saved = (await response.json()) as EquipmentTypicalDetail;
      await refreshTypicals(saved.id);
      await refreshTypicalVersions(saved.id);
      setMode("edit");
      await handleEditTypical(saved.id, true);
      setSuccessMessage(
        isEdit ? "Typical opgeslagen." : "Equipment Typical aangemaakt.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleValidateTypical() {
    if (!selectedClassId || !selectedClass) {
      setError("De geselecteerde ETIM-klasse is niet geladen.");
      return;
    }

    const payload = buildPayload();
    if (!payload) {
      return;
    }

    setValidating(true);
    setError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/typicals/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Validatie mislukt");
      }

      setValidation((await response.json()) as TypicalValidationResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setValidating(false);
    }
  }

  function toggleFeature(feature: EtimFeatureDetail) {
    setDefinitions((current) => {
      const exists = current.some((item) => item.feature_key === feature.art_class_feature_nr);
      if (exists) {
        return current.filter((item) => item.feature_key !== feature.art_class_feature_nr);
      }
      return [...current, createDefinitionFromFeature(feature)].sort(
        (left, right) => left.sort_order - right.sort_order,
      );
    });
  }

  function updateDefinition(featureKey: string, patch: Partial<GovernedParameterDefinition>) {
    setDefinitions((current) => {
      const nextDefinitions = current.map((definition) =>
        definition.feature_key === featureKey ? { ...definition, ...patch } : definition,
      );

      const changedDefinition = nextDefinitions.find((definition) => definition.feature_key === featureKey);
      const shouldRefreshInterfaces =
        inferTemplate(selectedClass) !== null &&
        (
          changedDefinition?.drives_interfaces ||
          changedDefinition?.code.toLowerCase() === "power_topology" ||
          patch.drives_interfaces !== undefined ||
          patch.default_value !== undefined
        );

      if (shouldRefreshInterfaces) {
        const nextDerived = deriveInterfacesFromDefinitions(
          inferTemplate(selectedClass),
          nextDefinitions,
          interfaceGroups,
          interfaceMappingRules,
        );
        setInterfaces((existing) => mergeInterfaces(nextDerived, existing, disabledInterfaceCodes));
      }

      return nextDefinitions;
    });
  }

  function deleteDefinition(featureKey: string) {
    const target = definitions.find((definition) => definition.feature_key === featureKey);
    if (!target) {
      return;
    }

    const nextDefinitions = definitions.filter((definition) => definition.feature_key !== featureKey);
    const nextRules = interfaceMappingRules.filter(
      (rule) => rule.driver_parameter_code.toLowerCase() !== target.code.toLowerCase(),
    );
    setDefinitions(nextDefinitions);
    setInterfaceMappingRules(nextRules);

    const nextDerived = deriveInterfacesFromDefinitions(
      inferTemplate(selectedClass),
      nextDefinitions,
      interfaceGroups,
      nextRules,
    );
    setInterfaces((current) => mergeInterfaces(nextDerived, current, disabledInterfaceCodes));
  }

  function regenerateInterfaces() {
    const nextDerived = deriveInterfacesFromDefinitions(
      inferTemplate(selectedClass),
      definitions,
      interfaceGroups,
      interfaceMappingRules,
    );
    setInterfaces((current) => mergeInterfaces(nextDerived, current, disabledInterfaceCodes));
  }

  function addLocalParameter() {
    setDefinitions((current) => [
      ...current,
      {
        feature_key: `local:${createLocalKey()}`,
        bundle_id: null,
        code: "",
        name: "",
        source: "typical_local",
        input_type: "enum",
        unit: null,
        default_value: "",
        allowed_values: [],
        allowed_values_text: "",
        required: false,
        is_parametrizable: true,
        drives_interfaces: false,
        sort_order: current.length + 100,
      },
    ]);
  }

  function addInterfaceMappingRule() {
    setInterfaceMappingRules((current) => [
      ...current,
      {
        local_key: createLocalKey(),
        bundle_id: null,
        driver_parameter_code: definitions.find((definition) => definition.drives_interfaces)?.code ?? "",
        driver_value: "",
        group_code: interfaceGroups[0]?.code ?? null,
        interface_code: "",
        role: "",
        logical_type: "power",
        direction: "in",
        source: "rule",
        sort_order: current.length,
      },
    ]);
  }

  function updateInterfaceMappingRule(
    localKey: string,
    patch: Partial<EditableInterfaceMappingRule>,
  ) {
    setInterfaceMappingRules((current) => {
      const nextRules = current.map((rule) => (rule.local_key === localKey ? { ...rule, ...patch } : rule));
      const nextDerived = deriveInterfacesFromDefinitions(
        inferTemplate(selectedClass),
        definitions,
        interfaceGroups,
        nextRules,
      );
      setInterfaces((existing) => mergeInterfaces(nextDerived, existing, disabledInterfaceCodes));
      return nextRules;
    });
  }

  function deleteInterfaceMappingRule(localKey: string) {
    setInterfaceMappingRules((current) => {
      const nextRules = current.filter((rule) => rule.local_key !== localKey);
      const nextDerived = deriveInterfacesFromDefinitions(
        inferTemplate(selectedClass),
        definitions,
        interfaceGroups,
        nextRules,
      );
      setInterfaces((existing) => mergeInterfaces(nextDerived, existing, disabledInterfaceCodes));
      return nextRules;
    });
  }

  function addInterfaceGroup() {
    setInterfaceGroups((current) => [
      ...current,
      {
        local_key: createLocalKey(),
        bundle_id: null,
        code: `custom_group_${current.length + 1}`,
        name: `Custom group ${current.length + 1}`,
        category: "custom",
        side: "",
        source: "custom",
        sort_order: current.length,
      },
    ]);
  }

  function updateInterfaceGroup(localKey: string, patch: Partial<EditableInterfaceGroup>) {
    const currentCode = interfaceGroups.find((group) => group.local_key === localKey)?.code;
    const nextGroups = interfaceGroups.map((group) =>
      group.local_key === localKey ? { ...group, ...patch } : group,
    );
    const nextRules =
      patch.code !== undefined && currentCode
        ? interfaceMappingRules.map((rule) =>
            rule.group_code === currentCode ? { ...rule, group_code: patch.code || null } : rule,
          )
        : interfaceMappingRules;
    const nextInterfaces =
      patch.code !== undefined && currentCode
        ? interfaces.map((item) =>
            item.group_code === currentCode ? { ...item, group_code: patch.code || null } : item,
          )
        : interfaces;

    setInterfaceGroups(nextGroups);
    setInterfaceMappingRules(nextRules);
    setInterfaces(nextInterfaces);
  }

  function removeBundle(bundleId: string) {
    const bundleDefinitionCodes = definitions
      .filter((definition) => definition.bundle_id === bundleId)
      .map((definition) => definition.code);
    const nextDefinitions = definitions.filter((definition) => definition.bundle_id !== bundleId);
    const nextGroups = interfaceGroups.filter((group) => group.bundle_id !== bundleId);
    const nextRules = interfaceMappingRules.filter((rule) => rule.bundle_id !== bundleId);
    const nextInterfaces = interfaces.filter((item) => item.source === "override");

    setDefinitions(nextDefinitions);
    setInterfaceGroups(nextGroups);
    setInterfaceMappingRules(nextRules);
    const nextDerived = deriveInterfacesFromDefinitions(
      inferTemplate(selectedClass),
      nextDefinitions,
      nextGroups,
      nextRules,
    );
    setInterfaces(mergeInterfaces(nextDerived, nextInterfaces, disabledInterfaceCodes));
  }

  function deleteInterfaceGroup(localKey: string) {
    const target = interfaceGroups.find((group) => group.local_key === localKey);
    const nextGroups = interfaceGroups.filter((group) => group.local_key !== localKey);
    let nextInterfaces = interfaces;
    let nextRules = interfaceMappingRules;
    if (target) {
      nextInterfaces = interfaces.map((item) =>
        item.group_code === target.code ? { ...item, group_code: null, source: "override" } : item,
      );
      nextRules = interfaceMappingRules.map((rule) =>
        rule.group_code === target.code ? { ...rule, group_code: null } : rule,
      );
    }
    setInterfaceGroups(nextGroups);
    setInterfaceMappingRules(nextRules);
    const nextDerived = deriveInterfacesFromDefinitions(
      inferTemplate(selectedClass),
      definitions,
      nextGroups,
      nextRules,
    );
    setInterfaces(mergeInterfaces(nextDerived, nextInterfaces, disabledInterfaceCodes));
  }

  function addOverrideInterface() {
    setInterfaces((current) => [
      ...current,
      {
        local_key: createLocalKey(),
        group_code: interfaceGroups[0]?.code ?? null,
        code: "",
        role: "",
        logical_type: "signal",
        direction: "bidirectional",
        source: "override",
        sort_order: current.length,
      },
    ]);
  }

  function updateInterface(localKey: string, patch: Partial<EditableInterface>) {
    setInterfaces((current) =>
      current.map((item) => {
        if (item.local_key !== localKey) {
          return item;
        }

        if (item.source === "derived") {
          setDisabledInterfaceCodes((existing) => {
            const normalized = normalizeInterfaceCode(item.code);
            return existing.includes(normalized) ? existing : [...existing, normalized];
          });
          return {
            ...item,
            ...patch,
            source: "override" as const,
          };
        }

        return { ...item, ...patch };
      }),
    );
  }

  function deleteInterface(localKey: string) {
    setInterfaces((current) => {
      const target = current.find((item) => item.local_key === localKey);
      if (!target) {
        return current;
      }

      if (target.source === "derived") {
        setDisabledInterfaceCodes((existing) => {
          const normalized = normalizeInterfaceCode(target.code);
          return existing.includes(normalized) ? existing : [...existing, normalized];
        });
      }

      return current.filter((item) => item.local_key !== localKey);
    });
  }

  async function handleEditTypical(typicalId: string, skipDirtyCheck = false) {
    if (!skipDirtyCheck && !confirmDiscardChanges()) {
      return;
    }
    setError(null);
    setLoadingTypical(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/typicals/${typicalId}`);
      if (!response.ok) {
        throw new Error("Typical laden mislukt");
      }

      const payload = (await response.json()) as EquipmentTypicalDetail;
      setSelectedTypicalId(payload.id);
      setSelectedTypicalStatus(payload.status === "released" ? "released" : "draft");
      setSelectedTypicalVersion(payload.version);
      setMode("edit");
      setSelectedClassId(payload.etim_class_id);
      setTypicalName(payload.name);
      setTypicalCode(payload.code);
      setTypicalDescription(payload.description ?? "");

      const classResponse = await fetch(`${apiBaseUrl}/api/v1/etim/classes/${payload.etim_class_id}`);
      const detail = classResponse.ok
        ? ((await classResponse.json()) as EtimClassDetail)
        : null;
      setClassDetail(detail);

      const nextDefinitions =
        payload.parameter_definitions.length > 0
          ? ensureTemplateDefinitions(
              payload.template_key ?? inferTemplate(detail ?? undefined),
              payload.parameter_definitions.map((definition) =>
                normalizeDefinition(definition, detail),
              ),
            )
          : ensureTemplateDefinitions(
              payload.template_key ?? inferTemplate(detail ?? undefined),
              payload.parameters.map((parameter) => ({
                feature_key: parameter.code.toUpperCase(),
                bundle_id: null,
                code: parameter.code,
                name: parameter.name,
                source: parameter.source,
                input_type: parameter.data_type,
                unit: parameter.unit,
                default_value: parameter.value ?? "",
                allowed_values: [],
                allowed_values_text: "",
                required: parameter.required === 1,
                is_parametrizable: parameter.is_parametrizable === 1,
                drives_interfaces: parameter.drives_interfaces === 1,
                sort_order: parameter.sort_order,
              })),
            );

      const nextGroups =
        payload.interface_groups.length > 0
          ? payload.interface_groups.map(normalizeGroup)
          : defaultInterfaceGroups(payload.template_key ?? inferTemplate(detail ?? undefined));
      const nextMappingRules =
        payload.interface_mapping_rules.length > 0
          ? payload.interface_mapping_rules.map(normalizeMappingRule)
          : defaultInterfaceMappingRules(payload.template_key ?? inferTemplate(detail ?? undefined));

      const sortedDefinitions = nextDefinitions.sort((left, right) => left.sort_order - right.sort_order);
      const nextDerived = deriveInterfacesFromDefinitions(
        payload.template_key ?? inferTemplate(detail ?? undefined),
        sortedDefinitions,
        nextGroups,
        nextMappingRules,
      );
      const savedInterfaces: EditableInterface[] = payload.interfaces
        .slice()
        .sort((left, right) => left.sort_order - right.sort_order || left.code.localeCompare(right.code))
        .map((item, index) => ({
          local_key: item.id || `${item.source}-${index}`,
          group_code: item.group_code,
          code: item.code,
          role: item.role,
          logical_type: item.logical_type,
          direction: item.direction,
          source: item.source === "override" ? "override" : "derived",
          sort_order: item.sort_order,
        }));
      const disabledCodes = nextDerived
        .map((item) => normalizeInterfaceCode(item.code))
        .filter(
          (code) =>
            !savedInterfaces.some(
              (saved) => saved.source === "derived" && normalizeInterfaceCode(saved.code) === code,
            ),
        );

      setDefinitions(sortedDefinitions);
      setInterfaceGroups(nextGroups);
      setInterfaceMappingRules(nextMappingRules);
      setInterfaces(savedInterfaces);
      setDisabledInterfaceCodes(disabledCodes);
      setSavedSnapshot(
        serializeEditorState({
          mode: "edit",
          selectedTypicalId: payload.id,
          selectedClassId: payload.etim_class_id,
          typicalName: payload.name,
          typicalCode: payload.code,
          typicalDescription: payload.description ?? "",
          definitions: sortedDefinitions,
          interfaceGroups: nextGroups,
          interfaceMappingRules: nextMappingRules,
          interfaces: savedInterfaces,
          disabledInterfaceCodes: disabledCodes,
        }),
      );
      await refreshTypicalVersions(payload.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoadingTypical(false);
    }
  }

  function handleNewTypical() {
    if (!confirmDiscardChanges()) {
      return;
    }
    setMode("create");
    setSelectedTypicalId(null);
    setSelectedTypicalStatus("draft");
    setSelectedTypicalVersion(1);
    setTypicalVersions([]);
    setError(null);
    setSuccessMessage(null);
    if (selectedClass && classDetail) {
      const recommended = new Set(recommendedFeatures(selectedClass, classDetail));
      const nextDefinitions = ensureTemplateDefinitions(
        inferTemplate(selectedClass),
        classDetail.features
        .filter((feature) => recommended.has(feature.art_class_feature_nr))
        .map(createDefinitionFromFeature),
      );
      const nextGroups = defaultInterfaceGroups(inferTemplate(selectedClass));
      const nextMappingRules = defaultInterfaceMappingRules(inferTemplate(selectedClass));
      const nextInterfaces = deriveInterfacesFromDefinitions(
        inferTemplate(selectedClass),
        nextDefinitions,
        nextGroups,
        nextMappingRules,
      );
      setTypicalName(selectedClass.description);
      setTypicalCode(`typ-${slugify(selectedClass.description)}-${selectedClass.id.toLowerCase()}`);
      setTypicalDescription(`Typical gebaseerd op ${selectedClass.description}`);
      setDefinitions(nextDefinitions);
      setInterfaceGroups(nextGroups);
      setInterfaceMappingRules(nextMappingRules);
      setInterfaces(nextInterfaces);
      setDisabledInterfaceCodes([]);
      setSavedSnapshot(
        serializeEditorState({
          mode: "create",
          selectedTypicalId: null,
          selectedClassId,
          typicalName: selectedClass.description,
          typicalCode: `typ-${slugify(selectedClass.description)}-${selectedClass.id.toLowerCase()}`,
          typicalDescription: `Typical gebaseerd op ${selectedClass.description}`,
          definitions: nextDefinitions,
          interfaceGroups: nextGroups,
          interfaceMappingRules: nextMappingRules,
          interfaces: nextInterfaces,
          disabledInterfaceCodes: [],
        }),
      );
    } else {
      setTypicalName("");
      setTypicalCode("");
      setTypicalDescription("");
      setDefinitions([]);
      setInterfaceGroups([]);
      setInterfaceMappingRules([]);
      setInterfaces([]);
      setDisabledInterfaceCodes([]);
      setSavedSnapshot(
        serializeEditorState({
          mode: "create",
          selectedTypicalId: null,
          selectedClassId,
          typicalName: "",
          typicalCode: "",
          typicalDescription: "",
          definitions: [],
          interfaceGroups: [],
          interfaceMappingRules: [],
          interfaces: [],
          disabledInterfaceCodes: [],
        }),
      );
    }
  }

  async function handleDeleteTypical(typicalId: string) {
    try {
      setError(null);
      setSuccessMessage(null);
      const response = await fetch(`${apiBaseUrl}/api/v1/typicals/${typicalId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Delete typical failed");
      }

      setTypicals((current) => current.filter((item) => item.id !== typicalId));
      if (selectedTypicalId === typicalId) {
        handleNewTypical();
      }
      setSuccessMessage("Typical verwijderd.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  async function handleReleaseTypical() {
    if (!selectedTypicalId) return;
    setError(null);
    setSuccessMessage(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/typicals/${selectedTypicalId}/release`, {
        method: "POST",
      });
      if (!response.ok) {
        let detail = "Release mislukt";
        try {
          const errorPayload = (await response.json()) as { detail?: string };
          if (errorPayload.detail) detail = errorPayload.detail;
        } catch {
          undefined;
        }
        throw new Error(detail);
      }
      const saved = (await response.json()) as EquipmentTypicalDetail;
      await refreshTypicals(saved.id);
      await handleEditTypical(saved.id, true);
      setSuccessMessage("Typical gereleased.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  async function handleCreateDraftFromReleased() {
    if (!selectedTypicalId) return;
    setError(null);
    setSuccessMessage(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/typicals/${selectedTypicalId}/drafts`, {
        method: "POST",
      });
      if (!response.ok) {
        let detail = "Nieuwe draft maken mislukt";
        try {
          const errorPayload = (await response.json()) as { detail?: string };
          if (errorPayload.detail) detail = errorPayload.detail;
        } catch {
          undefined;
        }
        throw new Error(detail);
      }
      const created = (await response.json()) as EquipmentTypicalDetail;
      await refreshTypicals(created.id);
      await handleEditTypical(created.id, true);
      setSuccessMessage("Nieuwe draft aangemaakt vanuit released typical.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  const parameterRows = useMemo(
    () =>
      definitions
        .slice()
        .sort((left, right) => left.sort_order - right.sort_order)
        .map((definition) => ({
          id: definition.feature_key,
          ...definition,
        })),
    [definitions],
  );

  const localParameterPresets = useMemo(
    () => presets.filter((preset) => preset.source === "typical_local"),
    [presets],
  );

  const presetRows = useMemo(
    () =>
      presets.map((preset) => ({
        id: preset.id,
        preset_name: preset.preset_name,
        code: preset.code,
        source: preset.source,
        input_type: preset.input_type,
        kind: presetKind(preset),
        group_count: preset.interface_groups.length,
        mapping_count: preset.interface_mapping_rules.length,
      })),
    [presets],
  );

  const presetColumns = useMemo<GridColDef[]>(
    () => [
      { field: "preset_name", headerName: "Preset", minWidth: 220, flex: 1.2 },
      { field: "code", headerName: "Code", minWidth: 150, flex: 1 },
      { field: "source", headerName: "Bron", width: 130 },
      { field: "input_type", headerName: "Type", width: 130 },
      { field: "kind", headerName: "Soort", width: 110 },
      { field: "group_count", headerName: "Groepen", width: 90 },
      { field: "mapping_count", headerName: "Mappings", width: 95 },
      {
        field: "actions",
        headerName: "Acties",
        width: 360,
        sortable: false,
        renderCell: (params: GridRenderCellParams) => (
          <div className="grid-actions">
            <button
              className="secondary-button"
              onClick={() => selectPresetForEditing(String(params.row.id))}
              type="button"
            >
              Open
            </button>
            <button
              className="secondary-button"
              onClick={() => handleRepairPreset(String(params.row.id))}
              type="button"
            >
              Herstel
            </button>
            <button
              className="delete-button"
              onClick={() => handleDeletePreset(String(params.row.id))}
              type="button"
            >
              Verwijder
            </button>
          </div>
        ),
      },
    ],
    [presets],
  );

  const parameterColumns = useMemo<GridColDef[]>(
    () => [
      {
        field: "name",
        headerName: "Naam",
        flex: 1.3,
        minWidth: 180,
        renderCell: (params: GridRenderCellParams) => (
          <input
            className="grid-input"
            value={String(params.row.name ?? "")}
            onChange={(event) =>
              updateDefinition(String(params.row.feature_key), { name: event.target.value })
            }
          />
        ),
      },
      {
        field: "code",
        headerName: "Code",
        flex: 1,
        minWidth: 140,
        renderCell: (params: GridRenderCellParams) => (
          <input
            className="grid-input"
            value={String(params.row.code ?? "")}
            onChange={(event) =>
              updateDefinition(String(params.row.feature_key), { code: event.target.value })
            }
          />
        ),
      },
      {
        field: "input_type",
        headerName: "Type",
        width: 150,
        renderCell: (params: GridRenderCellParams) => (
          <select
            className="grid-input"
            value={String(params.row.input_type ?? "enum")}
            onChange={(event) =>
              updateDefinition(String(params.row.feature_key), { input_type: event.target.value })
            }
          >
            <option value="enum">enum</option>
            <option value="boolean">boolean</option>
            <option value="managed_numeric">managed_numeric</option>
            <option value="range">range</option>
            <option value="managed_value">managed_value</option>
          </select>
        ),
      },
      {
        field: "default_value",
        headerName: "Default",
        flex: 1,
        minWidth: 140,
        renderCell: (params: GridRenderCellParams) => {
          const allowedValues = (params.row.allowed_values as string[]) ?? [];
          if (allowedValues.length > 0) {
            return (
              <select
                className="grid-input"
                value={String(params.row.default_value ?? "")}
                onChange={(event) =>
                  updateDefinition(String(params.row.feature_key), {
                    default_value: event.target.value,
                  })
                }
              >
                <option value="">Geen default</option>
                {allowedValues.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            );
          }
          return (
            <input
              className="grid-input"
              value={String(params.row.default_value ?? "")}
              onChange={(event) =>
                updateDefinition(String(params.row.feature_key), {
                  default_value: event.target.value,
                })
              }
            />
          );
        },
      },
      {
        field: "allowed_values_text",
        headerName: "Allowed values",
        flex: 1.6,
        minWidth: 220,
        renderCell: (params: GridRenderCellParams) => (
          <input
            className="grid-input"
            value={String(params.row.allowed_values_text ?? "")}
            onChange={(event) =>
              updateDefinition(String(params.row.feature_key), {
                allowed_values_text: event.target.value,
                allowed_values: event.target.value
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean),
              })
            }
          />
        ),
      },
      {
        field: "required",
        headerName: "Req",
        width: 70,
        sortable: false,
        renderCell: (params: GridRenderCellParams) => (
          <label className="checkbox-cell">
            <input
              type="checkbox"
              checked={Boolean(params.row.required)}
              onChange={(event) =>
                updateDefinition(String(params.row.feature_key), { required: event.target.checked })
              }
            />
          </label>
        ),
      },
      {
        field: "is_parametrizable",
        headerName: "Param",
        width: 80,
        sortable: false,
        renderCell: (params: GridRenderCellParams) => (
          <label className="checkbox-cell">
            <input
              type="checkbox"
              checked={Boolean(params.row.is_parametrizable)}
              onChange={(event) =>
                updateDefinition(String(params.row.feature_key), {
                  is_parametrizable: event.target.checked,
                })
              }
            />
          </label>
        ),
      },
      {
        field: "drives_interfaces",
        headerName: "Driver",
        width: 80,
        sortable: false,
        renderCell: (params: GridRenderCellParams) => (
          <label className="checkbox-cell">
            <input
              type="checkbox"
              checked={Boolean(params.row.drives_interfaces)}
              onChange={(event) =>
                updateDefinition(String(params.row.feature_key), {
                  drives_interfaces: event.target.checked,
                })
              }
            />
          </label>
        ),
      },
      {
        field: "bundle",
        headerName: "Bundel",
        width: 90,
        sortable: false,
        renderCell: (params: GridRenderCellParams) =>
          params.row.bundle_id ? <span>Ja</span> : <span>-</span>,
      },
      {
        field: "preset_actions",
        headerName: "Preset",
        minWidth: 220,
        flex: 0.9,
        sortable: false,
        renderCell: (params: GridRenderCellParams) => {
          const selectedPresetId = presetSelection[String(params.row.feature_key)] ?? "";
          const matchingPresets = presets.filter((preset) => preset.code === params.row.code);
          return (
            <div className="grid-actions grid-actions-stack">
              <select
                className="grid-input"
                value={selectedPresetId}
                onChange={(event) =>
                  setPresetSelection((current) => ({
                    ...current,
                    [String(params.row.feature_key)]: event.target.value,
                  }))
                }
              >
                <option value="">Preset</option>
                {matchingPresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.preset_name}
                  </option>
                ))}
              </select>
              <button
                className="secondary-button"
                disabled={!selectedPresetId}
                onClick={() =>
                  applyPresetToDefinition(String(params.row.feature_key), selectedPresetId)
                }
                type="button"
              >
                Gebruik
              </button>
            </div>
          );
        },
      },
      {
        field: "save_preset",
        headerName: "Opslaan",
        width: 180,
        sortable: false,
        renderCell: (params: GridRenderCellParams) => {
          const selectedPresetId = presetSelection[String(params.row.feature_key)] ?? "";
          const definition = definitions.find(
            (definition) => definition.feature_key === params.row.feature_key,
          )!;
          return (
            <div className="grid-actions grid-actions-stack">
              <button
                className="secondary-button"
                onClick={() => handleSavePreset(definition)}
                type="button"
              >
                Nieuw preset
              </button>
              <button
                className="secondary-button"
                disabled={!selectedPresetId}
                onClick={() => handleUpdatePreset(definition, selectedPresetId)}
                type="button"
              >
                Werk preset bij
              </button>
            </div>
          );
        },
      },
      {
        field: "actions",
        headerName: "Beheer",
        minWidth: 260,
        flex: 0.9,
        sortable: false,
        renderCell: (params: GridRenderCellParams) => {
          const isLocal = params.row.source === "typical_local";
          return (
            <div className="grid-actions">
              {params.row.bundle_id ? (
                <button
                  className="delete-button"
                  onClick={() => removeBundle(String(params.row.bundle_id))}
                  type="button"
                >
                  Verwijder bundel
                </button>
              ) : null}
              {isLocal ? (
                <button
                  className="delete-button"
                  onClick={() => deleteDefinition(String(params.row.feature_key))}
                  type="button"
                >
                  Verwijder parameter
                </button>
              ) : null}
            </div>
          );
        },
      },
    ],
    [definitions, presetSelection, presets],
  );

  const mappingRows = useMemo(
    () =>
      interfaceMappingRules
        .slice()
        .sort(
          (left, right) =>
            left.driver_parameter_code.localeCompare(right.driver_parameter_code) ||
            left.driver_value.localeCompare(right.driver_value) ||
            left.sort_order - right.sort_order,
        )
        .map((rule) => ({
          id: rule.local_key,
          ...rule,
        })),
    [interfaceMappingRules],
  );

  const mappingColumns = useMemo<GridColDef[]>(
    () => [
      {
        field: "driver_parameter_code",
        headerName: "Driver",
        minWidth: 180,
        flex: 1.2,
        renderCell: (params: GridRenderCellParams) => (
          <select
            className="grid-input"
            value={String(params.row.driver_parameter_code ?? "")}
            onChange={(event) =>
              updateInterfaceMappingRule(String(params.row.local_key), {
                driver_parameter_code: event.target.value,
              })
            }
          >
            <option value="">Kies parameter</option>
            {definitions.map((definition) => (
              <option key={definition.feature_key} value={definition.code}>
                {definition.name} ({definition.code})
              </option>
            ))}
          </select>
        ),
      },
      {
        field: "driver_value",
        headerName: "Waarde",
        minWidth: 140,
        flex: 1,
        renderCell: (params: GridRenderCellParams) => {
          const allowedValues = definitionAllowedValues(
            definitions,
            String(params.row.driver_parameter_code ?? ""),
          );
          if (allowedValues.length > 0) {
            return (
              <select
                className="grid-input"
                value={String(params.row.driver_value ?? "")}
                onChange={(event) =>
                  updateInterfaceMappingRule(String(params.row.local_key), {
                    driver_value: event.target.value,
                  })
                }
              >
                <option value="">Kies waarde</option>
                {allowedValues.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            );
          }
          return (
            <input
              className="grid-input"
              value={String(params.row.driver_value ?? "")}
              onChange={(event) =>
                updateInterfaceMappingRule(String(params.row.local_key), {
                  driver_value: event.target.value,
                })
              }
            />
          );
        },
      },
      {
        field: "group_code",
        headerName: "Groep",
        minWidth: 160,
        flex: 1,
        renderCell: (params: GridRenderCellParams) => (
          <select
            className="grid-input"
            value={String(params.row.group_code ?? "")}
            onChange={(event) =>
              updateInterfaceMappingRule(String(params.row.local_key), {
                group_code: event.target.value || null,
              })
            }
          >
            <option value="">Geen groep</option>
            {interfaceGroups.map((group) => (
              <option key={group.local_key} value={group.code}>
                {group.name} ({group.code})
              </option>
            ))}
          </select>
        ),
      },
      {
        field: "interface_code",
        headerName: "Interface",
        minWidth: 140,
        flex: 1,
        renderCell: (params: GridRenderCellParams) => (
          <input
            className="grid-input"
            value={String(params.row.interface_code ?? "")}
            onChange={(event) =>
              updateInterfaceMappingRule(String(params.row.local_key), {
                interface_code: event.target.value,
              })
            }
          />
        ),
      },
      {
        field: "role",
        headerName: "Rol",
        minWidth: 140,
        flex: 1,
        renderCell: (params: GridRenderCellParams) => (
          <input
            className="grid-input"
            value={String(params.row.role ?? "")}
            onChange={(event) =>
              updateInterfaceMappingRule(String(params.row.local_key), {
                role: event.target.value,
              })
            }
          />
        ),
      },
      {
        field: "logical_type",
        headerName: "Type",
        width: 140,
        renderCell: (params: GridRenderCellParams) => (
          <select
            className="grid-input"
            value={String(params.row.logical_type ?? "power")}
            onChange={(event) =>
              updateInterfaceMappingRule(String(params.row.local_key), {
                logical_type: event.target.value,
              })
            }
          >
            <option value="power">power</option>
            <option value="signal">signal</option>
            <option value="data">data</option>
            <option value="protective_earth">protective_earth</option>
          </select>
        ),
      },
      {
        field: "direction",
        headerName: "Richting",
        width: 140,
        renderCell: (params: GridRenderCellParams) => (
          <select
            className="grid-input"
            value={String(params.row.direction ?? "in")}
            onChange={(event) =>
              updateInterfaceMappingRule(String(params.row.local_key), {
                direction: event.target.value,
              })
            }
          >
            <option value="in">in</option>
            <option value="out">out</option>
            <option value="bidirectional">bidirectional</option>
          </select>
        ),
      },
      {
        field: "actions",
        headerName: "Actie",
        width: 120,
        sortable: false,
        renderCell: (params: GridRenderCellParams) => (
          <button
            className="delete-button"
            onClick={() => deleteInterfaceMappingRule(String(params.row.local_key))}
            type="button"
          >
            Verwijder
          </button>
        ),
      },
    ],
    [definitions, interfaceGroups],
  );

  const interfaceRows = useMemo(
    () =>
      interfaces
        .slice()
        .sort(
          (left, right) =>
            left.sort_order - right.sort_order || left.code.localeCompare(right.code),
        )
        .map((item) => ({
          id: item.local_key,
          ...item,
        })),
    [interfaces],
  );

  const interfaceGroupRows = useMemo(
    () =>
      interfaceGroups
        .slice()
        .sort(
          (left, right) =>
            left.sort_order - right.sort_order || left.code.localeCompare(right.code),
        )
        .map((group) => ({
          id: group.local_key,
          ...group,
        })),
    [interfaceGroups],
  );

  const interfaceGroupColumns = useMemo<GridColDef[]>(
    () => [
      {
        field: "code",
        headerName: "Code",
        minWidth: 150,
        flex: 1,
        renderCell: (params: GridRenderCellParams) => (
          <input
            className="grid-input"
            value={String(params.row.code ?? "")}
            onChange={(event) =>
              updateInterfaceGroup(String(params.row.local_key), { code: event.target.value })
            }
          />
        ),
      },
      {
        field: "name",
        headerName: "Naam",
        minWidth: 180,
        flex: 1.2,
        renderCell: (params: GridRenderCellParams) => (
          <input
            className="grid-input"
            value={String(params.row.name ?? "")}
            onChange={(event) =>
              updateInterfaceGroup(String(params.row.local_key), { name: event.target.value })
            }
          />
        ),
      },
      {
        field: "category",
        headerName: "Categorie",
        minWidth: 180,
        flex: 1,
        renderCell: (params: GridRenderCellParams) => (
          <input
            className="grid-input"
            value={String(params.row.category ?? "")}
            onChange={(event) =>
              updateInterfaceGroup(String(params.row.local_key), {
                category: event.target.value,
              })
            }
          />
        ),
      },
      {
        field: "side",
        headerName: "Side",
        minWidth: 150,
        flex: 1,
        renderCell: (params: GridRenderCellParams) => (
          <input
            className="grid-input"
            value={String(params.row.side ?? "")}
            onChange={(event) =>
              updateInterfaceGroup(String(params.row.local_key), { side: event.target.value })
            }
          />
        ),
      },
      {
        field: "source",
        headerName: "Bron",
        width: 120,
      },
      {
        field: "actions",
        headerName: "Actie",
        width: 140,
        sortable: false,
        renderCell: (params: GridRenderCellParams) => (
          <button
            className="delete-button"
            onClick={() => deleteInterfaceGroup(String(params.row.local_key))}
            type="button"
          >
            Verwijder
          </button>
        ),
      },
    ],
    [interfaceGroups, interfaceMappingRules, interfaces, definitions, disabledInterfaceCodes, selectedClass],
  );

  const interfaceColumns = useMemo<GridColDef[]>(
    () => [
      {
        field: "group_code",
        headerName: "Groep",
        minWidth: 180,
        flex: 1,
        renderCell: (params: GridRenderCellParams) => (
          <select
            className="grid-input"
            value={String(params.row.group_code ?? "")}
            onChange={(event) =>
              updateInterface(String(params.row.local_key), {
                group_code: event.target.value || null,
              })
            }
          >
            <option value="">Geen groep</option>
            {interfaceGroups.map((group) => (
              <option key={group.local_key} value={group.code}>
                {group.name} ({group.code})
              </option>
            ))}
          </select>
        ),
      },
      {
        field: "code",
        headerName: "Code",
        minWidth: 150,
        flex: 1,
        renderCell: (params: GridRenderCellParams) => (
          <input
            className="grid-input"
            value={String(params.row.code ?? "")}
            onChange={(event) =>
              updateInterface(String(params.row.local_key), { code: event.target.value })
            }
          />
        ),
      },
      {
        field: "role",
        headerName: "Rol",
        minWidth: 180,
        flex: 1,
        renderCell: (params: GridRenderCellParams) => (
          <input
            className="grid-input"
            value={String(params.row.role ?? "")}
            onChange={(event) =>
              updateInterface(String(params.row.local_key), { role: event.target.value })
            }
          />
        ),
      },
      {
        field: "logical_type",
        headerName: "Type",
        width: 160,
        renderCell: (params: GridRenderCellParams) => (
          <select
            className="grid-input"
            value={String(params.row.logical_type ?? "power")}
            onChange={(event) =>
              updateInterface(String(params.row.local_key), {
                logical_type: event.target.value,
              })
            }
          >
            <option value="power">power</option>
            <option value="signal">signal</option>
            <option value="data">data</option>
            <option value="protective_earth">protective_earth</option>
          </select>
        ),
      },
      {
        field: "direction",
        headerName: "Richting",
        width: 160,
        renderCell: (params: GridRenderCellParams) => (
          <select
            className="grid-input"
            value={String(params.row.direction ?? "in")}
            onChange={(event) =>
              updateInterface(String(params.row.local_key), {
                direction: event.target.value,
              })
            }
          >
            <option value="in">in</option>
            <option value="out">out</option>
            <option value="bidirectional">bidirectional</option>
          </select>
        ),
      },
      {
        field: "source",
        headerName: "Bron",
        width: 120,
      },
      {
        field: "actions",
        headerName: "Actie",
        width: 120,
        sortable: false,
        renderCell: (params: GridRenderCellParams) => (
          <button
            className="delete-button"
            onClick={() => deleteInterface(String(params.row.local_key))}
            type="button"
          >
            Verwijder
          </button>
        ),
      },
    ],
    [interfaceGroups],
  );

  return (
    <main className="app-shell">
      <section className="hero-card">
        <p className="eyebrow">HWEngineering</p>
        <h1>ETIM-driven Equipment Typicals</h1>
        <p className="intro">
          Basisomgeving voor het modelleren van Equipment Typicals, parameters,
          interfaces en validatieregels.
        </p>

        <div className="status-grid">
          <article className="status-card">
            <span className="label">Frontend</span>
            <strong>React + TypeScript</strong>
          </article>
          <article className="status-card">
            <span className="label">Backend</span>
            <strong>{health ? `Online (${health.status})` : "Controleren..."}</strong>
          </article>
          <article className="status-card">
            <span className="label">Environment</span>
            <strong>{health?.environment ?? error ?? "Niet bereikbaar"}</strong>
          </article>
        </div>

        <section className="roadmap-card">
          <h2>Governed parameter definitions</h2>
          <form className="search-row" onSubmit={handleSearch}>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Zoek ETIM classes"
            />
            <button type="submit">Zoek</button>
          </form>

          <div className="split-layout">
            <div>
              <h3>ETIM classes</h3>
              <div className="list-panel">
                {classes.map((item) => (
                  <label className="list-item" key={item.id}>
                    <input
                      checked={selectedClassId === item.id}
                      name="selected-class"
                      onChange={() => {
                        if (!confirmDiscardChanges()) {
                          return;
                        }
                        setSelectedClassId(item.id);
                        setSavedSnapshot("");
                      }}
                      type="radio"
                    />
                    <span>
                      <strong>{item.id}</strong>
                      <small>{item.description}</small>
                    </span>
                  </label>
                ))}
              </div>

              <div className="editor-panel">
                <div className="editor-header">
                  <h3>{mode === "edit" ? "Bewerk typical" : "Nieuwe typical"}</h3>
                  <div className="editor-actions">
                    {mode === "edit" ? (
                      <small className="empty-state">
                        {selectedTypicalStatus} · v{selectedTypicalVersion}
                      </small>
                    ) : null}
                    {isReleasedTypical ? (
                      <button
                        className="secondary-button"
                        onClick={handleCreateDraftFromReleased}
                        type="button"
                      >
                        Nieuwe draft
                      </button>
                    ) : null}
                    {mode === "edit" && !isReleasedTypical ? (
                      <button
                        className="secondary-button"
                        onClick={handleReleaseTypical}
                        type="button"
                      >
                        Release typical
                      </button>
                    ) : null}
                    <button className="secondary-button" onClick={handleNewTypical} type="button">
                      Nieuw
                    </button>
                  </div>
                </div>
                <label className="field">
                  <span>Naam</span>
                  <input
                    disabled={isReleasedTypical}
                    value={typicalName}
                    onChange={(event) => setTypicalName(event.target.value)}
                    placeholder="Naam van de typical"
                  />
                </label>
                <label className="field">
                  <span>Code</span>
                  <input
                    disabled={isReleasedTypical}
                    value={typicalCode}
                    onChange={(event) => setTypicalCode(event.target.value)}
                    placeholder="Interne code"
                  />
                </label>
                <label className="field">
                  <span>Beschrijving</span>
                  <input
                    disabled={isReleasedTypical}
                    value={typicalDescription}
                    onChange={(event) => setTypicalDescription(event.target.value)}
                    placeholder="Beschrijving"
                  />
                </label>
                <p className="helper-text">
                  Template: {inferTemplate(selectedClass) ?? "geen automatische template"}
                </p>
                <p className="helper-text">
                  Geselecteerde parameterdefinities: {definitions.length}
                </p>
                {isDirty ? <p className="dirty-message">Niet-opgeslagen wijzigingen</p> : null}
                {error ? <p className="error-message">{error}</p> : null}
                {successMessage ? <p className="success-message">{successMessage}</p> : null}
                {isReleasedTypical ? (
                  <p className="dirty-message">
                    Deze released typical is readonly. Maak een nieuwe draft om verder te bewerken.
                  </p>
                ) : null}
                <div className="editor-actions">
                <button disabled={!selectedClassId || submitting || isReleasedTypical} onClick={handleSaveTypical} type="button">
                  {submitting
                    ? mode === "edit"
                      ? "Opslaan..."
                      : "Aanmaken..."
                    : mode === "edit"
                      ? "Sla wijzigingen op"
                      : "Maak Equipment Typical"}
                </button>
                <button
                  className="secondary-button"
                  disabled={!selectedClassId || validating}
                  onClick={handleValidateTypical}
                  type="button"
                >
                  {validating ? "Valideren..." : "Valideer"}
                </button>
                </div>
              </div>
            </div>

            <div>
              <h3>ETIM features</h3>
              <div className="list-panel">
                {!classDetail ? (
                  <p className="empty-state">Geen klasse geselecteerd.</p>
                ) : (
                  classDetail.features.map((feature) => {
                    const checked = selectedFeatureKeys.includes(feature.art_class_feature_nr);

                    return (
                      <label className="feature-item" key={feature.art_class_feature_nr}>
                        <input
                          disabled={isReleasedTypical}
                          checked={checked}
                          onChange={() => toggleFeature(feature)}
                          type="checkbox"
                        />
                        <span>
                          <strong>{feature.feature_description ?? feature.feature_id}</strong>
                          <small>
                            {featureInputType(feature)}
                            {feature.unit_description ? ` · ${feature.unit_description}` : ""}
                            {feature.values.length > 0 ? ` · ${feature.values.length} waarden` : ""}
                          </small>
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            <div>
              <h3>Opgeslagen typicals</h3>
              <div className="list-panel">
                {typicals.length === 0 ? (
                  <p className="empty-state">Nog geen typicals opgeslagen.</p>
                ) : (
                  typicals.map((item) => (
                    <article className="typical-card" key={item.id}>
                      <div className="typical-card-body">
                        <strong>{item.name}</strong>
                        <small>{item.code}</small>
                        <small>
                          {item.etim_class_id} · {item.etim_class_description}
                        </small>
                        <small>
                          {item.status} · v{item.version}
                        </small>
                      </div>
                      <div className="typical-actions">
                        <button
                          className="secondary-button"
                          onClick={() => handleEditTypical(item.id)}
                          type="button"
                        >
                          {item.status === "released" ? "Bekijk" : "Bewerk"}
                        </button>
                        <button
                          className="delete-button"
                          disabled={item.status === "released"}
                          onClick={() => handleDeleteTypical(item.id)}
                          type="button"
                        >
                          Verwijder
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className={`governance-panel${isReleasedTypical ? " read-only-panel" : ""}`}>
            <div className="editor-header">
              <h3>Parameter governance</h3>
              <div className="editor-actions">
                {loadingTypical ? <small className="empty-state">Typical laden...</small> : null}
                <button className="secondary-button" onClick={addLocalParameter} type="button">
                  Voeg lokale parameter toe
                </button>
                <select
                  className="grid-input"
                  value={localPresetSelection}
                  onChange={(event) => setLocalPresetSelection(event.target.value)}
                >
                  <option value="">Lokale parameter preset</option>
                  {localParameterPresets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.preset_name} ({preset.code})
                    </option>
                  ))}
                </select>
                <button
                  className="secondary-button"
                  disabled={!localPresetSelection}
                  onClick={() => addLocalParameterFromPreset(localPresetSelection)}
                  type="button"
                >
                  Voeg preset toe
                </button>
              </div>
            </div>
            {definitions.length === 0 ? (
              <p className="empty-state">Selecteer eerst ETIM-features om parameterdefinities op te bouwen.</p>
            ) : (
              <div className="data-grid-shell">
                <DataGrid
                  rows={parameterRows}
                  columns={parameterColumns}
                  disableColumnMenu
                  disableRowSelectionOnClick
                  hideFooter
                  rowHeight={88}
                  columnHeaderHeight={44}
                  density="compact"
                />
              </div>
            )}
            <div className="editor-actions">
              <button disabled={!selectedClassId || submitting} onClick={handleSaveTypical} type="button">
                {submitting
                  ? mode === "edit"
                    ? "Opslaan..."
                    : "Aanmaken..."
                  : mode === "edit"
                    ? "Sla wijzigingen op"
                    : "Maak Equipment Typical"}
              </button>
              <button
                className="secondary-button"
                disabled={!selectedClassId || validating}
                onClick={handleValidateTypical}
                type="button"
              >
                {validating ? "Valideren..." : "Valideer"}
              </button>
            </div>
          </div>

          <div className={`interfaces-panel${isReleasedTypical ? " read-only-panel" : ""}`}>
            <div className="editor-header">
              <h3>Interface mappings</h3>
              <button className="secondary-button" onClick={addInterfaceMappingRule} type="button">
                Voeg mappingregel toe
              </button>
            </div>
            {interfaceMappingRules.length === 0 ? (
              <p className="empty-state">Nog geen mappingregels gedefinieerd.</p>
            ) : (
              <div className="data-grid-shell">
                <DataGrid
                  rows={mappingRows}
                  columns={mappingColumns}
                  disableColumnMenu
                  disableRowSelectionOnClick
                  hideFooter
                  rowHeight={56}
                  columnHeaderHeight={44}
                  density="compact"
                />
              </div>
            )}
          </div>

          <div className="governance-panel">
            <div className="editor-header">
              <h3>Presetbibliotheek</h3>
            </div>
            <div className="data-grid-shell">
              <DataGrid
                rows={presetRows}
                columns={presetColumns}
                disableColumnMenu
                disableRowSelectionOnClick
                hideFooter
                rowHeight={56}
                columnHeaderHeight={44}
                density="compact"
              />
            </div>
            {presetDraft ? (
              <div className="editor-panel">
                <div className="editor-header">
                  <h3>Preset detail</h3>
                  <small className="empty-state">
                    {presetKind(presetDraft)} · {presetDraft.interface_groups.length} groepen ·{" "}
                    {presetDraft.interface_mapping_rules.length} mappings
                  </small>
                </div>
                <div className="definition-grid">
                  <label className="field">
                    <span>Presetnaam</span>
                    <input
                      value={presetDraft.preset_name}
                      onChange={(event) =>
                        setPresetDraft((current) =>
                          current ? { ...current, preset_name: event.target.value } : current,
                        )
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Code</span>
                    <input
                      value={presetDraft.code}
                      onChange={(event) =>
                        setPresetDraft((current) =>
                          current ? { ...current, code: event.target.value } : current,
                        )
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Naam</span>
                    <input
                      value={presetDraft.name}
                      onChange={(event) =>
                        setPresetDraft((current) =>
                          current ? { ...current, name: event.target.value } : current,
                        )
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Type</span>
                    <select
                      value={presetDraft.input_type}
                      onChange={(event) =>
                        setPresetDraft((current) =>
                          current ? { ...current, input_type: event.target.value } : current,
                        )
                      }
                    >
                      <option value="enum">enum</option>
                      <option value="boolean">boolean</option>
                      <option value="managed_numeric">managed_numeric</option>
                      <option value="range">range</option>
                      <option value="managed_value">managed_value</option>
                    </select>
                  </label>
                  <label className="field definition-wide">
                    <span>Beschrijving</span>
                    <input
                      value={presetDraft.description}
                      onChange={(event) =>
                        setPresetDraft((current) =>
                          current ? { ...current, description: event.target.value } : current,
                        )
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Default</span>
                    <input
                      value={presetDraft.default_value}
                      onChange={(event) =>
                        setPresetDraft((current) =>
                          current ? { ...current, default_value: event.target.value } : current,
                        )
                      }
                    />
                  </label>
                  <label className="field definition-wide">
                    <span>Allowed values</span>
                    <input
                      value={presetDraft.allowed_values_text}
                      onChange={(event) =>
                        setPresetDraft((current) =>
                          current
                            ? {
                                ...current,
                                allowed_values_text: event.target.value,
                                allowed_values: event.target.value
                                  .split(",")
                                  .map((item) => item.trim())
                                  .filter(Boolean),
                              }
                            : current,
                        )
                      }
                    />
                  </label>
                </div>
                <div className="toggle-row">
                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      checked={presetDraft.required}
                      onChange={(event) =>
                        setPresetDraft((current) =>
                          current ? { ...current, required: event.target.checked } : current,
                        )
                      }
                    />
                    Required
                  </label>
                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      checked={presetDraft.is_parametrizable}
                      onChange={(event) =>
                        setPresetDraft((current) =>
                          current
                            ? { ...current, is_parametrizable: event.target.checked }
                            : current,
                        )
                      }
                    />
                    Parametriseerbaar
                  </label>
                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      checked={presetDraft.drives_interfaces}
                      onChange={(event) =>
                        setPresetDraft((current) =>
                          current
                            ? { ...current, drives_interfaces: event.target.checked }
                            : current,
                        )
                      }
                    />
                    Stuurt interfaces
                  </label>
                </div>
                <div className="editor-actions">
                  <button onClick={handleSavePresetDraft} type="button">
                    Sla preset op
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => handleRepairPreset(presetDraft.id)}
                    type="button"
                  >
                    Herstel bundle
                  </button>
                  <button
                    className="delete-button"
                    onClick={() => handleDeletePreset(presetDraft.id)}
                    type="button"
                  >
                    Verwijder preset
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className={`interfaces-panel${isReleasedTypical ? " read-only-panel" : ""}`}>
            <div className="editor-header">
              <h3>Interfaces</h3>
              <div className="editor-actions">
                <button
                  className="secondary-button"
                  onClick={addInterfaceGroup}
                  type="button"
                >
                  Voeg groep toe
                </button>
                <button
                  className="secondary-button"
                  onClick={regenerateInterfaces}
                  type="button"
                >
                  Herleid opnieuw
                </button>
                <button
                  className="secondary-button"
                  onClick={addOverrideInterface}
                  type="button"
                >
                  Voeg override toe
                </button>
              </div>
            </div>
            <p className="helper-text">
              Afgeleide interfaces volgen de template en parameterdefinitions. Bij aanpassen wordt een
              afgeleide interface omgezet naar een override.
            </p>
            <div className="data-grid-shell">
              <DataGrid
                rows={interfaceGroupRows}
                columns={interfaceGroupColumns}
                disableColumnMenu
                disableRowSelectionOnClick
                hideFooter
                rowHeight={56}
                columnHeaderHeight={44}
                density="compact"
              />
            </div>
            <div className="data-grid-shell data-grid-shell-wide">
              <DataGrid
                rows={interfaceRows}
                columns={interfaceColumns}
                disableColumnMenu
                disableRowSelectionOnClick
                hideFooter
                rowHeight={58}
                density="compact"
              />
            </div>
            <div className="editor-actions">
              <button disabled={!selectedClassId || submitting || isReleasedTypical} onClick={handleSaveTypical} type="button">
                {submitting
                  ? mode === "edit"
                    ? "Opslaan..."
                    : "Aanmaken..."
                  : mode === "edit"
                    ? "Sla wijzigingen op"
                    : "Maak Equipment Typical"}
              </button>
              <button
                className="secondary-button"
                disabled={!selectedClassId || validating}
                onClick={handleValidateTypical}
                type="button"
              >
                {validating ? "Valideren..." : "Valideer"}
              </button>
            </div>
          </div>

          {mode === "edit" && typicalVersions.length > 0 ? (
            <div className="governance-panel">
              <div className="editor-header">
                <h3>Versies</h3>
              </div>
              <div className="list-panel">
                {typicalVersions.map((item) => (
                  <article className="typical-card" key={item.id}>
                    <div className="typical-card-body">
                      <strong>
                        v{item.version} · {item.status}
                      </strong>
                      <small>{item.code}</small>
                      <small>{item.etim_class_id}</small>
                    </div>
                    <div className="typical-actions">
                      <button
                        className="secondary-button"
                        onClick={() => handleEditTypical(item.id)}
                        type="button"
                      >
                        Open
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          <div className="validation-panel">
            <div className="editor-header">
              <h3>Validatie</h3>
              {validation ? (
                <small className={validation.valid ? "validation-ok" : "validation-bad"}>
                  {validation.valid ? "Geen errors" : "Issues gevonden"}
                </small>
              ) : null}
            </div>
            {!validation ? (
              <p className="empty-state">Nog geen validatie uitgevoerd.</p>
            ) : validation.issues.length === 0 ? (
              <p className="validation-success">Geen validatieproblemen gevonden.</p>
            ) : (
              <div className="validation-list">
                {validation.issues.map((issue, index) => (
                  <article
                    className={issue.severity === "error" ? "validation-item error" : "validation-item warning"}
                    key={`${issue.code}-${index}`}
                  >
                    <strong>{issue.severity === "error" ? "Error" : "Warning"}</strong>
                    <p>{issue.message}</p>
                    {issue.parameter_name || issue.parameter_code ? (
                      <small>
                        {(issue.parameter_name ?? issue.parameter_code) || ""}
                        {issue.parameter_name && issue.parameter_code ? ` · ${issue.parameter_code}` : ""}
                      </small>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </div>

          <ul>
            <li>Equipment Typical bibliotheek</li>
            <li>Governed parameter definitions bovenop ETIM</li>
            <li>Parametergestuurde interface-afleiding</li>
            <li>Draft en released versies</li>
          </ul>
        </section>
      </section>
    </main>
  );
}
