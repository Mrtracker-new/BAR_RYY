/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Notebook palette — cream paper & sepia ink
        surface: {
          DEFAULT: '#FAF4E6',
          50:  '#FFFDF6',
          100: '#F1E8D3',
          200: '#E6D9BC',
          300: '#D8C9A6',
          400: '#C3B48F',
        },
        amber: {
          300: '#E8C85A',
          400: '#CE9530',
          500: '#B4791E',
          600: '#8F5E16',
          700: '#6E4711',
        },
        violet: {
          400: '#6B3FA0',
          500: '#573385',
          600: '#43276A',
        },
        // Legacy compat → wax-seal gold
        gold: {
          400: '#CE9530',
          500: '#B4791E',
          600: '#8F5E16',
        },
        // "dark" palette repurposed as warm paper tones so legacy
        // from-dark-800/to-dark-900 card gradients render as cream pages
        dark: {
          900: '#EDE3CE',
          800: '#FAF4E6',
          700: '#E6D9BC',
          600: '#F1E8D3',
          500: '#D8C9A6',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fade-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-up': 'slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'glow-pulse': 'glow-pulse 3s ease-in-out infinite',
        'scan': 'scan 3s linear infinite',
        'shimmer': 'shimmer 2.5s linear infinite',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.8' },
        },
        'scan': {
          '0%': { top: '0%' },
          '100%': { top: '100%' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      transitionDuration: {
        '400': '400ms',
      },
      boxShadow: {
        'amber-sm': '0 0 12px rgba(180, 121, 30, 0.15)',
        'amber-md': '0 0 24px rgba(180, 121, 30, 0.20)',
        'amber-lg': '0 0 48px rgba(180, 121, 30, 0.25)',
        'surface': '0 1px 3px rgba(60,45,20,0.12), 0 8px 24px rgba(60,45,20,0.10)',
        'surface-lg': '0 4px 6px rgba(60,45,20,0.14), 0 20px 48px rgba(60,45,20,0.14)',
      },
    },
  },
  plugins: [],
}
