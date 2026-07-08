/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#6C63FF',
          light: '#9D97FF',
          dark: '#4B44CC',
        },
        secondary: {
          DEFAULT: '#FF6584',
          light: '#FF94A8',
          dark: '#CC4D68',
        },
        neutral: {
          50: '#FAFAFA',
          100: '#F5F5F5',
          200: '#E5E5E5',
          300: '#D4D4D4',
          400: '#A3A3A3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          dark: '#1A1A1A',
        },
      },
      borderRadius: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        '2xl': '24px',
        '3xl': '32px',
      },
      zIndex: {
        base: '0',
        raised: '10',
        overlay: '20',
        modal: '30',
        toast: '40',
        top: '50',
      },
    },
  },
  plugins: [],
};
