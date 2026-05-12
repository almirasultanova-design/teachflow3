/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#1a1c30',
          soft: '#252845',
          panel: '#2c2f4d',
          ring: '#3f4366',
        },
        ink: {
          DEFAULT: '#fafafd',
          muted: '#d0d0e2',
          dim: '#9b9bb6',
        },
        brand: {
          DEFAULT: '#b9a3ff',
          accent: '#f472b6',
          glow: '#22d3ee',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Sora', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 30px -5px rgba(167, 139, 250, 0.45)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: 0, transform: 'translateY(6px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        pulse_soft: {
          '0%,100%': { opacity: 0.55 },
          '50%': { opacity: 1 },
        },
      },
      animation: {
        'fade-up': 'fade-up 200ms ease-out',
        'pulse-soft': 'pulse_soft 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
