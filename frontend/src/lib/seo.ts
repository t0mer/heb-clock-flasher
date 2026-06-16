import { useEffect } from "react";

const DEFAULT_OG_IMAGE =
  "https://github.com/t0mer/hebrew-clock/raw/main/assets/screenshots/clock-main-heebo-raanana.png";
const DEFAULT_OG_IMAGE_WIDTH = "800";
const DEFAULT_OG_IMAGE_HEIGHT = "480";

interface PageMeta {
  title: string;
  description: string;
  keywords?: string;
  ogImage?: string;
  ogImageWidth?: string;
  ogImageHeight?: string;
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
    const image = meta.ogImage || DEFAULT_OG_IMAGE;
    const imageWidth = meta.ogImage ? (meta.ogImageWidth ?? "") : DEFAULT_OG_IMAGE_WIDTH;
    const imageHeight = meta.ogImage ? (meta.ogImageHeight ?? "") : DEFAULT_OG_IMAGE_HEIGHT;

    document.title = meta.title;

    setMeta("description", meta.description);
    if (meta.keywords) setMeta("keywords", meta.keywords);

    setOgMeta("og:title", meta.title);
    setOgMeta("og:description", meta.description);
    setOgMeta("og:type", meta.ogType ?? "website");
    setOgMeta("og:url", canonical);
    setOgMeta("og:image", image);
    if (imageWidth) setOgMeta("og:image:width", imageWidth);
    if (imageHeight) setOgMeta("og:image:height", imageHeight);

    setOgMeta("twitter:card", "summary_large_image");
    setOgMeta("twitter:title", meta.title);
    setOgMeta("twitter:description", meta.description);
    setOgMeta("twitter:image", image);

    setCanonical(canonical);
  }, [meta.title, meta.description, meta.keywords, meta.ogImage, meta.ogImageWidth, meta.ogImageHeight, meta.canonical]);
}
