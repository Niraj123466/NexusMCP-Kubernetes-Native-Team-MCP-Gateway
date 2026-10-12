/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: "#0a0c10",
          subtle: "#0f1218",
          card: "#131720",
          elevated: "#181d28",
          border: "rgba(255, 255, 255, 0.08)",
          "border-focus": "rgba(16, 185, 129, 0.4)",
        },
        emerald: {
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
        },
        brand: {
          500: "#10b981",
          600: "#059669",
        },
        dark: {
          900: "#0a0c10",
          850: "#0f1218",
          800: "#131720",
          750: "#181d28",
          700: "#222838",
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'glow-emerald': '0 0 20px -5px rgba(16, 185, 129, 0.25)',
        'subtle': '0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px -1px rgba(0, 0, 0, 0.3)',
      }
    },
  },
  plugins: [],
}
