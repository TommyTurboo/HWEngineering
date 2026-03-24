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

type EquipmentTypical = {
  id: string;
  name: string;
  code: string;
  etim_class_id: string;
  etim_class_description: string;
  status: string;
  version: number;
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

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [classes, setClasses] = useState<EtimClassSummary[]>([]);
  const [typicals, setTypicals] = useState<EquipmentTypical[]>([]);
  const [search, setSearch] = useState("circuit breaker");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [typicalName, setTypicalName] = useState("");
  const [typicalCode, setTypicalCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selectedClass = classes.find((item) => item.id === selectedClassId);

  useEffect(() => {
    if (!selectedClass) return;
    setTypicalName(selectedClass.description);
    setTypicalCode(`typ-${slugify(selectedClass.description)}-${selectedClass.id.toLowerCase()}`);
  }, [selectedClassId, classes]);

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
    }
  }

  async function handleCreateTypical() {
    if (!selectedClassId) return;
    if (!selectedClass) return;

    setSubmitting(true);
    setError(null);
    try {
      const templateKey = inferTemplate(selectedClass);
      const response = await fetch(`${apiBaseUrl}/api/v1/typicals`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: typicalName.trim() || selectedClass.description,
          code:
            typicalCode.trim() ||
            `typ-${slugify(selectedClass.description)}-${selectedClass.id.toLowerCase()}`,
          description: `Typical gebaseerd op ${selectedClass.description}`,
          etim_class_id: selectedClass.id,
          template_key: templateKey,
          parameters: [
            {
              code: "number_of_poles",
              name: "Number of poles",
              source: "typical_local",
              data_type: "integer",
              value: "3",
              required: true,
              is_parametrizable: true,
              drives_interfaces: true,
              sort_order: 1,
            },
            {
              code: "rated_current",
              name: "Rated current",
              source: "typical_local",
              data_type: "numeric",
              unit: "A",
              value: "16",
              required: true,
              is_parametrizable: true,
              drives_interfaces: false,
              sort_order: 2,
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error("Create typical failed");
      }

      const created = (await response.json()) as EquipmentTypical;
      const listResponse = await fetch(`${apiBaseUrl}/api/v1/typicals`);
      const listPayload = (await listResponse.json()) as EquipmentTypical[];
      setTypicals(listPayload);
      setSelectedClassId(created.etim_class_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
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
                <h3>Nieuwe typical</h3>
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
                <p className="helper-text">
                  Template: {inferTemplate(selectedClass) ?? "geen automatische template"}
                </p>
                <button disabled={!selectedClassId || submitting} onClick={handleCreateTypical} type="button">
                  {submitting ? "Aanmaken..." : "Maak Equipment Typical"}
                </button>
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
                      <button
                        className="delete-button"
                        onClick={() => handleDeleteTypical(item.id)}
                        type="button"
                      >
                        Verwijder
                      </button>
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
