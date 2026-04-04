import { FormEvent, useEffect, useMemo, useState } from "react";

type TypicalListItem = {
  id: string;
  name: string;
  code: string;
  etim_class_id: string;
  etim_class_description: string;
  status: string;
  version: number;
};

type ProjectListItem = {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  status: string;
  instance_count: number;
};

type ProjectInstanceListItem = {
  id: string;
  name: string;
  tag: string;
  description?: string | null;
  typical_name: string;
  typical_code: string;
  typical_version: number;
  etim_class_id: string;
  status: string;
};

type InstanceDetail = ProjectInstanceListItem & {
  parameter_definition_snapshots: {
    id: string;
    parameter_code: string;
    parameter_name: string;
    source: string;
    input_type: string;
    unit?: string | null;
    allowed_values: string[];
    default_value: string | null;
    required: number;
    is_parametrizable?: number;
    drives_interfaces?: number;
    origin: string;
    visibility: string;
    sort_order: number;
  }[];
  parameter_selections: {
    id: string;
    parameter_code: string;
    parameter_name: string;
    input_type: string;
    selected_value: string | null;
    sort_order: number;
  }[];
  interfaces: {
    id: string;
    group_code: string | null;
    code: string;
    role: string;
    logical_type: string;
    direction: string;
  }[];
  interface_mapping_rule_snapshots: {
    id: string;
    driver_parameter_code: string;
    driver_value: string;
    group_code: string | null;
    interface_code: string;
    role: string;
    logical_type: string;
    direction: string;
  }[];
};

type InstanceValidationResult = {
  valid: boolean;
  issues: {
    severity: string;
    code: string;
    message: string;
    parameter_code?: string | null;
    parameter_name?: string | null;
  }[];
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
  feature_type: string | null;
  unit_description: string | null;
  values: EtimFeatureOption[];
};

type EtimClassDetail = {
  id: string;
  description: string;
  features: EtimFeatureDetail[];
};

type Props = {
  apiBaseUrl: string;
};

