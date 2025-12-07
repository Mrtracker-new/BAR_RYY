/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          400: '#FDB022',
          500: '#F59E0B',
          600: '#D97706',
        },
        dark: {
          900: '#0A0A0A',
          800: '#111111',
          700: '#1A1A1A',
          600: '#2A2A2A',
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float-slow': 'float-slow 8s ease-in-out infinite',
      },
      keyframes: {
        'float-slow': {
          '0%, 100%': { 
            transform: 'translate(0, 0) scale(1)',
            opacity: '0.3'
          },
          '50%': { 
            transform: 'translate(20px, -20px) scale(1.05)',
            opacity: '0.4'
          },
        }
      }
    },
  },
  plugins: [],
}
