/**
 * Web Serial API capability detection and port lifecycle manager.
 *
 * Web Serial requires:
 *   - A Chromium-based browser (Chrome 89+, Edge 89+, Opera 75+)
 *   - A secure context: HTTPS in production, or http://localhost / 127.0.0.1
 *
 * The flasher and the serial console share ONE SerialPort.  Only one consumer
 * may hold port.readable / port.writable at a time.  This module is the single
 * source of truth for the port reference and which consumer owns it.
 */

export type WebSerialSupport =
  | "supported"
  | "unsupported-browser"
  | "not-secure-context";

/** Detect whether Web Serial is available in the current context. */
export function detectWebSerialSupport(): WebSerialSupport {
  const isLocalhost =
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1" ||
    location.hostname === "::1";

  if (!window.isSecureContext && !isLocalhost) {
    return "not-secure-context";
  }
  if (!("serial" in navigator)) {
    return "unsupported-browser";
  }
  return "supported";
}

/** True when the current context can use Web Serial. */
export const isWebSerialSupported = (): boolean =>
  detectWebSerialSupport() === "supported";

// ---------------------------------------------------------------------------
// Port lifecycle state machine
// ---------------------------------------------------------------------------

/**
 * Who currently owns the open port.
 * "idle" means we have a reference but the port is closed (between flash & console).
 * "none" means no port has been acquired.
 */
export type PortOwner = "none" | "idle" | "flashing" | "console";

class PortManager {
  private _port: SerialPort | null = null;
  private _owner: PortOwner = "none";

  get port(): SerialPort | null {
    return this._port;
  }

  get owner(): PortOwner {
    return this._owner;
  }

  /**
   * Show the browser port picker and acquire a port.
   * If a port is already held, returns it without prompting.
   * Must be called from a user-gesture handler.
   */
  async acquire(filters?: SerialPortFilter[]): Promise<SerialPort> {
    if (this._port && this._owner !== "none") {
      return this._port;
    }
    this._port = await navigator.serial.requestPort({ filters: filters ?? [] });
    this._owner = "idle";
    return this._port;
  }

  /** Claim the port for the flasher. Returns the port. */
  claimForFlash(): SerialPort {
    if (!this._port) throw new Error("No port acquired");
    this._owner = "flashing";
    return this._port;
  }

  /** Called after transport.disconnect() — port is now closed, reference kept. */
  releaseFromFlash(): void {
    this._owner = "idle";
  }

  /** Claim the port for the serial console. Returns the port. */
  claimForConsole(): SerialPort {
    if (!this._port) throw new Error("No port acquired");
    this._owner = "console";
    return this._port;
  }

  /** Called when the serial console closes. Port is closed; reference released. */
  async releaseFromConsole(): Promise<void> {
    this._owner = "idle";
  }

  /** Fully forget the port (disconnect clicked). */
  async forget(): Promise<void> {
    if (this._port) {
      try {
        await this._port.close();
      } catch {
        // ignore — may already be closed
      }
      this._port = null;
    }
    this._owner = "none";
  }
}

/** Singleton port lifecycle manager shared by flasher and serial console. */
export const portManager = new PortManager();

// ---------------------------------------------------------------------------
// Lower-level helpers (used by serial-console.ts in Phase 7)
// ---------------------------------------------------------------------------

/**
 * Fully release a port's readable stream so another consumer can open it.
 * Call this after cancelling any active readers.
 */
export async function releaseReadable(port: SerialPort): Promise<void> {
  if (port.readable?.locked) {
    try {
      await port.readable.cancel();
    } catch {
      // may already be cancelled
    }
  }
}

/** Close a port and swallow errors (port may already be closed). */
export async function closePort(port: SerialPort): Promise<void> {
  try {
    await port.close();
  } catch {
    // ignore — may already be closed
  }
}