export default function ProjectWorkspace({ apiBaseUrl }: Props) {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [releasedTypicals, setReleasedTypicals] = useState<TypicalListItem[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [instances, setInstances] = useState<ProjectInstanceListItem[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<InstanceDetail | null>(null);
  const [projectName, setProjectName] = useState("");
  const [projectCode, setProjectCode] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [instanceName, setInstanceName] = useState("");
  const [instanceTag, setInstanceTag] = useState("");
  const [instanceDescription, setInstanceDescription] = useState("");
  const [selectedTypicalId, setSelectedTypicalId] = useState("");
  const [projectParameterName, setProjectParameterName] = useState("");
  const [projectParameterCode, setProjectParameterCode] = useState("");
  const [projectParameterInputType, setProjectParameterInputType] = useState("enum");
  const [projectParameterAllowedValues, setProjectParameterAllowedValues] = useState("");
  const [etimClassDetail, setEtimClassDetail] = useState<EtimClassDetail | null>(null);
  const [selectedEtimFeatureNr, setSelectedEtimFeatureNr] = useState("");
  const [selectedProjectName, setSelectedProjectName] = useState("");
  const [selectedProjectCode, setSelectedProjectCode] = useState("");
  const [selectedProjectDescription, setSelectedProjectDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [validation, setValidation] = useState<InstanceValidationResult | null>(null);

  useEffect(() => {
    void refreshProjects();
    void refreshReleasedTypicals();
  }, []);

  const selectionMap = useMemo(() => {
    const entries = selectedInstance?.parameter_selections ?? [];
    return Object.fromEntries(entries.map((item) => [item.parameter_code, item.selected_value ?? ""]));
  }, [selectedInstance]);
  const selectedProject = useMemo(
    () => projects.find((item) => item.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  async function refreshProjects(selectedId?: string | null) {
    const response = await fetch(`${apiBaseUrl}/api/v1/projects`);
    if (!response.ok) {
      throw new Error("Projecten laden mislukt");
    }
    const payload = (await response.json()) as ProjectListItem[];
    setProjects(payload);
    if (selectedId !== undefined) {
      setSelectedProjectId(selectedId);
    }
  }

  async function refreshReleasedTypicals() {
    const response = await fetch(`${apiBaseUrl}/api/v1/typicals`);
    if (!response.ok) {
      throw new Error("Released typicals laden mislukt");
    }
    const payload = (await response.json()) as TypicalListItem[];
    setReleasedTypicals(payload.filter((item) => item.status === "released"));
  }

  async function refreshInstances(projectId: string, instanceId?: string | null) {
    const response = await fetch(`${apiBaseUrl}/api/v1/projects/${projectId}/instances`);
    if (!response.ok) {
      throw new Error("Instances laden mislukt");
    }
    const payload = (await response.json()) as ProjectInstanceListItem[];
    setInstances(payload);
    if (instanceId) {
      await openInstance(instanceId);
    }
  }

  async function openProject(projectId: string) {
    setError(null);
    setSuccessMessage(null);
    setSelectedProjectId(projectId);
    setSelectedInstance(null);
    const project = projects.find((item) => item.id === projectId) ?? null;
    setSelectedProjectName(project?.name ?? "");
    setSelectedProjectCode(project?.code ?? "");
    setSelectedProjectDescription(project?.description ?? "");
    await refreshInstances(projectId);
  }

  async function openInstance(instanceId: string) {
    const response = await fetch(`${apiBaseUrl}/api/v1/instances/${instanceId}`);
    if (!response.ok) {
      throw new Error("Instance laden mislukt");
    }
    const payload = (await response.json()) as InstanceDetail;
    setSelectedInstance(payload);
    const classResponse = await fetch(`${apiBaseUrl}/api/v1/etim/classes/${payload.etim_class_id}`);
    if (classResponse.ok) {
      setEtimClassDetail((await classResponse.json()) as EtimClassDetail);
    } else {
      setEtimClassDetail(null);
    }
  }

  async function handleCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);
    const response = await fetch(`${apiBaseUrl}/api/v1/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: projectName,
        code: projectCode,
        description: projectDescription || null,
        status: "active",
      }),
    });
    if (!response.ok) {
      const detail = (await response.json().catch(() => null)) as { detail?: string } | null;
      setError(detail?.detail ?? "Project aanmaken mislukt");
      return;
    }
    const created = (await response.json()) as ProjectListItem;
    await refreshProjects(created.id);
    setProjectName("");
    setProjectCode("");
    setProjectDescription("");
    setSuccessMessage("Project aangemaakt.");
    await openProject(created.id);
  }

  async function handleUpdateProject() {
    if (!selectedProjectId) return;
    setError(null);
    setSuccessMessage(null);
    const response = await fetch(`${apiBaseUrl}/api/v1/projects/${selectedProjectId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: selectedProjectName,
        code: selectedProjectCode,
        description: selectedProjectDescription || null,
        status: selectedProject?.status ?? "active",
      }),
    });
    if (!response.ok) {
      const detail = (await response.json().catch(() => null)) as { detail?: string } | null;
      setError(detail?.detail ?? "Project opslaan mislukt");
      return;
    }
    await refreshProjects(selectedProjectId);
    setSuccessMessage("Project opgeslagen.");
  }

  async function handleDeleteProject(projectId: string) {
    const confirmed = window.confirm("Wil je dit project verwijderen?");
    if (!confirmed) return;
    setError(null);
    setSuccessMessage(null);
    const response = await fetch(`${apiBaseUrl}/api/v1/projects/${projectId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const detail = (await response.json().catch(() => null)) as { detail?: string } | null;
      setError(detail?.detail ?? "Project verwijderen mislukt");
      return;
    }
    await refreshProjects();
    if (selectedProjectId === projectId) {
      setSelectedProjectId(null);
      setInstances([]);
      setSelectedInstance(null);
      setSelectedProjectName("");
      setSelectedProjectCode("");
      setSelectedProjectDescription("");
    }
    setSuccessMessage("Project verwijderd.");
  }

  async function handleCreateInstance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProjectId) {
      setError("Selecteer eerst een project.");
      return;
    }
    setError(null);
    setSuccessMessage(null);
    const response = await fetch(`${apiBaseUrl}/api/v1/projects/${selectedProjectId}/instances`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: instanceName,
        tag: instanceTag,
        description: instanceDescription || null,
        released_typical_id: selectedTypicalId,
      }),
    });
    if (!response.ok) {
      const detail = (await response.json().catch(() => null)) as { detail?: string } | null;
      setError(detail?.detail ?? "Instance aanmaken mislukt");
      return;
    }
    const created = (await response.json()) as InstanceDetail;
    await refreshInstances(selectedProjectId, created.id);
    setInstanceName("");
    setInstanceTag("");
    setInstanceDescription("");
    setSelectedTypicalId("");
    setSuccessMessage("Instance aangemaakt vanuit released typical.");
  }

  function updateSelection(parameterCode: string, value: string) {
    setSelectedInstance((current) =>
      current
        ? {
            ...current,
            parameter_selections: current.parameter_selections.map((selection) =>
              selection.parameter_code === parameterCode
                ? { ...selection, selected_value: value }
                : selection,
            ),
          }
        : current,
    );
  }

  function updateDefinitionVisibility(parameterCode: string, visibility: string) {
    setSelectedInstance((current) =>
      current
        ? {
            ...current,
            parameter_definition_snapshots: current.parameter_definition_snapshots.map((definition) =>
              definition.parameter_code === parameterCode ? { ...definition, visibility } : definition,
            ),
          }
        : current,
    );
  }

  function addProjectParameter() {
    if (!projectParameterName.trim() || !projectParameterCode.trim()) {
      setError("Projectparameter naam en code zijn verplicht.");
      return;
    }
    setError(null);
    const allowedValues = projectParameterAllowedValues
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    setSelectedInstance((current) => {
      if (!current) return current;
      if (
        current.parameter_definition_snapshots.some(
          (definition) => definition.parameter_code.toLowerCase() === projectParameterCode.trim().toLowerCase(),
        )
      ) {
        setError("Projectparameter code bestaat al in deze instance.");
        return current;
      }
      const nextSortOrder =
        Math.max(...current.parameter_definition_snapshots.map((definition) => definition.sort_order), 0) + 1;
      return {
        ...current,
        parameter_definition_snapshots: [
          ...current.parameter_definition_snapshots,
          {
            id: `local-${projectParameterCode}-${Date.now()}`,
            parameter_code: projectParameterCode.trim(),
            parameter_name: projectParameterName.trim(),
            source: "project_local",
            input_type: projectParameterInputType,
            unit: null,
            allowed_values: allowedValues,
            default_value: null,
            required: 0,
            is_parametrizable: 1,
            drives_interfaces: 0,
            origin: "instance_added",
            visibility: "active",
            sort_order: nextSortOrder,
          },
        ],
        parameter_selections: [
          ...current.parameter_selections,
          {
            id: `local-selection-${projectParameterCode}-${Date.now()}`,
            parameter_code: projectParameterCode.trim(),
            parameter_name: projectParameterName.trim(),
            source: "project_local",
            input_type: projectParameterInputType,
            selected_value: null,
            sort_order: nextSortOrder,
          },
        ],
      };
    });
    setProjectParameterName("");
    setProjectParameterCode("");
    setProjectParameterInputType("enum");
    setProjectParameterAllowedValues("");
    setSuccessMessage("Projectparameter toegevoegd aan de instance-editor.");
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
    return "managed_value";
  }

  function addEtimProjectParameter() {
    if (!selectedInstance || !etimClassDetail || !selectedEtimFeatureNr) {
      setError("Selecteer eerst een ETIM-feature.");
      return;
    }
    const feature = etimClassDetail.features.find(
      (item) => item.art_class_feature_nr === selectedEtimFeatureNr,
    );
    if (!feature) {
      setError("Geselecteerde ETIM-feature bestaat niet.");
      return;
    }
    const parameterCode = feature.feature_id.toLowerCase();
    const parameterName = feature.feature_description ?? feature.feature_id;
    const allowedValues = feature.values.map(
      (value) => value.value_description ?? value.value_id,
    );
    if (
      selectedInstance.parameter_definition_snapshots.some(
        (definition) => definition.parameter_code.toLowerCase() === parameterCode,
      )
    ) {
      setError("Deze ETIM-feature is al aanwezig in de instance.");
      return;
    }

    const nextSortOrder =
      Math.max(...selectedInstance.parameter_definition_snapshots.map((definition) => definition.sort_order), 0) + 1;

    setSelectedInstance((current) =>
      current
        ? {
            ...current,
            parameter_definition_snapshots: [
              ...current.parameter_definition_snapshots,
              {
                id: `etim-${feature.art_class_feature_nr}-${Date.now()}`,
                parameter_code: parameterCode,
                parameter_name: parameterName,
                source: "etim_feature",
                input_type: featureInputType(feature),
                unit: feature.unit_description ?? null,
                allowed_values: allowedValues,
                default_value: null,
                required: 0,
                is_parametrizable: 1,
                drives_interfaces: 0,
                origin: "project_etim_added",
                visibility: "active",
                sort_order: nextSortOrder,
              },
            ],
            parameter_selections: [
              ...current.parameter_selections,
              {
                id: `etim-selection-${feature.art_class_feature_nr}-${Date.now()}`,
                parameter_code: parameterCode,
                parameter_name: parameterName,
                source: "etim_feature",
                input_type: featureInputType(feature),
                selected_value: null,
                sort_order: nextSortOrder,
              },
            ],
          }
        : current,
    );
    setSelectedEtimFeatureNr("");
    setError(null);
    setSuccessMessage("ETIM-feature toegevoegd aan de instance.");
  }

  async function handleValidateInstance() {
    if (!selectedInstance) return;
    setError(null);
    const response = await fetch(`${apiBaseUrl}/api/v1/instances/${selectedInstance.id}/validate`, {
      method: "POST",
    });
    if (!response.ok) {
      const detail = (await response.json().catch(() => null)) as { detail?: string } | null;
      setError(detail?.detail ?? "Instance validatie mislukt");
      return;
    }
    setValidation((await response.json()) as InstanceValidationResult);
  }

  async function handleSaveInstance() {
    if (!selectedInstance) return;
    setError(null);
    setSuccessMessage(null);
    const response = await fetch(`${apiBaseUrl}/api/v1/instances/${selectedInstance.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: selectedInstance.name,
        tag: selectedInstance.tag,
        description: selectedInstance.description || null,
        parameter_definition_snapshots: selectedInstance.parameter_definition_snapshots.map((definition) => ({
          parameter_code: definition.parameter_code,
          parameter_name: definition.parameter_name,
          source: definition.source,
          input_type: definition.input_type,
          unit: definition.unit || null,
          allowed_values: definition.allowed_values,
          default_value: definition.default_value || null,
          required: definition.required === 1,
          is_parametrizable: definition.is_parametrizable !== 0,
          drives_interfaces: definition.drives_interfaces === 1,
          origin: definition.origin,
          visibility: definition.visibility,
          sort_order: definition.sort_order,
        })),
        parameter_selections: selectedInstance.parameter_selections.map((selection) => ({
          parameter_code: selection.parameter_code,
          selected_value: selection.selected_value || null,
        })),
      }),
    });
    if (!response.ok) {
      const detail = (await response.json().catch(() => null)) as { detail?: string } | null;
      setError(detail?.detail ?? "Instance opslaan mislukt");
      return;
    }
    const saved = (await response.json()) as InstanceDetail;
    setSelectedInstance(saved);
    if (selectedProjectId) {
      await refreshInstances(selectedProjectId);
    }
    setSuccessMessage("Instance opgeslagen.");
    await handleValidateInstance();
  }

  async function handleDeleteInstance(instanceId: string) {
    const confirmed = window.confirm("Wil je deze instance verwijderen?");
    if (!confirmed) return;
    setError(null);
    setSuccessMessage(null);
    const response = await fetch(`${apiBaseUrl}/api/v1/instances/${instanceId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const detail = (await response.json().catch(() => null)) as { detail?: string } | null;
      setError(detail?.detail ?? "Instance verwijderen mislukt");
      return;
    }
    if (selectedProjectId) {
      await refreshInstances(selectedProjectId);
    }
    if (selectedInstance?.id === instanceId) {
      setSelectedInstance(null);
      setValidation(null);
    }
    setSuccessMessage("Instance verwijderd.");
  }

  async function handleDuplicateInstance(instanceId: string) {
    setError(null);
    setSuccessMessage(null);
    const response = await fetch(`${apiBaseUrl}/api/v1/instances/${instanceId}/duplicate`, {
      method: "POST",
    });
    if (!response.ok) {
      const detail = (await response.json().catch(() => null)) as { detail?: string } | null;
      setError(detail?.detail ?? "Instance dupliceren mislukt");
      return;
    }
    const duplicated = (await response.json()) as InstanceDetail;
    if (selectedProjectId) {
      await refreshInstances(selectedProjectId, duplicated.id);
    }
    setSuccessMessage("Instance gedupliceerd.");
  }

  const groupedInterfaces = useMemo(() => {
    if (!selectedInstance) return [];
    const groups = new Map<string, typeof selectedInstance.interfaces>();
    for (const item of selectedInstance.interfaces) {
      const key = item.group_code ?? "zonder_groep";
      const existing = groups.get(key) ?? [];
      existing.push(item);
      groups.set(key, existing);
    }
    return [...groups.entries()];
  }, [selectedInstance]);

  const activeDrivers = useMemo(() => {
    if (!selectedInstance) return [];
    const activeCodes = new Set(
      selectedInstance.parameter_definition_snapshots
        .filter((item) => item.visibility === "active")
        .map((item) => item.parameter_code),
    );
    const selectionByCode = Object.fromEntries(
      selectedInstance.parameter_selections.map((item) => [item.parameter_code, item.selected_value ?? ""]),
    );
    const definitionByCode = Object.fromEntries(
      selectedInstance.parameter_definition_snapshots.map((item) => [item.parameter_code, item.parameter_name]),
    );
    const counts = new Map<string, number>();
    for (const rule of selectedInstance.interface_mapping_rule_snapshots) {
      if (!activeCodes.has(rule.driver_parameter_code)) {
        continue;
      }
      if ((selectionByCode[rule.driver_parameter_code] ?? "") === rule.driver_value) {
        counts.set(rule.driver_parameter_code, (counts.get(rule.driver_parameter_code) ?? 0) + 1);
      }
    }
    return [...counts.entries()].map(([code, count]) => ({
      code,
      name: definitionByCode[code] ?? code,
      count,
      selectedValue: selectionByCode[code] ?? "",
    }));
  }, [selectedInstance]);

  const activeDefinitions = useMemo(
    () =>
      (selectedInstance?.parameter_definition_snapshots ?? [])
        .filter((definition) => definition.visibility === "active" && definition.origin !== "instance_added")
        .sort((left, right) => left.sort_order - right.sort_order),
    [selectedInstance],
  );
  const suppressedDefinitions = useMemo(
    () =>
      (selectedInstance?.parameter_definition_snapshots ?? [])
        .filter((definition) => definition.visibility === "suppressed")
        .sort((left, right) => left.sort_order - right.sort_order),
    [selectedInstance],
  );
  const projectDefinitions = useMemo(
    () =>
      (selectedInstance?.parameter_definition_snapshots ?? [])
        .filter(
          (definition) =>
            (definition.origin === "instance_added" || definition.origin === "project_etim_added") &&
            definition.visibility === "active",
        )
        .sort((left, right) => left.sort_order - right.sort_order),
    [selectedInstance],
  );
  const availableEtimFeatures = useMemo(() => {
    if (!selectedInstance || !etimClassDetail) return [];
    const existingCodes = new Set(
      selectedInstance.parameter_definition_snapshots.map((definition) =>
        definition.parameter_code.toLowerCase(),
      ),
    );
    return etimClassDetail.features.filter(
      (feature) => !existingCodes.has(feature.feature_id.toLowerCase()),
    );
  }, [etimClassDetail, selectedInstance]);

  return (
    <section className="roadmap-card">
      <h2>Projectomgeving</h2>
      <p className="intro">
        Deze laag gebruikt alleen released typicals en laat concrete projectinstances met echte
        parameterkeuzes en afgeleide interfaces toe.
      </p>
      {error ? <p className="error-message">{error}</p> : null}
      {successMessage ? <p className="success-message">{successMessage}</p> : null}

      <div className="split-layout">
        <div className="editor-panel">
          <div className="editor-header">
            <h3>Nieuw project</h3>
          </div>
          <form onSubmit={handleCreateProject}>
            <label className="field">
              <span>Naam</span>
              <input value={projectName} onChange={(event) => setProjectName(event.target.value)} />
            </label>
            <label className="field">
              <span>Code</span>
              <input value={projectCode} onChange={(event) => setProjectCode(event.target.value)} />
            </label>
            <label className="field">
              <span>Beschrijving</span>
              <input
                value={projectDescription}
                onChange={(event) => setProjectDescription(event.target.value)}
              />
            </label>
            <div className="editor-actions">
              <button type="submit">Maak project</button>
            </div>
          </form>
        </div>

        <div className="editor-panel">
          <div className="editor-header">
            <h3>Projecten</h3>
          </div>
          <div className="list-panel">
            {projects.length === 0 ? (
              <p className="empty-state">Nog geen projecten.</p>
            ) : (
              projects.map((project) => (
                <article className="typical-card" key={project.id}>
                  <div className="typical-card-body">
                    <strong>{project.name}</strong>
                    <small>{project.code}</small>
                    <small>{project.status} · {project.instance_count} instances</small>
                  </div>
                  <div className="typical-actions">
                    <button className="secondary-button" onClick={() => void openProject(project.id)} type="button">
                      Open
                    </button>
                    <button
                      className="delete-button"
                      onClick={() => void handleDeleteProject(project.id)}
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

      {selectedProjectId ? (
        <div className="split-layout">
          <div className="editor-panel">
            <div className="editor-header">
              <h3>Project bewerken</h3>
            </div>
            <label className="field">
              <span>Naam</span>
              <input value={selectedProjectName} onChange={(event) => setSelectedProjectName(event.target.value)} />
            </label>
            <label className="field">
              <span>Code</span>
              <input value={selectedProjectCode} onChange={(event) => setSelectedProjectCode(event.target.value)} />
            </label>
            <label className="field">
              <span>Beschrijving</span>
              <input
                value={selectedProjectDescription}
                onChange={(event) => setSelectedProjectDescription(event.target.value)}
              />
            </label>
            <div className="editor-actions">
              <button onClick={() => void handleUpdateProject()} type="button">
                Sla project op
              </button>
            </div>
          </div>

          <div className="editor-panel">
            <div className="editor-header">
              <h3>Nieuwe instance</h3>
            </div>
            <form onSubmit={handleCreateInstance}>
              <label className="field">
                <span>Released typical</span>
                <select value={selectedTypicalId} onChange={(event) => setSelectedTypicalId(event.target.value)}>
                  <option value="">Selecteer released typical</option>
                  {releasedTypicals.map((typical) => (
                    <option key={typical.id} value={typical.id}>
                      {typical.name} · v{typical.version}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Naam</span>
                <input value={instanceName} onChange={(event) => setInstanceName(event.target.value)} />
              </label>
              <label className="field">
                <span>Tag</span>
                <input value={instanceTag} onChange={(event) => setInstanceTag(event.target.value)} />
              </label>
              <label className="field">
                <span>Beschrijving</span>
                <input
                  value={instanceDescription}
                  onChange={(event) => setInstanceDescription(event.target.value)}
                />
              </label>
              <div className="editor-actions">
                <button disabled={!selectedTypicalId} type="submit">
                  Voeg instance toe
                </button>
              </div>
            </form>
          </div>

          <div className="editor-panel">
            <div className="editor-header">
              <h3>Instances</h3>
            </div>
            <div className="list-panel">
              {instances.length === 0 ? (
                <p className="empty-state">Nog geen instances in dit project.</p>
              ) : (
                instances.map((instance) => (
                  <article className="typical-card" key={instance.id}>
                    <div className="typical-card-body">
                      <strong>{instance.name}</strong>
                      <small>{instance.tag}</small>
                      <small>
                        {instance.typical_name} · v{instance.typical_version}
                      </small>
                    </div>
                    <div className="typical-actions">
                      <button
                        className="secondary-button"
                        onClick={() => void openInstance(instance.id)}
                        type="button"
                      >
                        Open
                      </button>
                      <button
                        className="secondary-button"
                        onClick={() => void handleDuplicateInstance(instance.id)}
                        type="button"
                      >
                        Dupliceer
                      </button>
                      <button
                        className="delete-button"
                        onClick={() => void handleDeleteInstance(instance.id)}
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
      ) : null}

      {selectedInstance ? (
        <div className="editor-panel">
          <div className="editor-header">
            <h3>Instance editor</h3>
            <small className="empty-state">
              {selectedInstance.typical_name} · v{selectedInstance.typical_version}
            </small>
          </div>

          <div className="definition-grid">
            <label className="field">
              <span>Naam</span>
              <input
                value={selectedInstance.name}
                onChange={(event) =>
                  setSelectedInstance((current) =>
                    current ? { ...current, name: event.target.value } : current,
                  )
                }
              />
            </label>
            <label className="field">
              <span>Tag</span>
              <input
                value={selectedInstance.tag}
                onChange={(event) =>
                  setSelectedInstance((current) =>
                    current ? { ...current, tag: event.target.value } : current,
                  )
                }
              />
            </label>
          </div>

          <h3>Standaardparameters</h3>
          <div className="definition-grid">
            {activeDefinitions.map((definition) => {
              const currentValue = selectionMap[definition.parameter_code] ?? "";
              const isSelect = definition.allowed_values.length > 0;
              return (
                <div className="editor-panel" key={definition.id}>
                  <label className="field">
                    <span>
                      {definition.parameter_name || definition.parameter_code}
                      {definition.required === 1 ? " *" : ""}
                    </span>
                    <small className="helper-text">{definition.parameter_code}</small>
                    {isSelect ? (
                      <select
                        value={currentValue}
                        onChange={(event) => updateSelection(definition.parameter_code, event.target.value)}
                      >
                        <option value="">Selecteer waarde</option>
                        {definition.allowed_values.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={currentValue}
                        onChange={(event) => updateSelection(definition.parameter_code, event.target.value)}
                      />
                    )}
                  </label>
                  <div className="editor-actions">
                    <button
                      className="secondary-button"
                      onClick={() => updateDefinitionVisibility(definition.parameter_code, "suppressed")}
                      type="button"
                    >
                      Verberg in project
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <h3>Projectparameters</h3>
          <div className="editor-panel">
            <div className="definition-grid">
              <label className="field">
                <span>Voeg ETIM-feature toe</span>
                <select
                  value={selectedEtimFeatureNr}
                  onChange={(event) => setSelectedEtimFeatureNr(event.target.value)}
                >
                  <option value="">Selecteer ETIM-feature</option>
                  {availableEtimFeatures.map((feature) => (
                    <option key={feature.art_class_feature_nr} value={feature.art_class_feature_nr}>
                      {feature.feature_description ?? feature.feature_id}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="editor-actions">
              <button
                className="secondary-button"
                disabled={!selectedEtimFeatureNr}
                onClick={addEtimProjectParameter}
                type="button"
              >
                Voeg ETIM-parameter toe
              </button>
            </div>
          </div>

          <div className="editor-panel">
            <div className="definition-grid">
              <label className="field">
                <span>Naam</span>
                <input
                  value={projectParameterName}
                  onChange={(event) => setProjectParameterName(event.target.value)}
                />
              </label>
              <label className="field">
                <span>Code</span>
                <input
                  value={projectParameterCode}
                  onChange={(event) => setProjectParameterCode(event.target.value)}
                />
              </label>
              <label className="field">
                <span>Type</span>
                <select
                  value={projectParameterInputType}
                  onChange={(event) => setProjectParameterInputType(event.target.value)}
                >
                  <option value="enum">enum</option>
                  <option value="managed_numeric">managed_numeric</option>
                  <option value="boolean">boolean</option>
                  <option value="managed_value">managed_value</option>
                </select>
              </label>
              <label className="field">
                <span>Allowed values</span>
                <input
                  value={projectParameterAllowedValues}
                  onChange={(event) => setProjectParameterAllowedValues(event.target.value)}
                />
              </label>
            </div>
            <div className="editor-actions">
              <button onClick={addProjectParameter} type="button">
                Voeg projectparameter toe
              </button>
            </div>
          </div>

          <div className="definition-grid">
            {projectDefinitions.map((definition) => {
              const currentValue = selectionMap[definition.parameter_code] ?? "";
              const isSelect = definition.allowed_values.length > 0;
              return (
                <div className="editor-panel" key={definition.id}>
                  <label className="field">
                    <span>{definition.parameter_name || definition.parameter_code}</span>
                    <small className="helper-text">
                      {definition.parameter_code} ·{" "}
                      {definition.origin === "project_etim_added"
                        ? "ETIM projectparameter"
                        : "vrije projectparameter"}
                    </small>
                    {isSelect ? (
                      <select
                        value={currentValue}
                        onChange={(event) => updateSelection(definition.parameter_code, event.target.value)}
                      >
                        <option value="">Selecteer waarde</option>
                        {definition.allowed_values.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={currentValue}
                        onChange={(event) => updateSelection(definition.parameter_code, event.target.value)}
                      />
                    )}
                  </label>
                </div>
              );
            })}
          </div>

          <h3>Verborgen parameters</h3>
          <div className="list-panel">
            {suppressedDefinitions.length === 0 ? (
              <p className="empty-state">Geen verborgen parameters.</p>
            ) : (
              suppressedDefinitions.map((definition) => (
                <article className="typical-card" key={definition.id}>
                  <div className="typical-card-body">
                    <strong>{definition.parameter_name}</strong>
                    <small>{definition.parameter_code}</small>
                  </div>
                  <div className="typical-actions">
                    <button
                      className="secondary-button"
                      onClick={() => updateDefinitionVisibility(definition.parameter_code, "active")}
                      type="button"
                    >
                      Herstel
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>

          <h3>Actieve drivers</h3>
          <div className="list-panel">
            {activeDrivers.length === 0 ? (
              <p className="empty-state">Nog geen actieve drivers voor interface-afleiding.</p>
            ) : (
              activeDrivers.map((driver) => (
                <article className="list-item" key={driver.code}>
                  <span>
                    <strong>{driver.name}</strong>
                    <small>
                      {driver.code} · waarde {driver.selectedValue} · {driver.count} interface-regels actief
                    </small>
                  </span>
                </article>
              ))
            )}
          </div>

          <h3>Interfaces</h3>
          <div className="list-panel">
            {groupedInterfaces.length === 0 ? (
              <p className="empty-state">Nog geen afgeleide interfaces voor deze selectie.</p>
            ) : (
              groupedInterfaces.map(([groupCode, items]) => (
                <div className="editor-panel" key={groupCode}>
                  <div className="editor-header">
                    <h3>{groupCode === "zonder_groep" ? "Zonder groep" : groupCode}</h3>
                    <small className="empty-state">{items.length} interfaces</small>
                  </div>
                  <div className="list-panel">
                    {items.map((item) => (
                      <article className="list-item" key={item.id}>
                        <span>
                          <strong>{item.code}</strong>
                          <small>
                            {item.role} · {item.logical_type} · {item.direction}
                          </small>
                        </span>
                      </article>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          <h3>Validatie</h3>
          {!validation ? (
            <p className="empty-state">Nog geen instance-validatie uitgevoerd.</p>
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

          <div className="editor-actions">
            <button onClick={() => void handleSaveInstance()} type="button">
              Sla instance op
            </button>
            <button
              className="secondary-button"
              onClick={() => void handleDuplicateInstance(selectedInstance.id)}
              type="button"
            >
              Dupliceer instance
            </button>
            <button className="secondary-button" onClick={() => void handleValidateInstance()} type="button">
              Valideer instance
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
