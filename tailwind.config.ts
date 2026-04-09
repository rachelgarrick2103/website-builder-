import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#111111",
        muted: "#f6f6f6",
        border: "#e7e7e7"
      },
      fontFamily: {
        body: ["Inter", "system-ui", "sans-serif"],
        display: ["Bebas Neue", "Arial Narrow", "sans-serif"]
      },
      boxShadow: {
        panel: "0 10px 40px rgba(0,0,0,0.06)"
      }
    }
  },
  plugins: []
};

export default config;
