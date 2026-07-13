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
        // Brand accent: cyan/teal — technical, infra-tool feel (Netlify/Supabase
        // family), pairs with a near-black base + monospace, and stays distinct
        // from the semantic status greens/ambers/reds below. Swap freely.
        primary: {
          DEFAULT: '#22D3EE',
          light: '#67E8F9',
          dark: '#0E7490',
        },
        // Secondary = a calm slate for secondary buttons/borders on dark.
        secondary: {
          DEFAULT: '#64748B',
          light: '#94A3B8',
          dark: '#475569',
        },
        // Semantic status — wire StatusChip / online dots / exit codes to these.
        success: { DEFAULT: '#22C55E', light: '#4ADE80', dark: '#15803D' }, // running / online / exit 0
        warning: { DEFAULT: '#F59E0B', light: '#FBBF24', dark: '#B45309' }, // queued / dirty
        danger: { DEFAULT: '#EF4444', light: '#F87171', dark: '#B91C1C' },  // failed / exit != 0
        info: { DEFAULT: '#3B82F6', light: '#60A5FA', dark: '#1D4ED8' },
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
        // Dark-first surfaces (near-black, GitHub-dark family) + an elevated layer.
        surface: {
          DEFAULT: '#FFFFFF',
          dark: '#0D1117',
          elevated: '#161B22',
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
