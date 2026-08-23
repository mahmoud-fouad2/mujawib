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
    },
  },
})
