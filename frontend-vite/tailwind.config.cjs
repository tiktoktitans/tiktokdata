/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./index.html",            // Scan index.html for class names
    "./src/**/*.{js,ts,jsx,tsx}" // Scan ALL .js/.ts/.jsx/.tsx under /src
  ],
  theme: {
    extend: {
      colors: {
        pageBg: "#0F0F12",
        cardBg: "#1A1A1F",
        primary: "#FFFFFF",
        secondary: "#A1A1AA",
        accent: "#FF6B00",
        borderColor: "#2C2C33",
      },
    },
  },
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/typography"),
  ],
};
