import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // I test delle regole condividono lo stesso emulatore: niente parallelismo tra file.
    fileParallelism: false,
    testTimeout: 15000,
  },
});
