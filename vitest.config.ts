import { fileURLToPath } from 'node:url';
import { defaultExclude, defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    // The database suite lives in tests/db and has its own config
    // (vitest.db.config.ts), so `npm run check` stays runnable without Postgres.
    include: ['tests/**/*.test.ts'],
    exclude: [...defaultExclude, 'tests/db/**'],
  },
});
