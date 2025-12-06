/**
 * tailwind.config.js
 *
 * Tailwind CSS configuration for the client application.
 * Configures content scanning, theme extensions, and plugins.
 */

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      // Custom theme extensions can be added here
    },
  },
  plugins: [
    // Tailwind plugins can be added here
  ],
};
