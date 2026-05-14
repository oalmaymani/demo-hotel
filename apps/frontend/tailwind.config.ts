import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#1F3B2C",
        accent: "#C8A24A",
        bg: "#F7F6F2"
      }
    }
  },
  plugins: []
} satisfies Config;
