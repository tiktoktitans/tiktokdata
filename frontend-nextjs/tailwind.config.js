/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'pageBg': '#0a0a0a',
        'cardBg': '#1a1a1a',
        'borderColor': '#27272a',
        'primary': '#ffffff',
        'secondary': '#a1a1aa',
        'accent': '#f97316',
      },
    },
  },
  plugins: [],
}