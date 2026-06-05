/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        bg: {
          base:     '#0F1117',
          card:     '#1A1D2E',
          elevated: '#242741',
          sidebar:  '#12152A',
        },
        border: {
          DEFAULT: '#2D3460',
          subtle:  '#1E2340',
          strong:  '#3D4478',
        },
        accent: {
          blue:   '#3B82F6',
          green:  '#10B981',
          amber:  '#F59E0B',
          red:    '#EF4444',
          purple: '#8B5CF6',
          cyan:   '#06B6D4',
          orange: '#F97316',
          pink:   '#EC4899',
          indigo: '#6366F1',
        },
        text: {
          primary:   '#F1F5F9',
          secondary: '#94A3B8',
          muted:     '#475569',
          disabled:  '#334155',
        },
      },
      boxShadow: {
        card:  '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
        modal: '0 20px 60px rgba(0,0,0,0.6)',
        glow:  '0 0 20px rgba(59,130,246,0.15)',
      },
      animation: {
        'fade-in':    'fadeIn 0.2s ease-out',
        'slide-in':   'slideIn 0.25s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: 0 }, to: { opacity: 1 } },
        slideIn: { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
}
