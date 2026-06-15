import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { ProductSummary } from "../api/types";

// ---------------------------------------------------------------------------
// Decorative chip SVG — shown when a product has no hero image
// ---------------------------------------------------------------------------

function ChipArt({ chipFamily }: { chipFamily: string }) {
  const label = chipFamily.toUpperCase().replace("ESP", "ESP\n");
  return (
    <svg
      viewBox="0 0 160 100"
      fill="none"
      className="w-full h-full"
      aria-hidden
    >
      {/* Grid background */}
      <defs>
        <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M 10 0 L 0 0 0 10" fill="none" stroke="var(--accent)" strokeWidth="0.2" strokeOpacity="0.15" />
        </pattern>
      </defs>
      <rect width="160" height="100" fill="url(#grid)" />

      {/* IC body */}
      <rect x="44" y="18" width="72" height="64" rx="3" fill="var(--bg-elevated)" stroke="var(--accent)" strokeWidth="1" />
      <rect x="50" y="24" width="60" height="52" rx="1" fill="var(--bg-base)" stroke="var(--accent-dim)" strokeWidth="0.5" />

      {/* Left pins */}
      {[30, 40, 50, 60, 70].map((y) => (
        <g key={`l${y}`}>
          <line x1="30" y1={y} x2="44" y2={y} stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
          <rect x="18" y={y - 3} width="12" height="6" rx="1" fill="var(--bg-surface)" stroke="var(--accent-dim)" strokeWidth="0.5" />
        </g>
      ))}

      {/* Right pins */}
      {[30, 40, 50, 60, 70].map((y) => (
        <g key={`r${y}`}>
          <line x1="116" y1={y} x2="130" y2={y} stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
          <rect x="130" y={y - 3} width="12" height="6" rx="1" fill="var(--bg-surface)" stroke="var(--accent-dim)" strokeWidth="0.5" />
        </g>
      ))}

      {/* Top pins */}
      {[62, 82, 102].map((x) => (
        <g key={`t${x}`}>
          <line x1={x} y1="6" x2={x} y2="18" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
          <rect x={x - 4} y="0" width="8" height="6" rx="1" fill="var(--bg-surface)" stroke="var(--accent-dim)" strokeWidth="0.5" />
        </g>
      ))}

      {/* Bottom pins */}
      {[62, 82, 102].map((x) => (
        <g key={`b${x}`}>
          <line x1={x} y1="82" x2={x} y2="94" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
          <rect x={x - 4} y="94" width="8" height="6" rx="1" fill="var(--bg-surface)" stroke="var(--accent-dim)" strokeWidth="0.5" />
        </g>
      ))}

      {/* Chip label */}
      <text
        x="80"
        y="52"
        textAnchor="middle"
        fill="var(--accent)"
        fontSize="9"
        fontFamily="var(--font-mono)"
        fontWeight="600"
        letterSpacing="1"
      >
        {label.split("\n").map((part, i) => (
          <tspan key={i} x="80" dy={i === 0 ? 0 : 11}>{part}</tspan>
        ))}
      </text>

      {/* Notch */}
      <path d="M44 28 A6 6 0 0 1 50 22" stroke="var(--accent-dim)" strokeWidth="0.8" fill="none" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Product card
// ---------------------------------------------------------------------------

function ProductCard({ product }: { product: ProductSummary }) {
  const navigate = useNavigate();
  const heroImage = product.images[0] ?? null;

  return (
    <div className="card flex flex-col group overflow-hidden" style={{ padding: 0 }}>
      {/* Image / art hero */}
      <div
        className="relative overflow-hidden flex items-center justify-center"
        style={{
          height: "160px",
          background: "var(--bg-surface)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {heroImage ? (
          <img
            src={api.imageUrl(product.slug, heroImage)}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full p-4 opacity-60 transition-opacity group-hover:opacity-80">
            <ChipArt chipFamily={product.chip_families[0] ?? "esp32"} />
          </div>
        )}

        {/* Chip badge overlay */}
        <div className="absolute bottom-2 left-2 flex flex-wrap gap-1">
          {product.chip_families.map((cf) => (
            <span key={cf} className="chip-badge" style={{ fontSize: "0.65rem" }}>
              {cf.toUpperCase()}
            </span>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-3 p-5 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h2
              className="font-display font-700 text-base leading-snug"
              style={{ color: "var(--text-primary)" }}
            >
              {product.name}
            </h2>
            <p
              className="text-sm mt-1 leading-relaxed line-clamp-2"
              style={{ color: "var(--text-secondary)" }}
            >
              {product.tagline}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between mt-auto pt-3 border-t"
          style={{ borderColor: "var(--border)" }}
        >
          <span
            className="text-xs font-mono"
            style={{ color: "var(--text-muted)" }}
          >
            {product.latest_version ? (
              <>
                <span style={{ color: "var(--text-secondary)" }}>v</span>
                <span style={{ color: "var(--accent)" }}>{product.latest_version}</span>
              </>
            ) : (
              <span style={{ color: "var(--text-muted)" }}>no releases</span>
            )}
          </span>

          <div className="flex items-center gap-2">
            <Link
              to={`/products/${product.slug}`}
              className="btn btn-ghost text-xs px-3 py-1.5"
              style={{ fontSize: "0.75rem" }}
              onClick={(e) => e.stopPropagation()}
            >
              Details
            </Link>
            <button
              className="btn btn-primary text-xs px-3 py-1.5"
              style={{ fontSize: "0.75rem" }}
              onClick={() =>
                navigate(
                  `/products/${product.slug}/flash${
                    product.latest_version ? `?version=${product.latest_version}` : ""
                  }`,
                )
              }
              disabled={!product.latest_version}
            >
              Flash
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="card animate-pulse overflow-hidden" style={{ padding: 0 }}>
      <div className="h-40" style={{ background: "var(--bg-elevated)" }} />
      <div className="p-5 flex flex-col gap-3">
        <div className="h-4 rounded-sm w-3/4" style={{ background: "var(--bg-elevated)" }} />
        <div className="h-3 rounded-sm w-full" style={{ background: "var(--bg-elevated)" }} />
        <div className="h-3 rounded-sm w-2/3" style={{ background: "var(--bg-elevated)" }} />
        <div className="flex justify-between mt-2">
          <div className="h-3 rounded-sm w-16" style={{ background: "var(--bg-elevated)" }} />
          <div className="h-6 rounded-sm w-20" style={{ background: "var(--bg-elevated)" }} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function HomePage() {
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getProducts()
      .then(setProducts)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      {/* ----------------------------------------------------------------- */}
      {/* Hero                                                               */}
      {/* ----------------------------------------------------------------- */}
      <section
        className="relative overflow-hidden grid-overlay border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="max-w-6xl mx-auto px-6 py-20 lg:py-28">
          <div className="max-w-2xl animate-fade-in-up">
            <h1
              className="font-display font-800 text-4xl sm:text-5xl lg:text-6xl leading-[1.05] mb-6"
              style={{ color: "var(--text-primary)" }}
            >
              Your{" "}
              <span style={{ color: "var(--accent)" }}>Hebrew</span>
              <br />
              Words Clock,
              <br />
              ready to flash.
            </h1>

            <p
              className="text-lg leading-relaxed mb-8"
              style={{ color: "var(--text-secondary)", maxWidth: "46ch" }}
            >
              No local tooling. No drivers. No command line. Plug in your device,
              pick a firmware, and flash — everything happens right here in Chrome
              or Edge.
            </p>

            {/* Feature pills */}
            <div className="flex flex-wrap gap-2">
              {[
                "Web Serial API",
                "esptool-js",
                "Live console",
                "HTTPS required",
              ].map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2.5 py-1 rounded-sm"
                  style={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    color: "var(--text-muted)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Decorative chip art — desktop only */}
        <div
          className="absolute right-0 top-0 bottom-0 w-64 opacity-10 pointer-events-none select-none hidden xl:flex items-center justify-center"
          aria-hidden
        >
          <svg viewBox="0 0 220 280" fill="none" className="h-full">
            <defs>
              <pattern id="hero-grid" width="14" height="14" patternUnits="userSpaceOnUse">
                <path d="M14 0L0 0 0 14" fill="none" stroke="var(--accent)" strokeWidth="0.3" />
              </pattern>
            </defs>
            <rect width="220" height="280" fill="url(#hero-grid)" />

            {/* Module body */}
            <rect x="50" y="50" width="120" height="180" rx="6" fill="var(--bg-surface)" stroke="var(--accent)" strokeWidth="1.5" />
            <rect x="60" y="60" width="100" height="160" rx="3" fill="var(--bg-base)" stroke="var(--accent-dim)" strokeWidth="0.5" />

            {/* USB port at bottom */}
            <rect x="84" y="216" width="52" height="20" rx="2" fill="var(--bg-elevated)" stroke="var(--accent)" strokeWidth="1" />
            <rect x="92" y="220" width="36" height="12" rx="1" fill="var(--bg-base)" stroke="var(--accent-dim)" strokeWidth="0.5" />

            {/* Antenna stub top-right */}
            <rect x="138" y="40" width="8" height="28" rx="2" fill="var(--accent)" opacity="0.6" />

            {/* Left pads */}
            {[80, 100, 120, 140, 160, 180].map((y) => (
              <g key={y}>
                <line x1="30" y1={y} x2="50" y2={y} stroke="var(--accent)" strokeWidth="1.5" />
                <rect x="14" y={y - 5} width="16" height="10" rx="1.5" fill="var(--bg-surface)" stroke="var(--accent-dim)" strokeWidth="0.5" />
              </g>
            ))}

            {/* Right pads */}
            {[80, 100, 120, 140, 160, 180].map((y) => (
              <g key={y}>
                <line x1="170" y1={y} x2="190" y2={y} stroke="var(--accent)" strokeWidth="1.5" />
                <rect x="190" y={y - 5} width="16" height="10" rx="1.5" fill="var(--bg-surface)" stroke="var(--accent-dim)" strokeWidth="0.5" />
              </g>
            ))}

            {/* Chip label */}
            <text x="110" y="142" textAnchor="middle" fill="var(--accent)" fontSize="11" fontFamily="monospace" fontWeight="700" letterSpacing="1.5">XIAO</text>
            <text x="110" y="158" textAnchor="middle" fill="var(--accent)" fontSize="9" fontFamily="monospace" opacity="0.7" letterSpacing="1">ESP32-C3</text>

            {/* Status LED */}
            <circle cx="90" cy="74" r="3" fill="var(--green)" opacity="0.8" />
            <circle cx="102" cy="74" r="3" fill="var(--amber)" opacity="0.5" />
          </svg>
        </div>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* Product grid                                                       */}
      {/* ----------------------------------------------------------------- */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="flex items-center gap-4 mb-8">
          <h2
            className="font-display font-700 text-sm uppercase tracking-widest"
            style={{ color: "var(--text-secondary)" }}
          >
            Available firmware
          </h2>
          {!loading && products.length > 0 && (
            <span
              className="text-xs px-2 py-0.5 rounded-sm font-mono"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                color: "var(--text-muted)",
              }}
            >
              {products.length}
            </span>
          )}
          <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
        </div>

        {error && (
          <div
            className="card p-5 text-sm mb-6"
            style={{ background: "var(--red-dim)", borderColor: "var(--red)" }}
          >
            <span style={{ color: "var(--red)" }}>Failed to load catalogue: {error}</span>
          </div>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
            : products.map((p, i) => (
                <div
                  key={p.slug}
                  className="animate-fade-in-up"
                  style={{ animationDelay: `${i * 70}ms` }}
                >
                  <ProductCard product={p} />
                </div>
              ))}

          {!loading && !error && products.length === 0 && (
            <div className="col-span-full py-20 text-center">
              <p
                className="text-sm"
                style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
              >
                No firmware products found. Add a{" "}
                <span style={{ color: "var(--accent)" }}>product.yaml</span> to the firmware
                directory.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* How it works                                                       */}
      {/* ----------------------------------------------------------------- */}
      <section
        className="border-t"
        style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
      >
        <div className="max-w-6xl mx-auto px-6 py-16">
          <h2
            className="font-display font-700 text-sm uppercase tracking-widest mb-10"
            style={{ color: "var(--text-secondary)" }}
          >
            How it works
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                step: "01",
                title: "Pick a firmware",
                body: "Browse the catalogue and choose the build that matches your hardware.",
              },
              {
                step: "02",
                title: "Connect your device",
                body: "Plug the ESP32 in via USB. Chrome will ask you to select the serial port.",
              },
              {
                step: "03",
                title: "Flash",
                body: "esptool-js detects the chip, downloads the parts, and writes them at the correct offsets.",
              },
              {
                step: "04",
                title: "Monitor",
                body: "A live serial console opens automatically so you can watch the device boot.",
              },
            ].map(({ step, title, body }) => (
              <div key={step} className="flex flex-col gap-3">
                <span
                  className="text-3xl font-display font-800 leading-none"
                  style={{ color: "var(--accent)", opacity: 0.25 }}
                >
                  {step}
                </span>
                <h3
                  className="font-display font-600 text-sm"
                  style={{ color: "var(--text-primary)" }}
                >
                  {title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
