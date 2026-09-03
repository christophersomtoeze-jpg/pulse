/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Brand — cyan/teal energy
        pulse: {
          50: '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490',
          800: '#155e75',
          900: '#164e63',
        },
        // Accent — emerald
        flux: {
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
        },
        // Alert — amber/rose
        alert: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
        ember: {
          400: '#fb7185',
          500: '#f43f5e',
          600: '#e11d48',
        },
        // Neutrals — deep blue-black
        ink: {
          950: '#06070d',
          900: '#0a0c14',
          850: '#0e111a',
          800: '#121622',
          750: '#1a1f2e',
          700: '#232938',
          600: '#2e3548',
          500: '#3b4257',
          400: '#525a72',
          300: '#717a96',
          200: '#9ca5bf',
          100: '#c9d0e3',
          50: '#eef1f8',
        },
      },
      boxShadow: {
        'glow-sm': '0 0 12px -2px rgba(34, 211, 238, 0.3)',
        glow: '0 0 24px -4px rgba(34, 211, 238, 0.35)',
        'glow-lg': '0 0 40px -8px rgba(34, 211, 238, 0.4)',
        card: '0 8px 32px -8px rgba(0, 0, 0, 0.6)',
      },
      borderRadius: {
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
    },
  },
  plugins: [],
};
