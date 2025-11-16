import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test environment - using node for our API tests
    environment: 'node',

    // Test file patterns
    include: ['**/*.{test,spec}.{js,ts}'],
    exclude: ['node_modules', 'dist'],

    // TypeScript support
    globals: true,

    // Coverage settings
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['node_modules/', 'dist/', '**/*.test.ts', '**/*.spec.ts'],
    },
  },
});
