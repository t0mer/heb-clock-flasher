import { type ReactNode } from "react";
import { detectWebSerialSupport } from "../lib/webserial";

interface Props {
  children: ReactNode;
}

const SUPPORTED_BROWSERS = [
  { name: "Google Chrome", version: "89+", url: "https://www.google.com/chrome/" },
  { name: "Microsoft Edge", version: "89+", url: "https://www.microsoft.com/edge" },
  { name: "Opera", version: "75+", url: "https://www.opera.com/" },
];

function UnsupportedPanel({
  kind,
}: {
  kind: "unsupported-browser" | "not-secure-context";
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center animate-fade-in">
      {/* Icon */}
      <div className="mb-6 relative">
        <div className="w-16 h-16 rounded-sm border-2 border-red-500/40 bg-red-500/10 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
        </div>
      </div>

      {kind === "not-secure-context" ? (
        <>
          <h2 className="font-display text-xl font-700 text-primary mb-2">
            HTTPS Required
          </h2>
          <p className="text-secondary max-w-md mb-6 leading-relaxed">
            The Web Serial API requires a{" "}
            <span className="text-accent font-mono text-sm">secure context</span>.
            Access this site over <strong>https://</strong> in production.
            Local development on <span className="font-mono text-sm text-accent">localhost</span> works without HTTPS.
          </p>
          <div
            className="card px-5 py-4 text-left max-w-sm"
            style={{ background: "var(--bg-elevated)" }}
          >
            <p className="text-xs text-secondary uppercase tracking-widest font-display mb-2">
              Behind a reverse proxy?
            </p>
            <p className="text-sm text-secondary leading-relaxed">
              Ensure your nginx / Caddy / Traefik config terminates TLS and
              passes the correct <span className="font-mono text-xs text-accent">X-Forwarded-Proto</span> header.
            </p>
          </div>
        </>
      ) : (
        <>
          <h2 className="font-display text-xl font-700 text-primary mb-2">
            Browser Not Supported
          </h2>
          <p className="text-secondary max-w-md mb-8 leading-relaxed">
            Flashing requires the{" "}
            <a
              href="https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              Web Serial API
            </a>
            , which is only available in Chromium-based desktop browsers.
            Firefox and Safari are not supported.
          </p>

          <div className="grid gap-3 w-full max-w-xs">
            {SUPPORTED_BROWSERS.map((b) => (
              <a
                key={b.name}
                href={b.url}
                target="_blank"
                rel="noopener noreferrer"
                className="card flex items-center justify-between px-4 py-3 hover:no-underline group"
              >
                <span className="text-primary text-sm font-medium group-hover:text-accent transition-colors">
                  {b.name}
                </span>
                <span className="chip-badge">{b.version}</span>
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Renders children if Web Serial is available in the current browser/context.
 * Otherwise shows a clear, styled unsupported-browser panel.
 */
export function BrowserSupportGate({ children }: Props) {
  const support = detectWebSerialSupport();
  if (support === "supported") return <>{children}</>;
  return <UnsupportedPanel kind={support} />;
}
