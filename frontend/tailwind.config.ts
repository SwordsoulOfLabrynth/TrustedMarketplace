import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ivory: {
          50: "#FDFCFB",
          100: "#FBF9F5", // Core canvas background
          200: "#F5F2EB", // Subtle contrast surface
          300: "#EAE6DF", // Delicate border line
        },
        ink: {
          900: "#1C1E21", // Primary text / deep charcoal
          700: "#374151", // High-contrast body text
          500: "#6B7280", // Muted secondary captions
          300: "#9CA3AF", // Soft placeholders / borders
        },
        jade: {
          50: "#E6F4EA",  // Light badge background
          100: "#CEEAD6",
          200: "#A3D9C9", // Badge border
          300: "#6EE7B7",
          400: "#34D399",
          500: "#10B981",
          600: "#16795F", // Vibrant emerald
          700: "#0F5B46", // Primary trust brand color
          800: "#0D4D3B", // Deep teak green
          900: "#0A3C2F", // Deep forest
        },
        gold: {
          50: "#FFFBEB",
          100: "#FEF3C7", // Star badge background
          500: "#F59E0B", // Bright star
          600: "#D97706", // Amber gold review rating
        },
        coral: {
          50: "#FEF2F2",
          100: "#FEE2E2", // Dispute alert background
          600: "#DC2626", // Warning / Disputed status
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "var(--font-myanmar)", "Noto Sans Myanmar", "Pyidaungsu", "sans-serif"],
      },
      lineHeight: {
        burmese: "1.7",
      },
      maxWidth: {
        mobile: "390px",
      },
    },
  },
  plugins: [],
};

export default config;
