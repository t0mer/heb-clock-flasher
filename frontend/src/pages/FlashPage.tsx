import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import type { FirmwareVersion, Product } from "../api/types";
import { BrowserSupportGate } from "../components/BrowserSupportGate";
import { flashDevice, type FlashPhase } from "../lib/flasher";
import { portManager } from "../lib/webserial";

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

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
                  border: `1px solid ${
                    active
                      ? "var(--accent)"
                      : done
                      ? "var(--accent-dim)"
                      : "var(--border)"
                  }`,
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

// ---------------------------------------------------------------------------
// Version selector
// ---------------------------------------------------------------------------

function VersionSelector({
  product,
  selectedVersion,
  onSelect,
  disabled,
}: {
  product: Product;
  selectedVersion: string;
  onSelect: (v: string) => void;
  disabled?: boolean;
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
            onClick={() => !disabled && onSelect(v.version)}
            disabled={disabled}
            className={`card text-left px-4 py-3 flex items-center justify-between transition-all ${
              selectedVersion === v.version ? "card-active" : ""
            } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
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

// ---------------------------------------------------------------------------
// Version details
// ---------------------------------------------------------------------------

function VersionDetails({ fw }: { fw: FirmwareVersion }) {
  return (
    <div className="card p-4 flex flex-col gap-3" style={{ background: "var(--bg-elevated)" }}>
      <div
        className="flex flex-wrap gap-4 text-xs"
        style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}
      >
        <span>
          Flash{" "}
          <span style={{ color: "var(--accent)" }}>{fw.flash.baud.toLocaleString()}</span>{" "}
          baud
        </span>
        <span>
          Console{" "}
          <span style={{ color: "var(--accent)" }}>{fw.console.baud.toLocaleString()}</span>{" "}
          baud
        </span>
        <span>
          <span style={{ color: "var(--accent)" }}>{fw.parts.length}</span> parts
        </span>
      </div>
      {fw.notes && (
        <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
          {fw.notes}
        </p>
      )}
      {fw.changelog && (
        <div className="border-t pt-3" style={{ borderColor: "var(--border)" }}>
          <p
            className="text-xs"
            style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
          >
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

// ---------------------------------------------------------------------------
// Progress bar
// ---------------------------------------------------------------------------

function ProgressBar({ pct, label }: { pct: number; label: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-center">
        <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
          {label}
        </span>
        <span className="text-xs font-mono" style={{ color: "var(--accent)" }}>
          {pct}%
        </span>
      </div>
      <div
        className="h-1 rounded-full overflow-hidden"
        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
      >
        <div
          className="h-full transition-all duration-200"
          style={{ width: `${pct}%`, background: "var(--accent)", borderRadius: "inherit" }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Flash log (esptool terminal output)
// ---------------------------------------------------------------------------

function FlashLog({ lines }: { lines: string[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  return (
    <div
      className="rounded-sm border overflow-auto text-xs leading-relaxed p-3"
      style={{
        background: "#020508",
        borderColor: "var(--border)",
        fontFamily: "var(--font-mono)",
        color: "var(--text-secondary)",
        maxHeight: "200px",
        minHeight: "80px",
      }}
    >
      {lines.length === 0 ? (
        <span style={{ color: "var(--text-muted)" }}>Waiting for device…</span>
      ) : (
        lines.map((l, i) => (
          <div key={i} style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
            {l}
          </div>
        ))
      )}
      <div ref={bottomRef} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Flash wizard
// ---------------------------------------------------------------------------

type WizardState =
  | { kind: "select" }
  | { kind: "flashing"; phase: FlashPhase; log: string[] }
  | { kind: "done"; chipName: string }
  | { kind: "error"; message: string };

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
  const [eraseAll, setEraseAll] = useState(false);
  const [wizard, setWizard] = useState<WizardState>({ kind: "select" });

  // Keep a mutable log ref so the terminal sink can append without stale closures
  const logRef = useRef<string[]>([]);

  const stepForWizard = (): Step => {
    switch (wizard.kind) {
      case "select":
        return "Select version";
      case "flashing": {
        const pt = wizard.phase.type;
        if (pt === "connecting" || pt === "detecting" || pt === "chip-detected") return "Connect";
        if (pt === "resetting") return "Flash";
        return "Flash";
      }
      case "done":
        return "Monitor";
      case "error":
        return "Connect";
    }
  };

  // Fetch version details when version changes
  useEffect(() => {
    if (!selectedVersion) return;
    setLoadingFw(true);
    api
      .getVersion(product.slug, selectedVersion)
      .then(setFw)
      .catch(console.error)
      .finally(() => setLoadingFw(false));
  }, [product.slug, selectedVersion]);

  // Build a terminal sink that appends to the log
  const makeTerminal = useCallback(() => {
    return {
      clean: () => {
        logRef.current = [];
        setWizard((w) =>
          w.kind === "flashing" ? { ...w, log: [] } : w
        );
      },
      writeLine: (s: string) => {
        logRef.current = [...logRef.current, s];
        setWizard((w) =>
          w.kind === "flashing" ? { ...w, log: logRef.current } : w
        );
      },
      write: (s: string) => {
        const last = logRef.current[logRef.current.length - 1] ?? "";
        logRef.current = [...logRef.current.slice(0, -1), last + s];
        setWizard((w) =>
          w.kind === "flashing" ? { ...w, log: logRef.current } : w
        );
      },
    };
  }, []);

  const handleConnect = useCallback(async () => {
    if (!fw) return;

    // Must call requestPort synchronously from this click handler
    try {
      await portManager.acquire();
    } catch {
      // User cancelled the port picker
      return;
    }

    logRef.current = [];
    const initialPhase: FlashPhase = { type: "connecting" };
    setWizard({ kind: "flashing", phase: initialPhase, log: [] });

    const terminal = makeTerminal();

    try {
      await flashDevice({
        firmware: fw,
        productSlug: product.slug,
        eraseAll,
        terminal,
        onPhase: (phase) => {
          setWizard((w) =>
            w.kind === "flashing"
              ? { ...w, phase, log: logRef.current }
              : w
          );
          if (phase.type === "done") {
            setWizard({ kind: "done", chipName: phase.chipName });
          }
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setWizard({ kind: "error", message: msg });
    }
  }, [fw, eraseAll, product.slug, makeTerminal]);

  const handleRetry = useCallback(() => {
    setWizard({ kind: "select" });
    logRef.current = [];
  }, []);

  // Compute progress percentage for the current phase
  const progressInfo = (() => {
    if (wizard.kind !== "flashing") return null;
    const p = wizard.phase;
    const parts = fw?.parts ?? [];
    const partCount = parts.length || 1;

    if (p.type === "connecting" || p.type === "detecting" || p.type === "chip-detected") {
      return { label: p.type === "connecting" ? "Connecting…" : p.type === "detecting" ? "Detecting chip…" : `Detected: ${(p as { chipName: string }).chipName}`, pct: 0 };
    }
    if (p.type === "downloading") {
      const pct = Math.round(((p.partIndex + 1) / partCount) * 100);
      return { label: `Downloading ${p.partFile} (${p.partIndex + 1}/${p.partCount})`, pct };
    }
    if (p.type === "flashing") {
      // Overall progress across all parts: finished parts + current part progress
      const partFraction = p.total > 0 ? p.written / p.total : 0;
      const pct = Math.round(((p.fileIndex + partFraction) / partCount) * 100);
      return { label: `Flashing ${p.partFile}`, pct: Math.min(pct, 99) };
    }
    if (p.type === "resetting") {
      return { label: "Resetting device…", pct: 99 };
    }
    return null;
  })();

  const isFlashing = wizard.kind === "flashing";
  const isDone = wizard.kind === "done";
  const isError = wizard.kind === "error";

  return (
    <div className="grid lg:grid-cols-5 gap-8 items-start">
      {/* Wizard column */}
      <div className="lg:col-span-3 flex flex-col gap-6">
        <StepIndicator current={stepForWizard()} />

        <VersionSelector
          product={product}
          selectedVersion={selectedVersion}
          onSelect={setSelectedVersion}
          disabled={isFlashing || isDone}
        />

        {loadingFw && !fw && (
          <div
            className="h-24 card animate-pulse"
            style={{ background: "var(--bg-elevated)" }}
          />
        )}
        {fw && !loadingFw && wizard.kind === "select" && <VersionDetails fw={fw} />}

        {/* Erase toggle — only shown before flashing */}
        {wizard.kind === "select" && fw && (
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              className="relative w-9 h-5 rounded-full transition-colors"
              style={{
                background: eraseAll ? "var(--accent)" : "var(--bg-elevated)",
                border: "1px solid var(--border)",
              }}
              onClick={() => setEraseAll((v) => !v)}
            >
              <div
                className="absolute top-0.5 w-4 h-4 rounded-full transition-transform"
                style={{
                  background: eraseAll ? "#000" : "var(--text-muted)",
                  transform: eraseAll ? "translateX(18px)" : "translateX(2px)",
                }}
              />
            </div>
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Erase flash before installing
            </span>
          </label>
        )}

        {/* Flash progress */}
        {isFlashing && progressInfo && (
          <div className="flex flex-col gap-4">
            <ProgressBar pct={progressInfo.pct} label={progressInfo.label} />
            <FlashLog lines={wizard.kind === "flashing" ? wizard.log : []} />
          </div>
        )}

        {/* Done state */}
        {isDone && (
          <div
            className="card p-5 flex flex-col gap-3"
            style={{ borderColor: "var(--green)", background: "var(--green-dim)" }}
          >
            <div className="flex items-center gap-2">
              <span
                className="status-dot"
                style={{ background: "var(--green)", width: "8px", height: "8px" }}
              />
              <span
                className="text-sm font-display font-600"
                style={{ color: "var(--green)" }}
              >
                Flash complete
              </span>
            </div>
            {wizard.kind === "done" && (
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {wizard.chipName} flashed successfully. Serial console is now active — watch
                the device boot below.
              </p>
            )}
          </div>
        )}

        {/* Error state */}
        {isError && (
          <div
            className="card p-5 flex flex-col gap-4"
            style={{ borderColor: "var(--red)", background: "var(--red-dim)" }}
          >
            <p
              className="text-sm font-display font-600"
              style={{ color: "var(--red)" }}
            >
              Flash failed
            </p>
            <p
              className="text-xs leading-relaxed whitespace-pre-wrap"
              style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}
            >
              {wizard.kind === "error" ? wizard.message : ""}
            </p>
            {fw?.notes && (
              <div
                className="border-t pt-3"
                style={{ borderColor: "var(--border)" }}
              >
                <p
                  className="text-xs leading-relaxed"
                  style={{ color: "var(--text-muted)" }}
                >
                  {fw.notes}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3">
          {wizard.kind === "select" && (
            <button
              className="btn btn-primary"
              disabled={!fw || loadingFw}
              onClick={handleConnect}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
                <path
                  d="M5.5 8h5M8 5.5l2.5 2.5L8 10.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Connect &amp; flash
            </button>
          )}

          {(isDone || isError) && (
            <button className="btn btn-ghost" onClick={handleRetry}>
              Flash again
            </button>
          )}
        </div>
      </div>

      {/* Serial console column (placeholder — Phase 7) */}
      <div className="lg:col-span-2">
        <div
          className="card rounded-sm flex flex-col"
          style={{
            minHeight: "320px",
            background: "#020508",
            borderColor: isDone ? "var(--green)" : "var(--border)",
            transition: "border-color 0.3s",
          }}
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
            <span
              className="status-dot"
              style={{
                background: isDone ? "var(--green)" : "var(--text-muted)",
                width: "6px",
                height: "6px",
                transition: "background 0.3s",
              }}
            />
          </div>
          <div className="flex-1 flex items-center justify-center p-6">
            <p
              className="text-xs text-center"
              style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
            >
              {isDone
                ? "Serial console implementation coming in Phase 7."
                : "Console available after flashing."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page shell
// ---------------------------------------------------------------------------

export function FlashPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const versionParam = searchParams.get("version") ?? "";

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    api
      .getProduct(slug)
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
          <p className="text-sm" style={{ color: "var(--red)" }}>
            {error}
          </p>
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
