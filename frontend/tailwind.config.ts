import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/services/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/store/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        cosmic: {
          950: "#040914",
          900: "#0a1225",
          800: "#111d3a",
          700: "#1a2d54"
        },
        neon: {
          cyan: "#35f2d1",
          violet: "#7ea2ff",
          coral: "#ff7c8d",
          amber: "#ffd173"
        }
      },
      boxShadow: {
        panel: "0 24px 80px rgba(3, 8, 25, 0.5), inset 0 1px 0 rgba(255,255,255,.08)"
      },
      backgroundImage: {
        "mesh-orbit":
          "radial-gradient(circle at 12% 10%, rgba(126, 162, 255, .26) 0, transparent 34%), radial-gradient(circle at 86% 6%, rgba(53, 242, 209, .2) 0, transparent 32%), linear-gradient(155deg, #040914 0%, #0a1225 45%, #111d3a 100%)"
      }
    }
  },
  plugins: []
};

export default config;
