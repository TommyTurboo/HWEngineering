import { FormEvent, useEffect, useMemo, useState } from "react";
import { Accordion, AccordionDetails, AccordionSummary } from "@mui/material";

const ETIM_SEARCH_STORAGE_KEY = "hwengineering.etim.search";
const ETIM_SELECTED_CLASS_STORAGE_KEY = "hwengineering.etim.selectedClass";
const ETIM_RESULTS_STORAGE_KEY = "hwengineering.etim.results";
const ETIM_DETAIL_STORAGE_KEY = "hwengineering.etim.detail";

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

type EtimClassDetail = {
  id: string;
  description: string;
  version: string | null;
  group_id: string | null;
  features: EtimFeatureDetail[];
};

type EtimSearchResult = {
  id: string;
  description: string;
  version: string | null;
  group_id: string | null;
  group_description: string | null;
  matching_synonyms: string[];
  matching_synonym_count: number;
  total_synonym_count: number;
};

type Props = {
  apiBaseUrl: string;
};

export default function EtimWorkspace({ apiBaseUrl }: Props) {
  const [search, setSearch] = useState(() => window.localStorage.getItem(ETIM_SEARCH_STORAGE_KEY) ?? "");
  const [results, setResults] = useState<EtimSearchResult[]>(() => {
    try {
      const raw = window.localStorage.getItem(ETIM_RESULTS_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as EtimSearchResult[]) : [];
    } catch {
      return [];
    }
  });
  const [selectedClassId, setSelectedClassId] = useState<string | null>(
    () => window.localStorage.getItem(ETIM_SELECTED_CLASS_STORAGE_KEY) ?? null,
  );
  const [selectedDetail, setSelectedDetail] = useState<EtimClassDetail | null>(() => {
    try {
      const raw = window.localStorage.getItem(ETIM_DETAIL_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as EtimClassDetail) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  useEffect(() => {
    const initialSearch = window.localStorage.getItem(ETIM_SEARCH_STORAGE_KEY) ?? "";
    if (!initialSearch.trim()) {
      return;
    }
    if (results.length > 0) {
      return;
    }
    if (selectedDetail && selectedClassId) {
      return;
    }
    if (initialSearch.trim()) {
      void runSearch(initialSearch);
    }
  }, [results.length, selectedClassId, selectedDetail]);

  useEffect(() => {
    window.localStorage.setItem(ETIM_SEARCH_STORAGE_KEY, search);
  }, [search]);

  useEffect(() => {
    window.localStorage.setItem(ETIM_RESULTS_STORAGE_KEY, JSON.stringify(results));
  }, [results]);

  useEffect(() => {
    if (selectedClassId) {
      window.localStorage.setItem(ETIM_SELECTED_CLASS_STORAGE_KEY, selectedClassId);
    } else {
      window.localStorage.removeItem(ETIM_SELECTED_CLASS_STORAGE_KEY);
    }
  }, [selectedClassId]);

  useEffect(() => {
    if (selectedDetail) {
      window.localStorage.setItem(ETIM_DETAIL_STORAGE_KEY, JSON.stringify(selectedDetail));
    } else {
      window.localStorage.removeItem(ETIM_DETAIL_STORAGE_KEY);
    }
  }, [selectedDetail]);

  async function runSearch(term: string) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/etim/search?search=${encodeURIComponent(term)}&limit=30`);
      if (!response.ok) {
        throw new Error("ETIM search failed");
      }
      const payload = (await response.json()) as EtimSearchResult[];
      setResults(payload);
      setExpandedGroups([]);
      if (payload.length > 0) {
        const nextId = selectedClassId && payload.some((item) => item.id === selectedClassId) ? selectedClassId : payload[0].id;
        setSelectedClassId(nextId);
        await openClass(nextId);
      } else {
        setSelectedClassId(null);
        setSelectedDetail(null);
      }
    } catch {
      setError("ETIM search mislukt.");
    } finally {
      setLoading(false);
    }
  }

  async function openClass(classId: string) {
    const response = await fetch(`${apiBaseUrl}/api/v1/etim/classes/${classId}`);
    if (!response.ok) {
      setError("ETIM class detail laden mislukt.");
      return;
    }
    setSelectedClassId(classId);
    setSelectedDetail((await response.json()) as EtimClassDetail);
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runSearch(search);
  }

  const groupedResults = useMemo(() => {
    const groups = new Map<string, EtimSearchResult[]>();
    for (const item of results) {
      const key = item.group_description || "Geen art group";
      const current = groups.get(key) ?? [];
      current.push(item);
      groups.set(key, current);
    }
    return [...groups.entries()];
  }, [results]);

  return (
    <section className="roadmap-card">
      <h2>ETIM Explorer</h2>
      <p className="intro">
        Uitgebreide ETIM-zoekweergave met classinfo, art group en matchende synoniemen.
      </p>
      <form className="search-row" onSubmit={handleSearch}>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Zoek ETIM classes en synoniemen"
        />
        <button type="submit">Zoek</button>
      </form>
      {error ? <p className="error-message">{error}</p> : null}
      <div className="workspace-layout">
        <div className="workspace-sidebar">
          <div className="editor-panel">
            <div className="editor-header">
              <div>
                <h3>Search results</h3>
                <p className="section-caption">
                  {loading ? "Zoeken..." : `${results.length} resultaten in ${groupedResults.length} groups`}
                </p>
              </div>
            </div>
            <div className="etim-results-groups">
              {results.length === 0 ? (
                <p className="empty-state">Geen ETIM-resultaten gevonden.</p>
              ) : (
                groupedResults.map(([groupName, items]) => (
                  <Accordion
                    className="etim-group-accordion"
                    expanded={expandedGroups.includes(groupName)}
                    key={groupName}
                    onChange={(_, expanded) =>
                      setExpandedGroups((current) =>
                        expanded ? [...new Set([...current, groupName])] : current.filter((item) => item !== groupName),
                      )
                    }
                  >
                    <AccordionSummary>
                      <div className="etim-group-summary">
                        <strong>{groupName}</strong>
                        <small>{items.length} matches</small>
                      </div>
                    </AccordionSummary>
                    <AccordionDetails>
                      <div className="list-panel">
                        {items.map((item) => (
                          <article
                            className={`typical-card${selectedClassId === item.id ? " selected-card" : ""}`}
                            key={item.id}
                          >
                            <div className="typical-card-body">
                              <strong>{item.description}</strong>
                              <small>
                                {item.id}
                                {item.version ? ` / ${item.version}` : ""}
                              </small>
                              <small>
                                {item.matching_synonyms.length > 0
                                  ? item.matching_synonyms.join("; ")
                                  : "Geen matchende synoniemen"}
                              </small>
                            </div>
                            <div className="typical-actions">
                              <button
                                className="secondary-button"
                                onClick={() => void openClass(item.id)}
                                type="button"
                              >
                                Open
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    </AccordionDetails>
                  </Accordion>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="workspace-detail">
          <div className="editor-panel">
            <div className="editor-header">
              <div>
                <h3>Class detail</h3>
                <p className="section-caption">
                  {selectedDetail ? `${selectedDetail.id} · ${selectedDetail.description}` : "Geen ETIM class geselecteerd."}
                </p>
              </div>
            </div>
            {!selectedDetail ? (
              <p className="empty-state">Selecteer een ETIM class uit de zoekresultaten.</p>
            ) : (
              <>
                <div className="definition-grid">
                  <div className="editor-panel">
                    <span className="label">Class</span>
                    <strong>{selectedDetail.id}</strong>
                  </div>
                  <div className="editor-panel">
                    <span className="label">Description</span>
                    <strong>{selectedDetail.description}</strong>
                  </div>
                  <div className="editor-panel">
                    <span className="label">Version</span>
                    <strong>{selectedDetail.version ?? "-"}</strong>
                  </div>
                  <div className="editor-panel">
                    <span className="label">Features</span>
                    <strong>{selectedDetail.features.length}</strong>
                  </div>
                </div>
                <div className="editor-panel">
                  <div className="editor-header">
                    <h3>Features</h3>
                  </div>
                  <div className="list-panel">
                    {selectedDetail.features.map((feature) => (
                      <article className="feature-item" key={feature.art_class_feature_nr}>
                        <span>
                          <strong>{feature.feature_description ?? feature.feature_id}</strong>
                          <small>
                            {feature.feature_id}
                            {feature.feature_type ? ` · ${feature.feature_type}` : ""}
                            {feature.unit_description ? ` · ${feature.unit_description}` : ""}
                          </small>
                          {feature.values.length > 0 ? (
                            <small>
                              {feature.values
                                .slice(0, 8)
                                .map((value) => value.value_description ?? value.value_id)
                                .join("; ")}
                              {feature.values.length > 8 ? " ..." : ""}
                            </small>
                          ) : null}
                        </span>
                      </article>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
