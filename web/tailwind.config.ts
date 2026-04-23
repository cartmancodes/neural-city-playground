import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          900: "#0b1220",
          800: "#111a2e",
          700: "#1b2540",
          600: "#27324f",
          500: "#3b4666",
          400: "#5a6687",
          300: "#8692b2",
          200: "#c6cbdc",
          100: "#e4e7f1",
        },
        accent: {
          DEFAULT: "#1867d8",
          500: "#1867d8",
          400: "#3684f4",
          300: "#6ba5fa",
          200: "#bbd7ff",
          100: "#e4efff",
        },
        risk: {
          critical: "#b8283b",
          high: "#d7783b",
          medium: "#d4aa2a",
          watch: "#4e8c5b",
          good: "#2f7d51",
        },
      },
      fontFamily: {
        sans: [
          'InterVariable',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'system-ui',
          'sans-serif',
        ],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
export default config;
