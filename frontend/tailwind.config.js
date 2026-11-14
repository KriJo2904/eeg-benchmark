/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#f7fafc",
        surface: "#ffffff",
        border: "#d7e0ea",
        text: "#0b1b2a",
        muted: "#516579",
        accent: "#1e66d0",
        accentSoft: "#e7f0ff",
        ok: "#1a7f37",
        warn: "#b54708",
        warnSoft: "#fff6e5",
        danger: "#b42318",
        dangerSoft: "#ffefe9",
      },
    },
  },
  plugins: [],
};

