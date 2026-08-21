/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ground: {
          DEFAULT: "var(--color-ground)",
          raised: "var(--color-ground-raised)",
        },
        ink: {
          DEFAULT: "var(--color-ink)",
          muted: "var(--color-ink-muted)",
        },
        score: {
          good: "var(--color-score-good)",
          mid: "var(--color-score-mid)",
          bad: "var(--color-score-bad)",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        tabular: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
