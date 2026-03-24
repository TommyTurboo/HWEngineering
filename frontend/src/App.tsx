import { FormEvent, useEffect, useState } from "react";

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

function defaultFeatureValue(feature: EtimFeatureDetail): string | null {
  if (feature.values.length > 0) {
    return feature.values[0].value_description ?? feature.values[0].value_id;
  }
  return null;
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

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [classes, setClasses] = useState<EtimClassSummary[]>([]);
  const [classDetail, setClassDetail] = useState<EtimClassDetail | null>(null);
  const [selectedFeatureIds, setSelectedFeatureIds] = useState<string[]>([]);
  const [typicals, setTypicals] = useState<EquipmentTypical[]>([]);
  const [selectedTypicalId, setSelectedTypicalId] = useState<string | null>(null);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [search, setSearch] = useState("circuit breaker");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [typicalName, setTypicalName] = useState("");
  const [typicalCode, setTypicalCode] = useState("");
  const [typicalDescription, setTypicalDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selectedClass = classes.find((item) => item.id === selectedClassId);

  useEffect(() => {
    if (mode === "edit") return;
    if (!selectedClass) return;
    setTypicalName(selectedClass.description);
    setTypicalCode(`typ-${slugify(selectedClass.description)}-${selectedClass.id.toLowerCase()}`);
    setTypicalDescription(`Typical gebaseerd op ${selectedClass.description}`);
  }, [selectedClassId, classes, mode, selectedClass]);

  useEffect(() => {
    async function loadClassDetail() {
      if (!selectedClassId) {
        setClassDetail(null);
        setSelectedFeatureIds([]);
        return;
      }

      const response = await fetch(`${apiBaseUrl}/api/v1/etim/classes/${selectedClassId}`);
      if (!response.ok) {
        setClassDetail(null);
        setSelectedFeatureIds([]);
        return;
      }

      const payload = (await response.json()) as EtimClassDetail;
      setClassDetail(payload);
      if (mode === "create") {
        setSelectedFeatureIds(recommendedFeatures(selectedClass, payload));
      }
    }

    void loadClassDetail();
  }, [selectedClassId, mode, selectedClass]);

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

        const healthPayload = (await healthResponse.json()) as HealthResponse;
        const classesPayload = (await classesResponse.json()) as EtimClassSummary[];
        const typicalsPayload = (await typicalsResponse.json()) as EquipmentTypical[];

        setHealth(healthPayload);
        setClasses(classesPayload);
        setTypicals(typicalsPayload);
        if (classesPayload.length > 0) {
          setSelectedClassId(classesPayload[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    }

    void loadInitialData();
  }, []);

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

    const selectedFeatures = (classDetail?.features ?? []).filter((feature) =>
      selectedFeatureIds.includes(feature.art_class_feature_nr),
    );

    return {
      name: typicalName.trim() || selectedClass.description,
      code:
        typicalCode.trim() ||
        `typ-${slugify(selectedClass.description)}-${selectedClass.id.toLowerCase()}`,
      description:
        typicalDescription.trim() || `Typical gebaseerd op ${selectedClass.description}`,
      etim_class_id: selectedClass.id,
      template_key: inferTemplate(selectedClass),
      parameters: selectedFeatures.map((feature) => ({
        code: featureCode(feature),
        name: feature.feature_description ?? feature.feature_id,
        source: "etim_feature",
        data_type: featureInputType(feature),
        unit: feature.unit_description,
        value: defaultFeatureValue(feature),
        required: false,
        is_parametrizable: true,
        drives_interfaces:
          (feature.feature_description ?? "").toLowerCase() === "number of poles (total)",
        sort_order: feature.sort_order ?? 0,
      })),
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
          headers: {
            "Content-Type": "application/json",
          },
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
          detail = isEdit ? "Update typical failed" : "Create typical failed";
        }
        throw new Error(detail);
      }

      const saved = (await response.json()) as EquipmentTypicalDetail;
      const listResponse = await fetch(`${apiBaseUrl}/api/v1/typicals`);
      const listPayload = (await listResponse.json()) as EquipmentTypical[];
      setTypicals(listPayload);
      setSelectedTypicalId(saved.id);
      setSelectedClassId(saved.etim_class_id);
      setMode("edit");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  function toggleFeature(featureId: string) {
    setSelectedFeatureIds((current) =>
      current.includes(featureId)
        ? current.filter((item) => item !== featureId)
        : [...current, featureId],
    );
  }

  async function handleEditTypical(typicalId: string) {
    setError(null);
    const response = await fetch(`${apiBaseUrl}/api/v1/typicals/${typicalId}`);
    if (!response.ok) {
      setError("Typical laden mislukt");
      return;
    }

    const payload = (await response.json()) as EquipmentTypicalDetail;
    setSelectedTypicalId(payload.id);
    setMode("edit");
    setSelectedClassId(payload.etim_class_id);
    setTypicalName(payload.name);
    setTypicalCode(payload.code);
    setTypicalDescription(payload.description ?? "");
    setSelectedFeatureIds(payload.parameters.map((parameter) => parameter.code.toUpperCase()));
  }

  function handleNewTypical() {
    setMode("create");
    setSelectedTypicalId(null);
    setError(null);
    if (selectedClass) {
      setTypicalName(selectedClass.description);
      setTypicalCode(`typ-${slugify(selectedClass.description)}-${selectedClass.id.toLowerCase()}`);
      setTypicalDescription(`Typical gebaseerd op ${selectedClass.description}`);
      setSelectedFeatureIds(recommendedFeatures(selectedClass, classDetail));
    } else {
      setTypicalName("");
      setTypicalCode("");
      setTypicalDescription("");
      setSelectedFeatureIds([]);
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
          <h2>Eerste ETIM verticale slice</h2>
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
                    const featureSelectionKey = feature.art_class_feature_nr;
                    const featureSelectionCode = feature.feature_id.toUpperCase();
                    const checked =
                      selectedFeatureIds.includes(featureSelectionKey) ||
                      selectedFeatureIds.includes(featureSelectionCode);

                    return (
                      <label className="feature-item" key={feature.art_class_feature_nr}>
                        <input
                          checked={checked}
                          onChange={() => toggleFeature(featureSelectionKey)}
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

          <ul>
            <li>Equipment Typical bibliotheek</li>
            <li>ETIM feature mapping</li>
            <li>Parametergestuurde interface-afleiding</li>
            <li>Draft en released versies</li>
          </ul>
        </section>
      </section>
    </main>
  );
}
