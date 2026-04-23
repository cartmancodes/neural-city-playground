import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#05080f",
          900: "#0a0f1c",
          800: "#111827",
          700: "#1f2937",
          600: "#334155",
          500: "#64748b",
          400: "#94a3b8",
          300: "#cbd5e1",
          200: "#e5e7eb",
          100: "#f1f5f9",
        },
        accent: {
          50: "#fff8eb",
          100: "#fff0c7",
          200: "#ffe08a",
          300: "#ffcb49",
          400: "#ffb721",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
        },
        teal: {
          500: "#14b8a6",
          600: "#0d9488",
          700: "#0f766e",
        },
        ok: "#22c55e",
        warn: "#f59e0b",
        bad: "#ef4444",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "Menlo", "monospace"],
      },
      boxShadow: {
        tile: "0 1px 0 0 rgb(255 255 255 / 0.04) inset, 0 1px 3px rgb(0 0 0 / 0.4)",
      },
      fontSize: {
        "2xs": "0.625rem",
      },
    },
  },
  plugins: [],
};

export default config;
