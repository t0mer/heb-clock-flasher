import { type ReactNode } from "react";
import { Navbar } from "./Navbar";

interface Props {
  children: ReactNode;
}

export function Layout({ children }: Props) {
  return (
    <div className="min-h-full flex flex-col" style={{ background: "var(--bg-base)" }}>
      <Navbar />
      <main className="flex-1">{children}</main>
      <footer
        className="border-t py-6"
        style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
      >
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            ESP·Flasher — self-hosted firmware flashing
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Apache-2.0 ·{" "}
            <a
              href="https://github.com/t0mer"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-accent transition-colors"
              style={{ color: "var(--text-muted)" }}
            >
              github.com/t0mer
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
