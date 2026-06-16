import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import { api } from "../api/client";
import type { Product } from "../api/types";
import { usePageMeta } from "../lib/seo";

// ---------------------------------------------------------------------------
// Image gallery
// ---------------------------------------------------------------------------

function ImageGallery({ slug, images }: { slug: string; images: string[] }) {
  const [active, setActive] = useState(0);

  if (images.length === 0) {
    return (
      <div
        className="w-full flex items-center justify-center rounded-sm border"
        style={{
          height: "260px",
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
        }}
      >
        <div className="flex flex-col items-center gap-3 opacity-40">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect x="6" y="6" width="36" height="36" rx="4" stroke="var(--accent)" strokeWidth="1.5" />
            <rect x="12" y="12" width="24" height="24" rx="2" stroke="var(--accent)" strokeWidth="1" />
            <circle cx="19" cy="19" r="3" stroke="var(--accent)" strokeWidth="1" />
            <path d="M6 34l10-10 6 6 5-5 15 9" stroke="var(--accent)" strokeWidth="1" strokeLinejoin="round" />
          </svg>
          <span
            className="text-xs"
            style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}
          >
            No photos yet
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Main image */}
      <div
        className="w-full overflow-hidden rounded-sm border"
        style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
      >
        <img
          src={api.imageUrl(slug, images[active])}
          alt={`Product image ${active + 1}`}
          className="w-full object-cover"
          style={{ maxHeight: "360px" }}
          loading="lazy"
        />
      </div>

      {/* Thumbnails — only shown when more than one image */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={img}
              onClick={() => setActive(i)}
              className="flex-shrink-0 w-16 h-16 overflow-hidden rounded-sm border transition-all"
              style={{
                borderColor: i === active ? "var(--accent)" : "var(--border)",
                opacity: i === active ? 1 : 0.5,
              }}
            >
              <img
                src={api.imageUrl(slug, img)}
                alt={`Thumbnail ${i + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Markdown summary
// ---------------------------------------------------------------------------

function MarkdownSummary({ text }: { text: string }) {
  if (!text.trim()) return null;
  return (
    <div
      className="prose-sm leading-relaxed"
      style={{ color: "var(--text-secondary)" }}
    >
      <ReactMarkdown
        rehypePlugins={[rehypeSanitize]}
        components={{
          p: ({ children }) => (
            <p className="mb-3 last:mb-0 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {children}
            </p>
          ),
          strong: ({ children }) => (
            <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>{children}</strong>
          ),
          em: ({ children }) => (
            <em style={{ color: "var(--text-secondary)" }}>{children}</em>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--accent)", textDecoration: "underline", textDecorationColor: "var(--accent-dim)" }}
            >
              {children}
            </a>
          ),
          ul: ({ children }) => (
            <ul className="my-2 flex flex-col gap-1.5 pl-4">{children}</ul>
          ),
          li: ({ children }) => (
            <li className="text-sm list-disc" style={{ color: "var(--text-secondary)" }}>{children}</li>
          ),
          code: ({ children }) => (
            <code
              className="px-1 py-0.5 rounded-sm text-xs"
              style={{
                background: "var(--bg-elevated)",
                color: "var(--accent)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {children}
            </code>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  usePageMeta({
    title: product
      ? `${product.name} — Hebrew Clock Web Flasher`
      : "Product — Hebrew Clock Web Flasher",
    description: product?.tagline || "View product details and flash firmware to your ESP32 device.",
    keywords: product
      ? `${product.name}, ${product.chip_families.join(", ")}, ESP32, firmware, Hebrew clock`
      : "ESP32, firmware, Hebrew clock",
    ogImage: product?.images?.[0] ?? undefined,
    ogType: "article",
  });

  useEffect(() => {
    if (!slug) return;
    api
      .getProduct(slug)
      .then(setProduct)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-12">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm mb-8"
          style={{ color: "var(--text-secondary)" }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          All products
        </Link>
        <div className="animate-pulse flex flex-col gap-4">
          <div className="h-8 rounded-sm w-1/2" style={{ background: "var(--bg-elevated)" }} />
          <div className="h-4 rounded-sm w-3/4" style={{ background: "var(--bg-elevated)" }} />
          <div className="h-64 rounded-sm mt-4" style={{ background: "var(--bg-elevated)" }} />
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-12">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm mb-8"
          style={{ color: "var(--text-secondary)" }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          All products
        </Link>
        <div className="card p-6" style={{ borderColor: "var(--red)" }}>
          <p style={{ color: "var(--red)" }}>{error ?? "Product not found."}</p>
        </div>
      </div>
    );
  }

  const latestVersion = product.versions[0];

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 animate-fade-in">
      {/* Breadcrumb */}
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm mb-8 transition-colors"
        style={{ color: "var(--text-secondary)", fontFamily: "var(--font-display)" }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        All products
      </Link>

      {/* Header */}
      <div className="mb-10">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {product.chip_families.map((cf) => (
            <span key={cf} className="chip-badge">
              {cf.toUpperCase()}
            </span>
          ))}
          <span
            className="text-xs px-2 py-0.5 rounded-sm font-mono"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              color: "var(--text-muted)",
            }}
          >
            {product.license}
          </span>
        </div>

        <h1
          className="font-display font-800 text-3xl sm:text-4xl mb-3 leading-tight"
          style={{ color: "var(--text-primary)" }}
        >
          {product.name}
        </h1>
        <p
          className="text-lg leading-relaxed"
          style={{ color: "var(--text-secondary)", maxWidth: "56ch" }}
        >
          {product.tagline}
        </p>

        {/* CTA row */}
        <div className="flex flex-wrap items-center gap-3 mt-6">
          <button
            className="btn btn-primary"
            onClick={() =>
              navigate(
                `/products/${slug}/flash${
                  latestVersion ? `?version=${latestVersion.version}` : ""
                }`,
              )
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
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1.5a5.5 5.5 0 100 11A5.5 5.5 0 007 1.5z" stroke="currentColor" strokeWidth="1.2" />
                <path d="M4.5 11.5c0-2.5 1-3.5 1-5.5M9.5 11.5c0-2.5-1-3.5-1-5.5M4 4.5c.5-.5 1-.5 3-.5s2.5 0 3 .5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
              </svg>
              GitHub
            </a>
          )}
          {product.links.setup_guide && (
            <a
              href={product.links.setup_guide}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost"
            >
              Setup guide
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 9.5l7-7M4 2.5h5.5V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          )}
        </div>
      </div>

      {/* Body — image gallery + two-column content */}
      <div className="flex flex-col gap-10">
        {/* Image gallery — full width */}
        <ImageGallery slug={product.slug} images={product.images} />

        {/* Content columns */}
        <div className="grid lg:grid-cols-3 gap-10">
          {/* Left: summary + features + versions */}
          <div className="lg:col-span-2 flex flex-col gap-8">
            {product.summary && (
              <Section title="About">
                <MarkdownSummary text={product.summary} />
              </Section>
            )}

            {product.features.length > 0 && (
              <Section title="Features">
                <ul className="flex flex-col gap-2.5">
                  {product.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2.5 text-sm"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      <svg
                        className="flex-shrink-0 mt-0.5"
                        width="14"
                        height="14"
                        viewBox="0 0 14 14"
                        fill="none"
                      >
                        <path
                          d="M2 7.5l3 3 7-7"
                          stroke="var(--accent)"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {product.versions.length > 0 && (
              <Section title="Releases">
                <div className="flex flex-col gap-2">
                  {product.versions.map((v, i) => (
                    <Link
                      key={v.version}
                      to={`/products/${slug}/flash?version=${v.version}`}
                      className="card flex items-center justify-between px-4 py-3 group cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="font-mono text-sm"
                          style={{ color: "var(--accent)" }}
                        >
                          {v.version}
                        </span>
                        {i === 0 && (
                          <span
                            className="text-xs px-1.5 py-0.5 rounded-sm font-mono"
                            style={{
                              background: "var(--green-dim)",
                              color: "var(--green)",
                            }}
                          >
                            latest
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className="text-xs hidden sm:block"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {v.released}
                        </span>
                        <span className="chip-badge">{v.chip_family.toUpperCase()}</span>
                        <svg
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          width="14"
                          height="14"
                          viewBox="0 0 14 14"
                          fill="none"
                          style={{ color: "var(--text-muted)" }}
                        >
                          <path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </Link>
                  ))}
                </div>
              </Section>
            )}
          </div>

          {/* Right: hardware + resources */}
          <div className="flex flex-col gap-6">
            {product.hardware.length > 0 && (
              <Section title="Hardware">
                <ul className="flex flex-col gap-2.5">
                  {product.hardware.map((h) => (
                    <li
                      key={h}
                      className="flex items-start gap-2 text-sm"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      <span
                        className="flex-shrink-0 mt-1.5 w-1 h-1 rounded-full"
                        style={{ background: "var(--border)" }}
                      />
                      {h}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            <Section title="Resources">
              <div className="flex flex-col gap-2">
                {product.repo && (
                  <a
                    href={product.repo}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm transition-colors"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                      <path d="M7 1.5a5.5 5.5 0 100 11A5.5 5.5 0 007 1.5z" stroke="currentColor" strokeWidth="1.2" />
                      <path d="M4.5 11.5c0-2.5 1-3.5 1-5.5M9.5 11.5c0-2.5-1-3.5-1-5.5M4 4.5c.5-.5 1-.5 3-.5s2.5 0 3 .5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
                    </svg>
                    Source on GitHub
                  </a>
                )}
                {product.links.setup_guide && (
                  <a
                    href={product.links.setup_guide}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm transition-colors"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                      <path d="M2 12V3a1 1 0 011-1h7l2 2v8a1 1 0 01-1 1H3a1 1 0 01-1-1z" stroke="currentColor" strokeWidth="1.2" />
                      <path d="M4.5 5.5h5M4.5 7.5h5M4.5 9.5h3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
                    </svg>
                    Setup guide
                  </a>
                )}
              </div>
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}
