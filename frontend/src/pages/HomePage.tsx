import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { ProductSummary } from "../api/types";

function ChipBadge({ family }: { family: string }) {
  return <span className="chip-badge">{family.toUpperCase()}</span>;
}

function ProductCard({ product }: { product: ProductSummary }) {
  return (
    <Link
      to={`/products/${product.slug}`}
      className="card flex flex-col gap-4 p-6 group cursor-pointer"
      style={{ animationFillMode: "both" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h2
            className="font-display font-700 text-lg leading-tight truncate transition-colors"
            style={{ color: "var(--text-primary)" }}
          >
            {product.name}
          </h2>
          <p className="text-sm mt-1 leading-relaxed line-clamp-2" style={{ color: "var(--text-secondary)" }}>
            {product.tagline}
          </p>
        </div>
        {/* Arrow */}
        <svg
          className="flex-shrink-0 mt-0.5 transition-transform group-hover:translate-x-0.5"
          width="16" height="16" viewBox="0 0 16 16" fill="none"
          style={{ color: "var(--text-muted)" }}
        >
          <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* Chip families */}
      <div className="flex flex-wrap gap-2">
        {product.chip_families.map((cf) => (
          <ChipBadge key={cf} family={cf} />
        ))}
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-between pt-3 mt-auto border-t text-xs"
        style={{ borderColor: "var(--border)", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
      >
        <span>
          {product.latest_version ? (
            <>
              <span style={{ color: "var(--text-secondary)" }}>latest</span>{" "}
              <span style={{ color: "var(--accent)" }}>{product.latest_version}</span>
            </>
          ) : (
            <span style={{ color: "var(--text-muted)" }}>no versions</span>
          )}
        </span>
        <span
          className="btn btn-sm btn-primary"
          style={{ fontSize: "0.75rem", padding: "0.25rem 0.75rem" }}
        >
          Flash
        </span>
      </div>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div className="card p-6 animate-pulse flex flex-col gap-4">
      <div className="h-5 rounded-sm w-3/4" style={{ background: "var(--bg-elevated)" }} />
      <div className="h-3 rounded-sm w-full" style={{ background: "var(--bg-elevated)" }} />
      <div className="h-3 rounded-sm w-2/3" style={{ background: "var(--bg-elevated)" }} />
      <div className="h-6 rounded-sm w-20 mt-2" style={{ background: "var(--bg-elevated)" }} />
    </div>
  );
}

export function HomePage() {
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getProducts()
      .then(setProducts)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      {/* Hero */}
      <section
        className="relative overflow-hidden grid-overlay border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="max-w-2xl animate-fade-in-up">
            <div className="flex items-center gap-2 mb-6">
              <span className="status-dot status-dot-accent animate-pulse-accent" />
              <span
                className="text-xs uppercase tracking-widest"
                style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}
              >
                Browser-based ESP firmware flashing
              </span>
            </div>
            <h1
              className="font-display font-800 text-4xl sm:text-5xl leading-tight mb-4"
              style={{ color: "var(--text-primary)" }}
            >
              Flash your{" "}
              <span style={{ color: "var(--accent)" }}>ESP32</span>
              <br />
              directly from the browser.
            </h1>
            <p
              className="text-lg leading-relaxed"
              style={{ color: "var(--text-secondary)", maxWidth: "48ch" }}
            >
              No local tooling. No drivers. Plug in your device, pick a firmware,
              and flash — all from Chrome or Edge.
            </p>
          </div>
        </div>
        {/* Decorative chip outlines */}
        <div
          className="absolute right-8 top-1/2 -translate-y-1/2 opacity-5 pointer-events-none select-none hidden lg:block"
          aria-hidden
        >
          <svg width="200" height="200" viewBox="0 0 200 200" fill="none">
            <rect x="40" y="40" width="120" height="120" rx="4" stroke="var(--accent)" strokeWidth="2" />
            <rect x="60" y="60" width="80" height="80" rx="2" stroke="var(--accent)" strokeWidth="1" />
            {[60,80,100,120,140].map((y) => (
              <g key={y}>
                <line x1="10" y1={y} x2="40" y2={y} stroke="var(--accent)" strokeWidth="1.5" />
                <line x1="160" y1={y} x2="190" y2={y} stroke="var(--accent)" strokeWidth="1.5" />
              </g>
            ))}
            {[60,80,100,120,140].map((x) => (
              <g key={x}>
                <line x1={x} y1="10" x2={x} y2="40" stroke="var(--accent)" strokeWidth="1.5" />
                <line x1={x} y1="160" x2={x} y2="190" stroke="var(--accent)" strokeWidth="1.5" />
              </g>
            ))}
          </svg>
        </div>
      </section>

      {/* Product grid */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <h2
            className="font-display font-700 text-sm uppercase tracking-widest"
            style={{ color: "var(--text-secondary)" }}
          >
            Available firmware
            {!loading && products.length > 0 && (
              <span
                className="ml-2 font-mono text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                ({products.length})
              </span>
            )}
          </h2>
        </div>

        {error && (
          <div
            className="card p-5 text-sm"
            style={{ background: "var(--red-dim)", borderColor: "var(--red)" }}
          >
            <span style={{ color: "var(--red)" }}>Failed to load catalogue: {error}</span>
          </div>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
            : products.map((p, i) => (
                <div
                  key={p.slug}
                  className="animate-fade-in-up"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <ProductCard product={p} />
                </div>
              ))}

          {!loading && !error && products.length === 0 && (
            <div className="col-span-full py-16 text-center">
              <p style={{ color: "var(--text-muted)" }} className="text-sm">
                No firmware products found. Add a{" "}
                <span className="font-mono text-xs" style={{ color: "var(--accent)" }}>
                  product.yaml
                </span>{" "}
                to the firmware directory.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
