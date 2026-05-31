import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    setupFiles: ['dotenv/config'], // carica apps/server/.env → DATABASE_URL
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false, // i test toccano il DB condiviso: niente parallelismo tra file
  },
});
