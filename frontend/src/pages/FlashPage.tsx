import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import type { FirmwareVersion, Product } from "../api/types";
import { BrowserSupportGate } from "../components/BrowserSupportGate";

/** Step indicator shown at the top of the wizard. */
const STEPS = ["Select version", "Connect", "Flash", "Monitor"] as const;
type Step = (typeof STEPS)[number];

function StepIndicator({ current }: { current: Step }) {
  const idx = STEPS.indexOf(current);
  return (
    <div className="flex items-center gap-0 mb-10">
      {STEPS.map((step, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <div key={step} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className="w-6 h-6 rounded-sm flex items-center justify-center text-xs font-mono transition-all"
                style={{
                  background: active
                    ? "var(--accent)"
                    : done
                    ? "var(--accent-glow)"
                    : "var(--bg-elevated)",
                  border: `1px solid ${active ? "var(--accent)" : done ? "var(--accent-dim)" : "var(--border)"}`,
                  color: active ? "#000" : done ? "var(--accent)" : "var(--text-muted)",
                  fontWeight: active ? 700 : 400,
                }}
              >
                {done ? "✓" : i + 1}
              </div>
              <span
                className="text-xs whitespace-nowrap hidden sm:block"
                style={{
                  fontFamily: "var(--font-display)",
                  color: active ? "var(--text-primary)" : "var(--text-muted)",
                  fontWeight: active ? 600 : 400,
                }}
              >
                {step}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className="w-10 sm:w-16 h-px mx-1 mb-5"
                style={{ background: i < idx ? "var(--accent-dim)" : "var(--border)" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function VersionSelector({
  product,
  selectedVersion,
  onSelect,
}: {
  product: Product;
  selectedVersion: string;
  onSelect: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <label
        className="text-xs uppercase tracking-widest font-display"
        style={{ color: "var(--text-muted)" }}
      >
        Firmware version
      </label>
      <div className="flex flex-col gap-2">
        {product.versions.map((v, i) => (
          <button
            key={v.version}
            onClick={() => onSelect(v.version)}
            className={`card text-left px-4 py-3 flex items-center justify-between transition-all ${
              selectedVersion === v.version ? "card-active" : ""
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm" style={{ color: "var(--accent)" }}>
                {v.version}
              </span>
              {i === 0 && (
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
          </button>
        ))}
      </div>
    </div>
  );
}

function VersionDetails({ fw }: { fw: FirmwareVersion }) {
  return (
    <div className="card p-4 flex flex-col gap-3" style={{ background: "var(--bg-elevated)" }}>
      <div className="flex flex-wrap gap-4 text-xs" style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>
        <span>
          Flash baud{" "}
          <span style={{ color: "var(--accent)" }}>{fw.flash.baud.toLocaleString()}</span>
        </span>
        <span>
          Console baud{" "}
          <span style={{ color: "var(--accent)" }}>{fw.console.baud.toLocaleString()}</span>
        </span>
        <span>
          Parts{" "}
          <span style={{ color: "var(--accent)" }}>{fw.parts.length}</span>
        </span>
      </div>
      {fw.notes && (
        <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
          {fw.notes}
        </p>
      )}
      {fw.changelog && (
        <div className="border-t pt-3" style={{ borderColor: "var(--border)" }}>
          <p className="text-xs" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            CHANGELOG
          </p>
          <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {fw.changelog}
          </p>
        </div>
      )}
    </div>
  );
}

function FlashWizardContent({
  product,
  initialVersion,
}: {
  product: Product;
  initialVersion: string;
}) {
  const [selectedVersion, setSelectedVersion] = useState(initialVersion);
  const [fw, setFw] = useState<FirmwareVersion | null>(null);
  const [loadingFw, setLoadingFw] = useState(false);
  const [currentStep] = useState<Step>("Select version");

  useEffect(() => {
    if (!selectedVersion) return;
    setLoadingFw(true);
    api
      .getVersion(product.slug, selectedVersion)
      .then(setFw)
      .catch(console.error)
      .finally(() => setLoadingFw(false));
  }, [product.slug, selectedVersion]);

  return (
    <div className="grid lg:grid-cols-5 gap-8 items-start">
      {/* Wizard column */}
      <div className="lg:col-span-3 flex flex-col gap-8">
        <StepIndicator current={currentStep} />

        <VersionSelector
          product={product}
          selectedVersion={selectedVersion}
          onSelect={setSelectedVersion}
        />

        {loadingFw && (
          <div className="h-24 card animate-pulse" style={{ background: "var(--bg-elevated)" }} />
        )}
        {fw && !loadingFw && <VersionDetails fw={fw} />}

        <button
          className="btn btn-primary w-full justify-center"
          disabled={!fw}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
            <path d="M5.5 8h5M8 5.5l2.5 2.5L8 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Connect device
        </button>

        {/* Placeholder for Phases 6 & 7 */}
        <div
          className="text-center text-xs py-4"
          style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
        >
          Flash wizard — implementation in Phase 6
        </div>
      </div>

      {/* Serial console column (placeholder — Phase 7) */}
      <div className="lg:col-span-2">
        <div
          className="card rounded-sm flex flex-col"
          style={{ minHeight: "320px", background: "#020508", borderColor: "var(--border)" }}
        >
          <div
            className="flex items-center justify-between px-3 py-2 border-b"
            style={{ borderColor: "var(--border)" }}
          >
            <span
              className="text-xs uppercase tracking-widest"
              style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}
            >
              Serial console
            </span>
            <span className="status-dot" style={{ background: "var(--text-muted)" }} />
          </div>
          <div className="flex-1 flex items-center justify-center p-6">
            <p
              className="text-xs text-center"
              style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
            >
              Console available after flashing.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FlashPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const versionParam = searchParams.get("version") ?? "";

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

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm mb-8" style={{ color: "var(--text-muted)" }}>
        <Link to="/" style={{ color: "var(--text-secondary)" }}>
          Products
        </Link>
        <span>/</span>
        {product ? (
          <>
            <Link to={`/products/${slug}`} style={{ color: "var(--text-secondary)" }}>
              {product.name}
            </Link>
            <span>/</span>
            <span style={{ color: "var(--text-primary)" }}>Flash</span>
          </>
        ) : (
          <span>{slug}</span>
        )}
      </div>

      {/* Title */}
      <div className="mb-8">
        <h1
          className="font-display font-800 text-2xl sm:text-3xl"
          style={{ color: "var(--text-primary)" }}
        >
          {product ? `Flash ${product.name}` : "Flash Device"}
        </h1>
        {product && (
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            {product.tagline}
          </p>
        )}
      </div>

      {loading && (
        <div className="flex flex-col gap-4 animate-pulse">
          <div className="h-6 rounded-sm w-1/3" style={{ background: "var(--bg-elevated)" }} />
          <div className="h-24 rounded-sm" style={{ background: "var(--bg-elevated)" }} />
        </div>
      )}

      {error && (
        <div className="card p-5" style={{ borderColor: "var(--red)" }}>
          <p className="text-sm" style={{ color: "var(--red)" }}>{error}</p>
        </div>
      )}

      {product && !loading && (
        <BrowserSupportGate>
          <FlashWizardContent
            product={product}
            initialVersion={versionParam || product.versions[0]?.version || ""}
          />
        </BrowserSupportGate>
      )}
    </div>
  );
}
