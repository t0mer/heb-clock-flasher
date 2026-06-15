/**
 * esptool-js wrapper for chip detection and firmware flashing.
 *
 * Responsibilities:
 *   - Claim the port from portManager, create Transport + ESPLoader
 *   - Connect with baud fallback (manifest baud → 115200)
 *   - Detect chip and verify it matches the manifest chip_family
 *   - Download each part from the backend API
 *   - Flash all parts via writeFlash with progress callbacks
 *   - Hard-reset and release the port back to idle
 *
 * The serial console (Phase 7) may then open the same port for reading.
 */

import { ESPLoader, Transport } from "esptool-js";
import type { IEspLoaderTerminal } from "esptool-js";
import type { FirmwareVersion } from "../api/types";
import { api } from "../api/client";
import { portManager } from "./webserial";

// ---------------------------------------------------------------------------
// Chip name mapping
// ---------------------------------------------------------------------------

/** esptool-js main() returns strings like "ESP32-C3"; map to our chip_family enum. */
const CHIP_NAME_TO_FAMILY: Record<string, string> = {
  "ESP32-C3": "esp32c3",
  "ESP32-S3": "esp32s3",
  "ESP32-S2": "esp32s2",
  "ESP32-C6": "esp32c6",
  "ESP32-H2": "esp32h2",
  "ESP32": "esp32",
  "ESP8266": "esp8266",
};

// ---------------------------------------------------------------------------
// Phase reporting
// ---------------------------------------------------------------------------

export type FlashPhase =
  | { type: "connecting" }
  | { type: "detecting" }
  | { type: "chip-detected"; chipName: string }
  | { type: "downloading"; partIndex: number; partCount: number; partFile: string }
  | { type: "flashing"; fileIndex: number; written: number; total: number; partFile: string }
  | { type: "resetting" }
  | { type: "done"; chipName: string };

// ---------------------------------------------------------------------------
// Binary string conversion (ArrayBuffer → Latin-1 string for esptool-js)
// ---------------------------------------------------------------------------

function arrayBufferToBstr(buf: ArrayBuffer): string {
  const u8 = new Uint8Array(buf);
  const CHUNK = 0x8000; // 32 KB — safe for Function.apply
  const parts: string[] = [];
  for (let i = 0; i < u8.length; i += CHUNK) {
    parts.push(String.fromCharCode.apply(null, u8.subarray(i, i + CHUNK) as unknown as number[]));
  }
  return parts.join("");
}

// ---------------------------------------------------------------------------
// Main flash function
// ---------------------------------------------------------------------------

export interface FlashDeviceOptions {
  firmware: FirmwareVersion;
  productSlug: string;
  eraseAll: boolean;
  /** Terminal sink wired to the on-screen flash log. */
  terminal: IEspLoaderTerminal;
  onPhase: (phase: FlashPhase) => void;
}

/**
 * Flash a device using the acquired port from portManager.
 * Throws on any error; caller is responsible for displaying it.
 */
export async function flashDevice(options: FlashDeviceOptions): Promise<void> {
  const { firmware, productSlug, eraseAll, terminal, onPhase } = options;

  const port = portManager.claimForFlash();
  const transport = new Transport(port, false);

  try {
    // -----------------------------------------------------------------------
    // 1. Connect — try manifest flash baud first, fall back to 115200
    // -----------------------------------------------------------------------
    onPhase({ type: "connecting" });

    const bauds = Array.from(new Set([firmware.flash.baud, 115200]));
    let esploader: ESPLoader | null = null;
    let chipName: string | null = null;
    let lastError: Error | null = null;

    for (let bi = 0; bi < bauds.length; bi++) {
      const baud = bauds[bi];
      try {
        esploader = new ESPLoader({
          transport,
          baudrate: baud,
          romBaudrate: 115200,
          terminal,
        });
        onPhase({ type: "detecting" });
        chipName = await esploader.main();
        lastError = null;
        break;
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
        if (bi < bauds.length - 1) {
          await transport.disconnect().catch(() => {});
        }
      }
    }

    if (!chipName || !esploader) {
      const base = lastError?.message ?? "Failed to sync with chip";
      throw new Error(
        `${base}\n\nIf the device did not enter download mode, hold BOOT and tap RESET, then try again.`
      );
    }

    // -----------------------------------------------------------------------
    // 2. Verify chip family matches manifest
    // -----------------------------------------------------------------------
    const detectedFamily = CHIP_NAME_TO_FAMILY[chipName];
    if (detectedFamily && detectedFamily !== firmware.chip_family) {
      throw new Error(
        `Chip mismatch: connected device is "${chipName}" (${detectedFamily}) ` +
          `but this firmware targets ${firmware.chip_family.toUpperCase()}.`
      );
    }

    onPhase({ type: "chip-detected", chipName });

    // -----------------------------------------------------------------------
    // 3. Download all parts from the backend
    // -----------------------------------------------------------------------
    const parts = firmware.parts;
    const fileArray: { data: string; address: number }[] = [];

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      onPhase({ type: "downloading", partIndex: i, partCount: parts.length, partFile: part.file });

      const url = api.partUrl(productSlug, firmware.version, part.file);
      const resp = await fetch(url);
      if (!resp.ok) {
        throw new Error(`Failed to download ${part.file}: HTTP ${resp.status}`);
      }

      const buf = await resp.arrayBuffer();
      const bstr = arrayBufferToBstr(buf);
      const address = parseInt(part.offset, 16);

      fileArray.push({ data: bstr, address });
    }

    // -----------------------------------------------------------------------
    // 4. Flash
    // -----------------------------------------------------------------------
    await esploader.writeFlash({
      fileArray,
      flashSize: "keep",
      flashMode: "keep",
      flashFreq: "keep",
      eraseAll,
      compress: true,
      reportProgress: (fileIndex, written, total) => {
        const part = parts[fileIndex];
        onPhase({
          type: "flashing",
          fileIndex,
          written,
          total,
          partFile: part?.file ?? `part-${fileIndex}`,
        });
      },
    });

    // -----------------------------------------------------------------------
    // 5. Reset the device so the app boots
    // -----------------------------------------------------------------------
    onPhase({ type: "resetting" });
    await esploader.hardReset();

    onPhase({ type: "done", chipName });
  } finally {
    // Always disconnect transport so the port is closed cleanly.
    // portManager.releaseFromFlash() marks it as idle so the console can reopen it.
    await transport.disconnect().catch(() => {});
    portManager.releaseFromFlash();
  }
}
