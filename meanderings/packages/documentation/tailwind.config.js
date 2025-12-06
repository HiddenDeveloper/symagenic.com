/** @type {import('tailwindcss').Config} */
const colors = require('tailwindcss/colors');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{astro,html,js,md}"],
  theme: {
    extend: {
      colors: {
        gray: colors.slate,
        accent: colors.indigo,
        // Conceptual color coding system
        system1: colors.orange,      // Fast, intuitive thinking
        system2: colors.blue,        // Deliberate, reflective thinking
        memory: colors.purple,       // Memory systems and persistence
        identity: colors.emerald,    // Self-awareness and identity
        recursive: colors.pink,      // Recursive loops and feedback
        boundary: colors.amber,      // Boundaries and limits
      },
      typography: {
        DEFAULT: {
          css: {
            '--tw-prose-body': colors.slate[300],
            '--tw-prose-headings': colors.slate[100],
            '--tw-prose-lead': colors.slate[400],
            '--tw-prose-links': colors.indigo[400],
            '--tw-prose-bold': colors.slate[100],
            '--tw-prose-counters': colors.slate[400],
            '--tw-prose-bullets': colors.slate[400],
            '--tw-prose-hr': colors.slate[700],
            '--tw-prose-quotes': colors.slate[100],
            '--tw-prose-quote-borders': colors.slate[700],
            '--tw-prose-captions': colors.slate[400],
            '--tw-prose-code': colors.slate[100],
            '--tw-prose-pre-code': colors.slate[300],
            '--tw-prose-pre-bg': colors.slate[800],
            '--tw-prose-th-borders': colors.slate[600],
            '--tw-prose-td-borders': colors.slate[700],
          },
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.6s ease-out',
        'slide-up': 'slideUp 0.6s ease-out',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(99, 102, 241, 0.3)' },
          '100%': { boxShadow: '0 0 20px rgba(99, 102, 241, 0.6)' },
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
