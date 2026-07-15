import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17202a",
        paper: "#f7f5ef",
        line: "#d8d3c8",
        accent: "#246b5c",
        signal: "#b7472a",
      },
    },
  },
  plugins: [],
} satisfies Config;
