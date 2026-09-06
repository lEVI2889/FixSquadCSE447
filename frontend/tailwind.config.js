/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        indigo: {
          50: '#f4fbf7',
          100: '#dff6ea', // mint-pale
          200: '#b8eed3',
          300: '#8ae2bb',
          400: '#62d6aa', // mint
          500: '#3ebc8d', 
          600: '#2c926c',
          700: '#123f36', // forest
          800: '#0d302a', // forest-dark
          900: '#16332e', // ink
          950: '#0a1a17', 
        },
        slate: {
          50: '#f8f7f2', // cream
          100: '#f0f3f2',
          200: '#dfe4dd', // line
          300: '#bccbc7',
          400: '#90a6a0',
          500: '#5d6e6a', // ink-soft
          600: '#465451',
          700: '#333e3c',
          800: '#222928',
          900: '#16332e', // ink
          950: '#0d1f1c',
        }
      }
    },
  },
  plugins: [],
};
