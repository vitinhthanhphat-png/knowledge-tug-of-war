/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%, 100%': { filter: 'drop-shadow(0 0 15px rgba(255,255,255,0.6))' },
          '50%': { filter: 'drop-shadow(0 0 30px rgba(255,255,255,1))' },
        }
      },
      animation: {
        float: 'float 3s ease-in-out infinite',
        glow: 'glow 2s ease-in-out infinite',
      },
      colors: {
        surface: {
          DEFAULT: '#f9f9ff',
          dim: '#cfdaf2',
          bright: '#f9f9ff',
          lowest: '#ffffff',
          low: '#f0f3ff',
          container: '#e7eeff',
          high: '#dee8ff',
          highest: '#d8e3fb',
        },
        'on-surface': '#111c2d',
        'on-surface-variant': '#3d4a3d',
        'inverse-surface': '#263143',
        'inverse-on-surface': '#ecf1ff',
        outline: {
          DEFAULT: '#6d7b6c',
          variant: '#bccbb9',
        },
        primary: {
          DEFAULT: '#006e2f',
          container: '#22c55e',
        },
        secondary: {
          DEFAULT: '#0058be',
          container: '#2170e4',
        },
        tertiary: {
          DEFAULT: '#b91a24',
          container: '#ff8a83',
        },
        'accent-glow': '#f97316',
      },
      fontFamily: {
        'display-force': ['"Space Grotesk"', 'sans-serif'],
        'headline-lg-mobile': ['"Plus Jakarta Sans"', 'sans-serif'],
        'headline-lg': ['"Plus Jakarta Sans"', 'sans-serif'],
        'label-caps': ['"Space Grotesk"', 'sans-serif'],
        'body-md': ['"Plus Jakarta Sans"', 'sans-serif'],
        'key-hint': ['"Space Grotesk"', 'sans-serif'],
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      fontSize: {
        'display-force': ['48px', { lineHeight: '48px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-lg-mobile': ['24px', { lineHeight: '32px', fontWeight: '800' }],
        'headline-lg': ['32px', { lineHeight: '40px', fontWeight: '800' }],
        'label-caps': ['14px', { lineHeight: '16px', letterSpacing: '0.05em', fontWeight: '700' }],
        'body-md': ['16px', { lineHeight: '24px', fontWeight: '500' }],
        'key-hint': ['18px', { lineHeight: '18px', fontWeight: '700' }],
      },
      borderRadius: {
        sm: '0.25rem',
        DEFAULT: '0.5rem',
        md: '0.75rem',
        lg: '1rem',
        xl: '1.5rem',
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '48px',
        'meter-height': '32px',
        'container-max': '1200px',
      },
    },
  },
  plugins: [],
}
