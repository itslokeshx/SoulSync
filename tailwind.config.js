/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        "sp-black": "#0a0a0a",
        "sp-dark": "#121212",
        "sp-card": "#181818",
        "sp-hover": "#282828",
        "sp-green": "#1db954",
        "sp-green-light": "#1ed760",
        "sp-muted": "#535353",
        "sp-sub": "#b3b3b3",
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
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        fadeUp: {
          from: { opacity: "0", transform: "translateY(40px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideInRight: {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        scaleIn: {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        eq1: "eq1 0.75s ease-in-out infinite",
        eq2: "eq2 0.75s ease-in-out infinite 0.15s",
        eq3: "eq3 0.75s ease-in-out infinite 0.3s",
        eq4: "eq4 0.75s ease-in-out infinite 0.1s",
        eq5: "eq5 0.75s ease-in-out infinite 0.25s",
        shimmer: "shimmer 1.6s linear infinite",
        fadeIn: "fadeIn 0.2s ease forwards",
        fadeUp: "fadeUp 0.3s ease forwards",
        slideInRight: "slideInRight 0.25s ease forwards",
        scaleIn: "scaleIn 0.2s ease forwards",
      },
    },
  },
  plugins: [],
};
