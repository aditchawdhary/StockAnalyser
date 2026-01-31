/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Robinhood-inspired color palette
        'rh-green': {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',  // Primary green
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        'rh-teal': {
          500: '#00C805',  // Robinhood signature green
          600: '#00B004',
        },
        'rh-dark': {
          900: '#0F1419',
          800: '#1C1F26',
          700: '#2D3139',
        }
      },
      fontFamily: {
        'sans': ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-green': 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
        'gradient-hero': 'linear-gradient(180deg, #f9fafb 0%, #ffffff 100%)',
      },
      boxShadow: {
        'rh': '0 4px 20px rgba(0, 0, 0, 0.08)',
        'rh-lg': '0 10px 40px rgba(0, 0, 0, 0.12)',
      }
    },
  },
  plugins: [],
}
