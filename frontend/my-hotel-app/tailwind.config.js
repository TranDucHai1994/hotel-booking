/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#0057FF',
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#0057FF',
          600: '#004de6',
          700: '#0043cc',
        },
        surface: '#FFFFFF',
        background: '#F7F7F7',
        'text-primary': '#1A1A1A',
        'text-secondary': '#6B7280',
        'text-muted': '#9CA3AF',
        'price-accent': '#FF6B2C',
        'sale-badge': '#FF3B30',
        star: '#F59E0B',
        border: 'rgba(0,0,0,0.08)',
        'hover-surface': '#F0F4FF',
      },
      borderRadius: {
        card: '12px',
        input: '8px',
        hero: '20px',
      },
      boxShadow: {
        'card-default': '0 1px 4px rgba(0,0,0,0.06)',
        'card-hover': '0 4px 16px rgba(0,0,0,0.10)',
        'search-bar': '0 4px 20px rgba(0,0,0,0.12)',
      },
      spacing: {
        '4.5': '18px',
      },
      fontSize: {
        '2xs': ['11px', { lineHeight: '16px' }],
      },
    },
  },
  plugins: [],
}