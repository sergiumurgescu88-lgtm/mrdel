/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'dark-bg': '#0f172a',
        'card-bg': '#1e293b',
        'neon-blue': '#00f3ff',
        'neon-purple': '#bd00ff',
        'neon-pink': '#ff00ea',
      }
    },
  },
  plugins: [],
}
