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

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [classes, setClasses] = useState<EtimClassSummary[]>([]);
  const [typicals, setTypicals] = useState<EquipmentTypical[]>([]);
  const [search, setSearch] = useState("circuit breaker");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
    const selectedClass = classes.find((item) => item.id === selectedClassId);
    if (!selectedClass) return;

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/typicals`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: `Automaat ${selectedClass.id}`,
          code: `MCB-${selectedClass.id}-${Date.now()}`,
          description: "Eerste vertical slice typical",
          etim_class_id: selectedClass.id,
          template_key: "multi_pole_switch_device",
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
              <button disabled={!selectedClassId || submitting} onClick={handleCreateTypical} type="button">
                {submitting ? "Aanmaken..." : "Maak automaat typical"}
              </button>
            </div>

            <div>
              <h3>Opgeslagen typicals</h3>
              <div className="list-panel">
                {typicals.length === 0 ? (
                  <p className="empty-state">Nog geen typicals opgeslagen.</p>
                ) : (
                  typicals.map((item) => (
                    <article className="typical-card" key={item.id}>
                      <strong>{item.name}</strong>
                      <small>{item.code}</small>
                      <small>
                        {item.etim_class_id} · {item.status} · v{item.version}
                      </small>
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
