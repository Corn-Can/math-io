/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}", // <--- 關鍵是這一行
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}