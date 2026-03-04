import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "sp-black": "#000000",
        "sp-dark": "#060606",
        "sp-card": "#141414",
        "sp-hover": "#1c1c1c",
        "sp-green": "#1db954",
        "sp-green-light": "#1ed760",
        "sp-muted": "#4a4a4a",
        "sp-sub": "#a0a0a0",
        "sp-glass": "rgba(255,255,255,0.04)",
        "sp-accent": "#6366f1",
        "sp-rose": "#f43f5e",
        "sp-amber": "#f59e0b",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      keyframes: {
        eq1: { "0%,100%": { height: "4px" }, "50%": { height: "18px" } },
        eq2: { "0%,100%": { height: "14px" }, "50%": { height: "4px" } },
        eq3: { "0%,100%": { height: "8px" }, "50%": { height: "22px" } },
        eq4: { "0%,100%": { height: "12px" }, "50%": { height: "6px" } },
        eq5: { "0%,100%": { height: "6px" }, "50%": { height: "16px" } },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        fadeIn: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        fadeUp: {
          from: { opacity: "0", transform: "translateY(24px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideInRight: {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        scaleIn: {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
        gradientShift: {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
        glowPulse: {
          "0%,100%": { opacity: "0.4" },
          "50%": { opacity: "0.8" },
        },
        vinylSpin: {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        breathe: {
          "0%,100%": { transform: "scale(1)", opacity: "0.6" },
          "50%": { transform: "scale(1.05)", opacity: "1" },
        },
      },
      animation: {
        eq1: "eq1 0.75s ease-in-out infinite",
        eq2: "eq2 0.75s ease-in-out infinite 0.15s",
        eq3: "eq3 0.75s ease-in-out infinite 0.3s",
        eq4: "eq4 0.75s ease-in-out infinite 0.1s",
        eq5: "eq5 0.75s ease-in-out infinite 0.25s",
        shimmer: "shimmer 1.6s linear infinite",
        fadeIn: "fadeIn 0.3s cubic-bezier(0.16,1,0.3,1) forwards",
        fadeUp: "fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) forwards",
        slideInRight: "slideInRight 0.3s cubic-bezier(0.16,1,0.3,1) forwards",
        scaleIn: "scaleIn 0.25s cubic-bezier(0.16,1,0.3,1) forwards",
        float: "float 3s ease-in-out infinite",
        gradientShift: "gradientShift 8s ease infinite",
        glowPulse: "glowPulse 3s ease-in-out infinite",
        vinylSpin: "vinylSpin 3s linear infinite",
        slideUp: "slideUp 0.35s cubic-bezier(0.16,1,0.3,1) forwards",
        breathe: "breathe 4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
