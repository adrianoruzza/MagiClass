/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
      },
      colors: {
        primary: '#810027', // RGB 129, 0, 39
        'primary-hover': '#60001d',
        'primary-light': '#a33352',
      }
    },
  },
  plugins: [],
}