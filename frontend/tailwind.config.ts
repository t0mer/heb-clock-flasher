import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        display: ["Syne", "sans-serif"],
        sans:    ["DM Sans", "sans-serif"],
        mono:    ["Fira Code", "monospace"],
      },
      colors: {
        base:    "var(--bg-base)",
        surface: "var(--bg-surface)",
        elevated:"var(--bg-elevated)",
        card:    "var(--bg-card)",
        accent:  "var(--accent)",
        amber:   "var(--amber)",
        success: "var(--green)",
        danger:  "var(--red)",
      },
      borderColor: {
        DEFAULT: "var(--border)",
        accent:  "var(--accent)",
        dim:     "var(--accent-dim)",
      },
      textColor: {
        primary:   "var(--text-primary)",
        secondary: "var(--text-secondary)",
        muted:     "var(--text-muted)",
        accent:    "var(--accent)",
      },
    },
  },
  plugins: [],
} satisfies Config;
