/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    container: { center: true, padding: { DEFAULT: '1rem', sm: '1.5rem', lg: '2rem' } },
    extend: {
      colors: {
        bg: token('c-bg'),
        surface: token('c-surface'),
        'surface-2': token('c-surface-2'),
        border: token('c-border'),
        fg: token('c-fg'),
        muted: token('c-muted'),
        accent: token('c-accent'),
        'accent-ink': token('c-accent-ink'),
        'on-accent': token('c-on-accent'),
        success: token('c-success'),
        danger: token('c-danger'),
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      maxWidth: { page: '76rem', 'page-wide': '100rem' },
      letterSpacing: { marca: '0.32em' },
    },
  },
  plugins: [],
};
