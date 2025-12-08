/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        serif: ["Playfair Display", "ui-serif", "Georgia", "serif"]
      },
      colors: {
        shotzi: {
          ink: "#322D29",
          wine: "#72383D",
          mocha: "#AC9C8D",
          sand: "#D1C7BD",
          silver: "#D9D9D9",
          cream: "#EFE9E1"
        }
      },
      borderRadius: {
        "2xl": "1.25rem",
        "3xl": "1.75rem"
      }
    },
  },
  plugins: [],
};
