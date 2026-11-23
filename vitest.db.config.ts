import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * The route tests talk to a real Postgres, because the authorization they cover
 * is enforced by queries and row locks. They run one at a time: every test file
 * empties the invitations table, so two workers would see each other's rows.
 *
 * Point DATABASE_URL at a disposable database whose name ends in `_test`; the
 * suite refuses to run anywhere else. See the README for the two commands.
 */
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
  // The app is compiled by Next's automatic JSX runtime, so match it here.
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    include: ['tests/db/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
