import { Link, useLocation } from "react-router-dom";

const NAV_LINKS = [
  { to: "/", label: "Products" },
];

export function Navbar() {
  const { pathname } = useLocation();

  return (
    <header
      className="sticky top-0 z-50 border-b"
      style={{
        background: "rgba(4, 8, 15, 0.85)",
        backdropFilter: "blur(12px)",
        borderColor: "var(--border)",
      }}
    >
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-6">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group flex-shrink-0">
          {/* Circuit chip icon */}
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            className="text-accent"
          >
            <rect x="6" y="6" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" />
            <rect x="9" y="9" width="6" height="6" fill="currentColor" opacity="0.3" />
            <line x1="9" y1="3" x2="9" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="12" y1="3" x2="12" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="15" y1="3" x2="15" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="9" y1="18" x2="9" y2="21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="12" y1="18" x2="12" y2="21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="15" y1="18" x2="15" y2="21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="3" y1="9" x2="6" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="3" y1="12" x2="6" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="3" y1="15" x2="6" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="18" y1="9" x2="21" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="18" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="18" y1="15" x2="21" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span
            className="font-display font-700 text-sm tracking-widest uppercase"
            style={{ color: "var(--text-primary)", letterSpacing: "0.15em" }}
          >
            ESP<span style={{ color: "var(--accent)" }}>·</span>Flasher
          </span>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-1">
          {NAV_LINKS.map(({ to, label }) => {
            const isActive = pathname === to || (to !== "/" && pathname.startsWith(to));
            return (
              <Link
                key={to}
                to={to}
                className="px-3 py-1.5 rounded-sm text-sm font-medium transition-colors"
                style={{
                  fontFamily: "var(--font-display)",
                  color: isActive ? "var(--accent)" : "var(--text-secondary)",
                  background: isActive ? "var(--accent-glow)" : "transparent",
                }}
              >
                {label}
              </Link>
            );
          })}

          <a
            href="https://github.com/t0mer"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 p-1.5 rounded-sm transition-colors"
            style={{ color: "var(--text-muted)" }}
            aria-label="GitHub"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
          </a>
        </nav>
      </div>
      {/* Accent line at bottom */}
      <div className="glow-line" />
    </header>
  );
}
