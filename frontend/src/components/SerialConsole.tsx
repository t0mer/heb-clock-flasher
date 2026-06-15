/**
 * SerialConsole — live scrolling view of device serial output.
 *
 * Features:
 *   - Autoscroll (follows new output; pauses when user scrolls up)
 *   - Clear, copy, and download log
 *   - Baud selector (overrides manifest default; reconnects)
 *   - Optional text input line to send bytes to the device
 *   - Status indicator (connected / connecting / disconnected / error)
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { startConsole, type ConsoleSession } from "../lib/serial-console";
import { portManager } from "../lib/webserial";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ConsoleStatus = "idle" | "connecting" | "connected" | "error" | "stopped";

interface LogEntry {
  id: number;
  text: string;
}

interface Props {
  /** Default baud rate from the firmware manifest. */
  defaultBaud: number;
  /** If true, automatically open the console on mount (after 1.25 s delay). */
  autoStart?: boolean;
  /** CSS min-height for the log pane. */
  minHeight?: string;
  /**
   * When true the Open button is disabled. Set while flashing so the user
   * cannot attempt to open the port while the flasher owns it.
   */
  disabled?: boolean;
  /**
   * When this flips to true any active session is stopped automatically.
   * Use to release the port before the flasher claims it.
   */
  flashActive?: boolean;
}

const BAUD_OPTIONS = [9600, 19200, 38400, 57600, 74880, 115200, 230400, 460800, 921600];

