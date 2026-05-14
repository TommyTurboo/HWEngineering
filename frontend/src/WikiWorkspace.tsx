import { ComponentProps, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type WikiDoc = {
  id: string;
  title: string;
  path: string;
  description: string;
};

const wikiDocs: WikiDoc[] = [
  {
    id: "index",
    title: "Start Here",
    path: "/wiki/index.md",
    description: "Korte onboarding en navigatie door de omgeving.",
  },
  {
    id: "what-is-etim",
    title: "What Is ETIM?",
    path: "/wiki/what-is-etim.md",
    description: "Technische uitleg over ETIM en hoe het in de app gebruikt wordt.",
  },
  {
    id: "library-vs-projects",
    title: "Library vs Projects",
    path: "/wiki/library-vs-projects.md",
    description: "Verschil tussen baseline library objects en projectinstances.",
  },
  {
    id: "process-hw-diagram",
    title: "Process HW Diagram",
    path: "/wiki/process-hw-diagram.md",
    description: "Vectorweergave van een Excalidraw-afgeleid procesdiagram.",
  },
];

export default function WikiWorkspace() {
  const [selectedDocId, setSelectedDocId] = useState<string>(() => window.localStorage.getItem("hwengineering.wiki.selected") ?? "index");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedDoc = useMemo(
    () => wikiDocs.find((item) => item.id === selectedDocId) ?? wikiDocs[0],
    [selectedDocId],
  );

  useEffect(() => {
    window.localStorage.setItem("hwengineering.wiki.selected", selectedDoc.id);
  }, [selectedDoc.id]);

  useEffect(() => {
    let cancelled = false;

    async function loadDoc() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(selectedDoc.path);
        if (!response.ok) {
          throw new Error("Wiki document laden mislukt");
        }
        const text = await response.text();
        if (!cancelled) {
          setContent(text);
        }
      } catch {
        if (!cancelled) {
          setError("Wiki document laden mislukt.");
          setContent("");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadDoc();
    return () => {
      cancelled = true;
    };
  }, [selectedDoc]);

  function resolveWikiLink(href?: string) {
    if (!href) return selectedDoc.path;
    if (href.startsWith("http://") || href.startsWith("https://")) {
      return href;
    }
    if (href.endsWith(".md")) {
      return href.startsWith("/") ? href : `/wiki/${href.replace(/^\.?\//, "")}`;
    }
    return href;
  }

  return (
    <section className="roadmap-card">
      <h2>Wiki</h2>
      <p className="intro">
        Ingebouwde documentatie op basis van markdownbestanden, bedoeld als onboarding en referentie voor gebruikers.
      </p>
      <div className="workspace-layout">
        <div className="workspace-sidebar">
          <div className="editor-panel">
            <div className="editor-header">
              <div>
                <h3>Documents</h3>
                <p className="section-caption">Kies een onderwerp uit de ingebouwde wiki.</p>
              </div>
            </div>
            <div className="list-panel">
              {wikiDocs.map((doc) => (
                <article
                  className={`typical-card${selectedDoc.id === doc.id ? " selected-card" : ""}`}
                  key={doc.id}
                >
                  <div className="typical-card-body">
                    <strong>{doc.title}</strong>
                    <small>{doc.description}</small>
                  </div>
                  <div className="typical-actions">
                    <button
                      className="secondary-button"
                      onClick={() => setSelectedDocId(doc.id)}
                      type="button"
                    >
                      Open
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>

        <div className="workspace-detail">
          <div className="editor-panel wiki-panel">
            <div className="editor-header">
              <div>
                <h3>{selectedDoc.title}</h3>
                <p className="section-caption">{selectedDoc.description}</p>
              </div>
            </div>
            {loading ? <p className="empty-state">Wiki document laden...</p> : null}
            {error ? <p className="error-message">{error}</p> : null}
            {!loading && !error ? (
              <div className="wiki-content">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    a: ({ href, children }: ComponentProps<"a">) => {
                      const resolved = resolveWikiLink(href);
                      if (resolved.endsWith(".md")) {
                        const target = wikiDocs.find((doc) => doc.path === resolved);
                        return (
                          <button
                            className="wiki-link-button"
                            onClick={() => target && setSelectedDocId(target.id)}
                            type="button"
                          >
                            {children}
                          </button>
                        );
                      }
                      return (
                        <a href={resolved} rel="noreferrer" target="_blank">
                          {children}
                        </a>
                      );
                    },
                    img: ({ src, alt }: ComponentProps<"img">) => (
                      typeof src === "string" && src.toLowerCase().endsWith(".svg") ? (
                        <div className="wiki-figure">
                          <div className="wiki-figure-actions">
                            <a className="secondary-button wiki-open-button" href={src} rel="noreferrer" target="_blank">
                              Open full size
                            </a>
                          </div>
                          <object
                            aria-label={alt ?? "SVG diagram"}
                            className="wiki-svg-object"
                            data={src}
                            type="image/svg+xml"
                          >
                            <img alt={alt ?? ""} className="wiki-image" src={src} />
                          </object>
                        </div>
                      ) : (
                        <img alt={alt ?? ""} className="wiki-image" src={src} />
                      )
                    ),
                  }}
                >
                  {content}
                </ReactMarkdown>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
