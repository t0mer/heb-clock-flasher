/**
 * Web Serial API capability detection and port lifecycle helpers.
 *
 * Web Serial requires:
 *   - A Chromium-based browser (Chrome 89+, Edge 89+, Opera 75+)
 *   - A secure context: HTTPS in production, or http://localhost / 127.0.0.1
 *
 * Firefox and Safari do not support Web Serial. Mobile browsers do not either.
 *
 * The flasher and the serial console share ONE SerialPort.  Only one consumer
 * may hold port.readable / port.writable at a time.  Callers must fully
 * release (cancel reader, releaseLock) before the other consumer opens its
 * streams.  The port lifecycle state machine lives here so that flasher.ts and
 * serial-console.ts coordinate through a single shared reference.
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

/**
 * Request a serial port from the user (triggers the browser's port picker).
 * Must be called from a user gesture (click handler).
 */
export async function requestPort(
  filters?: SerialPortFilter[],
): Promise<SerialPort> {
  return navigator.serial.requestPort({ filters: filters ?? [] });
}

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
