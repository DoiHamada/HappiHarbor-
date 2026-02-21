import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        harbor: {
          mint: "#dff7ef",
          peach: "#ffe6db",
          sky: "#d8e9ff",
          cream: "#fffaf1",
          ink: "#253045",
          coral: "#ff8a7a"
        }
      },
      borderRadius: {
        xl2: "1.25rem"
      },
      boxShadow: {
        soft: "0 12px 36px -16px rgba(37, 48, 69, 0.25)"
      }
    }
  },
  plugins: []
} satisfies Config;
