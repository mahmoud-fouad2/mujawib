import path from 'node:path'
import { defineConfig } from 'vitest/config'

/**
 * Pure, fast, no I/O. Everything that needs a real database or a live
 * OpenAI/Render environment stays in `scripts/verify-*.ts`, run by
 * `pnpm test:contracts` — a prior decision worth keeping: mocking the
 * database has already once let a broken migration pass tests that hit a
 * fake store instead of a real one. Vitest's job is the other half — logic
 * that has no business touching a network or a database at all.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, '.'),
      /**
       * `server-only` ships a module that throws on import, plus an empty one
       * it serves under React's `react-server` condition. The throw exists to
       * break a *client bundle* that reaches for server code — a bundling
       * concern with no bearing on running a module under Node in a test.
       *
       * Pointing at the package's own empty build is the same substitution
       * React performs, and the same reason `package.json` passes
       * `--conditions=react-server` to the `verify-*` contract scripts. The
       * guard stays exactly where it protects something real: the production
       * build. Without this the whole `server/` tree is untestable, which is
       * how the voice runtime came to have no unit tests at all.
       */
      'server-only': path.resolve(import.meta.dirname, 'node_modules/server-only/empty.js'),
    },
  },
})
