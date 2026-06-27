/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0B0E14',
        panel: '#131826',
        panelborder: '#1F2937',
        signal: '#5EEAD4',
        progress: '#F59E0B',
        err: '#F87171',
        muted: '#94A3B8',
        ink: '#E2E8F0',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
      },
      keyframes: {
        pulse_dot: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.35 },
        },
        signal_travel: {
          '0%': { left: '0%', opacity: 0 },
          '10%': { opacity: 1 },
          '90%': { opacity: 1 },
          '100%': { left: '100%', opacity: 0 },
        },
        fade_up: {
          '0%': { opacity: 0, transform: 'translateY(6px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
      },
      animation: {
        pulse_dot: 'pulse_dot 1.4s ease-in-out infinite',
        signal_travel: 'signal_travel 1.6s linear infinite',
        fade_up: 'fade_up 0.35s ease-out',
      },
    },
  },
  plugins: [],
}
