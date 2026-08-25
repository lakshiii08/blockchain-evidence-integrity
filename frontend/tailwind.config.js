/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        police: {
          900: "#0B132B",
          800: "#1C2541",
          700: "#3A506B",
          600: "#4B6B94",
          500: "#5BC0BE",
          100: "#EBF2FA"
        }
      }
    },
  },
  plugins: [],
}
