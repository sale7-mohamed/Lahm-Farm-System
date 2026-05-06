/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#198754', dark: '#146c43', light: '#e8f5e9' },
        secondary: { DEFAULT: '#f8f9fa', dark: '#e9ecef' },
        accent: { DEFAULT: '#ffc107', hover: '#e0a800' },
        dark: '#212529',
        muted: '#6c757d',
        danger: '#dc3545',
      },
      fontFamily: {
        sans: ['Cairo', 'sans-serif'],
      },
      container: {
        center: true,
        padding: '1rem',
        screens: { sm: '600px', md: '728px', lg: '984px', xl: '1240px' },
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in',
        'fade-in-up': 'fadeInUp 0.5s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
}
