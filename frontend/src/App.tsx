import { FormEvent, useEffect, useMemo, useState } from "react";

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
  code: string;
  name: string;
  category: string;
  side: string;
  source: "profile" | "custom";
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
  status: string;
  version: number;
};

type EquipmentTypicalDetail = EquipmentTypical & {
  parameter_definitions: {
    id: string;
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
    code: string;
    name: string;
    category: string;
    side: string | null;
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

function normalizeInterfaceCode(code: string): string {
  return code.trim().toUpperCase();
}

function defaultInterfaceGroups(templateKey: string | null): EditableInterfaceGroup[] {
  if (templateKey === "multi_pole_switch_device") {
    return [
      {
        local_key: "group-input-power",
        code: "input_power",
        name: "Input power",
        category: "power_input",
        side: "line",
        source: "profile",
        sort_order: 0,
      },
      {
        local_key: "group-output-power",
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
        code: "input_power",
        name: "Input power",
        category: "power_input",
        side: "primary",
        source: "profile",
        sort_order: 0,
      },
      {
        local_key: "group-output-power",
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
): EditableInterface[] {
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
    code: group.code,
    name: group.name,
    category: group.category,
    side: group.side ?? "",
    source: group.source === "custom" ? "custom" : "profile",
    sort_order: group.sort_order,
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
        name: group.name,
        category: group.category,
        side: group.side,
        source: group.source,
        sort_order: group.sort_order,
      }))
      .sort((left, right) => left.sort_order - right.sort_order || left.code.localeCompare(right.code)),
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
  const [classes, setClasses] = useState<EtimClassSummary[]>([]);
  const [classDetail, setClassDetail] = useState<EtimClassDetail | null>(null);
  const [typicals, setTypicals] = useState<EquipmentTypical[]>([]);
  const [selectedTypicalId, setSelectedTypicalId] = useState<string | null>(null);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [search, setSearch] = useState("circuit breaker");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [typicalName, setTypicalName] = useState("");
  const [typicalCode, setTypicalCode] = useState("");
  const [typicalDescription, setTypicalDescription] = useState("");
  const [definitions, setDefinitions] = useState<GovernedParameterDefinition[]>([]);
  const [interfaceGroups, setInterfaceGroups] = useState<EditableInterfaceGroup[]>([]);
  const [interfaces, setInterfaces] = useState<EditableInterface[]>([]);
  const [disabledInterfaceCodes, setDisabledInterfaceCodes] = useState<string[]>([]);
  const [presets, setPresets] = useState<ParameterDefinitionPreset[]>([]);
  const [presetSelection, setPresetSelection] = useState<Record<string, string>>({});
  const [validation, setValidation] = useState<TypicalValidationResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [loadingTypical, setLoadingTypical] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState("");

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
        interfaces,
        disabledInterfaceCodes,
      }),
    [
      definitions,
      interfaceGroups,
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
        setPresets((await presetsResponse.json()) as ParameterDefinitionPreset[]);
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
        setDefinitions(nextDefinitions);
        setInterfaceGroups(nextGroups);
        setDisabledInterfaceCodes([]);
        setInterfaces(
          deriveInterfacesFromDefinitions(
            inferTemplate(selectedClassSummary),
            nextDefinitions,
            nextGroups,
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

  async function refreshPresets() {
    const response = await fetch(`${apiBaseUrl}/api/v1/presets`);
    if (!response.ok) {
      throw new Error("Presets laden mislukt");
    }
    setPresets((await response.json()) as ParameterDefinitionPreset[]);
  }

  async function handleSavePreset(definition: GovernedParameterDefinition) {
    const presetName = window.prompt(
      `Presetnaam voor ${definition.name}`,
      `${definition.name} preset`,
    );
    if (!presetName || presetName.trim() === "") {
      return;
    }

    setError(null);
    const response = await fetch(`${apiBaseUrl}/api/v1/presets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        preset_name: presetName.trim(),
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
      }),
    });

    if (!response.ok) {
      setError("Preset opslaan mislukt");
      return;
    }

    await refreshPresets();
  }

  function applyPresetToDefinition(featureKey: string, presetId: string) {
    const preset = presets.find((item) => item.id === presetId);
    if (!preset) {
      return;
    }

    updateDefinition(featureKey, {
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
  }

  async function handleDeletePreset(presetId: string) {
    const confirmed = window.confirm("Wil je deze preset verwijderen?");
    if (!confirmed) {
      return;
    }

    setError(null);
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
        sort_order: definition.sort_order,
      })),
      parameters: [],
      interface_groups: interfaceGroups.map((group) => ({
        code: group.code,
        name: group.name,
        category: group.category,
        side: group.side || null,
        source: group.source,
        sort_order: group.sort_order,
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

    const payload = buildPayload();
    if (!payload) return;

    setSubmitting(true);
    setError(null);
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
      setMode("edit");
      await handleEditTypical(saved.id, true);
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
        );
        setInterfaces((existing) => mergeInterfaces(nextDerived, existing, disabledInterfaceCodes));
      }

      return nextDefinitions;
    });
  }

  function regenerateInterfaces() {
    const nextDerived = deriveInterfacesFromDefinitions(
      inferTemplate(selectedClass),
      definitions,
      interfaceGroups,
    );
    setInterfaces((current) => mergeInterfaces(nextDerived, current, disabledInterfaceCodes));
  }

  function addInterfaceGroup() {
    setInterfaceGroups((current) => [
      ...current,
      {
        local_key: createLocalKey(),
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
    setInterfaceGroups((current) =>
      current.map((group) => (group.local_key === localKey ? { ...group, ...patch } : group)),
    );
    if (patch.code !== undefined && currentCode) {
      setInterfaces((current) =>
        current.map((item) =>
          item.group_code === currentCode ? { ...item, group_code: patch.code || null } : item,
        ),
      );
    }
  }

  function deleteInterfaceGroup(localKey: string) {
    const target = interfaceGroups.find((group) => group.local_key === localKey);
    setInterfaceGroups((current) => current.filter((group) => group.local_key !== localKey));
    if (target) {
      setInterfaces((current) =>
        current.map((item) =>
          item.group_code === target.code ? { ...item, group_code: null, source: "override" } : item,
        ),
      );
    }
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

      const sortedDefinitions = nextDefinitions.sort((left, right) => left.sort_order - right.sort_order);
      const nextDerived = deriveInterfacesFromDefinitions(
        payload.template_key ?? inferTemplate(detail ?? undefined),
        sortedDefinitions,
        nextGroups,
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
          interfaces: savedInterfaces,
          disabledInterfaceCodes: disabledCodes,
        }),
      );
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
    setError(null);
    if (selectedClass && classDetail) {
      const recommended = new Set(recommendedFeatures(selectedClass, classDetail));
      const nextDefinitions = ensureTemplateDefinitions(
        inferTemplate(selectedClass),
        classDetail.features
        .filter((feature) => recommended.has(feature.art_class_feature_nr))
        .map(createDefinitionFromFeature),
      );
      const nextGroups = defaultInterfaceGroups(inferTemplate(selectedClass));
      const nextInterfaces = deriveInterfacesFromDefinitions(
        inferTemplate(selectedClass),
        nextDefinitions,
        nextGroups,
      );
      setTypicalName(selectedClass.description);
      setTypicalCode(`typ-${slugify(selectedClass.description)}-${selectedClass.id.toLowerCase()}`);
      setTypicalDescription(`Typical gebaseerd op ${selectedClass.description}`);
      setDefinitions(nextDefinitions);
      setInterfaceGroups(nextGroups);
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
          interfaces: [],
          disabledInterfaceCodes: [],
        }),
      );
    }
  }

  async function handleDeleteTypical(typicalId: string) {
    try {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }

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
                  <button className="secondary-button" onClick={handleNewTypical} type="button">
                    Nieuw
                  </button>
                </div>
                <label className="field">
                  <span>Naam</span>
                  <input
                    value={typicalName}
                    onChange={(event) => setTypicalName(event.target.value)}
                    placeholder="Naam van de typical"
                  />
                </label>
                <label className="field">
                  <span>Code</span>
                  <input
                    value={typicalCode}
                    onChange={(event) => setTypicalCode(event.target.value)}
                    placeholder="Interne code"
                  />
                </label>
                <label className="field">
                  <span>Beschrijving</span>
                  <input
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
                          Bewerk
                        </button>
                        <button
                          className="delete-button"
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

          <div className="governance-panel">
            <div className="editor-header">
              <h3>Parameter governance</h3>
              {loadingTypical ? <small className="empty-state">Typical laden...</small> : null}
            </div>
            {definitions.length === 0 ? (
              <p className="empty-state">Selecteer eerst ETIM-features om parameterdefinities op te bouwen.</p>
            ) : (
              <div className="definition-list">
                {definitions
                  .slice()
                  .sort((left, right) => left.sort_order - right.sort_order)
                  .map((definition) => {
                    const matchingPresets = presets.filter((preset) => preset.code === definition.code);
                    const selectedPresetId = presetSelection[definition.feature_key] ?? "";

                    return (
                    <article className="definition-card" key={definition.feature_key}>
                      <div className="definition-head">
                        <strong>{definition.name}</strong>
                        <small>{definition.code}</small>
                      </div>

                      <div className="definition-grid">
                        <label className="field">
                          <span>Inputtype</span>
                          <select
                            value={definition.input_type}
                            onChange={(event) =>
                              updateDefinition(definition.feature_key, {
                                input_type: event.target.value,
                              })
                            }
                          >
                            <option value="enum">enum</option>
                            <option value="boolean">boolean</option>
                            <option value="managed_numeric">managed_numeric</option>
                            <option value="range">range</option>
                            <option value="managed_value">managed_value</option>
                          </select>
                        </label>

                        <label className="field">
                          <span>Default</span>
                          {definition.allowed_values.length > 0 ? (
                            <select
                              value={definition.default_value}
                              onChange={(event) =>
                                updateDefinition(definition.feature_key, {
                                  default_value: event.target.value,
                                })
                              }
                            >
                              <option value="">Geen default</option>
                              {definition.allowed_values.map((value) => (
                                <option key={value} value={value}>
                                  {value}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              value={definition.default_value}
                              onChange={(event) =>
                                updateDefinition(definition.feature_key, {
                                  default_value: event.target.value,
                                })
                              }
                              placeholder="Defaultwaarde"
                            />
                          )}
                        </label>

                        <label className="field definition-wide">
                          <span>Allowed values (komma-gescheiden)</span>
                            <input
                            value={definition.allowed_values_text}
                            onChange={(event) =>
                              updateDefinition(definition.feature_key, {
                                allowed_values_text: event.target.value,
                                allowed_values: event.target.value
                                  .split(",")
                                  .map((item) => item.trim())
                                  .filter(Boolean),
                              })
                            }
                            placeholder="Bijv. B, C, D of 1, 2, 3, 4"
                          />
                        </label>
                      </div>

                      <div className="toggle-row">
                        <label className="checkbox-field">
                          <input
                            checked={definition.required}
                            onChange={(event) =>
                              updateDefinition(definition.feature_key, {
                                required: event.target.checked,
                              })
                            }
                            type="checkbox"
                          />
                          <span>Required</span>
                        </label>
                        <label className="checkbox-field">
                          <input
                            checked={definition.is_parametrizable}
                            onChange={(event) =>
                              updateDefinition(definition.feature_key, {
                                is_parametrizable: event.target.checked,
                              })
                            }
                            type="checkbox"
                          />
                          <span>Parametriseerbaar</span>
                        </label>
                        <label className="checkbox-field">
                          <input
                            checked={definition.drives_interfaces}
                            onChange={(event) =>
                              updateDefinition(definition.feature_key, {
                                drives_interfaces: event.target.checked,
                              })
                            }
                            type="checkbox"
                          />
                          <span>Stuurt interfaces</span>
                        </label>
                      </div>

                      <div className="preset-row">
                        <label className="field preset-select">
                          <span>Preset</span>
                          <select
                            value={selectedPresetId}
                            onChange={(event) =>
                              setPresetSelection((current) => ({
                                ...current,
                                [definition.feature_key]: event.target.value,
                              }))
                            }
                          >
                            <option value="">Geen preset geselecteerd</option>
                            {matchingPresets.map((preset) => (
                              <option key={preset.id} value={preset.id}>
                                {preset.preset_name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          className="secondary-button"
                          disabled={!selectedPresetId}
                          onClick={() => applyPresetToDefinition(definition.feature_key, selectedPresetId)}
                          type="button"
                        >
                          Pas preset toe
                        </button>
                        <button
                          className="secondary-button"
                          onClick={() => handleSavePreset(definition)}
                          type="button"
                        >
                          Sla op als preset
                        </button>
                        <button
                          className="delete-button"
                          disabled={!selectedPresetId}
                          onClick={() => handleDeletePreset(selectedPresetId)}
                          type="button"
                        >
                          Verwijder preset
                        </button>
                      </div>
                    </article>
                  )})}
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

          <div className="interfaces-panel">
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
            <div className="group-list">
              {interfaceGroups.length === 0 ? (
                <p className="empty-state">Nog geen interfacegroepen gedefinieerd.</p>
              ) : (
                interfaceGroups
                  .slice()
                  .sort((left, right) => left.sort_order - right.sort_order || left.code.localeCompare(right.code))
                  .map((group) => (
                    <article className="group-card" key={group.local_key}>
                      <div className="definition-head">
                        <strong>{group.name}</strong>
                        <small>{group.code}</small>
                      </div>
                      <div className="definition-grid">
                        <label className="field">
                          <span>Code</span>
                          <input
                            value={group.code}
                            onChange={(event) =>
                              updateInterfaceGroup(group.local_key, { code: event.target.value })
                            }
                          />
                        </label>
                        <label className="field">
                          <span>Naam</span>
                          <input
                            value={group.name}
                            onChange={(event) =>
                              updateInterfaceGroup(group.local_key, { name: event.target.value })
                            }
                          />
                        </label>
                        <label className="field">
                          <span>Categorie</span>
                          <input
                            value={group.category}
                            onChange={(event) =>
                              updateInterfaceGroup(group.local_key, { category: event.target.value })
                            }
                          />
                        </label>
                        <label className="field">
                          <span>Side</span>
                          <input
                            value={group.side}
                            onChange={(event) =>
                              updateInterfaceGroup(group.local_key, { side: event.target.value })
                            }
                          />
                        </label>
                      </div>
                      <div className="preset-row">
                        <span className="helper-text">Bron: {group.source}</span>
                        <button
                          className="delete-button"
                          onClick={() => deleteInterfaceGroup(group.local_key)}
                          type="button"
                        >
                          Verwijder groep
                        </button>
                      </div>
                    </article>
                  ))
              )}
            </div>
            {interfaces.length === 0 ? (
              <p className="empty-state">Nog geen interfaces beschikbaar.</p>
            ) : (
              <div className="interface-list">
                {interfaces.map((item) => (
                  <article className="interface-card" key={item.local_key}>
                    <div className="definition-head">
                      <strong>{item.code || "Nieuwe interface"}</strong>
                      <small>{item.source === "override" ? "override" : "derived"}</small>
                    </div>
                    <div className="definition-grid">
                      <label className="field">
                        <span>Groep</span>
                        <select
                          value={item.group_code ?? ""}
                          onChange={(event) =>
                            updateInterface(item.local_key, { group_code: event.target.value || null })
                          }
                        >
                          <option value="">Geen groep</option>
                          {interfaceGroups.map((group) => (
                            <option key={group.local_key} value={group.code}>
                              {group.name} ({group.code})
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        <span>Code</span>
                        <input
                          value={item.code}
                          onChange={(event) =>
                            updateInterface(item.local_key, { code: event.target.value })
                          }
                          placeholder="Bijv. L1_IN"
                        />
                      </label>
                      <label className="field">
                        <span>Rol</span>
                        <input
                          value={item.role}
                          onChange={(event) =>
                            updateInterface(item.local_key, { role: event.target.value })
                          }
                          placeholder="Bijv. line_in"
                        />
                      </label>
                      <label className="field">
                        <span>Type</span>
                        <select
                          value={item.logical_type}
                          onChange={(event) =>
                            updateInterface(item.local_key, { logical_type: event.target.value })
                          }
                        >
                          <option value="power">power</option>
                          <option value="signal">signal</option>
                          <option value="data">data</option>
                          <option value="protective_earth">protective_earth</option>
                        </select>
                      </label>
                      <label className="field">
                        <span>Richting</span>
                        <select
                          value={item.direction}
                          onChange={(event) =>
                            updateInterface(item.local_key, { direction: event.target.value })
                          }
                        >
                          <option value="in">in</option>
                          <option value="out">out</option>
                          <option value="bidirectional">bidirectional</option>
                        </select>
                      </label>
                    </div>
                    <div className="preset-row">
                      <span className="helper-text">Bron: {item.source}</span>
                      <button
                        className="delete-button"
                        onClick={() => deleteInterface(item.local_key)}
                        type="button"
                      >
                        Verwijder
                      </button>
                    </div>
                  </article>
                ))}
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
