import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite'

export default defineConfig(({ mode }) => ({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    clearMocks: true,
    env: loadEnv(mode, process.cwd(), '')
  },
}))
