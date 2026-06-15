// TypeScript types mirroring backend app/api/v1/schemas.py
// Part.offset is a hex string in API responses (e.g. "0x10000").

export interface Part {
  file: string;
  /** Hex string, e.g. "0x10000" */
  offset: string;
}

export interface ConsoleConfig {
  baud: number;
}

export interface FlashConfig {
  erase_before: boolean;
  baud: number;
}

export interface FirmwareVersionSummary {
  version: string;
  chip_family: string;
  released: string;
  changelog: string;
}

export interface FirmwareVersion {
  version: string;
  chip_family: string;
  released: string;
  changelog: string;
  console: ConsoleConfig;
  flash: FlashConfig;
  parts: Part[];
  notes: string;
}

export interface ProductLinks {
  setup_guide: string;
}

export interface ProductSummary {
  slug: string;
  name: string;
  tagline: string;
  chip_families: string[];
  images: string[];
  order: number;
  latest_version: string | null;
  latest_chip_family: string | null;
}

export interface Product {
  slug: string;
  name: string;
  tagline: string;
  summary: string;
  repo: string;
  license: string;
  chip_families: string[];
  hardware: string[];
  images: string[];
  features: string[];
  links: ProductLinks;
  order: number;
  versions: FirmwareVersionSummary[];
}

export interface HealthResponse {
  status: string;
  version: string;
  products: number;
  versions: number;
}
