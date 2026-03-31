/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        dark: {
          900: "#080c16",
          800: "#0a1020",
          700: "#0d1525",
          600: "#111a30",
        },
      },
    },
  },
  plugins: [],
};
