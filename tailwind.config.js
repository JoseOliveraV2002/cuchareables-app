/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./lib/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#FBF7F1",
        surface: "#FFFFFF",
        ink: "#3A2A1E",
        inksoft: "#7A6A57",
        line: "#E7DCC9",
        caramel: "#A15C2B",
        carameldark: "#7E4620",
        sage: "#5F7355",
        sagebg: "#EEF2E9",
        brick: "#A23E3E",
        brickbg: "#F7EAEA",
        chip: "#F3EADA",
      },
      fontFamily: {
        display: ["Georgia", "Cambria", "serif"],
        body: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      borderRadius: {
        card: "10px",
      },
    },
  },
  plugins: [],
};
