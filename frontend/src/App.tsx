import { useEffect, useState } from "react";

type HealthResponse = {
  status: string;
  environment: string;
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadHealth() {
      try {
        const response = await fetch(`${apiBaseUrl}/health`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const payload = (await response.json()) as HealthResponse;
        setHealth(payload);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    }

    void loadHealth();
  }, []);

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
          <h2>Eerste bouwblokken</h2>
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

