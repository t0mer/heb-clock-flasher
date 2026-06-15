import type {
  FirmwareVersion,
  FirmwareVersionSummary,
  HealthResponse,
  Product,
  ProductSummary,
} from "./types";

const BASE = "/api/v1";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      // ignore JSON parse failure
    }
    throw new ApiError(res.status, detail);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: (): Promise<HealthResponse> =>
    fetch("/health").then((r) => r.json() as Promise<HealthResponse>),

  getProducts: (): Promise<ProductSummary[]> =>
    apiFetch<ProductSummary[]>("/products"),

  getProduct: (slug: string): Promise<Product> =>
    apiFetch<Product>(`/products/${encodeURIComponent(slug)}`),

  getVersions: (slug: string): Promise<FirmwareVersionSummary[]> =>
    apiFetch<FirmwareVersionSummary[]>(`/products/${encodeURIComponent(slug)}/versions`),

  getVersion: (slug: string, version: string): Promise<FirmwareVersion> =>
    apiFetch<FirmwareVersion>(
      `/products/${encodeURIComponent(slug)}/versions/${encodeURIComponent(version)}`,
    ),

  /** URL for downloading a firmware part binary. */
  partUrl: (slug: string, version: string, file: string): string =>
    `${BASE}/products/${encodeURIComponent(slug)}/versions/${encodeURIComponent(version)}/parts/${encodeURIComponent(file)}`,

  /** URL for ESP Web Tools–compatible install manifest. */
  espWebToolsUrl: (slug: string, version: string): string =>
    `${BASE}/products/${encodeURIComponent(slug)}/versions/${encodeURIComponent(version)}/esp-web-tools.json`,

  /** URL for a product image. Absolute URLs (remote) are returned as-is. */
  imageUrl: (slug: string, imagePath: string): string =>
    imagePath.startsWith("http://") || imagePath.startsWith("https://")
      ? imagePath
      : `${BASE}/products/${encodeURIComponent(slug)}/images/${imagePath}`,
};
