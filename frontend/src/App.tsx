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
  required: boolean;
  is_parametrizable: boolean;
  drives_interfaces: boolean;
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
    code: string;
    role: string;
    logical_type: string;
    direction: string;
    source: string;
    sort_order: number;
  }[];
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

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
    required: false,
    is_parametrizable: true,
    drives_interfaces: name.toLowerCase() === "number of poles (total)",
    sort_order: feature.sort_order ?? 0,
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
    required: definition.required === 1,
    is_parametrizable: definition.is_parametrizable === 1,
    drives_interfaces: definition.drives_interfaces === 1,
    sort_order: definition.sort_order,
  };
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
  const [submitting, setSubmitting] = useState(false);
  const [loadingTypical, setLoadingTypical] = useState(false);

  const selectedClass = classes.find((item) => item.id === selectedClassId);
  const selectedFeatureKeys = useMemo(
    () => definitions.map((definition) => definition.feature_key),
    [definitions],
  );

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [healthResponse, classesResponse, typicalsResponse] = await Promise.all([
          fetch(`${apiBaseUrl}/health`),
          fetch(
            `${apiBaseUrl}/api/v1/etim/classes?search=${encodeURIComponent(
              "circuit breaker",
            )}&limit=8`,
          ),
          fetch(`${apiBaseUrl}/api/v1/typicals`),
        ]);

        if (!healthResponse.ok || !classesResponse.ok || !typicalsResponse.ok) {
          throw new Error("API bootstrap failed");
        }

        setHealth((await healthResponse.json()) as HealthResponse);
        const classesPayload = (await classesResponse.json()) as EtimClassSummary[];
        setClasses(classesPayload);
        setTypicals((await typicalsResponse.json()) as EquipmentTypical[]);
        if (classesPayload.length > 0) {
          setSelectedClassId(classesPayload[0].id);
        }
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
        }
        return;
      }

      const response = await fetch(`${apiBaseUrl}/api/v1/etim/classes/${selectedClassId}`);
      if (!response.ok) {
        setClassDetail(null);
        if (mode === "create") {
          setDefinitions([]);
        }
        return;
      }

      const payload = (await response.json()) as EtimClassDetail;
      setClassDetail(payload);

      if (mode === "create") {
        const recommended = new Set(recommendedFeatures(selectedClass, payload));
        setDefinitions(
          payload.features
            .filter((feature) => recommended.has(feature.art_class_feature_nr))
            .map(createDefinitionFromFeature),
        );
      }
    }

    void loadClassDetail();
  }, [selectedClassId, mode, selectedClass]);

  useEffect(() => {
    if (mode === "edit") return;
    if (!selectedClass) return;
    setTypicalName(selectedClass.description);
    setTypicalCode(`typ-${slugify(selectedClass.description)}-${selectedClass.id.toLowerCase()}`);
    setTypicalDescription(`Typical gebaseerd op ${selectedClass.description}`);
  }, [selectedClass, mode]);

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

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
    };
  }

  async function handleSaveTypical() {
    if (!selectedClassId || !selectedClass) return;

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
      await handleEditTypical(saved.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
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

  function updateDefinition(
    featureKey: string,
    patch: Partial<GovernedParameterDefinition>,
  ) {
    setDefinitions((current) =>
      current.map((definition) =>
        definition.feature_key === featureKey ? { ...definition, ...patch } : definition,
      ),
    );
  }

  async function handleEditTypical(typicalId: string) {
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
          ? payload.parameter_definitions.map((definition) =>
              normalizeDefinition(definition, detail),
            )
          : payload.parameters.map((parameter) => ({
              feature_key: parameter.code.toUpperCase(),
              code: parameter.code,
              name: parameter.name,
              source: parameter.source,
              input_type: parameter.data_type,
              unit: parameter.unit,
              default_value: parameter.value ?? "",
              allowed_values: [],
              required: parameter.required === 1,
              is_parametrizable: parameter.is_parametrizable === 1,
              drives_interfaces: parameter.drives_interfaces === 1,
              sort_order: parameter.sort_order,
            }));

      setDefinitions(nextDefinitions.sort((left, right) => left.sort_order - right.sort_order));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoadingTypical(false);
    }
  }

  function handleNewTypical() {
    setMode("create");
    setSelectedTypicalId(null);
    setError(null);
    if (selectedClass && classDetail) {
      setTypicalName(selectedClass.description);
      setTypicalCode(`typ-${slugify(selectedClass.description)}-${selectedClass.id.toLowerCase()}`);
      setTypicalDescription(`Typical gebaseerd op ${selectedClass.description}`);
      const recommended = new Set(recommendedFeatures(selectedClass, classDetail));
      setDefinitions(
        classDetail.features
          .filter((feature) => recommended.has(feature.art_class_feature_nr))
          .map(createDefinitionFromFeature),
      );
    } else {
      setTypicalName("");
      setTypicalCode("");
      setTypicalDescription("");
      setDefinitions([]);
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
                      onChange={() => setSelectedClassId(item.id)}
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
                {error ? <p className="error-message">{error}</p> : null}
                <button disabled={!selectedClassId || submitting} onClick={handleSaveTypical} type="button">
                  {submitting
                    ? mode === "edit"
                      ? "Opslaan..."
                      : "Aanmaken..."
                    : mode === "edit"
                      ? "Sla wijzigingen op"
                      : "Maak Equipment Typical"}
                </button>
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
                  .map((definition) => (
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
                            value={definition.allowed_values.join(", ")}
                            onChange={(event) =>
                              updateDefinition(definition.feature_key, {
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
