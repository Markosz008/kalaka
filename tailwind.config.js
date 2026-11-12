/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        pilis: {
          DEFAULT: '#1E4635',
          light: '#2A5C46',
          soft: '#E1EFE8'
        },
        terracotta: {
          DEFAULT: '#C86446',
          soft: '#FAEBE6'
        },
        limestone: {
          DEFAULT: '#F5F2EB',
          card: '#FFFFFF'
        }
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};
