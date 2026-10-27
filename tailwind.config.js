/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './apps/web/src/**/*.{js,ts,jsx,tsx,mdx}',
    './apps/web/src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './apps/web/src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './apps/web/src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#1d4ed8',
          600: '#0f3b7d',
          700: '#0d2f66',
          800: '#0a224a',
          accent: '#e11d48'
        }
      }
    },
  },
  plugins: [],
}

