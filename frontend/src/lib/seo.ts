import { useEffect } from "react";

interface PageMeta {
  title: string;
  description: string;
  keywords?: string;
  ogImage?: string;
  ogType?: "website" | "article";
  canonical?: string;
}

function setMeta(name: string, content: string): void {
  let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.name = name;
    document.head.appendChild(el);
  }
  el.content = content;
}

function setOgMeta(property: string, content: string): void {
  let el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", property);
    document.head.appendChild(el);
  }
  el.content = content;
}

function setCanonical(href: string): void {
  let el = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.rel = "canonical";
    document.head.appendChild(el);
  }
  el.href = href;
}

export function usePageMeta(meta: PageMeta): void {
  useEffect(() => {
    const canonical = meta.canonical ?? window.location.origin + window.location.pathname;

    document.title = meta.title;

    setMeta("description", meta.description);
    if (meta.keywords) setMeta("keywords", meta.keywords);

    setOgMeta("og:title", meta.title);
    setOgMeta("og:description", meta.description);
    setOgMeta("og:type", meta.ogType ?? "website");
    setOgMeta("og:url", canonical);
    if (meta.ogImage) setOgMeta("og:image", meta.ogImage);

    setOgMeta("twitter:card", "summary_large_image");
    setOgMeta("twitter:title", meta.title);
    setOgMeta("twitter:description", meta.description);
    if (meta.ogImage) setOgMeta("twitter:image", meta.ogImage);

    setCanonical(canonical);
  }, [meta.title, meta.description, meta.keywords, meta.ogImage, meta.canonical]);
}
