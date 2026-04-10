/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Design system tokens
        surface: {
          DEFAULT: '#0c0c0c',
          50:  '#f5f5f5',
          100: '#1a1a1a',
          200: '#222222',
          300: '#2a2a2a',
          400: '#333333',
        },
        amber: {
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#E8A020',
          600: '#D08000',
          700: '#B06800',
        },
        violet: {
          400: '#A78BFA',
          500: '#8B5CF6',
          600: '#7C3AED',
        },
        // Legacy compat
        gold: {
          400: '#FDB022',
          500: '#E8A020',
          600: '#D97706',
        },
        dark: {
          900: '#080808',
          800: '#0c0c0c',
          700: '#111111',
          600: '#1a1a1a',
          500: '#222222',
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
        'amber-sm': '0 0 12px rgba(232, 160, 32, 0.15)',
        'amber-md': '0 0 24px rgba(232, 160, 32, 0.20)',
        'amber-lg': '0 0 48px rgba(232, 160, 32, 0.25)',
        'surface': '0 1px 3px rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.3)',
        'surface-lg': '0 4px 6px rgba(0,0,0,0.5), 0 20px 48px rgba(0,0,0,0.4)',
      },
    },
  },
  plugins: [],
}
