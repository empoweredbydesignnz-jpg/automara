module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        theme: {
          primary: 'rgb(var(--color-primary) / <alpha-value>)',
          'primary-dark': 'rgb(var(--color-primary-dark) / <alpha-value>)',
          secondary: 'rgb(var(--color-secondary) / <alpha-value>)',
          'secondary-dark': 'rgb(var(--color-secondary-dark) / <alpha-value>)',
          accent: 'rgb(var(--color-accent) / <alpha-value>)',
          'accent-alt': 'rgb(var(--color-accent-alt) / <alpha-value>)',
        }
      }
    },
  },
  plugins: [],
}
