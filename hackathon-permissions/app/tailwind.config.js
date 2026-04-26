/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Government-grade neutral palette
        ink: {
          50: "#f7f9fc",
          100: "#eef2f7",
          200: "#dde4ee",
          300: "#c2cdde",
          400: "#8d9bb5",
          500: "#5d6d8a",
          600: "#3f4d68",
          700: "#2c3852",
          800: "#1c243a",
          900: "#101627",
          950: "#070b16",
        },
        gov: {
          // Indian state-tech accent (deep navy + saffron sparingly)
          navy: "#0b2545",
          steel: "#13315c",
          slate: "#1d3461",
          mist: "#e3eaf3",
          accent: "#0a7cad",
          saffron: "#d97706",
        },
        status: {
          pass: "#0e8a51",
          passBg: "#dcf5e8",
          warn: "#b45309",
          warnBg: "#fdf3d4",
          fail: "#b91c1c",
          failBg: "#fde2e2",
          review: "#1d4ed8",
          reviewBg: "#dee8ff",
          info: "#0369a1",
          infoBg: "#dceefb",
          neutral: "#475569",
          neutralBg: "#e2e8f0",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Inter", "ui-sans-serif", "system-ui"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,22,39,0.04), 0 1px 3px rgba(16,22,39,0.06)",
        elev: "0 4px 12px rgba(16,22,39,0.08), 0 1px 3px rgba(16,22,39,0.06)",
        focus: "0 0 0 3px rgba(10,124,173,0.25)",
      },
      borderRadius: {
        xl: "0.875rem",
      },
    },
  },
  plugins: [],
};
