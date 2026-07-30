import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17202a",
        paper: "#f2fafb",          // very light teal-tinted white
        line: "#cce6e8",           // teal-tinted border
        accent: "#3eadb0",         // DocWise mid teal (primary)
        "accent-light": "#62cece", // bright highlight teal
        "accent-dark": "#2a8286",  // deep shadow teal
        signal: "#b7472a",
      },
      boxShadow: {
        "2xs": "0 1px 2px 0 rgb(0 0 0 / 0.04)",
        xs: "0 1px 3px 0 rgb(0 0 0 / 0.08)",
        "accent-glow": "0 4px 24px 0 rgba(62,173,176,0.28)",
      },
    },
  },
  plugins: [],
} satisfies Config;