let _idSeq = 0;
const nextId = () => ++_idSeq;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SerialConsole({
  defaultBaud,
  autoStart = false,
  minHeight = "320px",
  disabled = false,
  flashActive = false,
}: Props) {
  const [status, setStatus] = useState<ConsoleStatus>("idle");
  const [baud, setBaud] = useState(defaultBaud);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [input, setInput] = useState("");
  const [autoscroll, setAutoscroll] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const sessionRef = useRef<ConsoleSession | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const logPaneRef = useRef<HTMLDivElement>(null);
  const partialLineRef = useRef(""); // accumulate chars until \n

  // Autoscroll
  useEffect(() => {
    if (autoscroll) {
      logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [log, autoscroll]);

  // Detect manual scroll-up to pause autoscroll
  const handleScroll = useCallback(() => {
    const el = logPaneRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAutoscroll(atBottom);
  }, []);

  // Append text to log, splitting on newlines
  const appendText = useCallback((text: string) => {
    setLog((prev) => {
      const combined = partialLineRef.current + text;
      const lines = combined.split("\n");
      // last element is a partial line (empty string if text ended with \n)
      partialLineRef.current = lines.pop() ?? "";
      if (lines.length === 0) return prev;
      const newEntries: LogEntry[] = lines.map((l) => ({ id: nextId(), text: l }));
      // Keep last 2000 lines to avoid unbounded growth
      return [...prev, ...newEntries].slice(-2000);
    });
  }, []);

  const stopSession = useCallback(async () => {
    if (sessionRef.current) {
      await sessionRef.current.stop();
      sessionRef.current = null;
    }
    setStatus("stopped");
  }, []);

  const startSession = useCallback(async (selectedBaud: number) => {
    if (sessionRef.current) {
      await stopSession();
    }
    setStatus("connecting");
    setErrorMsg("");
    partialLineRef.current = "";

    try {
      const session = await startConsole(
        selectedBaud,
        appendText,
        (err) => {
          setStatus("error");
          setErrorMsg(err.message);
        },
      );
      sessionRef.current = session;
      setStatus("connected");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus("error");
      setErrorMsg(msg);
    }
  }, [appendText, stopSession]);

  // Release the port the moment the flasher claims it.
  useEffect(() => {
    if (flashActive && sessionRef.current) {
      sessionRef.current.stop().catch(() => {});
      sessionRef.current = null;
      setStatus("idle");
    }
  }, [flashActive]);

  // Auto-start — wait 1.25 s after mount so the device finishes rebooting
  // before we try to open the serial port.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (autoStart) {
      timer = setTimeout(() => startSession(defaultBaud), 1250);
    }
    return () => {
      clearTimeout(timer);
      sessionRef.current?.stop().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Must be called directly from the click handler so the browser allows
  // requestPort() — acquire() is a no-op if a port is already selected.
  const handleOpen = useCallback(async () => {
    try {
      await portManager.acquire();
    } catch {
      return; // user cancelled the device picker
    }
    await startSession(baud);
  }, [baud, startSession]);

  const handleBaudChange = useCallback(
    async (newBaud: number) => {
      setBaud(newBaud);
      if (status === "connected") {
        await startSession(newBaud);
      }
    },
    [status, startSession],
  );

  const handleClear = useCallback(() => {
    setLog([]);
    partialLineRef.current = "";
  }, []);

  const handleCopy = useCallback(() => {
    const text = log.map((e) => e.text).join("\n");
    navigator.clipboard.writeText(text).catch(() => {});
  }, [log]);

  const handleDownload = useCallback(() => {
    const text = log.map((e) => e.text).join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "serial-log.txt";
    a.click();
    URL.revokeObjectURL(url);
  }, [log]);

  const handleSend = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!sessionRef.current || !input) return;
      const line = input + "\r\n";
      await sessionRef.current.send(new TextEncoder().encode(line));
      setInput("");
    },
    [input],
  );

  // Status indicator
  const statusColor = {
    idle: "var(--text-muted)",
    connecting: "var(--amber)",
    connected: "var(--green)",
    error: "var(--red)",
    stopped: "var(--text-muted)",
  }[status];

  const statusLabel = {
    idle: "idle",
    connecting: "connecting…",
    connected: "connected",
    error: "error",
    stopped: "disconnected",
  }[status];

  return (
    <div
      className="card rounded-sm flex flex-col"
      style={{ background: "#020508", borderColor: status === "connected" ? "var(--accent-dim)" : "var(--border)" }}
    >
      {/* Toolbar */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b gap-2"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="flex-shrink-0 rounded-full"
            style={{ width: "6px", height: "6px", background: statusColor }}
          />
          <span
            className="text-xs uppercase tracking-widest hidden sm:block"
            style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}
          >
            Serial console
          </span>
          <span className="text-xs" style={{ fontFamily: "var(--font-mono)", color: statusColor }}>
            {statusLabel}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Baud selector */}
          <select
            value={baud}
            onChange={(e) => handleBaudChange(Number(e.target.value))}
            className="text-xs rounded-sm px-1.5 py-0.5 outline-none"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {BAUD_OPTIONS.map((b) => (
              <option key={b} value={b}>
                {b.toLocaleString()}
              </option>
            ))}
          </select>

          {/* Action buttons */}
          {[
            { label: "↑↓", title: `Autoscroll ${autoscroll ? "on" : "off"}`, action: () => setAutoscroll((v) => !v), active: autoscroll },
            { label: "⊘", title: "Clear", action: handleClear, active: false },
            { label: "⎘", title: "Copy", action: handleCopy, active: false },
            { label: "↓", title: "Download", action: handleDownload, active: false },
          ].map(({ label, title, action, active }) => (
            <button
              key={title}
              onClick={action}
              title={title}
              className="text-xs w-6 h-6 rounded-sm flex items-center justify-center transition-colors"
              style={{
                background: active ? "var(--accent-glow)" : "transparent",
                color: active ? "var(--accent)" : "var(--text-muted)",
                border: "1px solid transparent",
                fontFamily: "var(--font-mono)",
              }}
            >
              {label}
            </button>
          ))}

          {/* Connect / Disconnect */}
          {status === "connected" ? (
            <button
              onClick={stopSession}
              className="btn text-xs px-2 py-0.5"
              style={{ background: "var(--red-dim)", color: "var(--red)", border: "1px solid var(--red)" }}
            >
              Stop
            </button>
          ) : (
            <button
              onClick={handleOpen}
              disabled={disabled || status === "connecting"}
              title={disabled ? "Port is busy — wait for flashing to complete" : undefined}
              className="btn btn-primary text-xs px-2 py-0.5"
            >
              {status === "connecting" ? "…" : "Open"}
            </button>
          )}
        </div>
      </div>

      {/* Log pane */}
      <div
        ref={logPaneRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto p-3 text-xs leading-relaxed"
        style={{
          minHeight,
          fontFamily: "var(--font-mono)",
          color: "var(--text-secondary)",
          background: "transparent",
        }}
      >
        {status === "error" && (
          <div className="mb-2 px-2 py-1 rounded-sm" style={{ background: "var(--red-dim)" }}>
            <span style={{ color: "var(--red)" }}>{errorMsg}</span>
          </div>
        )}

        {log.length === 0 ? (
          <span style={{ color: "var(--text-muted)" }}>
            {status === "idle" || status === "stopped"
              ? "Open the console to see device output."
              : status === "connecting"
              ? "Opening port…"
              : "Waiting for device output…"}
          </span>
        ) : (
          log.map((entry) => (
            <div key={entry.id} style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
              {entry.text}
            </div>
          ))
        )}
        <div ref={logEndRef} />
      </div>

      {/* Input line */}
      <form
        onSubmit={handleSend}
        className="flex items-center gap-2 px-3 py-2 border-t"
        style={{ borderColor: "var(--border)" }}
      >
        <span style={{ color: "var(--accent)", fontFamily: "var(--font-mono)", fontSize: "0.7rem" }}>
          &gt;
        </span>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Send to device (Enter to send)"
          disabled={status !== "connected"}
          className="flex-1 bg-transparent outline-none text-xs"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--text-primary)",
          }}
        />
        <button
          type="submit"
          disabled={status !== "connected" || !input}
          className="text-xs px-2 py-0.5 rounded-sm transition-colors"
          style={{
            background: "var(--bg-elevated)",
            color: status === "connected" && input ? "var(--accent)" : "var(--text-muted)",
            border: "1px solid var(--border)",
            fontFamily: "var(--font-mono)",
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
