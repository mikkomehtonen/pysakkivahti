import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: {
    proxy: {
      '/api': `http://localhost:${process.env.PORT ?? 3000}`,
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
  },
});
