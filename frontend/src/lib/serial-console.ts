/**
 * Serial console reader for post-flash device monitoring.
 *
 * Opens the port (which was closed after flashing) at the app baud rate,
 * streams raw bytes through a TextDecoder, and calls onData for each decoded
 * text chunk. Handles partial multi-byte UTF-8 sequences correctly because
 * TextDecoder carries streaming state between calls.
 *
 * Lifecycle:
 *   1. After flashDevice() completes, the port is closed (idle in portManager).
 *   2. Call startConsole(consoleBaud, onData) → opens port, starts reading.
 *   3. Call stopConsole() → cancels reader, closes port, releases back to idle.
 *   4. sendBytes() writes raw bytes to the device (optional input).
 *
 * Only one console session may run at a time. The module enforces this with
 * _active flag.
 */

import { portManager } from "./webserial";

let _active = false;
let _reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
let _writer: WritableStreamDefaultWriter<Uint8Array> | null = null;

export interface ConsoleSession {
  /** Send raw bytes to the device (e.g. command input). */
  send: (data: Uint8Array) => Promise<void>;
  /** Stop the console and release the port. */
  stop: () => Promise<void>;
}

/**
 * Start a serial console session.
 *
 * @param baud - App baud rate from the manifest (console.baud).
 * @param onData - Called with decoded text as it arrives from the device.
 * @param onError - Called if the read loop encounters an error.
 * @returns ConsoleSession with send() and stop() methods.
 */
export async function startConsole(
  baud: number,
  onData: (text: string) => void,
  onError: (err: Error) => void,
): Promise<ConsoleSession> {
  if (_active) {
    throw new Error("A console session is already active");
  }

  const port = portManager.claimForConsole();

  try {
    await port.open({ baudRate: baud });
  } catch (e) {
    portManager.releaseFromConsole();
    throw e;
  }

  _active = true;

  // Set up writer for optional input
  if (port.writable) {
    _writer = port.writable.getWriter();
  }

  // Read loop — runs until stop() is called or an error occurs
  const decoder = new TextDecoder("utf-8", { fatal: false });

  if (!port.readable) {
    await _cleanupConsole(port);
    throw new Error("Port is not readable");
  }

  _reader = port.readable.getReader();

  (async () => {
    try {
      while (true) {
        const { value, done } = await _reader!.read();
        if (done) break;
        if (value && value.length > 0) {
          // stream: true preserves incomplete multi-byte sequences across chunks
          const text = decoder.decode(value, { stream: true });
          if (text) onData(text);
        }
      }
      // Flush any remaining bytes in the decoder
      const tail = decoder.decode();
      if (tail) onData(tail);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      onError(e instanceof Error ? e : new Error(String(e)));
    }
  })();

  const stop = async () => {
    await _cleanupConsole(port);
  };

  const send = async (data: Uint8Array) => {
    if (!_writer) return;
    try {
      await _writer.write(data);
    } catch {
      // port may have disconnected
    }
  };

  return { send, stop };
}

async function _cleanupConsole(port: SerialPort): Promise<void> {
  _active = false;

  if (_reader) {
    try {
      await _reader.cancel();
    } catch {
      // ignore
    }
    try {
      _reader.releaseLock();
    } catch {
      // ignore
    }
    _reader = null;
  }

  if (_writer) {
    try {
      _writer.releaseLock();
    } catch {
      // ignore
    }
    _writer = null;
  }

  try {
    await port.close();
  } catch {
    // ignore — may already be closed
  }

  portManager.releaseFromConsole();
}
