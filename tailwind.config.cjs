const plugin = require('tailwindcss/plugin')

module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Palette pompiers adaptée
        primary: {
          DEFAULT: '#FF4F00', // Rouge pompier vif
          dark: '#CC3F00',
          light: '#FF6B35',
        },
        accent: {
          gold: '#D4AF37', // Or métallique
          goldDark: '#B8942D',
        },
        surface: {
          dark: '#1a1a1a', // Anthracite pour footer/header
          light: '#ffffff',
          soft: '#f8fafc',
        },
        // Couleurs sémantiques
        success: '#006400',
        info: '#254fad',
        muted: '#41454d',
        // Palette "Caserne 1847" — extraite de l'écusson (brique, pétrole, ciel)
        brand: {
          brick: '#9E2222',
          brickDark: '#7A1818',
          alert: '#D8341F',
          petrol: '#1C6E82',
          petrolDark: '#134F5E',
          sky: '#74C7E8',
          ink: '#181410',
          parchment: '#F3ECDC',
          paper: '#FBF7EE',
          hairline: '#DCD0B4',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Big Shoulders Display"', '"Arial Narrow"', 'sans-serif'],
        body: ['"Public Sans"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xs: '2px',
        sm: '6px',
        md: '10px',
        lg: '12px',
        pill: '9999px',
        full: '9999px',
      },
      spacing: {
        xxs: '4px',
        xs: '8px',
        sm: '12px',
        md: '16px',
        lg: '24px',
        xl: '32px',
        xxl: '48px',
        section: '96px',
      },
    },
  },
  plugins: [
    plugin(function({ addBase }) {
      addBase({
        '@media (prefers-reduced-motion: reduce)': {
          '*': {
            animationDuration: '0.01ms !important',
            animationIterationCount: '1 !important',
            transitionDuration: '0.01ms !important',
          },
        },
      })
    }),
  ],
}