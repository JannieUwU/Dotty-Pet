/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
        roboto: ['Roboto', 'sans-serif'],
        londrina: ['"Londrina Sketch"', 'cursive'],
      },
      colors: {
        tag: {
          teal: '#83B5B5',
          peach: '#F9CE9C',
          green: '#C1D09D',
          blue: '#BFC5D5',
        },
      },
    },
  },
  plugins: [],
}
