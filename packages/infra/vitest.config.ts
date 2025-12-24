import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'infra',
    root: '.',
    include: ['tests/**/*.test.ts'],
  },
});
