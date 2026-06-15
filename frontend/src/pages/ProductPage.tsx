import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { Product } from "../api/types";

function BackLink() {
  return (
    <Link
      to="/"
      className="inline-flex items-center gap-1.5 text-sm transition-colors mb-8"
      style={{ color: "var(--text-secondary)", fontFamily: "var(--font-display)" }}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      All products
    </Link>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3
        className="font-display text-xs uppercase tracking-widest mb-3"
        style={{ color: "var(--text-muted)" }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

export function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    api.getProduct(slug)
      .then(setProduct)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12">
        <BackLink />
        <div className="animate-pulse flex flex-col gap-4">
          <div className="h-8 rounded-sm w-1/2" style={{ background: "var(--bg-elevated)" }} />
          <div className="h-4 rounded-sm w-3/4" style={{ background: "var(--bg-elevated)" }} />
          <div className="h-4 rounded-sm w-2/3" style={{ background: "var(--bg-elevated)" }} />
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12">
        <BackLink />
        <div className="card p-6" style={{ borderColor: "var(--red)" }}>
          <p style={{ color: "var(--red)" }}>{error ?? "Product not found."}</p>
        </div>
      </div>
    );
  }

  const latestVersion = product.versions[0];

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 animate-fade-in">
      <BackLink />

      {/* Header */}
      <div className="mb-10">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {product.chip_families.map((cf) => (
            <span key={cf} className="chip-badge">{cf.toUpperCase()}</span>
          ))}
        </div>
        <h1
          className="font-display font-800 text-3xl sm:text-4xl mb-3"
          style={{ color: "var(--text-primary)" }}
        >
          {product.name}
        </h1>
        <p
          className="text-lg leading-relaxed"
          style={{ color: "var(--text-secondary)", maxWidth: "60ch" }}
        >
          {product.tagline}
        </p>

        {/* CTA */}
        <div className="flex flex-wrap items-center gap-3 mt-6">
          <button
            className="btn btn-primary"
            onClick={() =>
              navigate(`/products/${slug}/flash${latestVersion ? `?version=${latestVersion.version}` : ""}`)
            }
            disabled={!latestVersion}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2v8M5 7l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <rect x="2" y="12" width="12" height="2" rx="1" fill="currentColor" />
            </svg>
            Flash this device
          </button>
          {product.repo && (
            <a
              href={product.repo}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost"
            >
              View on GitHub
            </a>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="lg:col-span-2 flex flex-col gap-8">
          {product.summary && (
            <Section title="About">
              <p
                className="text-sm leading-relaxed whitespace-pre-wrap"
                style={{ color: "var(--text-secondary)" }}
              >
                {product.summary}
              </p>
            </Section>
          )}

          {product.features.length > 0 && (
            <Section title="Features">
              <ul className="flex flex-col gap-2">
                {product.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: "var(--text-secondary)" }}>
                    <span className="mt-1 flex-shrink-0 status-dot status-dot-accent" />
                    {f}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {product.versions.length > 0 && (
            <Section title="Versions">
              <div className="flex flex-col gap-2">
                {product.versions.map((v) => (
                  <Link
                    key={v.version}
                    to={`/products/${slug}/flash?version=${v.version}`}
                    className="card flex items-center justify-between px-4 py-3 group"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="font-mono text-sm"
                        style={{ color: "var(--accent)" }}
                      >
                        {v.version}
                      </span>
                      {v === product.versions[0] && (
                        <span
                          className="text-xs px-1.5 py-0.5 rounded-sm"
                          style={{
                            background: "var(--green-dim)",
                            color: "var(--green)",
                            fontFamily: "var(--font-mono)",
                          }}
                        >
                          latest
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {v.released}
                      </span>
                      <span className="chip-badge">{v.chip_family.toUpperCase()}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-6">
          {product.hardware.length > 0 && (
            <Section title="Hardware">
              <ul className="flex flex-col gap-2">
                {product.hardware.map((h) => (
                  <li
                    key={h}
                    className="text-sm"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {h}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {product.links.setup_guide && (
            <Section title="Resources">
              <a
                href={product.links.setup_guide}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm transition-colors"
                style={{ color: "var(--accent)" }}
              >
                Setup guide
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2.5 9.5l7-7M4 2.5h5.5V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            </Section>
          )}

          <Section title="License">
            <span
              className="text-sm font-mono"
              style={{ color: "var(--text-secondary)" }}
            >
              {product.license}
            </span>
          </Section>
        </div>
      </div>
    </div>
  );
}
